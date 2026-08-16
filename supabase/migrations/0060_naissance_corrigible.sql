-- Migration forward-only — Story 6.5b : l'heure de naissance corrigeable (QA T17, RGPD art. 16).
--
-- ══ CE QUE CETTE MIGRATION N'ÉCRIT PAS ═══════════════════════════════════════════════════════════
--
-- Elle n'écrit AUCUN recalculateur, et la note de suivi qui a demandé cette story se trompait sur ce
-- point : elle annonçait qu'il faudrait « recalculer et REGRAVER, alors que le write-gate art. 9 de
-- 0039 grave une seule fois ». Or 0039 n'a jamais gravé une seule fois — son trigger
-- `theme_natal_recalcul_declare` autorise explicitement le recalcul (version + 1 ET empreinte
-- différente), et la 5.3 s'en sert déjà. La regravure est PARESSEUSE : `lireThemeNatal` compare à
-- chaque lecture l'empreinte gravée à celle des entrées du jour, et recalcule si elles diffèrent.
--
-- Corriger l'heure fait donc changer l'empreinte, et le thème se regrave TOUT SEUL à la lecture
-- suivante — par le chemin déjà écrit, déjà testé, déjà en production. Câbler un recalcul ici
-- rouvrirait les trois pièges que la décision D5 de la 5.3 a fermés (une panne en cours de recalcul,
-- deux onglets qui violent `version + 1`, et une migration de forme que personne ne déclenche).
--
-- Il ne manquait qu'une chose, et c'est tout l'objet de cette migration : le write-once de 0039
-- refuse `valeur → autre valeur`. C'est cette porte-là qu'on ouvre, et elle seule.
--
-- ══ POURQUOI LA CORRECTION N'EST PAS PLAFONNÉE À UNE FOIS ════════════════════════════════════════
--
-- Le réflexe — et la première version de cette migration — était « corrigible UNE FOIS » : un
-- compteur, une porte qui se referme. C'est défendable côté produit (FR-051, « le socle ne bouge
-- pas ») et INDÉFENDABLE côté droit.
--
-- L'art. 16 du RGPD est un droit inconditionnel à la rectification d'une donnée inexacte. Il ne
-- s'épuise pas au premier usage. Quelqu'un qui se trompe DANS SA CORRECTION — 04:30 tapé 04:03 —
-- se retrouverait avec un ascendant faux pour toujours ET son recours déjà consommé : strictement
-- pire qu'avant la story. Un plafond ici ne protégerait pas le socle, il transformerait une faute de
-- frappe en condamnation.
--
-- Ce qui protège FR-051 n'est donc pas un compteur, c'est TROIS choses :
--   1. une correction exige un CHANGEMENT RÉEL (`is distinct from`) — réécrire la même heure n'est
--      pas une correction et ne compte pas ;
--   2. chaque correction est COMPTÉE ET DATÉE PAR LE SERVEUR, jamais par l'appelante. ⚠️ L'écran
--      montre la DATE, jamais le nombre : « tu as corrigé 3 fois » est un compteur, et FR-031 les
--      refuse. C'est exactement l'arbitrage déjà rendu par la 6.5 dans la section voisine du MÊME
--      écran, qui affiche « Tu as réécrit cette phrase. » sans jamais dire combien de fois. Le
--      nombre est gardé en base parce qu'il est la piste d'audit ; il n'est pas montré parce qu'il
--      deviendrait un score ;
--   3. surtout : la correction n'est JAMAIS AVEUGLE. L'écran calcule le thème que la nouvelle heure
--      produit AVANT d'écrire quoi que ce soit, et lui montre l'ascendant qu'elle gagne et celui
--      qu'elle perd. On ne remplace pas un plafond par rien : on le remplace par la vue.
--
-- ⚠️ AU PROCHAIN LECTEUR QUI VOUDRA « SÉCURISER » ÇA EN AJOUTANT UNE LIMITE : la limite est le
-- refus d'un droit. Si le compteur devient gênant, la question à poser est « pourquoi corrige-t-elle
-- cinq fois ? », pas « comment l'en empêcher ».
--
-- ══ CE QUI RESTE REFUSÉ ═════════════════════════════════════════════════════════════════════════
--
-- 1. `valeur → null`. Un effacement n'est pas une rectification : c'est l'art. 17, il a sa propre
--    porte (`effacer_toutes_mes_donnees`, 0058) et elle emporte tout le compte. Laisser une entrée
--    revenir à `null` par ce chemin-ci ferait surtout retomber le thème en `midi_par_defaut` sans
--    le dire.
--
-- 2. ⚠️ LE LIEU DE NAISSANCE RESTE WRITE-ONCE, et ce n'est PAS parce que la story n'a pas eu le
--    temps. L'art. 16 vaut pour lui aussi — la raison est technique, et elle est décisive :
--
--      le lieu est QUATRE colonnes qui doivent bouger ENSEMBLE (nom, latitude, longitude, fuseau),
--      re-résolues côté serveur depuis un seul code INSEE (`app/heure-naissance/actions.ts`). Un
--      trigger ne peut pas vérifier qu'elles proviennent de la même commune. Ouvrir la porte ici
--      permettrait de corriger la seule latitude et d'obtenir un lieu à moitié faux : un nom de
--      commune d'un côté, des coordonnées d'une autre — plausible, invérifiable, faux. C'est
--      exactement le mode d'échec que 0039 refusait déjà pour les coordonnées partielles.
--
--    L'heure, elle, est UNE colonne : sa correction ne peut pas être à moitié faite.
--
--    DETTE NOMMÉE (2026-08-16) : corriger son lieu de naissance exigera une RPC qui prend un code
--    INSEE et pose les quatre colonnes en un seul geste — et cette RPC, alors, pourra être la porte.
--    Tant qu'elle n'existe pas, le refus est un refus honnête, pas un oubli.

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 1. La trace — POSSÉDÉE PAR LE SERVEUR, à deux serrures distinctes
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- Les deux colonnes ne sont JAMAIS accordées à `authenticated` (0041 accorde l'UPDATE colonne par
-- colonne, et celles-ci n'y entrent pas) ET sont réécrites par le trigger à chaque passage. Les deux
-- serrures ne ferment PAS la même porte, et c'est pour ça qu'elles coexistent :
--   • le grant absent arrête `authenticated`, qui ne peut pas nommer la colonne ;
--   • le trigger arrête `service_role`, à qui aucun grant ne s'oppose (même raisonnement que les
--     CHECK de table en 0058 : ce qui doit lier le rôle système ne peut pas vivre dans une policy).
-- `tests/naissance-correction-sql.test.ts` les éprouve SÉPARÉMENT — sinon l'une couvrirait le
-- mutant de l'autre, et on croirait tenir deux gardes en n'en tenant qu'une.

