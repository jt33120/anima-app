-- Migration forward-only — revue des Epics 1 à 4 (trouvaille #9) : `consentement.cree_le`
-- antidatable À L'INSERTION.
--
-- ══ LE DÉFAUT ═══════════════════════════════════════════════════════════════════════════════════
--
-- 0041 a gelé `cree_le` par trigger, et son commentaire dit exactement pourquoi :
--
--     « La date de consentement est la PREUVE de licéité art. 9. Elle protège le responsable de
--       traitement ; qu'elle soit antidatable par le sujet la vide de toute valeur probante. »
--
-- Ce trigger est armé `before UPDATE`. À l'INSERTION, rien ne regarde la colonne : la policy
-- `consentement_insertion` vérifie la propriétaire, le consentement et la majorité — jamais
-- l'horodatage. `authenticated` détient l'INSERT sur la table ; un `POST /rest/v1/consentement`
-- portant `cree_le: '2019-01-01'` passe, et la preuve naît déjà fausse.
--
-- La moitié de la garde couvrait la réécriture. L'autre moitié — la naissance — était ouverte.
-- C'est le patron déjà vu trois fois ici : la garde est posée sur la transition qu'on avait en tête,
-- pas sur toutes celles qui écrivent la colonne.
--
-- ══ LE CORRECTIF ════════════════════════════════════════════════════════════════════════════════
--
-- Un trigger `before insert` qui IMPOSE `now()`, plutôt qu'un `raise` sur valeur fournie. Deux
-- raisons : cette date appartient au serveur, pas à l'appelant — il n'existe aucun cas légitime où
-- un client la choisisse ; et lever ferait échouer un `insert` par ailleurs valide sur une colonne
-- que l'application n'envoie jamais, transformant une garde en panne.
--
-- ⚠️ IL MORD AUSSI `service_role`, comme l'immuabilité d'`entree_journal` (0016). Un horodatage de
-- consentement qu'un chemin système pourrait choisir n'aurait pas plus de valeur probante qu'un
-- horodatage que le sujet choisit : c'est le RESPONSABLE DE TRAITEMENT que cette date protège, et
-- il est des deux côtés de la clé de service.

create or replace function public.consentement_horodatage_serveur()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  new.cree_le := now();
  return new;
end;
$$;

create trigger consentement_horodatage_serveur
  before insert on public.consentement
  for each row execute function public.consentement_horodatage_serveur();

revoke execute on function public.consentement_horodatage_serveur() from public, anon, authenticated;

comment on function public.consentement_horodatage_serveur() is
  'Revue Epics 1-4 : `cree_le` est la preuve horodatée de licéité art. 9 (RGPD art. 7-1). 0041 l''avait gelée en UPDATE seulement — elle restait choisie librement à l''INSERT, où `authenticated` a le privilège. Le serveur l''impose désormais, service_role compris.';
