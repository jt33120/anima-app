import "server-only";
import { codeDErreur } from "@/lib/domain/code-erreur";
import { journaliserExploitation } from "@/lib/safety/rpc-repli";
import { PALIER } from "@/lib/domain/ordonnanceur-budget";
import { palierHonoreLHeure } from "@/lib/domain/socle-quotidien";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import { creerDepotPoussee, type DepotPoussee } from "@/lib/data/depot-poussee";
// AD-17 : la même source que `synthese.ts` et `rappel-echeance.ts` (revue Epic 6, R3).
import { creneauDiurneOuvert } from "@/lib/domain/regime-anam";
import { creerPortPoussee } from "@/lib/poussee/fabrique";
import { DELAI_POUSSEE_MS } from "@/lib/poussee/adaptateurs/web-push";
import type { PortPoussee } from "@/lib/poussee/port";
import type { ContexteJob } from "@/lib/ordonnanceur/registre";

/**
 * Story 6.2 (T5, AC2/AC3/AC8) — LE JOB DU SOCLE QUOTIDIEN. Quatrième pensionnaire du registre, et le
 * premier qui ne parte PAS aujourd'hui.
 *
 * ── IL EST INERTE SUR LE PALIER COURANT, ET C'EST LA STORY ───────────────────────────────────────────
 *
 * L'AC2 exige une notification **à l'heure choisie par l'utilisatrice**. Le palier `hobby` autorise UN
 * déclenchement par jour, à ±59 minutes (`TICKS_MAX_PAR_JOUR`, `DERIVE_PLANIFICATION_MS`, mesurés en
 * 6.1/6.1a). Une cadence quotidienne ne peut honorer qu'une heure sur vingt-quatre, et la dérive
 * déplace même celle-là d'une heure civile à l'autre : la notification de 8 h partirait à 8 h 58 un
 * jour, à 6 h 04 le lendemain.
 *
 * Le repli est donc le REFUS, et pas « à peu près 8 h ». C'est AD-15 au littéral : le repli produit
 * moins d'effet, jamais plus. Une notification à une heure au hasard serait un effet de PLUS.
 *
 * La garde vit dans le domaine (`palierHonoreLHeure`), pas dans une condition écrite ici : une
 * condition d'ici serait invisible à la CI et s'oublierait au premier refactor.
 *
 * ── LE PLAFOND DE DÉBIT EST RÉEL, ET IL SE DIT ───────────────────────────────────────────────────────
 *
 * `LOT_PAR_TICK` personnes par tick, et le socle n'a qu'un tick par heure : le produit sert donc au
 * plus **vingt personnes à huit heures du matin**. Ce n'est pas un problème aujourd'hui et c'en sera un
 * — et le jour venu, le remède n'est pas de monter ce nombre (le budget du tick ne suit pas) mais de
 * pousser par LOTS, ce qui est une story.
 *
 * En attendant, deux choses évitent que ça se dégrade en silence : le lot saturé est journalisé, et la
 * sélection TOURNE (hachage dépendant du jour, 0053) — au-delà du lot, ce ne sont pas toujours les
 * mêmes qui sont servies, contrairement à un `order by utilisatrice_id`.
 */

export const NOM_JOB = "socle-quotidien";

/**
 * Le plafond de FAMILLE du socle : vingt heures.
 *
 * ⚠️ **Et surtout pas vingt-quatre.** À 24 h, deux manifestations à la même heure deux jours de suite
 * sont séparées d'exactement la borne — et la moindre dérive du côté court fait refuser la seconde.
 * C'est la faute de l'homme mort à 48 h (revue 4.8, défaut n°9), transposée : une comparaison posée
 * PILE sur un multiple de la cadence se joue sur du hasard de planification.
 *
 * Vingt heures laisse quatre heures de battement à un rythme quotidien, et interdit toujours ce qu'il
 * faut interdire : deux manifestations le même jour parce qu'elle a déplacé son heure de 22 h à 8 h.
 * Ce cas-là échappe à la clé d'idempotence (deux jours civils différents) et n'est arrêté que par ici.
 */
export const PLAFOND_SOCLE_HEURES = 20;

