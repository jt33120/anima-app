# lib/ai — le port IA gardé (AD-2, AD-3, AD-4, AD-13)

Couche **Ports** de l'architecture en couches à ports gardés. Elle est la **seule** voie par
laquelle l'applicatif parle à un modèle, et le **seul** endroit d'où des données art. 9 sortent.

## Règles non négociables

- **AD-3 — port unique.** L'applicatif ne connaît que `AiPort` (`port.ts`). **Aucun code hors
  `adapters/` n'importe un SDK fournisseur.** Le seul module autorisé à `import … from
  "@mistralai/mistralai"` est `adapters/mistral.ts`. Gardé en CI par `tests/frontiere-serveur.test.ts`.
- **AD-2 — médiée par le serveur.** Le navigateur ne parle jamais à un fournisseur ; tout passe
  par `app/api/**`. **Une seule** clé serveur (`MISTRAL_API_KEY`, secret Vercel, jamais
  `NEXT_PUBLIC_`). Usage métré par utilisatrice dans `usage_ia` (base propre, sans art. 9).
- **AD-4 / AC3 — boot-guard art. 9.** `adapters/mistral.ts` **refuse de démarrer** sur le chemin
  art. 9 sans `MISTRAL_ZDR_CONFIRMED` + `MISTRAL_DPA_SIGNED` + `MISTRAL_PLAN=scale`. Échec dur,
  jamais de dégradation silencieuse ni de bascule direct-US. Endpoints **stateless uniquement**.
- **AD-13 — egress-guard.** `egress-guard.ts` est le point d'egress art. 9 unique : il revérifie,
  au plus près de l'envoi, le **consentement vivant** (`a_consenti_art9()` sous RLS) **ET** le ZDR
  de l'adaptateur lié (`estZdrProuve()`). Une révocation en vol bloque et ne poste rien.

## Fichiers

- `port.ts` — le contrat `AiPort` + les types (`RequeteIa`, `ReponseIa`, `CapaciteIa`, `TierIa`).
- `politique-tier.ts` — résolveur minimal `capacité → tier → modèle` (la politique complète AD-5 = Stories 2.2/2.3).
- `adapters/mistral.ts` — adaptateur Mistral (SDK, stateless-only, boot-guard art. 9).
- `adapters/factice.ts` — adaptateur factice : chemin de dev/CI, aucun réseau, aucune clé.
- `fabrique.ts` — `creerAiPort()` : choisit l'adaptateur selon l'environnement (`AI_ADAPTER`).
- `egress-guard.ts` — le point d'egress art. 9 unique.
- `entetes-art9.ts` — en-têtes `no-store` + CSP stricte des réponses art. 9.

## Portes pré-lancement

- **DPA art. 28 + ZDR Mistral (plan Scale)** avant toute vraie donnée art. 9. Les clés gratuites
  « Experiment » s'entraînent sur les données → **dev/test = données synthétiques uniquement**.
