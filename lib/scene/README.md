# lib/scene — le modèle de scène pur (AD-7)

L'état de la scène vit ici comme **données pures**, testable sans navigateur. Le
**rendu** (`render/`) le consomme et le dessine ; il n'écrit rien ici.

- `regions.ts` — le catalogue des cadrages (`seuil`, `accueil`, `anam`, `arbre`) + les types.
- `vue.ts` — le **view-state** client éphémère (région courante) + la transition (`reducteurVue`), **propriétaire unique** du changement de région.
- `projection.ts` — la **domain-projection** serveur en lecture seule (tronc, branches AD-8). STUB en 1.7 ; l'Epic 4 la remplit depuis l'état persisté.
- `index.ts` — barrel d'exports.

**Interdit** : importer `react`, `next`, ou `render/` (dépendance remontante — AD-7/AD-10).
`eslint.config.mjs` bloque déjà l'import de `render/` ; la garde complète (react/next
inclus) est portée par `tests/scene-architecture.test.ts`.
