-- Migration forward-only — 0007 : durcir les privilèges EXECUTE (défense en profondeur).
--
-- CONTEXTE (relevé au déploiement cloud via get_advisors) : Supabase configure des *default
-- privileges* qui accordent AUTOMATIQUEMENT `execute` à `anon` ET `authenticated` sur toute
-- nouvelle fonction du schéma `public`. Les migrations 0002-0006 ne révoquaient que `from public`
-- (ou rien pour les triggers) — laissant des grants DIRECTS `anon`/`authenticated` non voulus.
--
-- Ce n'est PAS une faille : toutes ces fonctions sont clavetées sur `auth.uid()` (jamais un uid
-- passé par l'appelant) → pour `anon` (pas de session) elles renvoient toujours `false`, et il n'y
-- a pas d'oracle inter-utilisatrices (acquis des revues 1.6/1.9). Mais on ALIGNE le privilège réel
-- sur l'intention déclarée des migrations, et on réduit la surface exposée par PostgREST.
--
-- RÈGLES :
--  • Fonctions-TRIGGER (`handle_new_user`, `date_naissance_immuable`) : renvoient `trigger`, jamais
--    appelées à la main, non exposées en RPC. On retire `execute` à TOUS les rôles clients. Le
--    déclenchement PAR trigger NE vérifie PAS le privilège `execute` de l'appelant (il s'exécute en
--    security definer, propriétaire `postgres`) → signup et immuabilité continuent de fonctionner.
--  • Fonctions-PRÉDICAT de RLS (`a_consenti_art9`, `est_barre_minorite`) : `authenticated` GARDE
--    `execute` — les policies `art9_temoin` les évaluent SOUS ce rôle ; le lui retirer casserait le
--    write-gate. On retire seulement `anon`, qui n'écrit jamais de contenu art. 9.
--  • `appliquer_barriere_minorite` : déjà verrouillée `service_role`-only (0006), inchangée.
--
-- `service_role` conserve `execute` partout (rôle système privilégié, hors surface publique).

-- ── Fonctions-trigger : hors de portée de tout rôle client ──
revoke execute on function public.handle_new_user()         from public, anon, authenticated;
revoke execute on function public.date_naissance_immuable() from public, anon, authenticated;

-- ── Fonctions-prédicat de RLS : authenticated conserve (requis), anon retiré ──
revoke execute on function public.a_consenti_art9()    from anon;
revoke execute on function public.est_barre_minorite() from anon;
