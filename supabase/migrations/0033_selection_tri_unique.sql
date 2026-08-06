-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 0033 — le tri de la sélection était écrit DEUX FOIS
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Trouvé par la mutation-vérification du lot C, et c'est exactement le piège que cette story a déjà payé
-- deux fois sous une autre forme : DEUX expressions pour UN invariant, si bien qu'aucune n'est prouvée.
--
-- `utilisatrices_a_synthetiser` portait `order by attente nulls first, u.cree_le` dans la sous-requête
-- (qui décide QUI entre dans le lot borné) ET `order by c.attente nulls first, c.cree_le` dans le
-- `jsonb_agg` (qui décide dans quel ORDRE la liste sort). Muter l'une laissait l'autre rattraper le
-- résultat observable : le test restait vert, et l'équité — la seule chose qui empêche une utilisatrice
-- d'être repoussée indéfiniment quand le lot est plein — n'était gardée par rien.
--
-- On ne corrige pas ça en ajoutant un second test. On le corrige en supprimant la seconde expression :
-- le rang est calculé UNE fois, par la fenêtre, et le `limit` comme l'agrégat s'y réfèrent. Il n'existe
-- plus qu'un seul endroit où l'équité est écrite, donc plus qu'un seul endroit où elle peut être cassée.
create or replace function public.utilisatrices_a_synthetiser(p_job text, p_limite integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(c.id order by c.rang), '[]'::jsonb)
    from (
      select u.id,
             -- L'ÉQUITÉ, écrite une seule fois. Le lot est borné : servir dans l'ordre des identifiants
             -- affamerait toujours les mêmes. On sert celle qui a attendu le plus longtemps, `nulls
             -- first` étant celle qui n'a JAMAIS rien reçu — et à égalité, la plus anciennement inscrite,
             -- sans quoi l'ordre entre elles serait laissé au plan d'exécution, donc instable d'un jour
             -- à l'autre.
             row_number() over (order by d.periode_fin nulls first, u.cree_le) as rang
        from public.utilisatrice u
        left join lateral (
          select s.periode_fin, s.tronquee
            from public.synthese s
           where s.utilisatrice_id = u.id
           order by s.periode_fin desc
           limit 1
        ) d on true
       where public.eligible_a_synthese(u.id)
         -- LA CADENCE : sept jours depuis la fin de la dernière période racontée — sauf rattrapage en
         -- cours (la dernière tranche était tronquée), auquel cas on enchaîne dès le lendemain.
         and (d.periode_fin is null
              or d.tronquee
              or d.periode_fin <= now() - interval '7 days')
         -- D3 / FR-034 : « rien à dire » = aucune entrée ÉLIGIBLE depuis la dernière période. Des faits
         -- anciens ne suffisent pas — ils sont cumulatifs, donc « il existe des faits » serait vrai pour
         -- toujours dès la première semaine.
         and exists (select 1 from public.entrees_hors_detresse(u.id, d.periode_fin, now()) e
                      where e.role = 'utilisatrice')
         -- LE DISJONCTEUR : trois échecs en sept jours, et on passe son tour, le temps que la fenêtre
         -- glisse ou qu'un correctif arrive.
         and (select count(*) from public.execution_job ej
               where ej.job = p_job
                 and ej.cible_id = u.id
                 and ej.statut = 'echoue'
                 and ej.termine_le > now() - interval '7 days') < 3
       order by rang
       limit p_limite
    ) c;
$$;

revoke execute on function public.utilisatrices_a_synthetiser(text, integer) from public, anon, authenticated;
