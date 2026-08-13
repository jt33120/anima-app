---
story_key: "1-9-appliquer-barriere-minorite-detectee"
epic: 1
story: 9
title: "Appliquer la barrière de minorité détectée"
epic_name: "Franchir le seuil"
covers: [FR-071, AD-14, AD-9, AD-15, NFR-002, AD-12, AD-13]
depends_on:
  - "1-8-surimpression-persistante-mention-ia-aide"
  - "1-6-consentement-non-contournable-revocable"
  - "1-4-date-naissance-majorite"
status: done
baseline_commit: 94d46c8a8ba8ca29574f00a2f9a410964d95c664
created: "2026-07-27"
sources:
  - _bmad-output/planning-artifacts/epics.md#epic-1--story-1-9
  - _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md#ad-14
  - _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md#ad-9
  - _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md#ad-15
  - _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md#ad-13
  - _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md#operations
  - _bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/EXPERIENCE.md#state-patterns
  - _bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md#fr-071
---

# Story 1.9 : Appliquer la barrière de minorité détectée

Status: done

<!-- Note : validation optionnelle. Lancer validate-create-story avant dev-story pour un contrôle qualité. -->

## Story

En tant qu'**utilisatrice dont un signal net révèle qu'elle est mineure**,
je veux **que le parcours s'interrompe par un message clair et non culpabilisant, que mon compte soit suspendu, qu'on m'oriente vers des ressources de mon âge (le 3018 en tête), et que mes données soient effacées sous 30 jours après qu'un export m'a été proposé**,
afin d'**être protégée sans être punie, ni voir mes données exploitées, ni payer quoi que ce soit**.

**Sous le capot (l'enjeu de fond, pour le dev) :** cette story est la DERNIÈRE d'Epic 1 et elle ferme le socle légal-sécurité. Son invariant structurant n'est pas l'écran : c'est **AD-14 — le propriétaire unique de rétention/effacement**. 1.9 **applique** la barrière (suspend + enregistre l'échéance 30 j) et **n'efface JAMAIS elle-même** : la suppression appartient au **moteur unique** (jobs planifiés idempotents), qui arrive à l'**Epic 6 / Story 6.8**. Le piège serait de « rendre la story complète » en supprimant les données ici : ce serait dupliquer le propriétaire des durées, exactement ce qu'AD-14 interdit. Ici on pose une **donnée** (`echeance_suppression`) que le moteur consommera plus tard.

Deux autres frontières dures encadrent la story :
- **Le drapeau est INJECTÉ.** Le classifieur qui détecte la minorité *en conversation* relève du pipeline de sécurité (Epic 2). Ici il n'existe pas : la barrière est déclenchée par une injection contrôlée (test + affordance DEV). On construit le **mécanisme** et le **seam** où le futur classifieur se branchera — pas le classifieur.
- **La suspension mord au niveau BASE, pas à l'écran** (leçon de 1.6 / AD-13). « Plus aucune écriture » (AC1) est prouvé par le **write-gate qui se referme même avec un consentement valide** — une garde SQL `WITH CHECK`, pas une condition d'UI. Un écran qui « bloque » sans garde base serait une illusion de sécurité.

Cette barrière est **distincte** de `mineur_detecte` (Story 1.4) : celle-là bloque à la **déclaration** d'âge (compte jamais consenti, abandonné → `signOut` + `/entrer?refus=age`) ; celle-ci frappe **après coup** un compte qui a **consenti et accumulé des données** → il faut le suspendre, l'orienter, enregistrer l'échéance, proposer un export, poser le point de remboursement. Deux exigences distinctes (FR-069/070 vs **FR-071**), deux états.

## Acceptance Criteria

1. **Étant donné** un signal net de minorité levé pour une utilisatrice — *le classifieur en conversation relève d'un epic ultérieur ; ici le drapeau est **injecté*** — **Quand** la barrière s'applique **Alors** le compte est **suspendu immédiatement** : au **niveau base**, plus aucune **écriture de contenu** n'est possible — le **write-gate art. 9 se referme même avec un consentement valide** (garde `est_barre_minorite()` en `WITH CHECK`, prouvée en CI sur `art9_temoin`) — **Et** toute route protégée **route vers `/barriere`** (« plus aucun échange » : la scène et le futur fil de conversation deviennent inatteignables) **Et** la **lecture** reste ouverte au propriétaire (`USING` inchangé), pour permettre l'export. *(FR-071 ; AD-14 ; SPINE AD-13 write-gate L118 ; epics AC L527)*

