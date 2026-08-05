-- Migration forward-only — revue de la Story 4.8, défaut n°1 : l'INVERSION DU SIGNAL DE SANTÉ.
--
-- `sante_ordonnanceur_publique` ne regardait que `incident_systeme`. Or les incidents sont ÉCRITS PAR
-- l'ordonnanceur lui-même. Un ordonnanceur qui ne tourne plus n'écrit plus rien — donc plus aucun incident,
-- donc `/api/health` répondait « ok ». Pire : la fenêtre de deux jours faisait expirer les incidents
-- existants, si bien que le signal s'AMÉLIORAIT à mesure que la panne durait.
--
-- Les trois chemins concrets qui produisaient un « ok » mensonger :
--   • le projet cloud n'a pas été promu → refus d'environnement chaque nuit, et par conception (AC3) le
--     répartiteur n'écrit RIEN dans une base dont il doute : aucune exécution, aucun incident ;
--   • Vercel Cron ne déclenche plus (cron non enregistré, `CRON_SECRET` absent → 503, protection de
--     déploiement activée) : plus un seul tick, donc plus un seul incident ;
--   • la lambda meurt avant d'atteindre le job de santé.
--
-- Dans les trois cas, la seule observation qui reste vraie est une ABSENCE. D'où l'homme mort : on ne
-- déclare la santé que si l'on peut MONTRER une réussite récente du job de santé. Le doute penche
-- désormais vers `degrade` (AD-15 : le repli va vers le moins d'affirmation).
--
-- Deux seuils cohabitent volontairement, et ils ne mesurent pas la même chose :
--   • 48 h ici — l'homme mort. Il n'exige aucun tick pour parler : c'est une absence qui le déclenche.
--   • `toleranceHeures` du registre (60 h) — l'incident `job_en_retard`. Il exige un tick pour être écrit.
--     Le signal public dégrade donc AVANT que l'incident ne soit levé, ce qui est le bon ordre : l'incident
--     ne viendra peut-être jamais.
--
-- CONSÉQUENCE ASSUMÉE : sur un poste de développement et en CI, aucun cron ne tourne — `/api/health` y
-- répond donc `degrade`. C'est la vérité (l'ordonnanceur n'y tourne effectivement pas), et le test de fumée
-- accepte les trois valeurs.

create or replace function public.sante_ordonnanceur_publique()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.incident_systeme
                  where jour >= ((now() at time zone 'Europe/Paris')::date - 1))
      -- L'homme mort. Le nom est celui du job de santé du registre — une garde d'architecture
      -- (`tests/ordonnanceur-architecture.test.ts`) interdit de le renommer ou de le passer hebdomadaire
      -- sans casser le build, faute de quoi ce prédicat deviendrait faux en silence.
      or not exists (select 1 from public.execution_job
                      where job = 'sante-ordonnanceur'
                        and statut = 'reussi'
                        and termine_le > now() - interval '48 hours')
    then 'degrade' else 'ok' end;
$$;

revoke execute on function public.sante_ordonnanceur_publique() from public, anon, authenticated;

comment on function public.sante_ordonnanceur_publique() is
  'Story 4.8 (AC5, corrigé en revue) : l''état agrégé de l''ordonnanceur, en UN mot. `degrade` si un incident date de moins de deux jours OU si le job de santé n''a pas réussi depuis 48 h (homme mort : une absence de tick ne peut pas s''auto-signaler). Aucune donnée art. 9 — la signature ne peut rien porter d''autre qu''un mot.';
