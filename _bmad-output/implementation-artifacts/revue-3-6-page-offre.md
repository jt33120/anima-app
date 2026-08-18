# Revue de code — Story 3.6 « La page d'offre »

**Date** : 2026-08-18 · **Périmètre** : la seule surface du produit qui demande de l'argent.

---

## Méthode

Quatre angles indépendants (argent, garde, loi, régression), 16 candidates, dédoublonnage,
puis un **avocat de la défense** par candidate retenue. Une épreuve et la synthèse sont mortes en vol
(plafond de dépense mensuel) ; la candidate concernée a été vérifiée à la main — et elle était réelle.

Cadrage : `/abonnement` porte **deux régimes opposés**. La SORTIE n'est jamais gardée (garder =
empêcher quelqu'un en crise de résilier) ; l'OFFRE l'est toujours (FR-043). Trois des quatre angles
ont convergé, indépendamment, sur le même point.

---

## R1 — On vendait un second abonnement par-dessus un contrat qui court · CRITIQUE

`app/abonnement/page.tsx:188` · garde jumelle `app/api/stripe/checkout/route.ts:89`

`etatDepuisStatutStripe` projette `expire` **par défaut** : `past_due`, `unpaid`, `incomplete` et
`paused` y tombent tous — ce sont les contrats que Stripe relance et finira par encaisser. La garde
anti-double-souscription ne testait que `etat === "actif"`.

Tant qu'aucune surface ne vendait dans cet état, l'écart était théorique. **La 3.6 y a installé le
bouton.** Une carte refusée au renouvellement suffisait pour lire, dans le même document :

> « Ton abonnement n'est plus actif. » · « Résilier mon abonnement » · « 69 € / par an — M'abonner »

Au clic : nouveau Customer, seconde souscription vivante, 69 € débités. Puis, la projection étant
une-ligne-par-utilisatrice, le premier événement postérieur de l'ancienne souscription reprend la
ligne — et « Résilier » ne sait plus viser que le contrat mort. **Elle paie 69 €/an pour un abonnement
qu'aucune surface du produit ne peut plus désigner** (FR-060, loi du 16 août 2022).

**Ni l'état ni l'identifiant ne savent trancher** : un abonnement résilié GARDE son
`stripe_subscription_id` (refuser dessus bannirait à vie quiconque a résilié une fois), et `expire`
confond `past_due` (vivant) avec `incomplete_expired` (mort).

**Posé** : la route interroge Stripe — la seule autorité — et seulement quand il y a un identifiant à
interroger. Le prédicat est une liste de **refus** (`canceled`, `incomplete_expired`) et non
d'autorisation : un statut que Stripe inventera sera tenu pour vivant, et un test le prouve. Une
panne de Stripe fait REFUSER.

**Dette nommée** : le produit n'a **aucune surface de mise à jour de carte** (aucun portail de
facturation Stripe dans le dépôt). « Résilier puis reprendre » est le seul chemin honnête, et il coûte
à celle qui voulait simplement changer de carte.

## R2 — `RECONDUCTION` était hors du scanner zéro-dark-pattern · CRITIQUE

La seule chaîne neuve de la story — celle à enjeu **légal** (art. L215-1) — était la seule absente du
tableau `COPIE` que lit le scanner.

**Mesuré** : la remplacer par *« Dépêche-toi : l'offre expire dans 3 h, plus que 2 places. 99 € au
lieu de 149 €. — Anam »* laissait les **4613 tests verts**. Quatre marqueurs interdits sur quatorze,
plus une signature d'Anam sur un registre système. Le mutant meurt maintenant sur six assertions.

## R3 — Le refus était un JSON brut · MOYENNE

Ce POST vient d'un `<form>` sans JavaScript : le corps machine **remplaçait la page**. La SORTIE
(`resilier`) rendait déjà un retour humain sur son chemin d'échec ; l'ENTRÉE n'en avait aucun.

**Posé** : redirection vers `/abonnement?etat=contrat_ouvert`, et la phrase porte le **chemin**
(résilier le contrat coincé, puis reprendre) et non le seul refus. Un refus sans issue est une
impasse — l'impasse qu'on reprochait à l'écran d'origine.

## R4 — Le resserrage M22 n'avait été appliqué qu'à une des deux surfaces de vente · MOYENNE

`carte-abonnement.test.ts` exigeait des noms NUS, que la ligne d'import satisfait seule. La carte du
fil pouvait devenir muette sur la reconduction **au vert**. Il y a deux surfaces qui demandent
l'argent ; une garde qui n'en couvre qu'une n'en couvre aucune.

---

## Ce qui a été RÉFUTÉ

**« L'offre se monte sur l'horloge ÉTROITE : on vend pendant les 72 h où l'on refuse encore de laisser
naître une branche. »**

La prémisse est fausse. FR-042 (les branches) porte les 72 h ; FR-043 (le commerce) ne les porte pas,
et l'AC de la garde commerciale clave explicitement l'horloge étroite. AD-17 veut **une seule horloge
par concern**, et `limites-commerciales.ts` écrit l'avertissement noir sur blanc depuis la 2.5. La
seule pièce à charge était un commentaire imprécis dans `projection.ts`.

L'asymétrie se justifie aussi par la nature des gestes : une branche est **irréversible** et devient
une description permanente de soi ; l'abonnement est réversible **sur la surface même** (la garantie
FR-089 y est affichée, la résiliation trois clics est délibérément non gardée).

---

## Conséquence hors code

⚠️ **La porte Stripe passe BLOQUANTE.** Les clés de TEST sont en production, et le chemin vers
Checkout vient de s'ouvrir à tous.