2. **Étant donné** la suspension **Quand** l'écran `/barriere` s'affiche **Alors** un message **clair et non culpabilisant**, en **registre produit** et **JAMAIS signé d'Anam**, explique que l'app est réservée aux **majeures** (ce n'est pas une sanction) **Et** il **oriente vers des ressources adaptées à l'âge — le 3018 en tête —** rendues dans le **bloc ressources** (numéros en lien `tel:`, doublage vocal chiffre par chiffre), **JAMAIS une modale, JAMAIS de rouge / `{colors.alerte}`, JAMAIS un pictogramme de danger** (AD-9). *(FR-071 ; AD-9 L79 ; EXPERIENCE §State Patterns L187, §Component Patterns L160 ; epics AC L529)*

3. **Étant donné** la suspension **Quand** l'utilisatrice consulte l'écran **Alors** il dit **sans détour** que les données seront **supprimées sous 30 jours**, **sans exploitation d'aucune sorte**, et **un export lui est proposé avant suppression, en une action** **Et** l'**échéance de suppression à 30 jours est ENREGISTRÉE** (`utilisatrice.echeance_suppression`, calculée depuis une **durée paramétrée** — jamais codée en dur dans le SQL) **pour le moteur unique de rétention/effacement** (AD-14) — **1.9 n'efface RIEN elle-même**. *(FR-071 ; AD-14 L123 ; epics AC L531)*

4. **Étant donné** les données déjà collectées **Quand** la barrière est active **Alors** elles ne sont **exploitées à aucune fin** (analyse produit, segmentation, marketing) : l'écran `/barriere` **ne charge aucun traceur** (comme `/aide`, NFR-002), l'**enregistrement d'audit** de la classification ne porte **aucune** donnée art. 9 (type / décision / horodatage seulement), et **aucun chemin** ne lit les données d'un compte suspendu à des fins d'analyse. *(FR-071 ; NFR-002 L231 ; SPINE Opérations L241 ; epics AC L533)*

5. **Étant donné** le parcours d'entrée, **sans paiement à ce stade** **Quand** la minorité est détectée **Alors** **aucun paiement n'est encaissé** **Et** le **point de déclenchement** du **remboursement intégral** est **posé ici** (fonction `declencherRemboursement`, stub honnête et journalisé, appelée par l'application de la barrière) — l'intégration Stripe réelle (encaissement **et** remboursement) relève de l'**Epic 3** ; 1.9 pose le seam, pas le paiement. *(FR-071 ; epics AC L535 ; SPINE conventions paywall/Stripe)*

> **Périmètre — ce que 1.9 NE fait PAS** (garde-fous de scope, pour ne pas empiéter sur les epics suivants) :
> - **Pas le classifieur de minorité en conversation** — le drapeau est **injecté** (test + DEV). Le vrai détecteur vit dans le pipeline sécurité → **Epic 2**. Ici on pose la fonction d'application que ce classifieur appellera.
> - **Pas le moteur de rétention/effacement** — le job planifié qui **supprime** réellement à l'échéance, purge les caches, se propage aux sous-traitants et au PITR (AD-14) → **Story 6.8 / Epic 6**. 1.9 **enregistre** `echeance_suppression`, ne supprime pas.
> - **Pas l'intégration Stripe** (encaissement / remboursement réels) → **Epic 3**. Ici : le **point de déclenchement** du remboursement (stub).
> - **Pas le bloc ressources formalisé** (fiche `surface-elevee` + `bordure-forte`, date « vérifié le … », revue périodique FR-044, sortie rapide FR-074, garde `limites_levees`) → **Story 2.5**. Ici on réutilise la **présentation minimale** des ressources déjà posée en 1.8 (`/aide` : liste `tel:` + doublage vocal par chiffre), avec la **liste adaptée à l'âge** (3018 en tête). *(La fusion `/aide` ↔ `/barriere` en un composant partagé est différée à 2.5 — voir Dev Notes, décision 5.)*
> - **Pas l'export complet FR-067** (toutes les tables art. 9, propagation sous-traitants, PITR) → **Story 6.6**. Ici : un **export minimal réel et honnête** (les rangs existants du compte), en une action — le seam que 6.6 élargira.
> - **Pas de fusion avec `mineur_detecte`** (0003) : état **distinct** (barrière post-détection FR-071 vs blocage à la déclaration FR-069/070). Voir Dev Notes, décision 1.

## Tasks / Subtasks

- [x] **Tâche 1 — Le domaine pur : durée paramétrée + calcul d'échéance (`lib/safety/`)** (AC : 1, 3)
  - [x] Écrire d'abord le test ROUGE (`tests/barriere-minorite.test.ts`, bloc domaine pur) : `DELAI_SUPPRESSION_MINORITE_JOURS === 30` ; `echeanceSuppression(new Date("2026-07-27T12:00:00Z")) === "2026-08-26"` ; fonction pure (aucun import React/Next/Supabase).
  - [x] `lib/safety/barriere-minorite.ts` (NOUVEAU — **premier vrai fichier de `lib/safety/`**, la couche sécurité). Contrat proposé :
    ```ts
    /**
     * Barrière de minorité — logique PURE (AD-1/AD-10 : la couche sécurité ne dépend
     * d'aucune infra). La DURÉE de suppression est ici, en un seul endroit (AD-14 :
     * échéances paramétrées, jamais codées en dur — surtout pas dans le SQL). Le moteur
     * unique de rétention (Story 6.8) et l'application de la barrière lisent CETTE valeur.
     */
    export const DELAI_SUPPRESSION_MINORITE_JOURS = 30; // FR-071 : suppression sous 30 jours

    /** Échéance de suppression (date UTC `YYYY-MM-DD`) = maintenant + délai paramétré. */
    export function echeanceSuppression(maintenant: Date = new Date()): string {
      const d = new Date(maintenant);
      d.setUTCDate(d.getUTCDate() + DELAI_SUPPRESSION_MINORITE_JOURS);
      return d.toISOString().slice(0, 10);
    }
    ```
  - [x] Vérifier le vert.

- [x] **Tâche 2 — La barrière au niveau BASE (migration `0006`)** (AC : 1, 3, 4)
  - [x] `supabase/migrations/0006_barriere_minorite.sql` (NOUVEAU, forward-only, en-tête documentant la story + AD-14/AD-13/AD-9/FR-071). Contient, dans l'ordre :
    - [x] **Colonnes d'état** sur `utilisatrice` (l'état existant `mineur_detecte` reste, on ne le touche pas) :
      ```sql
      alter table public.utilisatrice
        add column barriere_minorite_le timestamptz,   -- null = active ; non-null = suspendue
        add column echeance_suppression date;          -- échéance enregistrée POUR le moteur (AD-14)
      ```
    - [x] **Prédicat de garde** `est_barre_minorite()` — sans paramètre, sur `auth.uid()` (pas d'oracle inter-utilisatrices — leçon 1.6), `security definer set search_path=''`, `grant execute to authenticated`, calqué sur `a_consenti_art9()` (0005).
      ```sql
      create or replace function public.est_barre_minorite()
      returns boolean language sql stable security definer set search_path = '' as $$
        select exists (
          select 1 from public.utilisatrice u
          where u.id = (select auth.uid()) and u.barriere_minorite_le is not null
        );
      $$;
      ```
    - [x] **Durcir le write-gate art. 9** : « plus aucune écriture » (AC1). On **re-crée** la policy `art9_temoin_ecriture` de 0005 en ajoutant `and not public.est_barre_minorite()` au `WITH CHECK`. Le `USING` (lecture propriétaire) **reste inchangé** → export encore possible sous barrière.
      ```sql
      drop policy art9_temoin_ecriture on public.art9_temoin;
      create policy art9_temoin_ecriture on public.art9_temoin
        for all
        using      (auth.uid() = utilisatrice_id)
        with check (auth.uid() = utilisatrice_id
                    and public.a_consenti_art9()
                    and not public.est_barre_minorite());
      ```
    - [x] **Table d'audit sécurité** `audit_securite` — **sans art. 9** (type / décision / horodatage). Système-only : RLS `enable` + `force`, **aucune policy** (deny-by-default, comme `probe`/0001) → alimentée uniquement par la fonction définer ci-dessous.
      ```sql
      create table public.audit_securite (
        id              uuid primary key default gen_random_uuid(),
        utilisatrice_id uuid not null references public.utilisatrice(id) on delete cascade,
        type            text not null,         -- ex. 'minorite'
        decision        text not null,         -- ex. 'barriere_appliquee'
        cree_le         timestamptz not null default now()
      );
      alter table public.audit_securite enable row level security;
      alter table public.audit_securite force  row level security;  -- aucune policy = deny-by-default
      ```
    - [x] **Application atomique + idempotente** `appliquer_barriere_minorite(cible uuid, echeance date)` — `security definer`, réservée au **rôle service** (décision SYSTÈME : le futur classifieur serveur ou l'injection ; **pas** une écriture de contenu par l'utilisatrice, AD-12). Idempotente : si déjà suspendue, ne réécrit rien et **ne ré-audite pas**.
      ```sql
      create or replace function public.appliquer_barriere_minorite(cible uuid, echeance date)
      returns void language plpgsql security definer set search_path = '' as $$
      declare deja boolean;
      begin
        select barriere_minorite_le is not null into deja from public.utilisatrice where id = cible;
        if coalesce(deja, false) then return; end if;  -- idempotent : suspendue une seule fois
        update public.utilisatrice
           set barriere_minorite_le = now(), echeance_suppression = echeance
         where id = cible;
        insert into public.audit_securite (utilisatrice_id, type, decision)
        values (cible, 'minorite', 'barriere_appliquee');
      end;
      $$;
      revoke all on function public.appliquer_barriere_minorite(uuid, date) from public, authenticated;
      ```
  - [x] Test ROUGE puis vert (SQL réel contre Supabase local, cf. pattern §Testing) : voir Tâche 7.

- [x] **Tâche 3 — La machine à états : étendre l'onboarding + router `barre` PARTOUT** (AC : 1, 2)
  - [x] `app/(auth)/onboarding.ts` : ajouter l'état à `EtapeOnboarding`, le champ à `LigneOnboarding`, et **primer `barre` en PREMIER** (la suspension est l'état le plus fort). Documenter l'ordre.
    ```ts
    export type LigneOnboarding = {
      date_naissance: string | null;
      mineur_detecte: boolean;
      barriere_minorite_le: string | null; // 1.9 : suspension post-détection (FR-071)
    } | null;

    export type EtapeOnboarding = "barre" | "mineur" | "naissance" | "consentement" | "revoque" | "suite";

    export function etapeOnboarding(ligne, consentement) {
      if (ligne?.barriere_minorite_le) return "barre";   // 1.9 : suspension, prime sur tout
      if (ligne?.mineur_detecte) return "mineur";
      if (consentement === "revoque") return "revoque";
      if (!ligne || !ligne.date_naissance) return "naissance";
      if (consentement === "aucun") return "consentement";
      return "suite";
    }
    ```
  - [x] `app/(auth)/etat-onboarding.ts` : ajouter `barriere_minorite_le` au `.select("date_naissance, mineur_detecte, barriere_minorite_le")`.
  - [x] **Router `barre` → `/barriere` à CHAQUE site de garde** — **SANS `signOut`** (contrairement à `mineur`) : l'utilisatrice reste connectée pour pouvoir **exporter** (le `USING` RLS ouvert n'est utile que si la session vit). Les 7 fichiers concernés (garde symétrique adossée à la source unique) :
    1. `app/page.tsx`
    2. `app/auth/confirm/route.ts` (retourne une chaîne, pas `redirect`) → `if (etape === "barre") return "/barriere";`
    3. `app/(auth)/consentement/actions.ts` → **`donnerConsentement`** ET **`revoquerConsentement`**
    4. `app/(auth)/consentement/page.tsx`
    5. `app/(auth)/consentement/revoque/page.tsx`
    6. `app/(auth)/consentement/revoquer/page.tsx`
    7. `app/(auth)/naissance/page.tsx`
  - [x] Placer la branche `barre` **juste avant** la branche `mineur` existante à chaque site (prime en premier). Exemple (`app/page.tsx`) :
    ```ts
    if (etape === "barre") redirect("/barriere");   // suspendue (1.9) : reste connectée pour l'export
    if (etape === "mineur") { await supabase.auth.signOut(); redirect("/entrer?refus=age"); }
    ```
  - [x] **Anti-divergence (leçon 1.4 : « une barrière oubliée dans un seul chemin »)** : ajouter au test un scan de ces 7 fichiers qui échoue si l'un d'eux ne route pas `barre` (voir Tâche 7). Ne PAS refactorer le routage en helper partagé dans cette story (risque de régression sur 6 stories done — décision 4 des Dev Notes).