alter table public.utilisatrice add column naissance_corrections integer not null default 0;
alter table public.utilisatrice add column naissance_corrigee_le  timestamptz;

alter table public.utilisatrice
  add constraint utilisatrice_naissance_corrections_positives
  check (naissance_corrections >= 0);

-- Le compteur et la date disent la MÊME chose ; les laisser diverger permettrait d'afficher
-- « corrigé 3 fois » sans savoir quand, ou une date sans correction. Contrainte de TABLE : elle lie
-- aussi `service_role`, que la RLS ne lie pas.
alter table public.utilisatrice
  add constraint utilisatrice_naissance_correction_coherente
  check ((naissance_corrections = 0) = (naissance_corrigee_le is null));

comment on column public.utilisatrice.naissance_corrections is
  'Nombre de corrections de l''HEURE de naissance (Story 6.5b, RGPD art. 16). POSÉ PAR LE TRIGGER, jamais par l''appelante : ni `authenticated` (aucun grant en 0041) ni `service_role` (le trigger réécrit la valeur) ne peuvent le forger. N''est PAS un plafond, et n''est PAS montré à l''écran (ce serait un compteur, FR-031) : c''est la piste d''audit. L''écran montre la DATE.';

comment on column public.utilisatrice.naissance_corrigee_le is
  'Date de la DERNIÈRE correction de l''heure de naissance, ou null si aucune. C''est CETTE colonne que l''écran montre. Voir naissance_corrections.';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 2. La porte : le write-once devient un write-once CORRIGIBLE
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- On remplace le trigger de 0039 plutôt que de l'amender : son nom (`naissance_ecrite_une_fois`)
-- deviendrait un mensonge, et un nom qui ment dans une garde est pire qu'une garde absente.

drop trigger  if exists utilisatrice_naissance_ecrite_une_fois on public.utilisatrice;
drop function if exists public.naissance_ecrite_une_fois();

