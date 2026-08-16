-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 0056 — UN TOMBSTONE EST VIDE, ET RIEN D'AUTRE NE L'EST (Story 6.5, AC2/AC3 · AD-18)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── LE TROU, MESURÉ AVANT D'ÉCRIRE CETTE MIGRATION ─────────────────────────────────────────────
--
-- Contre le vrai Postgres, sous une session utilisatrice ordinaire :
--
--     fusionner_fait_extrait('utilisatrice', 'corrige', 'k1', '', null)
--       → erreur : AUCUNE
--       → ligne  : { origine: 'utilisatrice', statut: 'corrige', contenu: '' }
--
-- Cette ligne n'est NI AFFICHABLE NI UN TOMBSTONE : elle a le statut d'une correction et le contenu
-- d'une suppression. Le write-gate art. 9 du trigger (0018) ne la voit pas — il ne se déclenche que
-- sur un contenu NON vide, précisément pour laisser passer la suppression après révocation.
--
-- La conséquence n'est pas théorique : le client peut fabriquer une suppression qui ne dit pas son
-- nom, et contourner ainsi la seule chose que le tombstone doit rendre lisible — CECI A ÉTÉ EFFACÉ.
-- L'écran de la 6.5 n'a alors aucun moyen de distinguer « corrigé en une phrase vide » de « aucune
-- correction » : les deux se ressemblent, et l'une des deux est un effacement.
--
-- ── POURQUOI UNE CONTRAINTE DE TABLE, ET PAS UN TRIGGER NI DU TYPESCRIPT ───────────────────────
--
--   • du TypeScript ne garderait rien : `authenticated` a le droit d'exécuter
--     `fusionner_fait_extrait`, donc de poser directement le couple interdit ;
--   • un trigger tiendrait, mais `fait_extrait_garde_resurrection` est déjà chargé de deux règles
--     (anti-résurrection, write-gate art. 9), et une troisième qui n'a rien à voir en ferait
--     l'endroit où l'on met « les autres vérifications » ;
--   • une contrainte de table s'applique à TOUS les écrivains, `service_role` COMPRIS — que la RLS
--     ne borne pas —, elle est déclarative, et aucun chemin d'écriture futur ne peut la manquer.
--
-- ⚠️ L'ÉQUIVALENCE EST DANS LES DEUX SENS, et c'est ce qui compte. `⇒` seul laisserait passer une
-- suppression qui garde son contenu — un tombstone qui n'a rien effacé, soit exactement l'inverse du
-- défaut ci-dessus, avec des conséquences pires (de l'art. 9 conservé après un geste d'effacement).
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- ── NORMALISER D'ABORD ─────────────────────────────────────────────────────────────────────────
--
-- Une ligne vivante (`actif`/`corrige`) au contenu vide n'affiche rien et ne peut plus rien dire :
-- elle EST déjà un tombstone, sans en porter le nom. On lui donne son nom plutôt que de refuser la
-- contrainte ou de perdre la ligne — la clé de dédoublonnage doit rester occupée, sans quoi la
-- ré-extraction ressusciterait ce que quelqu'un avait fait disparaître (AD-18).
update public.fait_extrait
   set statut = 'supprime', origine = 'utilisatrice', maj_le = now()
 where statut <> 'supprime' and contenu = '';

-- Le cas inverse — un tombstone qui aurait gardé son contenu — ne peut pas exister aujourd'hui (le
-- dépôt vide toujours), mais la contrainte le refuserait sans que rien ne l'ait nettoyé. On vide.
update public.fait_extrait
   set contenu = '', maj_le = now()
 where statut = 'supprime' and contenu <> '';

alter table public.fait_extrait
  add constraint fait_extrait_tombstone_est_vide
  check ((statut = 'supprime') = (contenu = ''));

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- LA LECTURE POSSÉDÉE DE L'ÉCRAN « CE QU'ANAM RETIENT »
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ⚠️ ELLE EXISTE PARCE QU'UNE GARDE A ROUGI, et la garde avait raison. `faits-architecture.test.ts`
-- exige que le littéral `fait_extrait` n'apparaisse NULLE PART dans le code applicatif : tout accès
-- passe par une fonction possédée — `fusionner_fait_extrait` pour l'écriture (4.2),
-- `charger_faits_actifs` pour la lecture du rappel (4.3). Un `.from("fait_extrait")` écrit dans un
-- dépôt de la 6.5 aurait été le troisième chemin, et le premier hors de tout contrôle.
--
-- Ce que la fonction achète, concrètement, sur une table art. 9 :
--   • la FORME de ce qui sort est décidée ici, en un endroit auditable — aucun appelant ne peut
--     écrire `select("*")` et faire descendre la clé de dédoublonnage et tout le reste ;
--   • la jointure vers le journal est EXPLICITE, au lieu de reposer sur l'inférence de relation de
--     PostgREST, qui rend tantôt un objet tantôt un tableau selon ce qu'elle devine du schéma.
--
-- `security invoker`, comme `fusionner_fait_extrait` et pour la même raison : on ne veut PAS
-- contourner la RLS, on veut qu'elle morde AUSSI dedans. Les deux policies propriétaires (0018 pour
-- les faits, 0016 pour le journal) sont donc ce qui garantit l'isolation — y compris sur la
-- jointure, qui ne peut pas ramener le message de quelqu'un d'autre.
--
-- ⚠️ La borne est un ARGUMENT, jamais un littéral (convention AD-14 / SPINE) : elle vit dans
-- `lib/data/lire-memoire.ts`, avec la raison de son choix.
create function public.charger_faits_retenus(p_max integer)
returns table (
  cle          text,
  contenu      text,
  statut       text,
  jour         date,
  source_texte text,
  source_jour  date
)
language sql
stable
security invoker
set search_path = ''
as $$
  select f.cle_dedoublonnage, f.contenu, f.statut, f.maj_le::date, j.contenu, j.cree_le::date
    from public.fait_extrait f
    -- `left join` : un extrait source disparu (le journal a pu être effacé) ne doit pas faire
    -- disparaître le fait — sinon un effacement partiel rendrait invisible ce qui reste à corriger.
    left join public.entree_journal j on j.id = f.extrait_source_id
   where f.statut <> 'supprime'
   order by f.maj_le desc
   limit greatest(p_max, 0);
$$;

revoke all    on function public.charger_faits_retenus(integer) from public, anon;
grant  execute on function public.charger_faits_retenus(integer) to authenticated;

comment on function public.charger_faits_retenus(integer) is
  'Story 6.5 (AC1) : les faits VIVANTS de l''appelante, avec leur date et leur extrait source. security invoker — la RLS de fait_extrait (0018) et celle d''entree_journal (0016) mordent, jointure comprise. Seul chemin de lecture de l''ecran, comme charger_faits_actifs l''est pour le rappel : le littéral de table ne doit apparaitre dans aucun fichier applicatif.';

comment on constraint fait_extrait_tombstone_est_vide on public.fait_extrait is
  'Story 6.5 (AC2/AC3) : un tombstone est vide, et rien d''autre ne l''est. Sans cette equivalence, une correction au contenu vide fabrique une ligne ni affichable ni tombstone — une suppression qui ne dit pas son nom (mesure du 2026-08-16). Contrainte de TABLE et non trigger : elle s''applique aussi a service_role, que la RLS ne borne pas.';