- [x] **Tâche 4 — Appliquer la barrière (server action) + point de remboursement + injection DEV** (AC : 1, 3, 5)
  - [x] `app/barriere/actions.ts` (NOUVEAU, `"use server"`) :
    - [x] `appliquerBarriereMinorite(cible: string)` : calcule l'échéance via le domaine (`echeanceSuppression()`), appelle la fonction SQL via le client **admin** (`createSupabaseAdminClient`, service_role — **tâche système**, AD-12, jamais du contenu), puis appelle `declencherRemboursement(cible)`. C'est le seam où le futur classifieur (Epic 2) se branchera.
      ```ts
      const admin = createSupabaseAdminClient();
      await admin.rpc("appliquer_barriere_minorite", { cible, echeance: echeanceSuppression() });
      await declencherRemboursement(cible);
      ```
    - [x] `declencherRemboursement(cible: string)` : **stub honnête** (AC5) — aucun Stripe en Epic 1 ; journalise l'intention (sans art. 9) et documente que l'encaissement/remboursement réels sont câblés à l'**Epic 3**. Ne prétend PAS rembourser.
  - [x] **Injection DEV** (pour que Julian VOIE l'écran en `npm run dev`, pas seulement en test) : ajouter au bloc DEV existant de `app/(auth)/entrer/page.tsx` (déjà gardé `NODE_ENV !== "production"`) un second bouton **« Entrer en compte suspendu (démo minorité) »** relié à une action DEV-only `entreeDemoSuspendue` (dans `app/(auth)/entrer/actions.ts`) : crée/connecte le compte démo (réutilise `entreeDemo`) **puis** `appliquerBarriereMinorite(user.id)` → atterrit sur `/barriere`. Strictement DEV (n'existe pas en prod, comme `entreeDemo`).

