-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 0032 — `btrim` ne fait pas ce que son nom laisse croire
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Trouvé en écrivant le test qui manquait à la contrainte (revue 4.9, lot C) — pas par relecture.
--
-- `btrim(texte)` sans second argument ne retire que les ESPACES. Pas les retours à la ligne, pas les
-- tabulations. Donc `length(btrim(E'\n\n')) = 2`, et la contrainte `synthese_contenu_non_vide` laissait
-- passer un contenu fait uniquement de blancs.
--
-- Ce n'est pas exploitable aujourd'hui : `validerSortieSynthese` utilise le `.trim()` de JavaScript, qui
-- lui traite tous les blancs, et refuse en amont. Mais cette contrainte est le DERNIER filet — celui qui
-- doit tenir le jour où un futur chemin d'écriture contourne la validation du domaine, ce qui est
-- exactement le scénario pour lequel on écrit des contraintes. Une garde qui promet plus qu'elle ne tient
-- est pire qu'une garde absente : on cesse de regarder derrière elle.
--
-- Le cas concret : un modèle qui répond deux retours à la ligne. La synthèse s'écrit, le courriel part,
-- et elle ouvre `/synthese` pour y trouver une page vide présentée comme le récit de sa semaine.

alter table public.synthese drop constraint synthese_contenu_non_vide;
alter table public.synthese add constraint synthese_contenu_non_vide
  check (length(btrim(contenu, E' \t\n\r')) > 0);
