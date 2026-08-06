import "server-only";
import { codeDErreur } from "@/lib/domain/code-erreur";
import { avecDelai } from "@/lib/domain/delai";
import { journaliserExploitation } from "@/lib/safety/rpc-repli";
import { PLAFOND_NOTIFICATION_HEURES } from "@/lib/domain/synthese";
import { creerDepotCanalCourriel, type DepotCanalCourriel } from "@/lib/data/depot-canal-courriel";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import { creerPortCourriel } from "@/lib/courriel/fabrique";
import type { PortCourriel } from "@/lib/courriel/port";
import type { ContexteJob } from "@/lib/ordonnanceur/registre";

/**
 * Story 4.10 (T5, AC3) — LE JOB DE RAPPEL D'ÉCHÉANCE. Le deuxième job du registre à produire un effet
 * visible, et le plus simple des deux : il ne fabrique rien.
 *
 * ── AUCUN APPEL MODÈLE, NULLE PART ────────────────────────────────────────────────────────────────────
 *
 * Ce job lit des dates et réserve un canal. Il ne compose pas de texte, ne consulte aucun modèle, ne fait
 * sortir aucun art. 9. C'est la conséquence directe de la décision D1 (elle écrit les intentions, pas
 * Anam) : il n'y a rien à générer. C'est aussi ce qui lui permet de tenir dans huit secondes.
 *
 * ── OÙ VIVENT LES GARDES ─────────────────────────────────────────────────────────────────────────────
 *
 * Toutes en SQL, dans `rappels_echeance_dus` (0036), et l'AC3 l'exige littéralement :
 *   • AD-17 — aucun rappel pendant un épisode de détresse ni dans les 72 h ;
 *   • premium (FR-081), consentement art. 9 vivant, aucune barrière de minorité ;
 *   • `echeance = AUJOURD'HUI` et jamais `<=`.
 * Un filtre écrit ici en TypeScript s'oublierait au premier appelant suivant ; une clause dans la
 * fonction qui SÉLECTIONNE ne se contourne pas — ce job n'a aucun autre chemin de lecture.
 *
 * ── CE QUI N'EST PAS RATTRAPÉ, DÉLIBÉRÉMENT ──────────────────────────────────────────────────────────
 *
 * Une échéance passée pendant un épisode de détresse n'est PAS reprise ensuite. Un rappel qui arrive
 * avec trois jours de retard est un reproche daté. Et ce choix est STRUCTUREL, pas disciplinaire : il
 * n'existe aucune file où le retard s'accumulerait.
 *
 * ── UN COURRIEL PAR PERSONNE ET PAR JOUR ─────────────────────────────────────────────────────────────
 *
 * La clé d'idempotence est le JOUR CIVIL PARIS, pas l'intention. Deux échéances le même jour ne
 * justifient pas deux courriels — le texte ne dit rien de leur contenu — et envoyer par intention ferait
 * mordre le plafond de famille sur la seconde, qui serait alors perdue.
 */

export const NOM_JOB = "rappel-echeance";

/**
 * Combien de personnes au plus par tick. Le fan-out est séquentiel dans un budget de huit secondes ;
 * chaque personne coûte quatre allers-retours (adresse, jeton, réservation, envoi), soit quelques
 * centaines de millisecondes. Vingt tiendrait à peine ; dix laisse de la marge à une base lente.
 */
export const LOT_PAR_TICK = 10;

/**
 * LE DÉLAI D'UN SEUL ENVOI, borné ICI (revue 4.10).
 *
 * ⚠️ L'adaptateur Resend porte son propre `avecDelai` de 10 s — soit PLUS que le budget entier de ce
 * job (8 s). Le job se serait donc fait tuer par son propre `avecDelai` avant que l'envoi n'ait le
 * droit d'expirer : `job_echoue`, sonde publique en `degrade`, alors que le courriel était peut-être
 * parti. Le budget d'un job ne peut pas être plus court que la plus longue opération qu'il contient.
 *
 * Quatre secondes : assez pour un POST HTTP ordinaire, assez court pour que la réserve ci-dessous tienne
 * dans huit secondes. Un envoi plus lent que ça est de toute façon un envoi qu'il vaut mieux retenter
 * demain — et grâce à `libererNotification`, il SERA retenté.
 */
export const DELAI_ENVOI_MS = 4_000;

/**
 * Ce qu'il faut avoir en réserve pour tenter une personne de plus (patron `RESERVE_PERSONNE_MS` de la
 * synthèse, T3-1). Se faire couper par `avecDelai` clôt le job en `echoue` et lève un `job_echoue` —
 * alors que tout le monde a peut-être été servi. Rendre la main proprement, c'est réussir.
 *
 * Doit couvrir l'ENVOI (borné ci-dessus) plus ses trois allers-retours de base — sans quoi la réserve
 * ne réserve rien et le job se fait couper au milieu d'une personne.
 */
export const RESERVE_PERSONNE_MS = DELAI_ENVOI_MS + 1_500;

export interface DepsRappel {
  readonly canal: DepotCanalCourriel;
  readonly dus: (limite: number) => Promise<{ utilisatriceId: string; jour: string }[]>;
  readonly courriel: PortCourriel;
}