/**
 * Combien de personnes au plus par tick. Chaque personne coûte trois allers-retours (appareils,
 * réservation, et le POST lui-même) plus un POST par appareil supplémentaire.
 */
export const LOT_PAR_TICK = 20;

/** Le budget du job entier, déclaré au registre. Voir le calcul de la chaîne dans `registre.ts`. */
export const DELAI_JOB_SOCLE_MS = 10_000;

/**
 * Ce qu'il faut avoir en réserve pour tenter une personne de plus (patron `RESERVE_ENVOI_MS`, 4.10).
 * Se faire couper par `avecDelai` clôt le job en `echoue` et lève un `job_echoue` — alors que tout le
 * monde a peut-être été servi. Rendre la main proprement, c'est réussir.
 *
 * Doit couvrir le POST (borné dans l'adaptateur) plus ses deux allers-retours de base.
 */
export const RESERVE_PERSONNE_POUSSEE_MS = DELAI_POUSSEE_MS + 2_400;

export interface DepsSocle {
  readonly depot: DepotPoussee;
  readonly dues: (limite: number) => Promise<{ utilisatriceId: string; jour: string }[]>;
  readonly poussee: PortPoussee;
}

/** Le cœur, testable : toutes les dépendances entrent par la porte (AD-10). */
export async function executerSocleQuotidienAvec(ctx: ContexteJob, deps: DepsSocle): Promise<void> {
  // ── LE REFUS DE PALIER, AVANT TOUTE LECTURE (AC8) ──────────────────────────────────────────────────
  // Avant `estConfigure`, avant la sélection : on ne consulte même pas la base pour une heure qu'on
  // sait ne pas pouvoir honorer. Et ça se DIT, une fois par tick — c'est le rappel, en production,
  // que le mécanisme livré attend le palier.
  if (!palierHonoreLHeure()) {
    journaliserExploitation("socle_palier_incapable", { code: PALIER });
    return;
  }

  // ── LE CRÉNEAU DIURNE, QUI MANQUAIT ICI ET NULLE PART AILLEURS (revue Epic 6, R3 · AD-17) ─────────
  //
  // ⚠️ **CE JOB ÉTAIT LE SEUL DES TROIS À NE PAS LE POSER, ET LE SEUL À ALLUMER UN ÉCRAN VERROUILLÉ.**
  //
  // `synthese.ts` et `rappel-echeance.ts` appellent `creneauDiurneOuvert(ctx.instant)` avant d'émettre.
  // Celui-ci lisait l'heure choisie et poussait. La 6.3 a bien posé le créneau « avant toute
  // réservation dans `notifier()` » — mais le socle ne passe pas par `notifier()` : il appelle
  // `reveiller()` sur le port de poussée. La garde n'a donc jamais couvert le canal le plus intrusif.
  //
  // Le défaut DORMAIT : sur `hobby`, `palierHonoreLHeure()` refuse juste au-dessus et rien n'est jamais
  // émis. Il se serait réveillé au passage en `pro` — c'est-à-dire le jour où personne ne relit ce
  // fichier. Quelqu'un qui avait choisi 2 h aurait été réveillée à 2 h.
  //
  // Placé APRÈS le refus de palier et AVANT `estConfigure` : on ne consulte pas la base, on ne réserve
  // rien, on ne consomme aucun droit de pousser. Un tick nocturne est un non-événement, pas un échec.
  if (!creneauDiurneOuvert(ctx.instant)) return;

  // `estConfigure()` AVANT toute lecture, et l'ordre compte : sans clés VAPID, il n'y a rien à faire et
  // surtout rien à RÉSERVER — consommer le droit de pousser sans pousser ferait perdre la journée.
  if (!deps.poussee.estConfigure()) return;

  const dues = await deps.dues(LOT_PAR_TICK);
  if (dues.length >= LOT_PAR_TICK) {
    // Le plafond de débit SE DIT (leçon T6-8 de la 4.9). Au-delà, des manifestations du jour sont
    // laissées de côté — et comme rien n'est jamais rattrapé, elles sont perdues.
    journaliserExploitation("socle_lot_sature", { code: `lot_${LOT_PAR_TICK}` });
  }

  let servies = 0;
  for (const [rang, { utilisatriceId, jour }] of dues.entries()) {
    if (ctx.echeance.getTime() - Date.now() < RESERVE_PERSONNE_POUSSEE_MS) {
      journaliserExploitation("socle_lot_incomplet", { code: `restantes_${dues.length - rang}` });
      break;
    }
    try {
      // Tout ce qui peut EMPÊCHER la poussée est connu AVANT de consommer le droit de pousser
      // (patron 4.9/4.10). Ici : ses appareils. Elle a pu se désabonner entre la sélection et
      // maintenant — la course est courte mais réelle, et réserver pour rien lui coûterait sa journée.
      const appareils = await deps.depot.endpoints(utilisatriceId);
      if (appareils.length === 0) {
        journaliserExploitation("socle_sans_appareil", { code: "desabonnee_entre_temps" });
        continue;
      }

      const reserve = await deps.depot.reserverPoussee(
        utilisatriceId,
        "socle_quotidien",
        jour,
        PLAFOND_SOCLE_HEURES,
      );
      if (!reserve) continue;

      let atteints = 0;
      for (const appareil of appareils) {
        // La même réserve, appliquée aux appareils d'une seule personne : un téléphone, une tablette
        // et un ordinateur, ce sont trois POST, et le troisième ne doit pas déborder sur la personne
        // suivante. Elle a déjà été atteinte sur au moins un appareil : c'est ce qui compte.
        if (ctx.echeance.getTime() - Date.now() < DELAI_POUSSEE_MS) {
          journaliserExploitation("socle_appareils_incomplets", { code: `n_${appareils.length}` });
          break;
        }
        const verdict = await deps.poussee.reveiller(appareil, "socle_quotidien");
        if (verdict === "poussee") atteints += 1;
        // ⚠️ `endpoint_mort` SEULEMENT — jamais sur `refuse`. Un 503 passager désabonnerait quelqu'un
        // sans qu'elle l'ait demandé et sans qu'elle le sache : la notification cesserait d'arriver.
        else if (verdict === "endpoint_mort") await deps.depot.oublierEndpoint(appareil.endpoint);
      }

      if (atteints === 0) {
        // ⚠️ ON REND LA RÉSERVATION. Le bénéfice de retente est mince (la sélection exige `heure =
        // heure courante`, donc elle ne repassera qu'à un rejeu du tick dans la même heure) mais le
        // bénéfice d'HONNÊTETÉ est entier : `notification_envoyee` est une table d'AUDIT, et y laisser
        // une ligne alors que rien n'est parti, c'est y écrire un fait faux.
        await deps.depot.libererPoussee(utilisatriceId, "socle_quotidien", jour);
        journaliserExploitation("socle_aucun_appareil_atteint", { code: `n_${appareils.length}` });
        continue;
      }
      servies += 1;
    } catch (e) {
      // L'échec d'UNE personne n'arrête pas les autres, et il ne passe pas par le canal des incidents
      // de SÉCURITÉ (leçon T6-10) : un 5xx d'un service de poussée n'est pas une panne de garde de
      // détresse.
      journaliserExploitation("socle_poussee", { code: codeDErreur(e) });
    }
  }

  // Rien n'est levé sur zéro : la plupart des heures, personne n'a choisi celle-là. Une alarme sur
  // « aucune poussée » hurlerait vingt-trois fois par jour, et une alarme qui hurle est une alarme
  // que personne ne lit.
  if (servies > 0) journaliserExploitation("socle_poussees", { code: `n_${servies}` });
}

/** Ce qu'appelle le registre. Résout les dépendances ; toute la logique est dans le cœur ci-dessus. */
export async function executerSocleQuotidien(ctx: ContexteJob): Promise<void> {
  const admin = createSupabaseAdminClient();
  return executerSocleQuotidienAvec(ctx, {
    depot: creerDepotPoussee(),
    poussee: creerPortPoussee(),
    dues: async (limite) => {
      const { data, error } = await admin.rpc("socle_quotidien_du", { p_limite: limite });
      if (error) throw new Error(`socle_quotidien_du: ${error.code ?? "echec"}`);
      return (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
        utilisatriceId: r.utilisatrice_id as string,
        jour: r.jour as string,
      }));
    },
  });
}