- [x] **Tâche 5 — L'écran halte `/barriere`** (AC : 2, 3, 4, 5)
  - [x] `app/barriere/page.tsx` (NOUVEAU, Server Component). `export const metadata = { title: "Anam" };` (NFR-015). **Gardé** : lit la session + `etapeOnboardingPour` ; si pas d'utilisateur → `/entrer` ; si `etape !== "barre"` → router comme les autres gardes (sinon boucle) ; si `"barre"` → rend l'écran. Contenu :
    - [x] `surtitre` « Anam », un titre sobre (ex. `t-titre` « Une pause »), puis un **message produit non signé d'Anam** (AC2) : l'app est réservée aux majeures, ce n'est pas une sanction ; registre neutre, aucune deuxième personne « signée » d'Anam, zéro emoji/exclamation (voir §Voix).
    - [x] **Bloc ressources adapté à l'âge** (AC2), 3018 en tête, présentation minimale reprise de `/aide` (1.8) : `<a href={`tel:${r.tel}`} aria-label={`${r.service}, ${r.aria}`}>` + `aria` chiffre par chiffre. Liste recommandée (Dev Notes, décision 3).
    - [x] **Notice données** (AC3) : « tes données seront supprimées sous 30 jours, sans être exploitées » — dit sans détour, en `t-corps`.
    - [x] **Export en une action** (AC3) : un lien/bouton unique déclenchant l'export (Tâche 6). Libellé sobre.
    - [x] **Aucune sémantique d'alerte** (AC2/AC4) : `surface` / `surface-elevee` / `bordure-forte`, **jamais `--alerte`, jamais rouge**, jamais modale, jamais pictogramme de danger. Aucun `<script>`/traceur (NFR-002).
  - [x] `app/barriere/barriere.module.css` (NOUVEAU) : sobre, cohérent avec `aide.module.css` (1.8) et `consentement/revoque` (1.6). `.numero` avec `min-height: var(--cible-tactile)`.

- [x] **Tâche 6 — L'export minimal réel (une action)** (AC : 3)
  - [x] `app/api/export/route.ts` (NOUVEAU, `GET`) : authentifié ; lit **sous la session RLS** (`createSupabaseServerClient`, `USING` ouvert → fonctionne **sous barrière**) les rangs existants du compte courant (`utilisatrice` + `consentement`) ; renvoie un **JSON en pièce jointe** (`Content-Disposition: attachment; filename="anam-mes-donnees.json"`, `Cache-Control: no-store`). Ne lit QUE ses propres données (getUser d'abord ; RLS garantit l'isolation). Minimal et **honnête** : c'est le **seam** que la Story 6.6 (export exhaustif FR-067, toutes tables art. 9 + propagation) élargira — le documenter en tête de fichier.
  - [x] (Le bouton de `/barriere` pointe vers cette route.)

- [x] **Tâche 7 — Les gardes (tests significatifs, non tautologiques)** (AC : 1, 2, 3, 4, 5)
  - [x] `tests/barriere-minorite.test.ts` (NOUVEAU) :
    - [x] **Domaine pur** : `DELAI_SUPPRESSION_MINORITE_JOURS === 30` ; `echeanceSuppression` = maintenant + 30 j (date connue).
    - [x] **Décision pure** : `etapeOnboarding({date_naissance:"1990-01-01", mineur_detecte:false, barriere_minorite_le:"..."}, "valide") === "barre"` — et `barre` **prime** même sur `mineur`/`revoque`.
    - [x] **SQL réel** (Supabase local, pattern admin+RLS de `write-gate-art9.test.ts` / `date-naissance.test.ts`) :
      - Sous barrière, une écriture `art9_temoin` **est REFUSÉE même avec un consentement valide** (AC1) — la garde base mord, pas l'UI.
      - Sous barrière, la **lecture** `art9_temoin` (et `utilisatrice`) **reste possible** au propriétaire (export, AC3/AC1).
      - `appliquer_barriere_minorite` **idempotente** : deux appels → `barriere_minorite_le`/`echeance_suppression` stables, **un seul** rang `audit_securite`.
      - `echeance_suppression` posée **= aujourd'hui + 30 j** (AC3).
      - `audit_securite` alimentée, **sans art. 9** (colonnes type/decision/cree_le uniquement) et **non lisible sous RLS** par l'utilisatrice (deny-by-default, AC4).
      - `est_barre_minorite()` : pas d'oracle inter-utilisatrices (une session ne révèle pas l'état d'une autre).
    - [x] **Anti-divergence** (garde par lecture de fichiers, comme les tests de scène) : pour **chacun** des 7 sites de garde listés en Tâche 3, asserter que le fichier route `barre` (contient `"barre"` **et** `"/barriere"`). Le test **échoue** si un site oublie la barrière.
    - [x] **Écran** (garde par lecture de `app/barriere/page.tsx` + css) : aucun import de traceur (`analytics|gtag|mixpanel|posthog|plausible`) — NFR-002/AC4 ; aucun `--alerte`/`red` dans le css ; présence du **3018** et d'un lien `tel:` ; l'export est **une action** (un lien vers `/api/export`) ; **jamais signé d'Anam** (pas de `t-anam` portant une 1re personne d'Anam — un simple contrôle de registre : titre + `t-corps`, pas de voix Anam).
  - [x] Faire tourner **toute** la suite (`npx vitest run`) : zéro régression sur la suite existante (vérifier en particulier `write-gate-art9.test.ts` — un compte NON suspendu avec consentement valide doit TOUJOURS pouvoir écrire) + les nouveaux tests au vert.

