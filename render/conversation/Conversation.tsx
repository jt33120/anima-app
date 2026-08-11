"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ApparitionAnam, { type Beat } from "./ApparitionAnam";
import Composeur from "./Composeur";
import Fil from "./Fil";
import { useFluxAnam, type MessageEnvoi } from "./useFluxAnam";
import { insererTour } from "./fil-ops";
import { LIGNE_QUOTA_EPUISEE } from "./ligne-quota";
import { REPONSE_REFUS, CONFIRME_NAISSANCE, ECHEC_NAISSANCE } from "./copie-proposition";
import type { Tour, OuvertureData } from "./types";
import s from "./conversation.module.css";

/**
 * Conversation — l'orchestrateur de la VUE conversation (Story 2.2, B2→B5). Rendu de la région
 * `anam` (AD-7 : adaptateur MUET — aucune règle de domaine ici, ni arc, ni sécurité, ni monotonie ;
 * il ne connaît que `fetch` vers `app/api` via `useFluxAnam`). Le cerveau d'Anam (arc 2.7, voix 2.8,
 * sécurité 2.3) vient après : en 2.2, l'échange se démontre via l'adaptateur factice.
 *
 * Tours ÉPHÉMÈRES en session (aucune table de conversation — persistance = Epic 4, AD-8). Le tour
 * de l'utilisatrice s'affiche immédiatement (optimiste) et n'est JAMAIS retiré (même en cas d'échec).
 *
 * `onPreparation` remonte l'état « Anam prépare » au SceneDom → qui épaissit le signe de la
 * surimpression persistante (AC2). Le fil reste muet ; c'est le signe qui porte la préparation.
 */

// Ids stables en session (jamais Math.random/Date au rendu → aucun mismatch d'hydratation).
let compteur = 0;
const nouvelId = () => `t${++compteur}`;

// Registre SYSTÈME (jamais signé Anam) — même texte que le tour en échec, pour l'annonce a11y.
const MESSAGE_ECHEC = "Je n’ai pas pu répondre. Ton message est gardé.";

/**
 * La CLÉ STABLE d'une ouverture — ce qui permet de distinguer « une nouvelle chose à dire » de « la même
 * chose, re-servie par un rafraîchissement ». L'identité de l'objet ne suffirait pas : chaque round-trip
 * RSC en fabrique un neuf.
 */
function cleDOuverture(o?: OuvertureData | null): string | null {
  if (!o) return null;
  // `switch` exhaustif plutôt qu'un ternaire : le ternaire d'origine traitait « tout ce qui n'est
  // pas une invitation » comme une proposition. À l'arrivée d'un troisième type (Story 5.3), il
  // aurait fabriqué la clé `p:undefined` — donc DEUX ouvertures différentes partageant la même
  // clé, donc l'une des deux jamais servie. TypeScript rend maintenant l'oubli impossible.
  switch (o.type) {
    case "invitation":
      return `i:${o.brancheCibleId}`;
    case "proposition":
      return `p:${o.signalId}`;
    case "socle-complete":
      // Une seule mention possible dans la vie d'un compte (0040) : la clé n'a rien à distinguer.
      return "s:socle";
  }
}

/** Le ou les tours à ajouter au fil pour cette ouverture. Vide s'il n'y a rien à ouvrir. */
function toursDOuverture(o?: OuvertureData | null): Tour[] {
  if (!o) return [];
  switch (o.type) {
    case "invitation":
      return [
        {
          id: nouvelId(),
          role: "invitation-integration",
          phrase: o.phrase,
          brancheCibleId: o.brancheCibleId,
        },
      ];
    case "proposition":
      return [
        { id: nouvelId(), role: "proposition-branche", signalId: o.signalId, phrase: o.phrase, etat: "propose" },
      ];
    case "socle-complete":
      // Story 5.3 (AC4) — un TOUR D'ANAM ORDINAIRE, et c'est le point. Pas de rôle dédié, pas de
      // bouton, pas de carte : il n'y a rien à faire de cette phrase. Lui fabriquer une forme
      // propre en ferait un événement — donc une récompense — alors que FR-051 demande « un motif
      // de retour honnête, jamais une carotte ». Elle se lit, et elle s'en va avec le fil.
      return [{ id: nouvelId(), role: "anam", texte: o.phrase, etat: "complet" }];
  }
}

