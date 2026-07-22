# Revue — Vérification réelle des versions & faits engagés (ARCHITECTURE-SPINE.md)

- **Cible** : `_bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md`
- **Date de vérification** : 2026-07-22
- **Méthode** : versions lues sur le registre npm officiel (`registry.npmjs.org/<pkg>/latest`, source autoritaire) ; faits de conformité par recherche web.

## Verdict

Les 6 versions épinglées sont **toutes réelles et à jour** (aucune fantaisiste, aucun couple incompatible, Node minimal exact) et les faits Mistral ZDR / Swiss Ephemeris **tiennent** — **sauf deux corrections** : `sweph-wasm` est **AGPL-3.0-or-later** (copyleft réseau), **pas MIT**, et n'est donc **pas** un contournement de la licence pro ; et la « bascule Opus » (fournisseur US) doit être **explicitement exclue du chemin art.9** pour ne pas contredire AD-4.

---

## 1. Versions de la Stack

| Techno | Épinglé dans la spine | Réel (npm `latest`, 2026-07-22) | Verdict | Source |
|---|---|---|---|---|
| Next.js (App Router) | 16.2.x | **16.2.11** | ✅ CONFIRMÉ | registry.npmjs.org/next/latest |
| React | 19.2.x | **19.2.8** | ✅ CONFIRMÉ | registry.npmjs.org/react/latest |
| @supabase/supabase-js | 2.110.x | **2.110.8** | ✅ CONFIRMÉ | registry.npmjs.org/@supabase/supabase-js/latest |
| stripe (node) | 22.3.x | **22.3.2** | ✅ CONFIRMÉ | registry.npmjs.org/stripe/latest |
| @mistralai/mistralai | 2.5.x | **2.5.0** | ✅ CONFIRMÉ | registry.npmjs.org/@mistralai/mistralai/latest |
| TypeScript | 7.0.x | **7.0.2** (GA 2026-07-08) | ✅ CONFIRMÉ (caveat maturité) | registry.npmjs.org/typescript/latest ; https://www.techtimes.com/articles/320049/20260710/typescript-7-now-stable-10-faster-builds-not-vue-svelte-yet.htm |
| Node.js | ≥ 20.9 · cible 22 LTS | Next 16 `engines: node >=20.9.0` | ✅ CONFIRMÉ | registry.npmjs.org/next/latest (champ engines) |

### Cohérence des couples
- **Next 16 + React 19.2** : compatible. Le `peerDependencies` de Next 16.2.11 est `react: "^18.2.0 || ^19.0.0"` → 19.2.8 est dans la plage. ✅
- **Node** : `stripe` exige `node >=18`, `next` exige `node >=20.9.0` → le socle ≥ 20.9 de la spine est le bon minimum (piloté par Next), « vérifié » à raison. ✅
- **TypeScript 7.0.x** : réel et stable, mais **GA seulement le 8 juillet 2026**, ~2 semaines avant la date du doc. Fait exact ; simple caveat de maturité écosystème/outillage (le compilateur Go-natif est neuf ; la remarque publique « Vue/Svelte doivent attendre » ne concerne pas ce projet React). Pas d'erreur de version.

**Conclusion §1 : aucune version fantaisiste, périmée ou incohérente.** Les valeurs correspondent au réel au niveau du patch.

---

## 2. Technos nommées — existence & adéquation

