-- Migration forward-only — REVUE DE CODE du 2026-08-11, lot 1 (Epic 5), trouvailles S1/S2/S3.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- CE QUE CETTE MIGRATION RÉPARE, ET POURQUOI ÇA A ÉCHAPPÉ À TOUT LE MONDE PENDANT SIX SEMAINES
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- Supabase accorde par défaut les SEPT privilèges DML (select, insert, update, delete, truncate,
-- references, trigger) aux rôles `anon` et `authenticated` sur CHAQUE table de `public`. C'est le
-- modèle assumé de la plateforme : les privilèges sont larges, et c'est la RLS qui filtre.
--
-- Le modèle tient tant que CHAQUE garde vit dans une policy. Il tombe dès qu'une garde vit
-- ailleurs — dans une Server Action, dans une RPC, dans une fonction de décision TypeScript.
-- Parce qu'alors rien n'oblige la cliente à emprunter ce chemin : elle a le grant, elle a la RLS
-- sur SA ligne, et elle écrit en direct par l'API REST.
--
-- Trois gardes du seuil vivaient hors des policies. La revue les a exploitées une par une contre
-- l'API HTTP réelle, pas seulement en `psql` :
--
--   S1 — LA BARRIÈRE DE MINORITÉ (0006, FR-071). `barriere_minorite_le` est une colonne ordinaire
--        de `utilisatrice`, en GRANT UPDATE. Un `PATCH /rest/v1/utilisatrice?id=eq.<son_uid>` avec
--        `{"barriere_minorite_le": null}` répond 200. La suspension est levée par la personne
--        qu'elle protège. Et le système ne peut PAS la re-poser : `appliquer_barriere_minorite`
--        ré-insère dans `audit_securite`, viole `audit_securite_minorite_unique`, et toute la
--        fonction roule en arrière. Elle se dé-barre UNE fois, elle est immunisée POUR TOUJOURS.
--        Au passage, `echeance_suppression` — l'échéance de 30 jours — est effacée.
--
--   S1bis — `mineur_detecte` (1.4/1.9, FR-070), trouvée en écrivant ce correctif. Même vecteur.
--        Un compte marqué mineur a `date_naissance = null` (l'action ne pose que le drapeau) : il
--        se dé-marque, `etapeOnboarding` le renvoie vers `naissance`, et il déclare une date
--        d'adulte. La barrière « refusée à CHAQUE connexion » dure le temps d'une requête.
--
--   S2 — LE CONSENTEMENT ART. 9 (0004/1.6, AD-13). `revoked_at` remis à `null` rouvre le
--        write-gate et la scène — exactement ce que `consentement/actions.ts:43` interdit en
--        commentaire (« JAMAIS de reconquête »). Mais l'accès n'est pas le vrai dégât : `cree_le`
--        est lui aussi en GRANT UPDATE. La preuve horodatée de licéité art. 9 — celle qui protège
--        le RESPONSABLE DE TRAITEMENT, pas la personne — est antidatable et supprimable par le
--        sujet. Un consentement qu'on peut se forger soi-même ne prouve plus rien.
--
--   S3 — L'IMMUABILITÉ DU THÈME NATAL (0039, AD-6). La policy est `for all`, donc DELETE est
--        accordé, et le trigger `theme_natal_immuable_sauf_recalcul` ne garde que l'UPDATE. Un
--        DELETE suivi d'un INSERT remet `version := 1` et accepte n'importe quel contenu. La
--        revue a même montré l'épinglage : relire son `empreinte_entrees`, supprimer, ré-insérer
--        un contenu falsifié SOUS LA MÊME EMPREINTE — le faux thème n'est alors plus jamais
--        recalculé. Portée honnête : ses propres données, aucun chemin vers un prompt, aucun accès
--        à autrui. Une ligne de correctif, on la prend au passage.
--
-- ── LE PIÈGE DU CORRECTIF, DÉCOUVERT EN LE TESTANT ────────────────────────────────────────────
--
-- Le réflexe est `revoke update (barriere_minorite_le) on utilisatrice from authenticated`.
-- IL NE FERME RIEN. Un GRANT de TABLE couvre toutes les colonnes, présentes et futures, et un
-- revoke de colonne ne le perce pas : l'exploit passait encore. Le seul patron correct est
-- « révoquer la TABLE, puis re-granter les colonnes légitimes, nommément ».
--
-- Conséquence à connaître : toute colonne AJOUTÉE plus tard à `utilisatrice` sera en lecture
-- seule pour l'application tant qu'on ne l'aura pas ajoutée au grant ci-dessous. C'est voulu.
-- Le défaut sûr est « je ne peux pas écrire », pas « tout le monde peut écrire ».
--
-- ── CE QUE CETTE MIGRATION NE FAIT PAS ────────────────────────────────────────────────────────
--
-- Les 27 tables de `public` portent toutes les mêmes 7 privilèges pour `anon`. Cette migration
-- n'en durcit que TROIS — celles dont la revue a prouvé un contournement. L'audit des 24 autres
-- (« quelle garde de cette table vit hors de sa policy ? ») appartient au lot 3 de la revue, sur
-- les fondations. Il est tracé dans `deferred-work.md` ; il n'est pas fait ici.

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 1. `utilisatrice` — les trois drapeaux du seuil redeviennent système-only
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- `anon` d'abord : il ne franchit aucune policy (auth.uid() est nul), donc il n'obtient rien
-- aujourd'hui. On le révoque quand même — défense en profondeur. Le jour où une policy est écrite
-- `using (true)` par copie d'un gabarit, le privilège absent est la deuxième serrure. C'est aussi
-- ce qui rend enfin VRAIE l'affirmation « aucun grant anon » que `theme-natal-sql.test.ts`
-- portait dans un titre de describe sans jamais la vérifier (trouvaille E7).
revoke all on public.utilisatrice from anon;

-- La ligne est créée par le trigger `handle_new_user` (security definer) et détruite par la
-- cascade depuis `auth.users` sous `service_role`. L'application n'insère ni ne supprime jamais.
revoke insert, delete, truncate on public.utilisatrice from authenticated;

-- Le cœur du correctif : on retire l'UPDATE de TABLE, puis on rend nommément les neuf colonnes
-- que l'application écrit vraiment sous le JWT de l'utilisatrice.
--   • date_naissance / prenom / nom_complet   → app/(auth)/naissance/actions.ts + entrer/actions.ts
--   • mineur_detecte                          → app/(auth)/naissance/actions.ts (false → true seul,
--                                               voir le trigger monotone plus bas)
--   • heure_naissance / lieu_*                → app/heure-naissance/actions.ts (write-once, 0039)
-- RESTENT DEHORS, et c'est tout l'objet de la migration :
--   • barriere_minorite_le, echeance_suppression → posées par `appliquer_barriere_minorite`
--     (security definer, service_role). L'application ne les écrit jamais.
--   • socle_complete_annonce_le → posée par `reserver_annonce_socle_complet` (security definer).
--     La laisser ouverte permettait aussi de la remettre à `null` et de re-déclencher à volonté
--     une mention que 0040 promet unique à vie.
--   • id, cree_le → identité et horodatage de création. Rien ne les réécrit, jamais.
revoke update on public.utilisatrice from authenticated;
grant update (
  date_naissance,
  prenom,
  nom_complet,
  mineur_detecte,
  heure_naissance,
  lieu_naissance,
  lieu_latitude,
  lieu_longitude,
  lieu_fuseau
) on public.utilisatrice to authenticated;

-- `mineur_detecte` reste écrivable — l'action de déclaration d'âge doit pouvoir le poser — mais
-- il devient MONOTONE. C'est le même invariant que la barrière : une protection se pose, elle ne
-- se retire pas. Le retrait légitime n'existe pas : un compte marqué mineur ne redevient pas
-- majeur par une écriture, il attend d'avoir dix-huit ans et rouvre un compte.
create function public.mineur_detecte_monotone()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if old.mineur_detecte is true and new.mineur_detecte is distinct from true then
    raise exception 'mineur_detecte : une barrière de minorité se pose, elle ne se retire pas (FR-070)';
  end if;
  return new;
end;
$$;

create trigger utilisatrice_mineur_detecte_monotone
  before update on public.utilisatrice
  for each row execute function public.mineur_detecte_monotone();

revoke execute on function public.mineur_detecte_monotone() from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 2. `consentement` — la révocation devient terminale EN BASE, et la preuve devient une preuve
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

revoke all on public.consentement from anon;

-- L'application ne supprime jamais un consentement : il est la PREUVE, il survit à tout sauf à
-- l'effacement du compte (cascade depuis `utilisatrice`, elle-même en cascade d'`auth.users`).
revoke delete, truncate on public.consentement from authenticated;