/** Le cœur, testable : toutes les dépendances entrent par la porte (AD-10). */
export async function executerRappelEcheanceAvec(ctx: ContexteJob, deps: DepsRappel): Promise<void> {
  // `estConfigure()` AVANT toute lecture, et l'ordre compte : sans canal, il n'y a rien à faire, et
  // surtout rien à RÉSERVER — consommer le droit d'envoyer sans envoyer bloquerait le plafond de 72 h
  // sur un courriel qui n'est jamais parti.
  if (!deps.courriel.estConfigure()) return;

  const dus = await deps.dus(LOT_PAR_TICK);

  // Le plafond de débit SE DIT (leçon T6-8 de la 4.9). Un lot plein n'est pas encore un problème, mais
  // c'est le seul signal disponible avant que ça en devienne un : au-delà, des rappels du jour sont
  // silencieusement laissés de côté — et comme ils ne sont jamais rattrapés, ils sont perdus.
  if (dus.length >= LOT_PAR_TICK) {
    journaliserExploitation("rappel_lot_sature", { code: `lot_${LOT_PAR_TICK}` });
  }

  let envoyes = 0;
  for (const [rang, { utilisatriceId, jour }] of dus.entries()) {
    if (ctx.echeance.getTime() - Date.now() < RESERVE_PERSONNE_MS) {
      journaliserExploitation("rappel_lot_incomplet", { code: `restantes_${dus.length - rang}` });
      break;
    }
    try {
      // Tout ce qui peut EMPÊCHER l'envoi est connu AVANT de consommer le droit d'envoyer (patron 4.9).
      // ⚠️ CES DEUX SORTIES SE DISENT (revue 4.10). `adresse()` rend `null` aussi bien pour « pas
      // d'adresse » que pour une panne de l'API admin, et `jetonDesabonnement()` pour une panne de
      // base — dans les deux cas le rappel du jour est perdu DÉFINITIVEMENT (rien n'est rattrapé).
      // Le module prend soin de dire le lot saturé et le lot incomplet ; ces chemins-là étaient muets.
      const adresse = await deps.canal.adresse(utilisatriceId);
      if (!adresse) {
        journaliserExploitation("rappel_sans_adresse", { code: "adresse_absente" });
        continue;
      }
      const jeton = await deps.canal.jetonDesabonnement(utilisatriceId);
      if (!jeton) {
        // Un courriel sans porte de sortie ne part pas — mais on ne le perd plus en silence.
        journaliserExploitation("rappel_sans_jeton", { code: "jeton_absent" });
        continue;
      }

      // La réservation précède l'envoi, et elle porte le plafond PAR FAMILLE (D4) : si une synthèse est
      // partie il y a moins de 72 h, ce rappel ne part pas — « une notification d'Anam par 72 heures ».
      const reserve = await deps.canal.reserverNotification(
        utilisatriceId,
        "echeance_intention",
        jour,
        PLAFOND_NOTIFICATION_HEURES,
      );
      if (!reserve) continue;

      try {
        // Borné ICI, plus court que le budget du job (voir `DELAI_ENVOI_MS`).
        await avecDelai(
          deps.courriel.envoyer(adresse, "echeance_intention", jeton),
          DELAI_ENVOI_MS,
          "rappel_envoi_timeout",
        );
        envoyes += 1;
      } catch (e) {
        // ⚠️ ON REND LA RÉSERVATION (revue 4.10). Sans ça, la clé du jour reste occupée alors qu'aucun
        // courriel n'est parti — et comme l'échéance ne repasse JAMAIS (`echeance = aujourd'hui`), ce
        // rendez-vous qu'elle s'était fixé était perdu définitivement, sur un simple hoquet réseau.
        // La libérer rend le rappel retentable au tick suivant, ou à une relance du job le même jour.
        await deps.canal.libererNotification(utilisatriceId, "echeance_intention", jour);
        throw e; // remonte au catch de l'itération : journalisé, et la personne suivante est servie
      }
    } catch (e) {
      // L'échec d'UNE personne n'arrête pas les autres, et il ne passe pas par le canal des incidents
      // de SÉCURITÉ (leçon T6-10) : un 5xx de Resend n'est pas une panne de garde de détresse.
      journaliserExploitation("rappel_courriel", { code: codeDErreur(e) });
    }
  }

  // Rien de plus n'est levé : zéro rappel dû est le cas NORMAL (la plupart des jours, personne n'a
  // d'échéance aujourd'hui). Une alarme sur « aucun envoi » hurlerait tous les jours, et une alarme qui
  // hurle tous les jours est une alarme que personne ne lit.
  if (envoyes > 0) journaliserExploitation("rappel_envoyes", { code: `n_${envoyes}` });
}

/** Ce qu'appelle le registre. Résout les dépendances ; toute la logique est dans le cœur ci-dessus. */
export async function executerRappelEcheance(ctx: ContexteJob): Promise<void> {
  const admin = createSupabaseAdminClient();
  return executerRappelEcheanceAvec(ctx, {
    canal: creerDepotCanalCourriel(),
    courriel: creerPortCourriel(),
    dus: async (limite) => {
      const { data, error } = await admin.rpc("rappels_echeance_dus", { p_limite: limite });
      if (error) throw new Error(`rappels_echeance_dus: ${error.code ?? "echec"}`);
      return (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
        utilisatriceId: r.utilisatrice_id as string,
        jour: r.jour as string,
      }));
    },
  });
}
