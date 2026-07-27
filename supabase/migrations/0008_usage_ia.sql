-- Migration forward-only — Story 2.1 : métrage IA (AD-2 ; convention « Métrage & paywall »).
--
-- Table `usage_ia` : compteurs de tokens PAR REQUÊTE LOGIQUE. NON-art. 9 : elle ne porte
-- AUCUN contenu (jamais prompt, réponse, ni verbatim) — seulement tier/modèle/tokens/horodatage.
--
-- Patron `audit_securite` (dény-by-default), PAS `art9_temoin` (write-gate) :
--   RLS activée + FORCE, AUCUNE policy → la table est invisible ET non-inscriptible sous une
--   session utilisatrice. L'usage est SERVER-AUTHORITATIVE : écrit uniquement côté serveur via
--   le client admin (service_role), ce qui est une tâche système autorisée (AD-12) puisque
--   usage_ia n'est pas du contenu art. 9. Une cliente ne peut donc jamais forger ses compteurs.
--
-- Idempotence : index UNIQUE sur `cle_idempotence` → le serveur écrit les tokens EXACTEMENT
--   une fois par requête logique (`insert ... on conflict do nothing`).

create table public.usage_ia (
  id              uuid primary key default gen_random_uuid(),
  utilisatrice_id uuid        not null references public.utilisatrice(id) on delete cascade,
  cle_idempotence text        not null,
  tier            text,
  modele          text,
  tokens_entree   integer     not null default 0,
  tokens_sortie   integer     not null default 0,
  cree_le         timestamptz not null default now()
);

create unique index usage_ia_cle_idempotence_unique on public.usage_ia (cle_idempotence);
create index        usage_ia_utilisatrice_idx       on public.usage_ia (utilisatrice_id);

alter table public.usage_ia enable row level security;
alter table public.usage_ia force  row level security;

-- Aucune policy créée volontairement : deny-by-default (comme `probe`/0001, `audit_securite`/0006).
-- L'écriture passe par le serveur (service_role) ; jamais par le client.

comment on table public.usage_ia is
  'Métrage IA par requête logique (AD-2). NON-art. 9 : aucune colonne de contenu (jamais prompt/réponse/verbatim). Deny-by-default : écrit uniquement côté serveur (service_role), idempotent par cle_idempotence. Une session utilisatrice ne lit ni n''écrit rien.';
