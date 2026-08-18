-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 0063 — L'HYPOTHÈSE EST GARDÉE À LA PAROLE, PAS SEULEMENT À LA SEMENCE
--        (revue Epic 5, R4 · Story 5.5 · AD-17, FR-042/FR-043)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── LE DÉFAUT ──────────────────────────────────────────────────────────────────────────────────
--
-- `branche_bloquee_par_detresse()` n'apparaît QU'UNE FOIS dans 0049 : dans le `with check` de
-- `enneagramme_hypothese_depot`, c'est-à-dire à l'INSERTION. La base interdit donc de SEMER un
-- germe pendant un épisode de détresse ou dans les 72 h qui suivent — et n'interdit rien du tout
-- quant au fait de le DIRE.
--
-- Or l'en-tête de 0049 justifie sa garde par la PAROLE, pas par l'écriture : « proposer une
-- typologie de personnalité à quelqu'un en détresse est la définition du mauvais moment ». C'est
-- exact, et c'est précisément ce que la garde ne couvrait pas.
--
-- ── LE PARCOURS, SANS RIEN DE PARTICULIER ──────────────────────────────────────────────────────
--
--   Lundi 22 h, tour calme. Le pipeline sème un germe : `statut='en_attente'`, `dite_le is null`.
--   L'insertion passe ses deux gardes AD-17 : il n'y a pas d'épisode.
--
--   Mardi 19 h, un message classe niveau 2. L'épisode s'ouvre.
--
--   Mardi 19 h 05, elle recharge l'application. `chargerOuverture` appelle
--   `lireHypotheseEnneagramme(..., {seulementADire:true})` — un `select` sur trois colonnes, sans
--   le moindre prédicat de détresse. Anam ouvre le fil en lui proposant un type d'ennéagramme.
--
--   ⚠️ ET LA PAROLE EST DÉPENSÉE. Le client pose `dite_le` dès que la région est active : le germe
--   ne reviendra JAMAIS à un moment calme. Le défaut ne se contente pas de parler au pire moment,
--   il consomme au pire moment ce qui était dû à un moment juste.
--
-- Le germe est PERSISTANT PAR CONCEPTION — « l'hypothèse reste en_attente en base : elle repart au
-- prochain chargement ». La fenêtre n'a donc rien de théorique : le germe ATTEND qu'elle revienne,
-- et un épisode de détresse est exactement le moment où l'on revient.
--
-- ── POURQUOI LA GARDE VIT ICI, ET PAS DANS LE TYPESCRIPT ───────────────────────────────────────
--
-- Le jumeau exact de cette ouverture le fait déjà, et depuis la 4.5 : `charger_proposition_branche`
-- (0021:243) porte `and not public.branche_bloquee_par_detresse()` SUR LA LECTURE. Les deux germes
-- ont la même forme (posé à froid, dit plus tard, dépensé à la parole) et la même règle. Écrire
-- cette règle une seconde fois en TypeScript serait fabriquer la divergence que la revue Epic 6 a
-- payée sur `fait_extrait.statut` : deux lectures d'une même règle, à deux endroits, qui finissent
-- par ne plus dire la même chose.
--
-- Ici la définition de « en détresse » est la LARGE — épisode ouvert OU 72 h — parce que la règle
-- qui gouverne ce geste est FR-042 (rien ne NAÎT d'un moment de détresse), la même que la branche,
-- et non FR-043 (le commerce n'interrompt pas). Une seule horloge par concern (AD-17), et celle-ci
-- est déjà écrite dans `branche_bloquee_par_detresse()`.
--
-- ── CE QUI N'EST PAS GARDÉ, ET C'EST UNE DÉCISION ──────────────────────────────────────────────
--
-- ⚠️ `lireHypotheseEnneagramme` GARDE SON CHEMIN DIRECT, et `/enneagramme` continue de l'appeler
-- sans aucune garde. La distinction est la même qu'en 3.5 sur la résiliation : ce qui est refusé,
-- c'est qu'ANAM LUI PARLE d'elle-même au mauvais moment. Une page qu'elle a ouverte DÉLIBÉRÉMENT
-- pour y lire son propre résultat n'est pas Anam qui parle — la lui fermer serait lui retirer ses
-- données pendant une crise, ce que ni l'art. 15 ni le bon sens n'autorisent.
--
-- Une RPC pour le chemin qui PARLE, la lecture directe pour le chemin qu'elle OUVRE.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- Copie conforme de `charger_proposition_branche` (0021) : `security invoker` → la RLS propriétaire
-- de `enneagramme_hypothese` mord, et la fonction n'a AUCUN paramètre d'identité — il n'y a rien à
-- forger. `stable` : elle n'écrit rien, la dépense vit dans `marquer_hypothese_dite`.
create function public.charger_hypothese_a_dire()
returns table (id uuid, type smallint)
language sql
stable
security invoker
set search_path = ''
as $$
  select h.id, h.type
  from public.enneagramme_hypothese h
  where h.utilisatrice_id = (select auth.uid())
    and h.statut = 'en_attente'
    and h.dite_le is null
    -- ⚠️ LA LIGNE DE CETTE MIGRATION. Rien n'est proposé pendant un épisode ni dans les 72 h
    -- (FR-042, AD-17) — même source unique que la branche, jamais une seconde dérivation.
    and not public.branche_bloquee_par_detresse()
  -- La plus ANCIENNE d'abord : c'est l'ordre de l'index partiel `enneagramme_hypothese_due` (0049),
  -- et un `limit` sans `order` rendrait une ligne arbitraire — donc une hypothèse différente d'un
  -- chargement à l'autre.
  order by h.cree_le asc
  limit 1;
$$;

revoke execute on function public.charger_hypothese_a_dire() from public, anon;
grant  execute on function public.charger_hypothese_a_dire() to authenticated;

comment on function public.charger_hypothese_a_dire() is
  'Story 5.5 (AC2), corrigee par la revue Epic 5 (R4) : le germe d''hypothese DU A LA PAROLE — le plus ancien en attente, jamais dit, HORS fenetre de detresse (episode ouvert ou 72 h, FR-042/AD-17). 0049 ne gardait que la SEMENCE (with check de enneagramme_hypothese_depot) : un germe seme a froid etait donc prononce en pleine crise, et DEPENSE — jamais redit a un moment calme. Meme patron et meme predicat que charger_proposition_branche (0021), dont le germe a exactement la meme forme. security invoker (RLS proprietaire), aucun parametre d''identite. NE REMPLACE PAS la lecture directe de /enneagramme : une page qu''elle ouvre elle-meme pour lire son propre resultat n''est pas Anam qui parle, et la lui fermer en crise lui retirerait ses donnees (art. 15).';
