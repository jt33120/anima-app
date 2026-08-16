"use client";

import { useState, useTransition } from "react";
import { debase64url } from "@/lib/poussee/base64url";
import s from "./reglages.module.css";

/**
 * L'ÎLOT CLIENT DES RÉGLAGES (Story 6.2, AC4).
 *
 * ── LA PERMISSION SE DEMANDE UNE FOIS, À LA DEMANDE ─────────────────────────────────────────────────
 *
 * ⚠️ Aucun appel à `Notification.requestPermission()` au montage, dans un `useEffect`, ni derrière un
 * quelconque « au bon moment ». **Uniquement dans le gestionnaire d'un clic sur un bouton qui dit ce
 * qu'il fait.** C'est l'AC4 au littéral (« une seule fois, en contexte, depuis les réglages, sans
 * bannière insistante ») et c'est aussi la seule façon dont les navigateurs l'acceptent encore sans
 * pénaliser le site.
 *
 * Le corollaire est que le REFUS est définitif côté navigateur : on ne peut plus redemander. La copie
 * le dit et n'en reparle plus — insister serait de toute façon impossible.
 *
 * ── LES QUATRE ÉTATS QUI NE SONT PAS DES ERREURS ───────────────────────────────────────────────────
 *
 *   • le navigateur ne sait pas pousser (Safari iOS hors écran d'accueil) ;
 *   • elle a refusé — définitif ;
 *   • elle n'a pas répondu (`default`) — PAS définitif, et c'est toute la différence ;
 *   • le palier ne met pas encore le mécanisme en service.
 *
 * Aucun des quatre n'est une panne, et aucun n'empêche quoi que ce soit : le socle vit dans
 * l'application, et c'est là qu'il a toujours vécu (AC4, dégradation propre).
 *
 * ── LA COPIE ENTRE PAR LA PORTE ────────────────────────────────────────────────────────────────────
 *
 * ⚠️ Aucun texte n'est écrit dans ce fichier, et aucun import de `lib/domain` : `render/` est un
 * ADAPTATEUR MUET (AD-7), gardé par `tests/arc-architecture.test.ts` et `tests/scene-architecture.test.ts`.
 * La copie vit dans `lib/domain/copie-reglages.ts`, où les détecteurs la passent au crible, et la page
 * la lui passe — exactement comme `/ancrages` le fait pour `copie-ancrage`.
 */

/** La copie, telle que la page la fournit. Aucun défaut : un texte manquant doit se voir. */
export interface CopieReglages {
  readonly section: string;
  readonly description: string;
  readonly activer: string;
  readonly desactiver: string;
  readonly labelHeure: string;
  readonly etatActif: string;
  readonly etatInactif: string;
  readonly permissionRefusee: string;
  readonly permissionSansReponse: string;
  readonly indisponible: string;
  readonly echec: string;
  readonly pasEncoreActif: string;
}

export interface ProprietesReglages {
  readonly copie: CopieReglages;
  readonly clePublique: string | null;
  readonly abonneIci: boolean;
  readonly heure: number;
  /** Le palier met-il réellement le rythme en service ? Faux ⇒ on le DIT, on ne le cache pas. */
  readonly enService: boolean;
  readonly abonner: (endpoint: string, p256dh: string, auth: string) => Promise<{ statut: string }>;
  readonly desabonner: (endpoint: string) => Promise<{ statut: string }>;
  readonly choisirHeure: (heure: number) => Promise<{ statut: string }>;
}

type Etat = "pret" | "indisponible" | "refuse" | "sansReponse" | "echec";