## Dev Notes

### L'invariant central : AD-14 — on APPLIQUE, on n'EFFACE pas

`ARCHITECTURE-SPINE.md#ad-14` (L120-123) : *« un **moteur unique** (jobs planifiés idempotents) possède les durées NFR-021 — … **minorité détectée (FR-071) → 30 j** — échéances **paramétrées** (jamais codées en dur), journalisées sans art. 9 en clair, export proposé avant suppression. »* Traduction pour 1.9 :
- On **enregistre** `echeance_suppression` (une donnée), calculée depuis `DELAI_SUPPRESSION_MINORITE_JOURS` (le paramètre, en **un** endroit — pas dans le SQL). Le **moteur** (Story 6.8) lira cette date pour supprimer. 1.9 **ne supprime pas**, ne planifie pas de job, ne propage rien. Empiéter dessus = dupliquer le propriétaire des durées (le défaut qu'AD-14 nomme).
- « export proposé avant suppression » : posé ici (Tâche 6, minimal), élargi par 6.6 (FR-067).

### Décisions de conception (à ne pas re-litiger en dev)

1. **État DISTINCT de `mineur_detecte`.** `mineur_detecte` (0003) = blocage à la **déclaration** d'âge (FR-069/070) : compte jamais consenti, `signOut` + `/entrer?refus=age`. `barriere_minorite_le` (0006) = minorité **détectée après coup** (FR-071) : compte consenti, avec données → suspension + échéance + écran + export + point de remboursement. Réutiliser la même colonne casserait : le routage `mineur` fait `signOut` (l'utilisatrice ne pourrait plus exporter) et va vers `/entrer?refus=age` (pas l'écran 30 j / ressources 3018). Deux exigences ⇒ deux états.
2. **La suspension NE fait PAS `signOut`.** Contrairement à `mineur`. Raison : l'export (AC3) lit sous RLS (`USING` ouvert) — il faut une session vivante. La session survit mais **toute route protégée renvoie à `/barriere`** et **toute écriture de contenu est refusée en base**. C'est ça, « suspendu ».
3. **Ressources adaptées à l'âge (3018 en tête).** Liste **recommandée** (à confirmer avec le pro — porte pré-lancement FR-044, comme pour `/aide`) :
   - **3018** — violences numériques / harcèlement en ligne (national, jeunes, gratuit) — *en tête (epics L529)*.
   - **119** — Enfance en danger (à toute heure).
   - **Fil Santé Jeunes** — `0800 235 236` (anonyme, gratuit).
   - **3114** — souffrance psychique / prévention du suicide (tous âges).
   > Ce n'est **pas** la liste de `/aide` (1.8), qui vise des adultes (3114/15/112/3919/119/SOS Amitié). L'écran minorité a sa **propre** liste, même **présentation**.
4. **On NE refactore PAS le routage en helper partagé** dans cette story. Un `destinationOnboarding(etape)` centralisé serait séduisant (fermer définitivement le trou « chemin oublié »), mais : (a) le side-effect `signOut` de `mineur` vs pas-de-signOut de `barre`, et (b) chaque site a un **état terminal différent** (la page `/consentement` rend le formulaire quand `etape==="consentement"`, l'action `donnerConsentement` écrit à ce moment-là, etc.) — un helper « redirige pour tout état ≠ suite » ne s'y plie pas sans réécrire 7 fichiers de 6 stories **done**. Risque > bénéfice. À la place : ajout mécanique de la branche `barre` à chaque site **+ un test qui scanne les 7 fichiers** (Tâche 7) — le trou est fermé par le test, pas par un refactor risqué. *(Si un refactor de centralisation est souhaité, c'en est le moment idéal en épilogue d'Epic 1 — mais alors comme story/chantier séparé, testé site par site.)*
5. **`/aide` et `/barriere` restent deux fichiers** pour l'instant (présentation dupliquée, minimale). L'extraction d'un composant `BlocRessources` partagé + la **fiche formalisée** (surface-elevee/bordure-forte, « vérifié le … », FR-044) sont **Story 2.5**. Toucher `/aide` (1.8, done) pour extraire maintenant = risque de régression sur `aide-route.test.ts` sans bénéfice de scope. Duplication documentée et assumée.
6. **L'audit `audit_securite` est inclus** (léger, seam propre). SPINE Opérations L241 : *« Chaque classification de sécurité (détresse, minorité) émet un **enregistrement d'audit sans art. 9** (niveau, décision, tier, horodatage). »* Ici le drapeau étant **injecté** (pas classifié), il n'y a ni « niveau » ni « tier » pertinents → on pose le minimum honnête (`type='minorite'`, `decision='barriere_appliquee'`, `cree_le`). Le classifieur réel (Epic 2) enrichira. Table système-only (RLS sans policy).

### Frontière serveur & rôles (AD-12) — qui écrit quoi

- **Application de la barrière** = **tâche SYSTÈME** (le futur classifieur serveur, ou l'injection) → `service_role` via `createSupabaseAdminClient` appelant `appliquer_barriere_minorite`. Ce n'est **pas** du contenu écrit par l'utilisatrice ; c'est une décision de sécurité sur le compte. Conforme à AD-12 (« `service_role` réservé aux migrations et **tâches système** »). La fonction est `security definer` et **révoquée** pour `public`/`authenticated` : une utilisatrice ne peut pas s'auto-lever ou lever autrui.
- **Export** = lecture par l'**utilisatrice** → `createSupabaseServerClient` (RLS `auth.uid()`), jamais admin. Fonctionne sous barrière car seul le `WITH CHECK` (écriture) s'est refermé ; le `USING` (lecture) reste ouvert.
- **Le prédicat `est_barre_minorite()`** lit `utilisatrice` en `security definer` sur `auth.uid()` uniquement — même garantie « pas d'oracle » que `a_consenti_art9()` (revue 1.6).

### Fichiers à modifier / créer

**NOUVEAUX :**
- `lib/safety/barriere-minorite.ts` — domaine pur (délai + échéance).
- `supabase/migrations/0006_barriere_minorite.sql` — colonnes + `est_barre_minorite()` + write-gate durci + `audit_securite` + `appliquer_barriere_minorite()`.
- `app/barriere/page.tsx` + `app/barriere/barriere.module.css` — l'écran halte.
- `app/barriere/actions.ts` — `appliquerBarriereMinorite`, `declencherRemboursement`.
- `app/api/export/route.ts` — export minimal réel.
- `tests/barriere-minorite.test.ts` — gardes.

**MODIFIÉS :**
- `app/(auth)/onboarding.ts` — `EtapeOnboarding` + `LigneOnboarding` + prime `barre`.
- `app/(auth)/etat-onboarding.ts` — `.select(... , barriere_minorite_le)`.
- Les **7 sites de garde** (Tâche 3) — branche `barre` → `/barriere`.
- `app/(auth)/entrer/page.tsx` + `app/(auth)/entrer/actions.ts` — bouton + action DEV `entreeDemoSuspendue`.

### État courant des fichiers clés (lu avant rédaction)

- **`app/(auth)/onboarding.ts`** — fonction pure `etapeOnboarding(ligne, consentement)` ; `mineur_detecte` prime aujourd'hui ; à faire primer par `barre`.
- **`app/(auth)/etat-onboarding.ts`** — `etapeOnboardingPour` (SOURCE UNIQUE), lit `utilisatrice.select("date_naissance, mineur_detecte")` + `consentement`, **fail-loud**. Ajouter la colonne au select.
- **`supabase/migrations/0005_write_gate_art9.sql`** — `a_consenti_art9()` + `art9_temoin` + policy `art9_temoin_ecriture` (`using` propriétaire, `with check` propriétaire **+ consentement**). 0006 **re-crée** cette policy en ajoutant `and not est_barre_minorite()`.
- **`app/(auth)/consentement/actions.ts`** — patterns de référence : `effacerCompteCourant` (admin `deleteUser`, échec non silencieux), `revoquerConsentement` (garde d'état symétrique), commentaire L96 : *« L'export réel des données (proposé avant la suppression) est différé à l'epic données (AD-14) »* → 1.9 pose l'export minimal, 6.6 le complète.
- **Migrations** : `0001`→`0005` présentes ; 1.9 = `0006`. **Forward-only**, une story par migration.

### Testing standards (résumé — cf. `write-gate-art9.test.ts`, `date-naissance.test.ts`)

- Vitest `environment: "node"` (pas de DOM). Deux styles :
  - **Pur / lecture de fichiers** : import direct (`lib/safety/…`, `app/(auth)/onboarding.ts`) ou lecture de source en string (gardes de routage/écran).
  - **SQL réel** contre **Supabase local** (`supabase start`) : `createClient(SUPABASE_URL, SUPABASE_SECRET_KEY)` (admin) pour préparer l'état (`admin.auth.admin.createUser`, `admin.rpc("appliquer_barriere_minorite", …)`), et une **session RLS** (`createClient(url, publishable)` + `signInWithPassword`) pour prouver le refus d'écriture / l'ouverture de lecture. `afterAll`: `admin.auth.admin.deleteUser`.
  - Rappel : Vitest ne charge pas `.env.local` → `npx vitest run`.
- **Red-green** : écrire le test qui échoue d'abord (Tâche 1 domaine, Tâche 2 SQL), constater le rouge, puis implémenter.

### Voix / registre (l'écran ne se signe JAMAIS d'Anam — AC2)

`EXPERIENCE.md` L187 : *« en registre produit, **jamais signé d'Anam** … un message **clair et non culpabilisant** … ce n'est pas une sanction. »* Concrètement : pas de « je » d'Anam, pas de `t-anam` en voix incarnée, pas de tutoiement « intime » ; un énoncé de faits calme (l'app est réservée aux majeures ; voici des ressources ; voici ce qui arrive à tes données ; voici comment exporter). Zéro emoji, zéro exclamation, aucune sémantique d'alerte. Le ton est celui de la page `/consentement/revoque` (1.6), pas celui d'Anam.

### Pièges connus (anticipés)

1. **Ne pas supprimer les données ici.** Tentation « finir le boulot » → viole AD-14. On enregistre l'échéance, c'est tout.
2. **Ne pas `signOut` sur `barre`.** Sinon l'export (RLS) devient impossible et l'AC3 casse.
3. **Ne pas oublier un des 7 sites de garde.** C'est LE risque (leçon 1.4). Le test anti-divergence (Tâche 7) doit lister les 7 fichiers en dur et échouer si l'un ne route pas `barre`.
4. **Ne pas coder « 30 » dans le SQL.** La durée vit dans `DELAI_SUPPRESSION_MINORITE_JOURS` (paramètre unique, AD-14) ; le SQL reçoit une **date** déjà calculée.
5. **Idempotence de l'application.** Deux détections ne doivent pas re-poser l'échéance (fenêtre 30 j stable) ni empiler des rangs d'audit. `coalesce`/garde `deja`.
6. **`/barriere` doit se garder lui-même** contre la boucle : rendu seulement si `etape === "barre"` ; sinon router (sans se rediriger vers `/barriere`).
7. **Boucle de redirection avec `/api/export`** : la route d'export ne passe PAS par la garde onboarding (sinon un compte `barre` serait renvoyé à `/barriere` au lieu d'exporter). Elle vérifie seulement `getUser()` + lit sous RLS.
8. **`declencherRemboursement` ne doit pas prétendre rembourser.** Stub honnête, journalisé, commenté « Epic 3 ». Ne pas simuler un succès Stripe.

### Project Structure Notes

- `lib/safety/` reçoit son **premier vrai module** (jusqu'ici un README stub) — cohérent avec le mapping SPINE L254/L260 (« sécurité » → `lib/safety/`). La barrière de minorité est une **sortie de classification de sécurité**, sa logique pure y a sa place ; l'application (I/O) vit en `app/…/actions.ts` + la fonction SQL.
- `app/barriere/` calque `app/aide/` (1.8) : route publique-de-halte, `title: "Anam"`, présentation ressources minimale.
- `app/api/export/` inaugure `app/api/**` côté **données** (la frontière serveur AD-2 posée en 1.7 pour l'IA ; ici un GET de lecture RLS, pas d'IA).

### References

- [epics.md — Story 1.9](_bmad-output/planning-artifacts/epics.md) (L519-535, AC L527/529/531/533/535)
- [ARCHITECTURE-SPINE.md — AD-14 rétention/effacement, propriétaire unique](_bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md) (L120-123)
- [ARCHITECTURE-SPINE.md — AD-9 haltes joignables, jamais de rouge/modale](_bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md) (L76-79)
- [ARCHITECTURE-SPINE.md — AD-13 write-gate / AD-15 filet / AD-12 RLS](_bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md) (L110-128)
- [ARCHITECTURE-SPINE.md — Opérations : audit de classification sans art. 9](_bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md) (L241)
- [EXPERIENCE.md — état « Minorité détectée »](_bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/EXPERIENCE.md) (L187) & [Bloc ressources](_bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/EXPERIENCE.md) (L160)
- [prd.md — FR-071](_bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md) (L57), [NFR-002](_bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md) (L231), [NFR-021](_bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md) (L234)
- Code existant : [onboarding.ts](app/(auth)/onboarding.ts), [etat-onboarding.ts](app/(auth)/etat-onboarding.ts), [0005_write_gate_art9.sql](supabase/migrations/0005_write_gate_art9.sql), [consentement/actions.ts](app/(auth)/consentement/actions.ts), [app/aide/page.tsx](app/aide/page.tsx)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context)

### Debug Log References

- **Régression d'ENVIRONNEMENT (pas de code)** : lancer `npx supabase db reset` a récupéré une CLI non épinglée (v2.109.1) qui a rendu la clé `sb_secret_` inopérante pour service_role via PostgREST (« permission denied for table utilisatrice » — cassait AUSSI `write-gate-art9.test.ts`, prouvant l'origine env). **Correctif** : `db reset` relancé avec la CLI épinglée du projet (binaire Homebrew `supabase` v2.67.1). ⚠️ Ne pas utiliser `npx supabase` sur ce repo — toujours le binaire global v2.67.1.

### Completion Notes List

- **TDD suivi** : domaine pur (Tâche 1) rouge → vert ; migration + gardes SQL prouvées contre Supabase local ; `barriere-minorite.test.ts` = 27 tests (domaine, décision, base réelle, anti-divergence, écran).
- **Écart assumé vs la story (sécurité)** : `appliquerBarriereMinorite` / `declencherRemboursement` ont été placées dans **`lib/safety/appliquer-barriere.ts` (`server-only`)**, PAS dans `app/barriere/actions.ts` en `"use server"`. Raison : un `"use server"` prenant un `cible` arbitraire serait invocable par n'importe quel client → suspension de n'importe quel compte. Le module `server-only` n'est appelable que par du code serveur de confiance (injection DEV self-only ; futur classifieur Epic 2). La fonctionnalité de la Tâche 4 est intégralement livrée.
- **Injection DEV** : `entreeDemoSuspendue` (self-only, `NODE_ENV !== production`) + bouton « Entrer en compte suspendu (démo minorité) » sur `/entrer` → Julian peut VOIR `/barriere` en `npm run dev`. Un helper `assurerSessionDemoConsentie` factorise le setup démo (partagé avec `entreeDemo`, comportement identique préservé).
- **AD-14 respecté** : 1.9 pose `echeance_suppression` (donnée) + audit ; elle **n'efface RIEN** (le moteur = Story 6.8).
- **Non-régression du write-gate** : la policy `art9_temoin_ecriture` re-créée (0006) ajoute `and not est_barre_minorite()` ; un compte NON suspendu + consentant écrit toujours (testé), un compte suspendu est refusé même consentant (testé).
- **Type sûr** : `LigneOnboarding.barriere_minorite_le` rendu **requis** (pas optionnel) → le compilateur force chaque appelant à fournir l'état de suspension (principe « aucun chemin n'oublie la barrière » au niveau du type). `tests/date-naissance.test.ts` mis à jour en conséquence (littéraux).
- **Validation** : `npx vitest run` = **224/224** (19 fichiers) · `tsc --noEmit` propre · `eslint .` propre · `npm run build` OK (`/barriere` et `/api/export` = Dynamic ; `/aide` reste Static).
- **Porte pré-lancement (signalée)** : la liste de ressources adaptées à l'âge (3018, 119, Fil Santé Jeunes, 3114) est à faire valider par un professionnel avant lancement (comme `/aide`).

