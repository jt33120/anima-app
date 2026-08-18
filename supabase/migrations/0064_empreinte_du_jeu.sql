-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 0064 — LE JOURNAL DE TIRAGE DIT DE QUEL JEU IL PARLE (revue Epic 5, R5 · Story 5.7/5.10 · AD-11)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── LE DÉFAUT ──────────────────────────────────────────────────────────────────────────────────
--
-- 0050 journalise `taille_jeu` et affirme, dans le commentaire de la colonne : « Quatre octets
-- journalisés rendent l'audit définitif ». C'est vrai de la BORNE du modulo, et faux du reste.
--
-- Rejouer une ligne demande DEUX choses : la borne, ET la liste ORDONNÉE des cartes.
-- `rejouer(graine, borne)` rend un INDICE — et un indice ne désigne une carte que dans un jeu donné.
--
-- La 5.10 a déjà fait mentir cette phrase. Elle a retiré six cartes prises AU MILIEU de la liste
-- (`fontaine` était 3ᵉ, `nid` 7ᵉ, `metier-a-tisser` 10ᵉ, `orage` 15ᵉ, `corde` 20ᵉ, `puits` 24ᵉ) et en
-- a ajouté trois. Une ligne écrite sous la 5.7 avec `taille_jeu = 24`, rejouée contre le jeu
-- courant, rend un indice qui pointe sur une AUTRE carte — ou sur rien du tout au-delà de 20. Une
-- carte fausse, rendue avec assurance, sur toutes les lignes antérieures : exactement la panne que
-- le commentaire prétendait avoir rendue impossible.
--
-- ⚠️ ET CE N'EST PAS DERRIÈRE NOUS. `lib/tirage/jeu.ts` annonce lui-même que si Anima refuse la
-- carte `seuil` — qui est de NOTRE main et figure dans les arbitrages à lui soumettre — « le jeu
-- tombe à vingt et rien d'autre ne bouge ». Toutes les lignes écrites d'ici là deviendraient
-- illisibles de la même façon.
--
-- MESURÉ AVANT DE POSER : `select count(*) from public.tirage` rend 0 en production. Aucune ligne
-- n'est perdue aujourd'hui, et c'est la seule raison pour laquelle cette colonne peut être ajoutée
-- sans reprise de données. Elle coûte une migration maintenant, et un journal d'audit irrécupérable
-- après la première ligne écrite.
--
-- ── CE QUE L'EMPREINTE FAIT, ET CE QU'ELLE NE FAIT PAS ─────────────────────────────────────────
--
-- Elle NE REND PAS le journal rejouable : on ne rejoue pas un jeu qu'on n'a plus, et journaliser la
-- liste entière à chaque ligne serait payer vingt et un noms pour un tirage. Elle rend l'audit
-- HONNÊTE — il peut dire « cette ligne appartient à un jeu que je ne détiens plus » au lieu de
-- nommer une carte fausse. C'est le minimum qu'un journal d'audit se doit : ne pas mentir sur ce
-- qu'il sait. Retrouver le jeu d'alors reste possible par l'historique du dépôt, où chaque version
-- de `jeu.ts` est datée ; l'empreinte est ce qui dit LAQUELLE aller chercher.
--
-- ⚠️ NULLABLE, ET C'EST L'ÉTAT HONNÊTE. Une ligne antérieure à cette migration n'a pas d'empreinte
-- et n'en aura jamais : la remplir avec celle du jeu courant serait affirmer une chose qu'on ignore
-- — c'est-à-dire fabriquer précisément la fausse certitude que cette migration corrige. `null`
-- veut dire « jeu inconnu », et un audit doit pouvoir le lire ainsi. (Il n'y a aujourd'hui aucune
-- ligne dans ce cas ; la colonne reste nullable pour que ce soit vrai demain aussi.)
-- ════════════════════════════════════════════════════════════════════════════════════════════════

alter table public.tirage
  add column if not exists empreinte_jeu text;

-- Même forme que `graine` : huit caractères hexadécimaux minuscules (FNV-1a 32 bits, calculé dans
-- `lib/tirage/jeu.ts` sur la liste ORDONNÉE des clés). Une contrainte de FORME, jamais de valeur :
-- graver l'empreinte courante en base la rendrait fausse à la prochaine décision d'Anima, et une
-- contrainte qu'il faut migrer à chaque carte est une contrainte qu'on finira par retirer.
alter table public.tirage
  add constraint tirage_empreinte_forme check (empreinte_jeu is null or empreinte_jeu ~ '^[0-9a-f]{8}$');

comment on column public.tirage.empreinte_jeu is
  'Revue Epic 5 (R5) : l''identite du JEU dont provient l''indice — FNV-1a 32 bits sur la liste ORDONNEE des cles (lib/tirage/jeu.ts). taille_jeu donne la BORNE du modulo, pas la LISTE : la 5.10 a retire six cartes prises au milieu, donc rejouer une ligne 5.7 contre le jeu courant rend une carte FAUSSE. L''empreinte ne rend pas le journal rejouable (on ne rejoue pas un jeu qu''on n''a plus) — elle rend l''audit honnete : « cette ligne vient d''un jeu que je ne detiens plus ». NULL = ligne anterieure a 0064, jeu inconnu ; la remplir serait fabriquer la fausse certitude que cette migration corrige.';
