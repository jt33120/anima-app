-- Migration forward-only — Story 1.5 : halte de consentement art. 9 + déclaration IA.
--
-- Table `consentement` : PREUVE horodatée du consentement, 1:1 avec utilisatrice.
--   art9_accorde  : consentement EXPLICITE au traitement des données sensibles (RGPD art. 9).
--   ia_reconnue   : la déclaration « tu parles à une IA » a été reconnue (FR-013 / AI Act art. 50).
--   cgu_acceptees : CGU acceptées + 18 ans confirmé (case DISTINCTE de l'art. 9 — FR-012/NFR-006).
--   revoked_at    : colonne PRÉPARÉE pour la révocation (Story 1.6, AD-13) — non exploitée ici.
--
-- Écriture SOUS la session RLS de l'utilisatrice (auth.uid()), jamais service_role (AD-12).
-- Ce n'est PAS le write-gate art. 9 au niveau base (c'est la Story 1.6) : ici on stocke
-- seulement la preuve de consentement. Aucune table de contenu art. 9 n'existe encore (AD-4/FR-072).

create table public.consentement (
  utilisatrice_id uuid primary key references public.utilisatrice(id) on delete cascade,
  art9_accorde    boolean     not null,
  ia_reconnue     boolean     not null,
  cgu_acceptees   boolean     not null,
  cree_le         timestamptz not null default now(),
  revoked_at      timestamptz
);

alter table public.consentement enable row level security;
alter table public.consentement force  row level security;

-- Owner-only : chaque utilisatrice ne lit et n'écrit que SON consentement.
create policy consentement_proprietaire on public.consentement
  for all
  using (auth.uid() = utilisatrice_id)
  with check (auth.uid() = utilisatrice_id);