-- ⚠️ On garde UPDATE de table ici, volontairement, et le trigger fait le travail. L'`upsert` de
-- `consentement/actions.ts:46` s'appuie sur `ON CONFLICT DO UPDATE` et touche donc art9_accorde,
-- ia_reconnue, cgu_acceptees et revoked_at : les figer par grant casserait le consentement
-- idempotent. Ce qu'il faut interdire n'est pas l'écriture, c'est une TRANSITION précise.
create function public.consentement_revocation_terminale()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  -- AD-13, Story 1.6, AC4 : « jamais de reconquête ». La garde vivait dans une Server Action
  -- (`consentement/actions.ts:43`), c'est-à-dire nulle part pour qui n'emprunte pas cette action.
  if old.revoked_at is not null and new.revoked_at is null then
    raise exception 'consentement : la révocation est définitive — pas de reconquête (Story 1.6, AC4)';
  end if;
  -- La date de consentement est la PREUVE de licéité art. 9. Elle protège le responsable de
  -- traitement ; qu'elle soit antidatable par le sujet la vide de toute valeur probante.
  if new.cree_le is distinct from old.cree_le then
    raise exception 'consentement : cree_le est la preuve horodatée, elle ne se réécrit pas (RGPD art. 7-1)';
  end if;
  return new;
end;
$$;

create trigger consentement_revocation_terminale
  before update on public.consentement
  for each row execute function public.consentement_revocation_terminale();

revoke execute on function public.consentement_revocation_terminale() from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 3. `theme_natal` — « calculé une fois et gravé » cesse d'être contournable par un DELETE
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

revoke all on public.theme_natal from anon;

-- Le trigger `theme_natal_immuable_sauf_recalcul` (0039) exige version+1 ET une empreinte
-- différente — mais il ne garde que l'UPDATE. Sans ce revoke, `delete` puis `insert` remet le
-- compteur à 1 et accepte n'importe quel contenu.
-- L'effacement du compte n'en a pas besoin : il passe par `on delete cascade` depuis
-- `utilisatrice`, déclenché par `auth.admin.deleteUser()` sous `service_role`.
revoke delete, truncate on public.theme_natal from authenticated;

comment on function public.mineur_detecte_monotone() is
  'Revue 2026-08-11 (S1bis) : mineur_detecte ne redescend jamais à false. La garde vivait dans etapeOnboarding (TypeScript) ; authenticated avait le GRANT UPDATE et pouvait la contourner par un PATCH direct.';

comment on function public.consentement_revocation_terminale() is
  'Revue 2026-08-11 (S2) : révocation définitive + cree_le immuable. Les deux gardes vivaient dans une Server Action, donc nulle part pour qui écrit en direct par PostgREST.';
