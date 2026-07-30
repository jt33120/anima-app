-- Migration forward-only — Story 3.4 : marque des tours d'ALLOCATION RÉSIDUELLE sur `usage_ia`.
--
-- `post_premiere_seance` : la ligne PRINCIPALE d'un tour servi APRÈS la clôture de la 1re séance
-- (bilan livré) est marquée `true` → elle compte dans l'allocation résiduelle gratuite mensuelle
-- (FR-079). Les tours de la 1re séance (gratuite, non décomptée, FR-059) et les SOUS-COÛTS `:arc` /
-- `:bilan` (ce ne sont pas des « tours » de conversation) gardent `false`.
--
-- NON-art. 9 : un booléen de PHASE, aucun contenu (jamais prompt/réponse/verbatim). `usage_ia` reste
-- deny-by-default (RLS activée + FORCE, aucune policy) : écrit uniquement côté serveur (service_role) ;
-- une session utilisatrice ne peut ni lire ni forger ce marqueur. RLS/policy INCHANGÉES.
--
-- Le VOLUME alloué n'est PAS en base (paramètre produit lu à l'exécution, SPINE L.151 —
-- `lib/ai/allocation-config`). Ce SQL ne stocke qu'un marqueur, aucune règle, aucun seuil (AD-14).

alter table public.usage_ia
  add column post_premiere_seance boolean not null default false;

comment on column public.usage_ia.post_premiere_seance is
  'Story 3.4 : true = tour d''allocation résiduelle (servi après la clôture de la 1re séance). Compté dans le quota mensuel gratuit (FR-079). NON-art. 9 (booléen de phase, aucun contenu).';