### File List

**NOUVEAUX :**
- `lib/safety/barriere-minorite.ts` — domaine pur (délai paramétré + échéance).
- `lib/safety/appliquer-barriere.ts` — application (server-only) : `appliquerBarriereMinorite`, `declencherRemboursement`.
- `supabase/migrations/0006_barriere_minorite.sql` — colonnes, `est_barre_minorite()`, write-gate durci, `audit_securite`, `appliquer_barriere_minorite()`.
- `app/barriere/page.tsx` + `app/barriere/barriere.module.css` — écran halte.
- `app/api/export/route.ts` — export minimal réel (JSON en pièce jointe, sous RLS).
- `tests/barriere-minorite.test.ts` — 27 tests.

**MODIFIÉS :**
- `app/(auth)/onboarding.ts` — état `barre` (prime), champ `barriere_minorite_le` (requis).
- `app/(auth)/etat-onboarding.ts` — `barriere_minorite_le` ajouté au select.
- `app/page.tsx`, `app/auth/confirm/route.ts`, `app/(auth)/naissance/page.tsx`, `app/(auth)/consentement/page.tsx`, `app/(auth)/consentement/revoque/page.tsx`, `app/(auth)/consentement/revoquer/page.tsx`, `app/(auth)/consentement/actions.ts` (×2 : donner + revoquer) — routage `barre` → `/barriere` (8 points de garde).
- `app/(auth)/entrer/actions.ts` — helper `assurerSessionDemoConsentie` + `entreeDemoSuspendue` (DEV).
- `app/(auth)/entrer/page.tsx` — bouton DEV « compte suspendu ».
- `tests/date-naissance.test.ts` — littéraux `LigneOnboarding` complétés (`barriere_minorite_le: null`).

