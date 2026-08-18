/*
 * sw.js — LE SERVICE WORKER D'ANAM (Story 6.2).
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 * IL NE FAIT QUE LA POUSSÉE. Aucun gestionnaire `fetch`, aucun cache, aucune stratégie hors-ligne.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Décision D5, et ce n'est pas un choix de confort. Un service worker qui met en cache est la façon la
 * plus fiable de livrer une application que l'utilisatrice ne peut plus mettre à jour : une version
 * périmée reste servie, elle ne peut ni la voir ni la vider, et sur un produit qui porte de l'art. 9,
 * servir un écran de CONSENTEMENT périmé est une faute grave — le texte qu'elle a accepté ne serait
 * plus celui qui s'applique.
 *
 * `tests/poussee-architecture.test.ts` lit ce fichier et casse le build si `addEventListener("fetch"`
 * ou `caches.` y apparaît. La discipline sans garde n'est pas de la discipline.
 *
 * ── L'APERÇU EST CHOISI ICI, PARCE QUE LA POUSSÉE NE PORTE RIEN ────────────────────────────────────
 *
 * Décision D1 : le POST du serveur fait zéro octet (RFC 8030 l'autorise). Le titre et le corps sont
 * donc choisis dans l'ensemble fini ci-dessous, qui doit rester le MIROIR EXACT de
 * `lib/domain/socle-quotidien.ts` — c'est là qu'il est relu, et là que trois détecteurs le passent au
 * crible (prédiction, lexique interdit, lexique d'aperçu). La garde d'architecture compare les deux
 * listes caractère par caractère : sans elle, l'ensemble relu vivrait là-bas et l'ensemble affiché
 * ici, et les deux divergeraient au premier « je corrige juste une virgule ».
 *
 * ⚠️ Ce fichier est du JavaScript nu, servi tel quel depuis `public/`. Il n'est ni compilé, ni typé,
 * ni transformé : ce qui est écrit ici est ce qui s'exécute sur le téléphone.
 */

/* ESLint : `/* eslint-env *\/` n'est plus reconnu par la configuration à plat et devient une ERREUR
   en v10 (averti par la montée 9.18 → 9.39, porte §7). Les globales du contexte service worker sont
   déclarées ici, une par une, plutôt que par un environnement nommé. */
/* global self */

const TITRE_POUSSEE = "Anam";

// MIROIR EXACT de `CORPS_POUSSEE` — voir l'en-tête. Toute modification ici sans la même là-bas
// (et réciproquement) fait rougir `tests/poussee-architecture.test.ts`.
const CORPS_POUSSEE = [
  "Le jour a tourné.",
  "Rien d'urgent, comme toujours.",
  "C'est là, quand tu veux.",
  "Un moment calme est disponible.",
  "Le jour commence, sans hâte.",
  "Rien à faire aujourd'hui non plus.",
  "La journée est ouverte.",
];

/**
 * Le nombre de jours écoulés depuis l'époque, modulo `taille` — miroir d'`indexDuJour`.
 *
 * Compte ABSOLU, et pas un jour de l'année : ce dernier retombe à 0 le 1er janvier, ce qui répète ou
 * saute une ligne chaque année.
 */
function indexDuJour(jour, taille) {
  const [a, m, j] = jour.split("-").map((n) => Number.parseInt(n, 10));
  const jours = Math.floor(Date.UTC(a, m - 1, j) / 86400000);
  return ((jours % taille) + taille) % taille;
}

/** Le jour civil à Paris — le fuseau unique du produit (décision D3). */
function jourParis() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

self.addEventListener("push", (evenement) => {
  // ⚠️ On affiche TOUJOURS quelque chose, même si la poussée est vide ou inattendue. Les navigateurs
  // révoquent l'abonnement d'un service worker qui reçoit une poussée sans afficher de notification
  // (« silent push abuse ») : ne rien montrer, c'est perdre le canal en silence.
  const corps = CORPS_POUSSEE[indexDuJour(jourParis(), CORPS_POUSSEE.length)];
  evenement.waitUntil(
    self.registration.showNotification(TITRE_POUSSEE, {
      body: corps,
      // `tag` fixe : une nouvelle manifestation REMPLACE la précédente au lieu de s'empiler. Un
      // produit qui n'exige rien n'accumule pas de pastilles non lues (AC3).
      tag: "socle-quotidien",
      renotify: false,
      requireInteraction: false,
      icon: "/marque/icone-192.png",
      badge: "/marque/icone-192.png",
      // Aucun `data`, aucune `actions` : rien d'autre à transporter, donc aucun endroit où le
      // transporter. Même stratégie que la signature du port (NFR-015).
    }),
  );
});

self.addEventListener("notificationclick", (evenement) => {
  evenement.notification.close();
  // On RÉUTILISE une fenêtre déjà ouverte plutôt que d'en empiler une nouvelle à chaque jour. Le
  // socle n'a pas de destination propre : il ouvre l'accueil, où il vit de toute façon (AC4).
  evenement.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      for (const fenetre of fenetres) {
        if ("focus" in fenetre) return fenetre.focus();
      }
      return self.clients.openWindow("/");
    }),
  );
});

// Prend la main sans attendre la fermeture de tous les onglets. Sans cela, une correction du texte
// d'aperçu resterait invisible pendant des jours — et comme il n'y a aucun cache, il n'y a aucun
// risque à activer vite : rien d'ancien ne survit à ce remplacement.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evenement) => evenement.waitUntil(self.clients.claim()));
