-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 0047 — UN FAIT NE S'ANCRE QUE SUR SON PROPRE JOURNAL
-- Revue de code du 2026-08-12 — la garde-dans-la-RPC, retrouvée une QUATRIÈME fois
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── LE DÉFAUT ─────────────────────────────────────────────────────────────────────────────────
--
-- `fusionner_fait_extrait` (0019) refuse d'ancrer un fait sur l'entrée de journal d'une autre : la
-- garde d'appartenance est écrite dans la RPC, et `tests/fait-extrait.test.ts` la prouve.
--
-- La policy `fait_extrait_insertion`, elle, ne demandait que ceci :
--
--     auth.uid() = utilisatrice_id AND a_consenti_art9() AND NOT est_barre_minorite()
--
-- Rien sur `extrait_source_id`. Or `authenticated` a le grant INSERT sur la table : un
-- `POST /rest/v1/fait_extrait` direct, sous son propre jeton, avec l'UUID d'une entrée d'autrui,
-- PASSAIT. Mesuré, sous JWT réel, le 2026-08-12.
--
-- Ses deux voisines portent pourtant la clause depuis toujours — `branche_insertion` et
-- `signal_reconceptualisation_insertion` exigent l'une comme l'autre :
--
--     exists (select 1 from entree_journal e where e.id = <colonne> and e.utilisatrice_id = auth.uid())
--
-- Trois tables, le même besoin, deux gardes. C'est l'oubli qui ne se voit pas.
--
-- ── CE QUE ÇA PERMETTAIT ──────────────────────────────────────────────────────────────────────
--
--   1. UNE PROVENANCE FAUSSE. Un fait de A déclarant venir d'un tour de B. La mémoire à trois
--      couches (AD-8) repose entièrement sur cette chaîne : le fait pointe le moment qui l'a
--      produit. Un pointeur faux corrompt la couche qui sert à Anam de souvenir.
--   2. UN ORACLE D'UUID. La clé étrangère non composite acceptait tout identifiant d'entrée
--      EXISTANT et rejetait les autres (23503). A pouvait donc distinguer « cet UUID est une
--      entrée de journal quelque part » de « il ne l'est pas » — un signal ténu, mais qui porte
--      sur des comptes qui ne sont pas le sien.
--
-- ── POURQUOI LE TEST NE L'A PAS VU, ET C'EST LA LEÇON ─────────────────────────────────────────
--
-- « A ne peut pas ancrer un fait sur le journal de B » appelle `fusionner_fait_extrait`. Il éprouve
-- donc le chemin GARDÉ, et il passe — depuis toujours, à juste titre. Il ne dit rien du chemin
-- direct, qui existe pour toute table du schéma `public`.
--
-- Un test qui éprouve la RPC ne prouve rien sur la table. C'est la troisième fois que cette revue
-- l'écrit, et la quatrième occurrence du même défaut dans ce dépôt.
--
-- ── LA CORRECTION : DEUX COUCHES, ET LA SECONDE REND LA PREMIÈRE INDISPENSABLE ────────────────
--
--   1. LA POLICY reçoit la clause d'appartenance de ses deux voisines — c'est l'harmonisation.
--   2. LA CLÉ ÉTRANGÈRE DEVIENT COMPOSITE, sur `(utilisatrice_id, extrait_source_id)`. C'est le
--      patron déjà employé par `branche_retour_meme_proprietaire` (0026), et il vaut mieux qu'une
--      policy : une policy s'écrit, se relit et s'oublie ; une clé étrangère composite rend
--      l'ancrage croisé STRUCTURELLEMENT impossible, y compris pour `service_role`, y compris pour
--      une future RPC qu'on n'a pas encore écrite.
--
-- On pose les deux. La policy donne un refus lisible (42501) au chemin ordinaire ; la clé étrangère
-- est le mur qui reste debout quand quelqu'un touche à la policy.

-- ── 1. LA POLICY ──────────────────────────────────────────────────────────────────────────────

drop policy fait_extrait_insertion on public.fait_extrait;

create policy fait_extrait_insertion on public.fait_extrait
for insert to authenticated
with check (
  (select auth.uid()) = utilisatrice_id
  and public.a_consenti_art9()
  and not public.est_barre_minorite()
  -- La clause manquante. `extrait_source_id` est NULLABLE (un fait peut naître d'une correction
  -- manuelle, sans moment source) : `is null` reste donc permis. Ce qui devient impossible, c'est
  -- de pointer une entrée qui n'est pas la sienne.
  and (
    extrait_source_id is null
    or exists (
      select 1 from public.entree_journal e
       where e.id = fait_extrait.extrait_source_id
         and e.utilisatrice_id = (select auth.uid())
    )
  )
);

-- ── 2. LA CLÉ ÉTRANGÈRE COMPOSITE ─────────────────────────────────────────────────────────────
--
-- `on delete set null` est CONSERVÉ, et c'est important : effacer une entrée de journal ne doit pas
-- emporter le fait qui en était issu. Le fait perd sa provenance, il ne perd pas son contenu — la
-- mémoire d'Anam survit à l'effacement du verbatim (AD-8).

alter table public.fait_extrait
  drop constraint fait_extrait_extrait_source_id_fkey;

alter table public.fait_extrait
  add constraint fait_extrait_source_meme_proprietaire
  foreign key (utilisatrice_id, extrait_source_id)
  references public.entree_journal (utilisatrice_id, id)
  on delete set null;

comment on constraint fait_extrait_source_meme_proprietaire on public.fait_extrait is
  'Revue du 2026-08-12 : un fait ne s''ancre que sur le journal de SA propriétaire. Clé composite plutôt que policy seule — une policy s''oublie, une clé étrangère rend l''ancrage croisé structurellement impossible. Patron de `branche_retour_meme_proprietaire` (0026).';