### Change Log

- 2026-07-27 — Story 1.9 implémentée : barrière de minorité détectée (suspension au niveau base + échéance 30 j enregistrée pour le moteur AD-14 + écran halte `/barriere` + export minimal + point de remboursement). 224/224 tests. Statut → review.
- 2026-07-27 — Revue de code adversariale (multi-agents, vérif croisée Sonnet) : 6 trouvailles traitées (2 HIGH + 2 MED + 2 LOW), aucune bloquante. Correctifs : (#3) `appliquer_barriere_minorite` sérialisée (UPDATE conditionnel + index unique partiel `audit_securite`) ; (#5) compte démo dédié pour la démo suspendue ; (#1) anti-divergence lie condition→destination (+ strip commentaires) ; (#2) test du refus AD-12 (authenticated/anon) ; (#4) test du wrapper de prod + alias `server-only` en test ; (#6) test « pas d'oracle » rendu concluant. **230/230 tests · tsc · lint · build OK.** Statut → done.

**Fichiers ajoutés/modifiés par les correctifs de revue :** `supabase/migrations/0006_barriere_minorite.sql` (fonction sérialisée + index), `app/(auth)/entrer/actions.ts` (compte démo dédié), `tests/barriere-minorite.test.ts` (+6 tests, anti-divergence durci, oracle concluant), `tests/_stubs/server-only.ts` (NOUVEAU), `vitest.config.ts` (alias `server-only`).

## Senior Developer Review (AI)

**Date :** 2026-07-27 · **Revue :** adversariale multi-agents (8 lentilles Opus 4.8 → vérification croisée Sonnet → synthèse) · **Verdict :** changes-requested (aucun blocage sécurité/légal). 8 trouvailles brutes → 7 survivantes → 1 réfutée.

**Validé (pas de défaut) :** risque n°1 OK — les 7 sites routent `barre → /barriere`, `/barriere` ne boucle pas, `/api/export` contourne volontairement la garde (export sous barrière, AC3) ; write-gate AD-13 re-créé avec `and not est_barre_minorite()`, `USING` ouvert ; `appliquer_barriere_minorite` révoquée pour public/anon/authenticated.

**Réfutée :** « le test anti-divergence a une liste de sites codée en dur » — c'est la spec assumée de la story (découverte dynamique hors périmètre).

### Action Items

- [x] **[HIGH] Le garde-fou CI du risque n°1 est contournable** (`tests/barriere-minorite.test.ts:234-239`) — les deux `toMatch` (`etape === "barre"` et `/barriere`) sont découplés, et `/barriere` apparaît dans des commentaires : muter la destination du redirect ne ferait PAS échouer le test. Fix : asserter l'adjacence condition→destination en une regex (ou stripper les commentaires, comme le bloc écran), et vérifier qu'une mutation de destination casse bien le test.
- [x] **[HIGH] Aucun test ne prouve le refus AD-12** (`tests/barriere-minorite.test.ts:128`) — `appliquer_barriere_minorite` n'est testée que via `admin` (service_role). Ajouter : appel via `clientScope()` (authenticated) avec un `cible` tiers → `error != null` (permission denied) ET cible non suspendue. (Le `revoke` est la seule garde de ce type, non couverte.)
- [x] **[MED] Race check-then-act dans `appliquer_barriere_minorite`** (`supabase/migrations/0006_barriere_minorite.sql:92`) — SELECT nu (sans `FOR UPDATE`) + UPDATE inconditionnel → deux appels concurrents (Epic 2 : classifieur/retries) doublent l'audit et écrasent l'échéance. Fix : UPDATE conditionnel `where id = cible and barriere_minorite_le is null; if not found then return;` AVANT l'audit ; + contrainte d'unicité partielle sur `audit_securite` ; + test de concurrence.
- [x] **[MED] Le wrapper de production `appliquerBarriereMinorite` n'est jamais testé** (`lib/safety/appliquer-barriere.ts:19`) — les tests appellent la RPC SQL directement avec une échéance recalculée à la main ; la soudure AD-14 (que `echeanceSuppression()` est bien injectée) n'est pas prouvée. Fix : test du wrapper réel → échéance en base == J+30, + cas d'erreur RPC → throw.
- [x] **[LOW] `entreeDemoSuspendue` empoisonne le compte démo partagé (DEV)** (`app/(auth)/entrer/actions.ts:119`) — une fois suspendu, le compte démo partagé reste `barre` (jamais levé en Epic 1), donc le bouton « démo » normal atterrit ensuite toujours sur `/barriere`. Fix : compte démo dédié pour la démo suspendue (ex. `demo-suspendu@anam.local`).
- [x] **[LOW] Le test « pas d'oracle » n'est pas concluant** (`tests/barriere-minorite.test.ts:213`) — au moment du test, aucune suspendue n'existe (cascade-supprimée par le describe précédent) ; il ne prouve que « compte vierge → false ». Fix : suspendre un tiers dans le `beforeAll` du bloc, puis vérifier qu'`autre` obtient toujours false.

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] Renforcer l'anti-divergence (adjacence condition→destination) + prouver qu'une mutation casse le test
- [x] [AI-Review][HIGH] Tester le refus AD-12 de `appliquer_barriere_minorite` (authenticated/anon)
- [x] [AI-Review][MED] Sérialiser `appliquer_barriere_minorite` (UPDATE conditionnel) + unicité audit + test concurrence
- [x] [AI-Review][MED] Tester le wrapper `appliquerBarriereMinorite` (soudure AD-14)
- [x] [AI-Review][LOW] Compte démo dédié pour `entreeDemoSuspendue`
- [x] [AI-Review][LOW] Rendre le test « pas d'oracle » concluant (suspendre un tiers dans le beforeAll)
