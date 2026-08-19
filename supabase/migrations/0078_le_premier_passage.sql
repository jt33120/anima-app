-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 0078 — LE PREMIER PASSAGE (QA visuelle du 2026-08-19, H4)
--
-- Le constat, écrit tel quel : « Pas de passage "je viens de m'inscrire" → "je sais quoi faire". »
-- Après le code, la date de naissance et les deux cases de l'article 9, on arrive au seuil, qui dit
-- une phrase et ouvre une porte. Derrière : une pile de cartes et trois noms dans une barre. Rien
-- n'a jamais dit ce qu'est Anam, ce qu'est l'arbre, ni par quoi commencer.
--
-- ── CE QUE CETTE MIGRATION AJOUTE, ET RIEN DE PLUS ────────────────────────────────────────────
--
-- Une DATE : celle du premier franchissement du seuil. Le texte d'orientation se dit tant qu'elle
-- est nulle, et jamais après. C'est tout le mécanisme — il n'y a ni étape, ni compteur d'étapes, ni
-- « tutoriel vu à 3/5 ». Un tutoriel qu'on peut abandonner au milieu est un tutoriel qu'il faut
-- reprendre au milieu, et cet état-là se périme au premier changement de copie.
--
-- ⚠️ LA MARQUE SE POSE QUAND ON FRANCHIT, PAS QUAND ON REND. C'est exactement la leçon de la 0045 :
-- `socle_complete_annonce_le` se dépensait dans `app/page.tsx`, y compris quand la phrase vivait
-- dans une région `inert` que personne ne voyait — une seule chance dans la vie d'un compte,
-- consommée par un rendu. Ici la marque est posée par le GESTE (le bouton du seuil), pas par le
-- rendu du seuil : quelqu'un qui ouvre l'application et referme l'onglet retrouvera son texte.
--
-- ⚠️ AUCUNE GARDE DE DÉTRESSE (AD-17), ET C'EST DÉLIBÉRÉ. AD-17 interdit qu'une annonce se
-- SUPERPOSE à un épisode ; 0045 s'en gardait à raison, car sa mention arrive sans avoir été
-- demandée, par-dessus ce qui est à l'écran. Ce texte-ci n'arrive par-dessus rien : il EST le seuil,
-- il est là avant qu'on entre, et le retirer à quelqu'un en détresse reviendrait à la faire entrer
-- dans un lieu qu'on ne lui a pas présenté. La porte de secours, elle, est au-dessus du seuil comme
-- partout ailleurs (FR-077).
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

alter table public.utilisatrice
  add column if not exists seuil_franchi_le timestamptz;

comment on column public.utilisatrice.seuil_franchi_le is
  'Story H4 : date du PREMIER franchissement du seuil. Nulle = le texte d''orientation est encore dû. Posée par le geste (le bouton), jamais par un rendu. Monotone : aucun grant UPDATE à `authenticated`, seule `marquer_seuil_franchi()` l''écrit.';

-- ── LA LECTURE ────────────────────────────────────────────────────────────────────────────────
-- ⚠️ LE GRANT DE LECTURE EST NÉCESSAIRE ET IL EST EXPLICITE. Sur `utilisatrice`, `authenticated` ne
-- détient AUCUN privilège de table : tout est accordé colonne par colonne (mesuré). Une colonne
-- neuve n'hérite donc de rien — ce qui est la bonne valeur par défaut, et ce qui oblige à écrire
-- ici, noir sur blanc, ce que la session a le droit de voir.
grant select (seuil_franchi_le) on public.utilisatrice to authenticated;

-- ⚠️ ET AUCUN GRANT D'ÉCRITURE. C'est LÀ que vit la garde, pas dans la Server Action : la policy
-- `utilisatrice_proprietaire` est en `ALL` avec `WITH CHECK (auth.uid() = id)`, donc si la colonne
-- recevait un `grant update`, n'importe qui pourrait la remettre à `null` depuis un POST direct sur
-- `/rest/v1/` et se re-servir le texte à volonté. Ce n'est pas une faille de sécurité — c'est une
-- promesse produit (« le seuil ne se lève qu'une fois ») rendue tenable. Même raisonnement que le
-- revoke de `socle_complete_annonce_le`, éprouvé par `tests/gardes-dans-la-policy.test.ts`.

-- ── L'ÉCRITURE ────────────────────────────────────────────────────────────────────────────────

create or replace function public.marquer_seuil_franchi()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_lignes integer;
begin
  if v_uid is null then return false; end if;

  -- Deux onglets ouverts au même instant ne posent qu'une date. Sel PROPRE : 4909 (notifications),
  -- 4910 (invitation), 4911 (annonce du socle), 3500 et 0 sont pris.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 4912));

  -- `is null` dans le WHERE : la date du PREMIER passage, jamais celle du dernier. Sans lui, chaque
  -- franchissement réécrirait `now()` et la colonne cesserait de dire ce que son nom promet.
  update public.utilisatrice u
     set seuil_franchi_le = now()
   where u.id = v_uid
     and u.seuil_franchi_le is null;

  get diagnostics v_lignes = row_count;
  return v_lignes > 0;
end;
$$;

revoke execute on function public.marquer_seuil_franchi() from public, anon;
grant  execute on function public.marquer_seuil_franchi() to authenticated;

comment on function public.marquer_seuil_franchi() is
  'Story H4 : pose la date du premier franchissement du seuil, une fois pour toutes. Rend `true` si elle vient d''être posée, `false` si elle l''était déjà (ou sans session). Idempotente et sans effet de bord au second appel.';
