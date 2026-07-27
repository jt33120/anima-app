-- Migration forward-only — Story 2.3 : l'audit de détresse SANS art. 9 (FR-078, AD-16, AD-5).
--
-- Étend `audit_securite` (0006) — le MÊME registre d'audit sans art. 9 — pour porter la trace
-- complète du SPINE (Opérations L241) : « niveau, décision, tier, horodatage ». Rappel : la table
-- est deny-by-default (RLS activée + FORCE, AUCUNE policy), alimentée UNIQUEMENT par une fonction
-- security definer réservée au service_role. Elle ne porte JAMAIS de contenu (prompt/réponse/verbatim).
--
-- Différence avec 'minorite' (0006) : une classification de détresse émet UNE ligne PAR TOUR classé
-- (mesure du rappel et des FAUX NÉGATIFS, FR-078), là où la minorité était UNE décision par compte.
-- Les nouvelles colonnes sont NULLABLES → les lignes 'minorite' existantes restent valides.

-- CHECK nullable-tolérants : les lignes 'minorite' (0006) gardent niveau/tier null → `is null or …`.
-- Défense en profondeur (au-delà du typage TS de l'appelant) : l'intégrité de l'audit de sécurité,
-- base de la mesure du rappel (FR-078), et l'invariant AD-5 « détection toujours au fort » tiennent
-- aussi au niveau DONNÉE — un futur appelant / une régression ne peut pas écrire niveau=99 ou tier='leger'.
alter table public.audit_securite
  add column niveau          int  check (niveau is null or niveau between 0 and 3),  -- 0-3 ; null pour 'minorite'
  add column tier            text check (tier   is null or tier = 'fort'),           -- 'fort' (AD-5) ; null pour 'minorite'
  add column cle_idempotence text;   -- idempotence PAR TOUR (comme usage_ia) ; null pour 'minorite'

comment on column public.audit_securite.niveau is
  'Story 2.3 : niveau de détresse classé (0-3). SANS art. 9 — un ENTIER, jamais le contenu du message.';
comment on column public.audit_securite.tier is
  'Story 2.3 : tier du modèle de détection. Toujours ''fort'' (AD-5) — la détection n''est jamais au léger.';
comment on column public.audit_securite.cle_idempotence is
  'Story 2.3 : idempotence PAR TOUR (clé serveur, bornée par utilisatrice). La dédup d''un RETOUR client (même tour rejoué) exige un jeton stable côté client — déféré, cf. usage_ia / deferred-work.md.';

-- Idempotence 'detresse' BORNÉE PAR UTILISATRICE (revue 2.1 : jamais un index global — sinon une
-- cliente annulerait l'audit d'une autre en réutilisant sa clé). Index PARTIEL → n'affecte pas les
-- lignes 'minorite' (qui gardent leur propre unique index `where type = 'minorite'`, cle_idempotence null).
create unique index audit_securite_detresse_idempotence_unique
  on public.audit_securite (utilisatrice_id, cle_idempotence) where (type = 'detresse');

-- Écriture SYSTÈME (une DÉCISION DE SÉCURITÉ, pas du contenu utilisateur — AD-12) → security definer,
-- réservée au service_role, jamais un insert client. Idempotente par (utilisatrice, clé) : un même
-- tour classé (retry serveur) n'ajoute qu'UNE ligne. search_path verrouillé (comme 0005/0006).
create or replace function public.journaliser_audit_detresse(
  cible uuid, p_niveau int, p_decision text, p_tier text, p_cle text
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_securite (utilisatrice_id, type, decision, niveau, tier, cle_idempotence)
  values (cible, 'detresse', p_decision, p_niveau, p_tier, p_cle)
  on conflict (utilisatrice_id, cle_idempotence) where (type = 'detresse') do nothing;
$$;

-- Jamais exécutable par une cliente (ni anon) : une décision de sécurité sur un compte.
revoke all on function public.journaliser_audit_detresse(uuid, int, text, text, text) from public, anon, authenticated;
grant execute on function public.journaliser_audit_detresse(uuid, int, text, text, text) to service_role;
