-- Migration forward-only — Story 4.6, correctifs de la RE-REVUE ADVERSARIALE (2026-08-04).
--
-- UN SEUL SUJET : la classe des caractères SANS GLYPHE, mesurée trop étroite.
--
-- La re-revue a testé la classe de 0023 caractère par caractère contre la base, puis a fait NAÎTRE
-- 9 branches réelles dont le nom est entièrement invisible — sous JWT, à travers la policy, le CHECK et
-- le trigger. Passaient encore : les SÉLECTEURS DE VARIATION U+FE00–U+FE0F (dont U+FE0F, présent dans
-- presque tout copier-coller d'emoji), U+034F, U+061C, U+17B4–U+17B5, les FVS mongols, U+FFA0, les
-- annotations U+FFF9–U+FFFB, le formatage musical et les TAGS U+E0000–U+E01EF.
--
-- Ce que voyait l'utilisatrice : une branche sur son arbre dont le nom n'affiche RIEN, que le lecteur
-- d'écran annonce « Branche : » suivi de rien, et qu'elle ne peut pas distinguer des autres. Le repli
-- « sans nom » du rendu ne se déclenchait même pas, `.trim()` de JavaScript ne retirant pas U+FE0F.
--
-- Pas de `[:graph:]` ni `[:print:]` : mesuré en base, ils classent U+FE0F, U+034F, U+17B4, U+180B et
-- U+2800 comme « graphiques », et leur verdict dépend du ctype de l'instance (en_US.UTF-8 en local, non
-- garanti en cloud). On ÉNUMÈRE, donc, et la même énumération est reprise à l'identique côté application
-- (`lib/domain/branche.ts` et `render/nom-branche.ts`) — leçon R1-bis : une garde plus faible d'un côté
-- que de l'autre EST un contournement. Une garde de test verrouille l'équivalence des trois copies.

-- ── (1) La garde : « ce nom contient-il au moins un caractère qui s'affiche ? » ────────────────────────
create or replace function public.branche_nom_significatif(p_nom text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_nom ~ E'[^[:space:]\u00a0\u00ad\u034f\u061c\u115f-\u1160\u1680\u17b4-\u17b5\u180b-\u180f\u2000-\u200f\u2028-\u2029\u202f\u205f\u2060-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff9-\ufffb\U0001d173-\U0001d17a\U000e0000-\U000e01ef]';
$$;

-- `create or replace` ne revalide PAS les lignes existantes : on répare celles nées sous l'ancienne classe.
update public.branche set nom = '(sans nom)' where not public.branche_nom_significatif(nom);

-- ── (2) Le ROGNAGE, aligné sur la garde (mêmes caractères, sans le `^`) ───────────────────────────────
-- `btrim` prend un JEU de caractères sans plages : d'où le double `regexp_replace`.
create or replace function public.branche_rogner_nom(p_nom text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
           regexp_replace(p_nom, E'^[[:space:]\u00a0\u00ad\u034f\u061c\u115f-\u1160\u1680\u17b4-\u17b5\u180b-\u180f\u2000-\u200f\u2028-\u2029\u202f\u205f\u2060-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff9-\ufffb\U0001d173-\U0001d17a\U000e0000-\U000e01ef]+', ''),
           E'[[:space:]\u00a0\u00ad\u034f\u061c\u115f-\u1160\u1680\u17b4-\u17b5\u180b-\u180f\u2000-\u200f\u2028-\u2029\u202f\u205f\u2060-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff9-\ufffb\U0001d173-\U0001d17a\U000e0000-\U000e01ef]+$', '');
$$;

comment on function public.branche_rogner_nom(text) is
  'Story 4.6 (re-revue) : rognage des caractères SANS GLYPHE, STRICTEMENT aligné sur branche_nom_significatif. Extrait en fonction propre pour que naissance et renommage ne puissent plus diverger.';

-- ── (3) `renommer_branche` utilise le rognage partagé ─────────────────────────────────────────────────
create or replace function public.renommer_branche(p_branche_id uuid, p_nouveau_nom text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_touchees int;
begin
  if p_nouveau_nom is null or not public.branche_nom_significatif(p_nouveau_nom) then
    raise exception 'branche : un nom donné par l''utilisatrice ne peut pas être vide (AC2, Story 4.6)';
  end if;
  update public.branche
     set nom = public.branche_rogner_nom(p_nouveau_nom)
   where id = p_branche_id and utilisatrice_id = (select auth.uid());
  get diagnostics v_touchees = row_count;
  if v_touchees = 0 then
    raise exception 'branche : branche introuvable ou non possédée (isolation, Story 4.6)';
  end if;
end;
$$;

-- ── (4) La NAISSANCE rogne comme le RENOMMAGE (fin d'une divergence silencieuse) ──────────────────────
-- Trouvé par la re-revue : la naissance (0021) faisait `btrim(p_nom, E' \t\n\r ')` — quatre caractères —
-- tandis que le renommage rognait toute la classe. Conséquence observable : un nom collé avec une queue
-- invisible était STOCKÉ tel quel à la naissance, puis se retrouvait rogné au premier renommage. Le nom
-- changeait tout seul, sans qu'elle ait rien tapé de différent — sur l'objet le plus personnel de l'app.
create or replace function public.creer_branche_depuis_signal(p_signal_id uuid, p_nom text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entree uuid;
begin
  if public.branche_bloquee_par_detresse() then
    raise exception 'branche : aucune branche ne naît pendant un épisode de détresse ni dans les 72 h (AD-17, Story 4.5)';
  end if;

  select entree_journal_id into v_entree
    from public.signal_reconceptualisation
   where id = p_signal_id
     and utilisatrice_id = (select auth.uid())
     and statut = 'en_attente'
   for update;
  if v_entree is null then
    raise exception 'branche : signal introuvable, non possédé, ou déjà traité (isolation/anti-rejeu, Story 4.5)';
  end if;

  if p_nom is null or not public.branche_nom_significatif(p_nom) then
    raise exception 'branche : une branche sans nom donné par l''utilisatrice n''existe pas (AC2, Story 4.5)';
  end if;

  insert into public.branche (utilisatrice_id, extrait_source_id, nom, etat)
  values ((select auth.uid()), v_entree, public.branche_rogner_nom(p_nom), 'naissance')
  on conflict (utilisatrice_id, extrait_source_id) do nothing;

  update public.signal_reconceptualisation
     set statut = 'consomme'
   where id = p_signal_id and statut = 'en_attente';
end;
$$;
revoke execute on function public.creer_branche_depuis_signal(uuid, text) from public, anon;
grant  execute on function public.creer_branche_depuis_signal(uuid, text) to authenticated;