export default function Conversation({
  onPreparation,
  ouverture,
  onAllerVersBranche,
}: {
  onPreparation?: (prepare: boolean) => void;
  /**
   * Story 4.5, arbitrée en 4.10 — ce que le SERVEUR a décidé d'ouvrir : une proposition de branche, une
   * invitation à faire vivre celle qui attend, ou rien. Amorce le fil au montage. Aucun compte n'y figure
   * (AC5 [DUR]) : le rendu ne peut pas afficher un chiffre qu'il n'a pas reçu.
   */
  ouverture?: OuvertureData | null;
  /** L'invitation doit MENER quelque part, sinon c'est un reproche : ceci ouvre la fiche de la branche visée. */
  onAllerVersBranche?: (brancheId: string) => void;
}) {
  // ⚠️ `ouverture` EST RÉACTIVE, et ça n'a rien d'optionnel (revue 4.10, défaut le plus grave trouvé).
  //
  // Cette Conversation reste MONTÉE en permanence (voir `scene-dom.tsx` : la démonter détruisait le fil
  // de la séance en cours). Un initialiseur de `useState` ne s'exécute qu'au montage — jamais ensuite.
  // Or entrer dans la région arbre déclenche `router.refresh()`, qui ré-exécute `app/page.tsx`, donc
  // `chargerOuverture()`, donc — quand le seuil est franchi — `reserverParole()`, QUI ÉCRIT.
  //
  // Le parcours est ordinaire : elle nomme sa 3ᵉ branche, elle clique sur l'onglet arbre. La fenêtre de
  // sept jours était alors CONSOMMÉE, la nouvelle prop arrivait, l'initialiseur ne rejouait pas, et
  // l'invitation n'était JAMAIS affichée. Anam se taisait une semaine de plus au moment précis où elle
  // devait parler — sans trace, sans erreur, sans que rien ne le dise.
  //
  // Le patron employé ici est celui déjà validé pour `projLocale` dans `scene-dom.tsx` (« props-into-state
  // figé — revue 4.6 ») : ajustement d'état PENDANT le rendu, comparé sur une CLÉ STABLE. La clé, et pas
  // l'identité de l'objet : deux rafraîchissements qui rendent la même proposition ne doivent pas
  // l'empiler deux fois dans le fil.
  const cle = cleDOuverture(ouverture);
  const [tours, setTours] = useState<Tour[]>(() => toursDOuverture(ouverture));
  const [clePrec, setClePrec] = useState(cle);
  if (cle !== clePrec) {
    setClePrec(cle);
    const nouveaux = toursDOuverture(ouverture);
    if (nouveaux.length > 0) setTours((prev) => [...prev, ...nouveaux]);
  }
  const [annonce, setAnnonce] = useState("");
  // Allocation résiduelle épuisée (3.4, AC4) : le composeur passe désactivé-visible avec un motif.
  // Persistant pour la session (le fil est éphémère ; le mois se réévalue au prochain chargement réel).
  const [quotaEpuise, setQuotaEpuise] = useState(false);
  const { prepare, enCours, envoyer } = useFluxAnam();

  // Beat « ouverture » monté au démarrage (2.2, AC6) ; « nommer » piloté par l'arc de séance (2.7,
  // via onBeat) ; « cloture » = seam 2.9. Passif : l'apparition ne vole jamais le focus au composeur.
  const [beat, setBeat] = useState<Beat>("ouverture");

  const shell = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLTextAreaElement>(null);
  // Historique envoyé PAR tour d'Anam (id → {messages, jeton}) : « Réessayer » rejoue le BON tour, pas
  // le dernier envoi global (revue 2.2). Le `jeton` est l'identité STABLE du tour logique (3.4, AC1) :
  // réutilisé au retry → le métrage et l'allocation résiduelle ne se recomptent pas. Éphémère en session.
  const envoisParTour = useRef<Map<string, { messages: MessageEnvoi[]; jeton: string }>>(new Map());
  // « Pas maintenant » (3.2, AC5/FR-057) : une SEULE sollicitation par session. Le fil est éphémère
  // (aucune persistance — Epic 4), et la trame `paywall` n'est émise qu'une fois (beat cloture
  // idempotent) → la sollicitation unique est structurellement tenue ; ce verrou est la ceinture
  // (si la trame se re-présentait, aucune ré-insertion). La persistance serveur du refus est différée.
  const abonnementRefuse = useRef(false);

  // Remonte « Anam prépare » au SceneDom (→ signe épaissi). Effet, pas de setState pendant le rendu.
  useEffect(() => {
    onPreparation?.(prepare);
  }, [prepare, onPreparation]);

  // Clavier virtuel mobile (AC8) : `dvh` seul ne suffit pas (Chromium ne rétrécit pas les unités
  // viewport à l'ouverture du clavier). On lit `visualViewport` (resize + scroll) et on expose le
  // décalage en var CSS → le composeur remonte au-dessus du clavier. Repli : rien si absent (dvh).
  useEffect(() => {
    const vv = window.visualViewport;
    const el = shell.current;
    if (!vv || !el) return;
    const maj = () => {
      const decalage = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      el.style.setProperty("--decalage-clavier", `${decalage}px`);
    };
    maj();
    vv.addEventListener("resize", maj);
    vv.addEventListener("scroll", maj);
    return () => {
      vv.removeEventListener("resize", maj);
      vv.removeEventListener("scroll", maj);
    };
  }, []);

  const lancer = useCallback(
    (messages: MessageEnvoi[], jeton: string) => {
      const idAnam = nouvelId();
      // Id du bilan de CE tour (ancre de la carte d'abonnement 3.2). Capturé dans la même clôture que
      // les rappels de flux → `onPaywall` insère la carte sous le bon bilan, sans état partagé.
      let idBilanCourant: string | null = null;
      envoisParTour.current.set(idAnam, { messages, jeton });
      setTours((prev) => [...prev, { id: idAnam, role: "anam", texte: "", etat: "flux" }]);
      setAnnonce("");
      void envoyer(messages, jeton, {
        onMotsReveles: (mots) =>
          setTours((prev) =>
            prev.map((t) =>
              t.id === idAnam && t.role === "anam" ? { ...t, texte: t.texte + mots } : t,
            ),
          ),
        onFin: (complet) => {
          setTours((prev) =>
            prev.map((t) =>
              t.id === idAnam && t.role === "anam" ? { ...t, texte: complet, etat: "complet" } : t,
            ),
          );
          setAnnonce(complet); // annonce a11y UNIQUE (aria-atomic), à la fin — SUCCÈS
        },
        onEchec: () => {
          setTours((prev) =>
            prev.map((t) => (t.id === idAnam && t.role === "anam" ? { ...t, etat: "echec" } : t)),
          );
          setAnnonce(MESSAGE_ECHEC); // l'ÉCHEC aussi est annoncé au lecteur d'écran (revue 2.2)
        },
        // Bloc ressources de détresse (2.6, AC4) : le SERVEUR décide le placement (avant/après le tour
        // d'Anam) ; on insère passivement, sans jamais déplacer le focus (le composeur reste au focus).
        // Ancré à `idAnam` → « Réessayer » les purge ensemble (R2). Annonce POLIE de son arrivée au
        // lecteur d'écran (R3) — sinon le filet de secours est inséré muet pour l'AT.
        onRessources: (position, ressources, verifieLe) => {
          const idRes = nouvelId();
          setTours((prev) =>
            insererTour(prev, idAnam, position, {
              id: idRes,
              role: "ressource",
              ancreId: idAnam,
              ressources,
              verifieLe,
            }),
          );
          setAnnonce("Des ressources d’aide sont affichées.");
        },
        // Beat d'apparition (2.7) : Anam paraît en Présence au moment décidé par l'arc (serveur).
        // Passif — jamais de vol de focus (le composeur reste actif).
        onBeat: (b) => setBeat(b),
        // Bilan de clôture (2.9, AC2) : le SERVEUR a structuré le bilan (titre + points) et l'émet dans
        // le MÊME flux, avant `fin`. Bloc document inséré APRÈS le tour d'Anam, dans le fil (jamais une
        // modale). Passif — ne vole pas le focus (le composeur reste actif). Annonce polie au lecteur d'écran.
        onBilan: (titre, points) => {
          const idBilan = nouvelId();
          idBilanCourant = idBilan; // ancre de POSITION de la carte d'abonnement (3.2)
          setTours((prev) =>
            insererTour(prev, idAnam, "apres", { id: idBilan, role: "bilan", ancreId: idAnam, titre, points }),
          );
          setAnnonce("Le bilan de la séance est affiché.");
        },
        // Proposition d'abonnement (3.2, AC1) : le SERVEUR a décidé de proposer (trame `paywall`,
        // retenue en détresse/premium — AD-9). On insère la carte SOUS le bilan. Passive : ne vole
        // jamais le focus (le composeur reste actif) et ne s'annonce pas (l'annonce du bilan prime ;
        // la carte reste navigable). Ne se réinsère pas si l'utilisatrice a déjà dit « Pas maintenant ».
        onPaywall: () => {
          if (abonnementRefuse.current || !idBilanCourant) return; // refus session, ou pas de bilan-ancre
          const ancre = idBilanCourant;
          const idPaywall = nouvelId();
          // Position : SOUS le bilan (`ancre`). `ancreId: idAnam` = le tour producteur → « Réessayer »
          // purge la carte avec lui (jamais une carte orpheline doublée au rejeu, comme le bloc ressource).
          setTours((prev) => insererTour(prev, ancre, "apres", { id: idPaywall, role: "paywall", ancreId: idAnam }));
        },
        // Allocation résiduelle épuisée (3.4, AC4) : le SERVEUR a coupé (trame `quota`, retenue en
        // détresse/premium — gate serveur). Aucun texte d'Anam ne viendra : on RETIRE le placeholder
        // d'Anam (vide) et on passe le composeur en désactivé-visible. Le message optimiste de
        // l'utilisatrice RESTE. Jamais « Réessayer », jamais « Passe au premium » — le socle reste ouvert.
        onQuota: () => {
          setTours((prev) => prev.filter((t) => t.id !== idAnam));
          setQuotaEpuise(true);
          // Pas de `setAnnonce` ici (revue 3.4, F7) : l'annonce a11y est portée UNIQUEMENT par le
          // `role="status"` du motif dans le Composeur → une seule région live (AC3, jamais une double
          // annonce de la MÊME phrase dans la région du Fil ET dans le motif).
        },
      });
    },
    [envoyer],
  );

  const surEnvoi = useCallback(
    (texte: string) => {
      const histo: MessageEnvoi[] = tours
        // Garde de type : seuls les tours PORTEURS DE TEXTE entrent dans l'historique envoyé. Les blocs
        // `ressource` et `bilan` (2.9, sans `texte`) en sont exclus — par le rôle, pas juste par Exclude.
        .filter(
          (t): t is Extract<Tour, { role: "utilisatrice" | "anam" }> =>
            t.role === "utilisatrice" || (t.role === "anam" && t.etat === "complet"),
        )
        .map((t) => ({ role: t.role === "utilisatrice" ? "user" : "assistant", content: t.texte }));
      setTours((prev) => [...prev, { id: nouvelId(), role: "utilisatrice", texte }]);
      // Nouveau tour LOGIQUE → nouveau jeton stable (3.4, AC1). Dans un handler d'événement (jamais au
      // rendu) → aucun risque de mismatch d'hydratation.
      lancer([...histo, { role: "user", content: texte }], crypto.randomUUID());
    },
    [tours, lancer],
  );

  // « Réessayer » CE tour précis : retire seulement le tour d'Anam en échec `idAnam` (les partiels
  // des AUTRES échecs restent dans le fil — revue 2.2) et rejoue l'historique de CE tour avec le MÊME
  // jeton (Story 3.4, AC1) → même clé d'idempotence serveur → un retry ne recompte ni tokens ni
  // allocation résiduelle (dette du jeton de tour stable close).
  const reessayer = useCallback(
    (idAnam: string) => {
      if (quotaEpuise) return; // ceinture (revue 3.4, F9) : l'échange est clos ce mois — aucun rejeu
      const envoi = envoisParTour.current.get(idAnam);
      if (!envoi) return;
      envoisParTour.current.delete(idAnam);
      // Retire le tour d'Anam ET tout bloc rattaché par `ancreId` (ressources 2.6, bilan + carte 3.2) —
      // sinon un tour de clôture qui échoue APRÈS avoir émis bilan/carte laisserait ceux-ci orphelins, et
      // le rejeu en insérerait un SECOND (double bilan / double paywall — même patron que le double 15/112,
      // revue 2.6 R2 / 3.2).
      setTours((prev) =>
        prev.filter(
          (t) =>
            t.id !== idAnam &&
            !((t.role === "ressource" || t.role === "bilan" || t.role === "paywall") && t.ancreId === idAnam),
        ),
      );
      // MÊME jeton que l'envoi initial (3.4, AC1) : le retry est le MÊME tour logique → le métrage et
      // l'allocation résiduelle ne se recomptent pas (clé d'idempotence serveur stable).
      lancer(envoi.messages, envoi.jeton);
      // Le bouton « Réessayer » vient d'être démonté : redéplacer le focus vers le composeur, jamais
      // le laisser retomber sur <body> (WCAG 2.4.3).
      requestAnimationFrame(() => champRef.current?.focus());
    },
    [lancer, quotaEpuise],
  );

  // « Pas maintenant » (3.2, AC5) : retire la carte, arme le verrou d'unique sollicitation, et
  // redéplace le focus vers le composeur (le bouton retiré ne doit jamais laisser le focus sur <body>,
  // WCAG 2.4.3). L'abonnement reste ensuite atteignable depuis le menu de compte (surface différée).
  const refuserAbonnement = useCallback((id: string) => {
    abonnementRefuse.current = true;
    setTours((prev) => prev.filter((t) => t.id !== id));
    requestAnimationFrame(() => champRef.current?.focus());
  }, []);

  // Story 4.5 — l'état d'un « Nommer » en vol (#12 verrou anti-double-POST ; #3 échec retryable).
  const [nommage, setNommage] = useState<{ id: string; etat: "envoi" | "echec" } | null>(null);

  // Story 4.5 — Oui/Non sur une proposition de branche. « Oui » ouvre le champ de nommage (etat "nomme") ;
  // « Non » écarte le germe (jamais rejoué) et remplace la proposition par « Ok. » (AC4).
  const majEtatProposition = useCallback((id: string, etat: "nomme" | "refuse" | "nee", nom?: string) => {
    setTours((prev) =>
      prev.map((t) => (t.id === id && t.role === "proposition-branche" ? { ...t, etat, nom: nom ?? t.nom } : t)),
    );
  }, []);

  const repondreProposition = useCallback(
    (id: string, signalId: string, oui: boolean) => {
      if (oui) {
        majEtatProposition(id, "nomme");
        return; // le focus est posé sur le champ par PropositionBranche (effet au passage en "nomme").
      }
      majEtatProposition(id, "refuse");
      setAnnonce(REPONSE_REFUS); // a11y : « Ok. » annoncé au lecteur d'écran.
      // #2 (WCAG 2.4.3) : le bouton « Non » vient d'être démonté → redéplacer le focus vers le composeur,
      // jamais le laisser retomber sur <body> (même convention que reessayer / refuserAbonnement).
      requestAnimationFrame(() => champRef.current?.focus());
      // Écriture optimiste : à défaut (réseau/500), le germe reste en attente et pourra être re-proposé (sûr).
      void fetch("/api/anam/branche", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "refus", signalId }),
      }).catch(() => {});
    },
    [majEtatProposition],
  );

  // « Nommer » : crée la branche (le nom donné par elle) puis, à confirmation SERVEUR, la marque née (sobre,
  // sans célébration). #12 : verrou d'envoi (aucun double-POST). #3 : un échec (garde AD-17/consentement/réseau)
  // n'est JAMAIS silencieux — ligne neutre + annonce, le champ reste (elle peut réessayer) ; jamais un faux « née ».
  const nommerBranche = useCallback(
    (id: string, signalId: string, nom: string) => {
      setNommage({ id, etat: "envoi" });
      const echoue = () => {
        setNommage({ id, etat: "echec" });
        setAnnonce(ECHEC_NAISSANCE);
      };
      void fetch("/api/anam/branche", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "creer", signalId, nom }),
      })
        .then((r) => {
          if (!r.ok) return echoue();
          majEtatProposition(id, "nee", nom);
          setNommage(null);
          setAnnonce(CONFIRME_NAISSANCE); // #2 a11y : la naissance est annoncée.
          requestAnimationFrame(() => champRef.current?.focus()); // #2 focus : jamais sur <body>.
        })
        .catch(echoue);
    },
    [majEtatProposition],
  );

  return (
    <div className={s.conversation} ref={shell}>
      <ApparitionAnam beat={beat} />
      <Fil
        tours={tours}
        annonce={annonce}
        onReessayer={reessayer}
        onRefuserAbonnement={refuserAbonnement}
        onRepondreProposition={repondreProposition}
        onNommerBranche={nommerBranche}
        onAllerVersBranche={onAllerVersBranche}
        nommage={nommage}
        quotaEpuise={quotaEpuise}
      />
      <Composeur
        onEnvoyer={surEnvoi}
        occupe={enCours}
        champRef={champRef}
        motifDesactive={quotaEpuise ? LIGNE_QUOTA_EPUISEE : undefined}
      />
    </div>
  );
}