- **Next.js 16 App Router sur Vercel** : ✅ CONFIRMÉ (16.2.11 courant ; Vercel est l'éditeur de Next).
- **Supabase RLS + auth sans mot de passe** : ✅ CONFIRMÉ (fait établi — Supabase Auth magic link/OTP + RLS Postgres ; supabase-js 2.110.8 courant). Non controversé.
- **Stripe abonnement web** : ✅ CONFIRMÉ (Stripe Billing/Subscriptions ; stripe-node 22.3.2 courant).
- **Mistral La Plateforme** : ✅ CONFIRMÉ (endpoints stateless chat/embeddings/OCR/audio ; SDK @mistralai/mistralai 2.5.0). Voir §3 pour la restriction ZDR.

---

## 3. Affirmations de conformité

### Mistral EU / ZDR sur plan Scale — ✅ CONFIRMÉ **avec restriction à documenter**
- ZDR est disponible **uniquement sur le plan Scale** et **uniquement sur les appels stateless** (chat completions, embeddings, moderation, OCR, audio). ✅ conforme au Deferred de la spine.
- **⚠ Restriction non mentionnée dans la spine** : le ZDR **ne s'applique PAS** aux produits *stateful* de Mistral (Agents, Conversations, batch/files, libraries, Le Chat). → Le chemin art.9 doit impérativement passer par les **completions stateless**, jamais par l'API Agents/Conversations de Mistral. La mémoire longue de la spine (AD-8) vivant dans **notre** Postgres, l'archi est compatible — mais il faut l'énoncer comme invariant.
- ZDR **n'est pas automatique** : demande + justification requises ; rétention par défaut 30 j (abuse monitoring). Cohérent avec la « porte pré-lancement » du Deferred.
- Source : https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr ; https://meetily.ai/llm-privacy/mistral

### Prompt caching sous ZDR — ✅ CONFIRMÉ
- Avec le prompt caching actif, les données sont conservées en **mémoire volatile quelques minutes, jamais persistées sur disque** → compatible ZDR.
- Source : https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr

### Exclusion « Fable 5 / Mythos-class » pour données art.9 — ⚠ NON VÉRIFIABLE (absent de la spine) + tension interne réelle
- Les noms « Fable 5 » / « Mythos-class » **n'apparaissent pas** dans ARCHITECTURE-SPINE.md. La seule référence à un modèle non-Mistral est **« bascule Opus »** (AD-3), c.-à-d. un modèle **Anthropic (fournisseur US)**.
- **⚠ Incohérence à réconcilier** : AD-3 autorise « bascule Opus possible sans toucher l'applicatif », or AD-4 interdit « tout intermédiaire US … sur le chemin art.9 ». Anthropic étant US, un fallback Opus **sur données art.9** contredirait AD-4. La spine **ne déclare jamais explicitement** que les modèles US sont exclus du chemin art.9.
- **À corriger** : restreindre la bascule Opus au **hors-art.9**, OU exiger une route Anthropic **UE + ZDR/DPA** (ex. Bedrock région UE) avant tout usage art.9 — et l'écrire dans AD-3/AD-4.

---

## 4. Éphémérides — faits de licence

### Swiss Ephemeris : dual-license AGPL vs licence pro — ✅ CONFIRMÉ (prix à préciser)
- Double licence **AGPL (copyleft réseau : SaaS ⇒ tout le code sous AGPL)** OU **Professional License** (proprio, sans open-source). ✅
- **Prix — à préciser** : la licence Professional « unlimited » est **CHF 700** (paiement unique, valable 99 ans), pas un montant en euros. La spine dit « ~750 € » : ordre de grandeur correct (CHF 700 ≈ €740–745) mais **le chiffre exact/la devise sont CHF 700**.
- Sources : https://www.astro.com/swisseph/swephprice_e.htm ; contrat Professional edition juin 2026 http://www.astro.com/swisseph/secont_e.pdf

### `sweph` (binding Node) — copyleft, pas permissif
- Licence npm déclarée : **`(AGPL-3.0-or-later OR LGPL-3.0-or-later)`**. C'est du **copyleft** (AGPL ou LGPL), **pas** MIT/permissif.
- Source : registry.npmjs.org/sweph/latest (champ `license`)

### `sweph-wasm` — ❌ À CORRIGER (erreur de licence dans la spine)
- Licence npm déclarée : **`AGPL-3.0-or-later`**. C'est une **compilation WebAssembly du Swiss Ephemeris** → **AGPL, PAS MIT**.
- La spine (Deferred) présente « `sweph-wasm` / lib MIT alternative » comme un moyen d'éviter la licence pro (~750 €). **Faux** : sur une SaaS proprio accessible par le réseau, l'AGPL §13 déclenche l'obligation d'**ouvrir tout le code de l'application**. `sweph-wasm` **n'évite donc pas** la licence pro et **n'est pas** une alternative « MIT ».
- **Options réelles** : (a) acheter la **Professional License** (CHF 700), ou (b) une **vraie** lib permissive **distincte** (moteur différent, ex. `astronomy-engine`, MIT) — mais ce n'est **pas** du Swiss Ephemeris (précision/maisons/features différentes ; à valider séparément).
- Source : registry.npmjs.org/sweph-wasm/latest (champ `license`)

---

## Corrections nécessaires (synthèse)

1. **sweph-wasm** : licence = **AGPL-3.0-or-later**, pas MIT ; ce n'est pas un contournement de la licence pro (copyleft réseau AGPL §13 s'applique à une SaaS proprio). Reformuler le Deferred.
2. **Bascule Opus (AD-3)** : Anthropic = fournisseur **US** → contredit AD-4 sur le chemin art.9. Écrire explicitement l'exclusion des modèles US du chemin art.9, ou n'autoriser Opus qu'en route UE+ZDR/DPA.
3. **Mistral ZDR** : ajouter l'invariant « appels **stateless** uniquement » (ZDR exclut Agents/Conversations/batch/libraries/Le Chat).
4. **Prix Swiss Ephemeris** : **CHF 700** (unlimited, 99 ans), pas « ~750 € » (ordre de grandeur ok, devise/chiffre à corriger).
5. **TypeScript 7.0.x** : exact (7.0.2), mais GA le 2026-07-08 → ajouter un caveat de maturité (compilateur Go-natif neuf).

**Aucune** correction requise sur : Next.js 16.2.x, React 19.2.x, @supabase/supabase-js 2.110.x, stripe 22.3.x, @mistralai/mistralai 2.5.x, Node ≥ 20.9, couple Next/React, Supabase passwordless+RLS, Stripe abonnement web, ZDR/plan Scale, prompt caching volatile.
