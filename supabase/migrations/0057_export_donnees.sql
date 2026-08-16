-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 0057 — L'EXPORT COMPLET (Story 6.6 · FR-067 volet export · AD-4 · NFR-002/003/005)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── POURQUOI UNE FONCTION `security definer`, ALORS QUE AD-12 DIT « SOUS LE JWT » ────────────────
--
-- AD-12 exige que le contenu utilisateur se lise sous l'identité de l'utilisatrice, RLS active,
-- jamais par `service_role`. Une lecture table par table sous le JWT respecterait la lettre — et
-- produirait un export FAUX.
--
-- Mesuré sur la base au 2026-08-16 : sur les 29 tables qui portent quelque chose d'elle, ONZE sont
-- deny-by-default et le resteront (`episode_detresse`, `audit_securite`, `usage_ia`, `seance`,
-- `pause_rythme`, `invitation_integration`, `notification_envoyee`, `information_reconduction`…).
-- Sous le JWT, chacune rend zéro ligne SANS ERREUR. L'export serait vert, complet en apparence, et
-- muet sur onze couches. C'est le pire défaut possible ici : sur cet écran-là, un vide se lit comme
-- « le produit ne sait rien de moi ».
--
-- Les deux issues étaient : ouvrir onze policies de lecture (élargir DÉFINITIVEMENT la surface de
-- lecture de l'application pour un seul écran), ou UNE porte nommée. On prend la porte nommée —
-- même geste que `charger_faits_actifs`, `rappels_echeance_dus`, `motifs_anam_du`.
--
-- Le prix est réel : `security definer` contourne la RLS, donc chaque sous-requête doit porter son
-- `where utilisatrice_id = v_uid` et une seule oubliée fuiterait TOUT. Ce prix est payé par un test
-- qui ne peut pas mentir : deux utilisatrices semées dans les 29 tables, et l'export de l'une ne
-- doit contenir AUCUN marqueur de l'autre (`tests/export-sql.test.ts`). Un `where` retiré tue ce
-- test immédiatement, quelle que soit la table.
--
-- ── CE QUE LA FONCTION ÉCRIT, ET POURQUOI L'ÉCRITURE EST ICI ─────────────────────────────────────
--
-- L'AC3 demande que l'opération soit journalisée sans art. 9 en clair. La trace est posée DANS la
-- fonction, dans la même transaction que la lecture : il devient impossible de servir un export
-- sans l'enregistrer. Un `console.log` côté route aurait été oubliable, et surtout perdu au premier
-- redéploiement — or c'est exactement la trace qu'un responsable de traitement doit pouvoir
-- produire pour prouver qu'il a honoré une demande d'accès.
--
-- La trace est posée APRÈS la construction du document : l'export décrit l'état d'AVANT lui-même.
--
-- ── LES TROIS COLONNES RETIRÉES, ET POURQUOI CE N'EST PAS UN EXPORT INCOMPLET ────────────────────
--
-- `abonnement_poussee.cle_p256dh` / `.cle_auth` et `preference_courriel.jeton` ne sont pas des
-- données SUR elle : ce sont des CAPACITÉS — de quoi pousser une notification sur son appareil, de
-- quoi la désabonner sans être elle. Les mettre dans un fichier qu'elle va transporter, envoyer par
-- courriel, poser sur un disque partagé, c'est fabriquer une fuite de pouvoir sans lui apprendre
-- quoi que ce soit. Les lignes, elles, sont exportées : elle voit qu'un appareil est abonné et
-- depuis quand. Le retrait est DÉCLARÉ dans le document lui-même (clé `retraits`) — un export qui
-- cache ce qu'il retire ment deux fois.

-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- La porte unique. `volatile` (elle écrit), `security definer` (voir plus haut), `search_path` figé.
-- ────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.exporter_mes_donnees()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_doc jsonb;
begin
  -- ⚠️ ON LÈVE, ON NE REND PAS UN DOCUMENT VIDE. Sans identité, un `{}` serait servi comme fichier
  -- et se lirait « Anam n'a rien sur toi » — le mensonge exact que cette story existe pour éviter.
  if v_uid is null then
    raise exception 'export_sans_identite' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'version', 1,
    'genere_le', now(),
    'retraits', jsonb_build_array(
      jsonb_build_object('table', 'abonnement_poussee', 'colonnes', jsonb_build_array('cle_p256dh', 'cle_auth'),
                         'motif', 'clés de poussée : une capacité sur ton appareil, pas une donnée sur toi'),
      jsonb_build_object('table', 'preference_courriel', 'colonnes', jsonb_build_array('jeton'),
                         'motif', 'jeton de désabonnement : quiconque le lit peut te désabonner sans être toi')
    ),

    -- ── QUI ELLE EST ──────────────────────────────────────────────────────────────────────────
    'utilisatrice', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                       from public.utilisatrice t where t.id = v_uid),
    'consentement', (select coalesce(jsonb_agg(to_jsonb(t) order by t.cree_le), '[]'::jsonb)
                       from public.consentement t where t.utilisatrice_id = v_uid),

    -- ── LA MÉMOIRE, SES TROIS COUCHES (AD-8) ──────────────────────────────────────────────────
    -- `entree_journal` porte AUSSI les transcriptions conservées (NFR-003) : elles y sont déposées
    -- comme n'importe quel tour, donc elles sortent ici sans traitement particulier.
    'entree_journal', (select coalesce(jsonb_agg(to_jsonb(t) order by t.cree_le), '[]'::jsonb)
                         from public.entree_journal t where t.utilisatrice_id = v_uid),
    'fait_extrait', (select coalesce(jsonb_agg(to_jsonb(t) order by t.maj_le), '[]'::jsonb)
                       from public.fait_extrait t where t.utilisatrice_id = v_uid),
    'branche', (select coalesce(jsonb_agg(to_jsonb(t) order by t.cree_le), '[]'::jsonb)
                  from public.branche t where t.utilisatrice_id = v_uid),
    'branche_retour', (select coalesce(jsonb_agg(to_jsonb(t) order by t.cree_le), '[]'::jsonb)
                         from public.branche_retour t where t.utilisatrice_id = v_uid),
    'resume_glissant', (select coalesce(jsonb_agg(to_jsonb(t) order by t.maj_le), '[]'::jsonb)
                          from public.resume_glissant t where t.utilisatrice_id = v_uid),
    'synthese', (select coalesce(jsonb_agg(to_jsonb(t) order by t.cree_le), '[]'::jsonb)
                   from public.synthese t where t.utilisatrice_id = v_uid),
    'intention', (select coalesce(jsonb_agg(to_jsonb(t) order by t.cree_le), '[]'::jsonb)
                    from public.intention t where t.utilisatrice_id = v_uid),
    'signal_reconceptualisation', (select coalesce(jsonb_agg(to_jsonb(t) order by t.cree_le), '[]'::jsonb)
                                     from public.signal_reconceptualisation t where t.utilisatrice_id = v_uid),

    -- ── LE SOCLE CALCULÉ ET LE TYPE ───────────────────────────────────────────────────────────
    'theme_natal', (select coalesce(jsonb_agg(to_jsonb(t) order by t.calcule_le), '[]'::jsonb)
                      from public.theme_natal t where t.utilisatrice_id = v_uid),
    'enneagramme', (select coalesce(jsonb_agg(to_jsonb(t) order by t.cree_le), '[]'::jsonb)
                      from public.enneagramme t where t.utilisatrice_id = v_uid),
    'enneagramme_hypothese', (select coalesce(jsonb_agg(to_jsonb(t) order by t.cree_le), '[]'::jsonb)
                                from public.enneagramme_hypothese t where t.utilisatrice_id = v_uid),
    'enneagramme_tentative', (select coalesce(jsonb_agg(to_jsonb(t) order by t.cree_le), '[]'::jsonb)
                                from public.enneagramme_tentative t where t.utilisatrice_id = v_uid),

    -- ── LES LECTURES ──────────────────────────────────────────────────────────────────────────
    'tirage', (select coalesce(jsonb_agg(to_jsonb(t) order by t.tire_a), '[]'::jsonb)
                 from public.tirage t where t.utilisatrice_id = v_uid),
    'lecture', (select coalesce(jsonb_agg(to_jsonb(t) order by t.ouverte_a), '[]'::jsonb)
                  from public.lecture t where t.utilisatrice_id = v_uid),

    -- ── CE QUE LE PRODUIT A FAIT D'ELLE ───────────────────────────────────────────────────────
    -- `seance`, `usage_ia`, `episode_detresse`, `audit_securite` sont DANS l'export et c'est une
    -- décision. Ce sont des données à caractère personnel la concernant (art. 15) : lui refuser
    -- l'accès à la façon dont le système l'a classée serait garder pour nous le seul jugement que
    -- le produit porte sur elle.
    'seance', (select coalesce(jsonb_agg(to_jsonb(t) order by t.cree_le), '[]'::jsonb)
                 from public.seance t where t.utilisatrice_id = v_uid),
    'usage_ia', (select coalesce(jsonb_agg(to_jsonb(t) order by t.cree_le), '[]'::jsonb)
                   from public.usage_ia t where t.utilisatrice_id = v_uid),
    'episode_detresse', (select coalesce(jsonb_agg(to_jsonb(t) order by t.debut), '[]'::jsonb)
                           from public.episode_detresse t where t.utilisatrice_id = v_uid),
    'audit_securite', (select coalesce(jsonb_agg(to_jsonb(t) order by t.cree_le), '[]'::jsonb)
                         from public.audit_securite t where t.utilisatrice_id = v_uid),
    'pause_rythme', (select coalesce(jsonb_agg(to_jsonb(t) order by t.propose_le), '[]'::jsonb)
                       from public.pause_rythme t where t.utilisatrice_id = v_uid),
    'invitation_integration', (select coalesce(jsonb_agg(to_jsonb(t) order by t.dite_le), '[]'::jsonb)
                                 from public.invitation_integration t where t.utilisatrice_id = v_uid),
    'notification_envoyee', (select coalesce(jsonb_agg(to_jsonb(t) order by t.envoye_le), '[]'::jsonb)
                               from public.notification_envoyee t where t.utilisatrice_id = v_uid),

    -- ── L'ARGENT ET LES RÉGLAGES ──────────────────────────────────────────────────────────────
    'abonnement', (select coalesce(jsonb_agg(to_jsonb(t) order by t.cree_le), '[]'::jsonb)
                     from public.abonnement t where t.utilisatrice_id = v_uid),
    'remboursement', (select coalesce(jsonb_agg(to_jsonb(t) order by t.demande_le), '[]'::jsonb)
                        from public.remboursement t where t.utilisatrice_id = v_uid),
    'information_reconduction', (select coalesce(jsonb_agg(to_jsonb(t) order by t.echeance), '[]'::jsonb)
                                   from public.information_reconduction t where t.utilisatrice_id = v_uid),
    'preference_socle', (select coalesce(jsonb_agg(to_jsonb(t) order by t.maj_le), '[]'::jsonb)
                           from public.preference_socle t where t.utilisatrice_id = v_uid),
    -- Les deux seules lignes où l'on retire quelque chose. `to_jsonb(t) - 'colonne'` ôte la clé.
    'preference_courriel', (select coalesce(jsonb_agg((to_jsonb(t) - 'jeton') order by t.maj_le), '[]'::jsonb)
                              from public.preference_courriel t where t.utilisatrice_id = v_uid),
    'abonnement_poussee', (select coalesce(
                              jsonb_agg((to_jsonb(t) - 'cle_p256dh' - 'cle_auth') order by t.cree_le), '[]'::jsonb)
                             from public.abonnement_poussee t where t.utilisatrice_id = v_uid)
  ) into v_doc;

  -- AC3 — la trace, sans art. 9 : qui, quoi, quand. Jamais un extrait, jamais un compte de lignes
  -- (un volume est déjà un renseignement sur elle).
  insert into public.audit_securite (utilisatrice_id, type, decision)
  values (v_uid, 'export_donnees', 'servi');

  return v_doc;
end;
$fn$;

-- La porte est NOMMÉE : personne ne l'a par défaut, `authenticated` l'a nommément, `anon` jamais.
revoke all on function public.exporter_mes_donnees() from public, anon;
grant execute on function public.exporter_mes_donnees() to authenticated;

comment on function public.exporter_mes_donnees() is
  'Story 6.6 — l''export complet (FR-067). Rend TOUTES les couches de l''utilisatrice courante en un '
  'seul document jsonb et pose la trace d''accès (audit_securite, type « export_donnees »). '
  'security definer parce que onze des tables exportées sont deny-by-default par conception : sous le '
  'seul JWT elles rendraient zéro ligne SANS erreur, et l''export mentirait en silence.';