export default function Reglages(p: ProprietesReglages) {
  const [abonne, setAbonne] = useState(p.abonneIci);
  const [heure, setHeure] = useState(p.heure);
  const [etat, setEtat] = useState<Etat>("pret");
  const [enCours, demarrer] = useTransition();

  async function activer() {
    // Le test de capacité AVANT la demande de permission : demander une permission qu'on ne pourra pas
    // utiliser produirait une boîte de dialogue système pour rien, et un refus définitif en prime.
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window) ||
      !p.clePublique
    ) {
      setEtat("indisponible");
      return;
    }
    const permission = await Notification.requestPermission();
    // ⚠️ `default` VEUT DIRE « ELLE N'A PAS RÉPONDU », PAS « ELLE A REFUSÉ » (QA tour 1, en creusant
    // T11). La boîte de dialogue fermée d'un clic à côté rend `default` — et le code rendait alors le
    // texte du refus, qui renvoie aux réglages du navigateur. On lui apprenait qu'il n'y avait plus
    // rien à faire, là où un second appui sur le même bouton aurait marché. Les deux états divergent
    // donc ici, et pas seulement dans la copie : `denied` est définitif, `default` ne l'est pas.
    if (permission === "default") {
      setEtat("sansReponse");
      return;
    }
    if (permission !== "granted") {
      setEtat("refuse");
      return;
    }
    try {
      const enregistrement = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const abonnement = await enregistrement.pushManager.subscribe({
        // `userVisibleOnly` obligatoire : le navigateur exige la promesse qu'une notification sera
        // AFFICHÉE à chaque poussée. C'est aussi ce que le service worker tient — voir `sw.js`.
        userVisibleOnly: true,
        applicationServerKey: debase64url(p.clePublique),
      });
      const brut = abonnement.toJSON() as { endpoint?: string; keys?: Record<string, string> };
      if (!brut.endpoint || !brut.keys?.p256dh || !brut.keys?.auth) {
        setEtat("echec");
        return;
      }
      const issue = await p.abonner(brut.endpoint, brut.keys.p256dh, brut.keys.auth);
      if (issue.statut !== "ok") {
        // ⚠️ ON DÉFAIT L'ABONNEMENT DU NAVIGATEUR. Sans ça, le navigateur se croit abonné et la base
        // ne le sait pas : elle ne recevrait jamais rien, et le bouton lui proposerait de s'abonner à
        // nouveau — sur un endpoint que le navigateur rendrait identique, donc en boucle.
        await abonnement.unsubscribe();
        setEtat("echec");
        return;
      }
      setAbonne(true);
      setEtat("pret");
    } catch {
      setEtat("echec");
    }
  }

  async function retirer() {
    try {
      const enregistrement = await navigator.serviceWorker.getRegistration();
      const abonnement = await enregistrement?.pushManager.getSubscription();
      if (abonnement) {
        await p.desabonner(abonnement.endpoint);
        await abonnement.unsubscribe();
      }
      setAbonne(false);
      setEtat("pret");
    } catch {
      setEtat("echec");
    }
  }

  return (
    <section className={s.section} aria-labelledby="titre-socle">
      <h2 id="titre-socle" className={s.titre}>
        {p.copie.section}
      </h2>
      <p className={s.description}>{p.copie.description}</p>

      <p className={s.etat} data-testid="etat-abonnement">
        {abonne ? p.copie.etatActif : p.copie.etatInactif}
      </p>

      <div className={s.actions}>
        <button
          type="button"
          className={s.bouton}
          disabled={enCours}
          onClick={() => demarrer(() => void (abonne ? retirer() : activer()))}
        >
          {abonne ? p.copie.desactiver : p.copie.activer}
        </button>
      </div>

      <label className={s.champHeure}>
        <span>{p.copie.labelHeure}</span>
        <select
          className={s.select}
          value={heure}
          disabled={enCours}
          onChange={(e) => {
            const choix = Number(e.target.value);
            setHeure(choix);
            demarrer(() => void p.choisirHeure(choix));
          }}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, "0")} h
            </option>
          ))}
        </select>
      </label>

      {/* `role="status"` : le changement d'état est annoncé sans voler le focus. */}
      <p className={s.message} role="status" data-testid="message-reglages">
        {etat === "indisponible" && p.copie.indisponible}
        {etat === "refuse" && p.copie.permissionRefusee}
        {etat === "sansReponse" && p.copie.permissionSansReponse}
        {etat === "echec" && p.copie.echec}
        {etat === "pret" && !p.enService && p.copie.pasEncoreActif}
      </p>
    </section>
  );
}
