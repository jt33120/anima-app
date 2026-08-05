-- Amorçage des bases de DÉVELOPPEMENT et d'INTÉGRATION uniquement.
--
-- `supabase start` et `supabase db reset` jouent ce fichier APRÈS les migrations ([db.seed] dans
-- config.toml). Un projet cloud, lui, ne reçoit QUE les migrations — jamais ce fichier. C'est exactement
-- la propriété qu'on recherche ici.
--
-- ── POURQUOI LE MARQUEUR D'ENVIRONNEMENT VIT ICI ET NON DANS LA MIGRATION 0027 ─────────────────────────
-- Revue de la Story 4.8, défaut n°2. La migration amorçait `environnement.nom = 'local'`, et
-- `environnementDuDeploiement()` se replie sur `'local'` quand `ANIMA_ENV` est absente ou méconnaissable.
-- Les DEUX « je ne sais pas » du verrou AC3 portaient donc le même mot — et deux ignorances qui portent le
-- même mot ne se contredisent pas : elles s'accordent. Un projet cloud fraîchement migré mais pas encore
-- promu déclarait `local`, s'accordait avec n'importe quel déploiement non configuré, et le verrou était
-- inerte dans l'état par défaut d'après-déploiement — c'est-à-dire précisément l'état où l'on compte sur lui.
--
-- Le marqueur ayant déménagé ici, une base cloud n'a AUCUNE ligne tant qu'on ne l'a pas promue à la main.
-- `environnementDeclare()` rend alors `null`, le verdict est `base_muette`, et l'ordonnanceur REFUSE de
-- tourner. Oublier la promotion ne donne plus le droit d'écrire : ça donne un refus, bruyant et sans effet.
insert into public.environnement (nom) values ('local')
on conflict (id) do nothing;