create function public.naissance_corrigible()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_correction boolean := false;
begin
  -- ── 1. Un effacement n'est pas une rectification ──────────────────────────────────────────────
  if (old.heure_naissance is not null and new.heure_naissance is null)
     or (old.lieu_naissance  is not null and new.lieu_naissance  is null)
     or (old.lieu_latitude   is not null and new.lieu_latitude   is null)
     or (old.lieu_longitude  is not null and new.lieu_longitude  is null)
     or (old.lieu_fuseau     is not null and new.lieu_fuseau     is null) then
    raise exception 'naissance_effacement_refuse' using
      errcode = '23514',
      hint    = 'Une entrée de naissance se corrige, elle ne s''efface pas (art. 17 a sa propre porte).';
  end if;

  -- ── 2. LE LIEU reste write-once (voir l'encadré en tête : quatre colonnes solidaires) ─────────
  if (old.lieu_naissance is not null and new.lieu_naissance is distinct from old.lieu_naissance)
     or (old.lieu_latitude  is not null and new.lieu_latitude  is distinct from old.lieu_latitude)
     or (old.lieu_longitude is not null and new.lieu_longitude is distinct from old.lieu_longitude)
     or (old.lieu_fuseau    is not null and new.lieu_fuseau    is distinct from old.lieu_fuseau) then
    raise exception 'lieu_naissance_write_once' using
      errcode = '23514',
      hint    = 'Le lieu ne se corrige pas colonne par colonne : ses quatre champs doivent être re-résolus ensemble depuis un code INSEE.';
  end if;

  -- ── 3. L'HEURE : un remplacement est une CORRECTION ───────────────────────────────────────────
  -- `null → valeur` n'en est PAS une : c'est le parcours de complétion de la 5.3, et il ne consomme
  -- rien. Seul `valeur → autre valeur` compte.
  if old.heure_naissance is not null
     and new.heure_naissance is distinct from old.heure_naissance then
    v_correction := true;
  end if;

  -- ── 4. Corriger une entrée, c'est faire bouger une donnée art. 9 ─────────────────────────────
  --
  -- Les ENTRÉES de naissance ne sont pas art. 9 (0039 le dit, et il a raison : une heure et une
  -- commune sont de l'état civil). Mais une CORRECTION n'a qu'un seul effet : faire regraver le
  -- thème natal, qui l'est. La garde est donc la même que celle du WITH CHECK de `theme_natal`,
  -- portée ici parce que c'est ici que le geste commence.
  --
  -- Sans elle, quelqu'un qui a révoqué son consentement pourrait corriger son heure et obtenir…
  -- rien : l'entrée changée, le thème figé sur l'ancienne, et aucune erreur nulle part. L'état
  -- incohérent silencieux, exactement ce que la 5.3 avait pris soin d'éviter.
  --
  -- ⚠️ NE MORD QUE SUR UNE CORRECTION : le premier remplissage (5.3) et les écritures système qui
  -- ne touchent pas ces colonnes (`echeance_suppression`, 0059) passent sans consulter quoi que ce
  -- soit — `a_consenti_art9()` rendrait `false` sous `service_role`, où `auth.uid()` est null.
  --
  -- ⚠️⚠️ CONSÉQUENCE NON PRÉVUE, MESURÉE PAR UN TEST ROUGE, ET CONSERVÉE : puisque le rôle système
  -- n'a pas d'identité, il n'a jamais de consentement — donc AUCUN CHEMIN SYSTÈME NE PEUT CORRIGER
  -- UNE ENTRÉE DE NAISSANCE. Ni un job, ni un script, ni un support. Une correction est toujours SON
  -- geste à elle, jamais un geste fait sur elle. C'est plus fort que ce que la story visait, et
  -- c'est la bonne direction pour la donnée d'où dérive tout le socle. Le prix est nommé : un
  -- correctif d'urgence exigerait de désactiver ce trigger à la main — un geste visible, pas une
  -- requête de plus.
  if v_correction then
    if not public.a_consenti_art9() then
      raise exception 'correction_sans_consentement' using
        errcode = '42501',
        hint    = 'Corriger fait regraver le thème natal : le consentement art. 9 doit être valide.';
    end if;
    if public.est_barre_minorite() then
      raise exception 'correction_sous_barriere' using errcode = '42501';
    end if;
  end if;

  -- ── 5. La trace, posée par le serveur dans les deux branches ──────────────────────────────────
  -- La branche `else` n'est PAS décorative : sans elle, une écriture système pourrait remettre le
  -- compteur à zéro et effacer la trace de toutes les corrections passées.
  if v_correction then
    new.naissance_corrections := old.naissance_corrections + 1;
    new.naissance_corrigee_le := now();
  else
    new.naissance_corrections := old.naissance_corrections;
    new.naissance_corrigee_le := old.naissance_corrigee_le;
  end if;

  return new;
end;
$$;

create trigger utilisatrice_naissance_corrigible
  before update on public.utilisatrice
  for each row execute function public.naissance_corrigible();

revoke execute on function public.naissance_corrigible() from public, anon, authenticated;

comment on function public.naissance_corrigible() is
  'Story 6.5b : l''HEURE de naissance se corrige (RGPD art. 16), autant de fois qu''il le faut ; elle ne s''efface pas (art. 17 a sa porte) ; le LIEU reste write-once (quatre colonnes solidaires qu''un trigger ne peut pas vérifier ensemble — dette nommée). Chaque correction est comptée et datée par le SERVEUR, et exige un consentement art. 9 valide, ce qui ferme de fait tout chemin système (aucune identité ⇒ aucun consentement). Remplace `naissance_ecrite_une_fois` (0039), dont le write-once gravait une faute de frappe pour toujours (QA T17). Le thème natal se regrave tout seul à la lecture suivante — cette migration n''écrit aucun recalculateur.';
