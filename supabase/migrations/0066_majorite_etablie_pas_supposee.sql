-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 0066 — NE PAS RÉPONDRE À LA QUESTION NE VAUT PAS MAJORITÉ
-- Revue adversariale des Epics 1 à 4, 2026-08-18 — trouvaille CRITIQUE n° 1
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── CE QUI ÉTAIT OUVERT, ET QUI A ÉTÉ REPRODUIT DE BOUT EN BOUT ────────────────────────────────
--
-- Un compte créé par lien magique qui SAUTE `/naissance` porte `date_naissance = null`,
-- `mineur_detecte = false`, `barriere_minorite_le = null`. Sous un vrai JWT `authenticated`, en
-- POSTant directement sur PostgREST, chaque appel rendait 201 :
--
--     POST /rest/v1/consentement  {art9_accorde, ia_reconnue, cgu_acceptees}  → 201
--     POST /rest/v1/entree_journal  (verbatim art. 9)                          → 201
--     POST /rest/v1/art9_temoin                                                → 201
--
-- Une enfant de treize ans qui n'écrit aucune date écrit sa vie intérieure dans une base art. 9,
-- et la fait lire par un modèle de langage, avec un consentement juridiquement valide au dossier.
--
-- ── POURQUOI 0048 NE L'A PAS FERMÉ ─────────────────────────────────────────────────────────────
--
-- 0048 a fermé « déclarer une FAUSSE date » avec le trigger `exiger_majorite`. Mais il est armé
-- `before insert or update OF date_naissance` : **un trigger armé sur une colonne ne se déclenche
-- jamais si personne n'écrit cette colonne.** Son corps le confirme d'ailleurs — il commence par
-- `if new.date_naissance is null then return new;`.
--
-- Le trigger garde une VALEUR. Il ne peut rien contre une ABSENCE. Il faut les deux, et ils doivent
-- être éprouvés SÉPARÉMENT — sinon chacun couvre le mutant de l'autre.
--
-- ── LA FORME DU PRÉDICAT CHANGE, ET C'EST LE CŒUR DU CORRECTIF ─────────────────────────────────
--
-- Il s'écrivait `exists (… where <conditions de barrage>)` : il fallait qu'une raison de barrer
-- soit POSITIVEMENT présente. Toute absence échouait donc OUVERT — pas de date, pas de barrage ;
-- et même pas de ligne `utilisatrice` du tout, pas de barrage.
--
-- Il s'écrit désormais `not exists (… where <tout va bien>)` : la majorité doit être POSITIVEMENT
-- ÉTABLIE. L'absence barre, quelle qu'en soit la cause. C'est la doctrine AD-15 — le repli penche
-- vers le moins d'effet — appliquée au seuil légal le plus important du produit.
--
-- ── UN SEUL POINT, VINGT-SIX POLICIES ──────────────────────────────────────────────────────────
--
-- C'est le patron gagnant de 0042 : « réparer la fonction les répare toutes d'un coup ». Vingt-six
-- policies d'écriture citent ce prédicat, sur les tables art. 9 et sur `consentement` lui-même —
-- donc le seul geste hors-application du scénario d'attaque se referme du même coup. L'egress-guard
-- (`lib/ai/egress-guard.ts`) le rejoue par RPC : `/api/anam/message`, qui n'appelle jamais
-- `etapeOnboardingPour`, se referme sans qu'on ait à toucher la route.
--
-- ⚠️ AUCUNE POLICY DE LECTURE NE CITE CE PRÉDICAT — vérifié, les vingt-six sont des écritures.
-- L'export (FR-067) et la consultation restent donc ouverts, ce que la Story 1.9 exige.
--
-- ── LE NOM EST CONSERVÉ, DÉLIBÉRÉMENT ──────────────────────────────────────────────────────────
--
-- `est_barre_minorite` couvre maintenant « la majorité n'est pas établie », ce qui est plus large
-- que « elle est mineure ». Le renommer demanderait de réécrire vingt-six policies pour un gain
-- de vocabulaire, et chaque site réécrit est une occasion de perdre une clause — c'est exactement
-- ce qui est arrivé à `reserver_notification` en 0036. Le sens est donc porté par le commentaire
-- de fonction, que `psql \df+` affiche.
--
-- La phrase montrée à l'utilisatrice ne prétend rien de faux : `REFUS_MINORITE` dit « Je ne peux
-- pas ouvrir ce moment ici. » — jamais « tu es mineure ». Vérifié avant d'élargir.

create or replace function public.est_barre_minorite()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select not exists (
    select 1 from public.utilisatrice u
    where u.id = (select auth.uid())
      -- La majorité doit être DÉCLARÉE. Sans date, rien n'est établi — et 0048 n'a jamais
      -- l'occasion de se prononcer, puisque son trigger est armé sur cette colonne.
      and u.date_naissance is not null
      -- Story 1.4 / FR-070 — minorité déclarée au seuil.
      and not u.mineur_detecte
      -- Story 1.9 / FR-071 — minorité détectée après coup, compte suspendu 30 jours.
      and u.barriere_minorite_le is null
  );
$$;

comment on function public.est_barre_minorite() is
  'Revue Epics 1-4, 2026-08-18 : rend VRAI tant que la majorité n''est pas POSITIVEMENT établie — '
  'date de naissance absente, minorité déclarée (FR-070), minorité détectée (FR-071), ou aucune '
  'ligne utilisatrice. La forme est `not exists (tout va bien)` et non `exists (une raison de '
  'barrer)` : toute absence barre. Avant, un compte qui sautait /naissance écrivait de l''art. 9.';
