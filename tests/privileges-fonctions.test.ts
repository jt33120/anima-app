import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Migration 0007 — durcissement des privilèges EXECUTE (défense en profondeur, AD-12).
 *
 * Preuve BLOQUANTE en CI que le privilège RÉEL colle à l'intention (pas seulement un lint) :
 *  - `anon` ne peut PLUS exécuter les fonctions-prédicat (`a_consenti_art9`, `est_barre_minorite`) ;
 *  - un rôle privilégié (service_role) le peut TOUJOURS → le refus anon n'est pas dû à une fonction
 *    cassée ou absente (contrôle positif : le test n'est pas tautologique).
 *
 * L'invariant « `authenticated` GARDE execute sur les prédicats » (sinon le write-gate casse) est
 * déjà gardé par write-gate-art9.test.ts et barriere-minorite.test.ts (ils appellent ces rpc sous
 * session authentifiée et attendent un booléen, pas une erreur). Les fonctions-trigger, elles, ne
 * sont pas exposées en RPC : leur bon déclenchement post-revoke est prouvé par toute la suite
 * (chaque `createUser` dépend de handle_new_user ; l'immuabilité, de date_naissance_immuable).
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonClient = () =>
  createClient(url, publishable, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

describe("Privilèges EXECUTE durcis (migration 0007, AD-12)", () => {
  beforeAll(() => {
    if (!url || !publishable || !secret) {
      throw new Error(
        "Supabase local requis. Lance `supabase start`, puis exporte " +
          "SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY.",
      );
    }
  });

  // Ce que chaque prédicat répond pour un appelant SANS `auth.uid()` (service_role). La valeur n'est
  // pas la même, et c'est le sujet : depuis 0066, `est_barre_minorite` exige que la majorité soit
  // POSITIVEMENT établie — une identité absente ne peut rien établir, donc elle BARRE. Le consentement,
  // lui, se lit dans l'autre sens : personne n'a consenti, donc `false`. Les deux échouent du côté sûr.
  const REPONSE_SANS_IDENTITE = { a_consenti_art9: false, est_barre_minorite: true } as const;

  for (const fn of ["a_consenti_art9", "est_barre_minorite"] as const) {
    it(`${fn} : service_role PEUT l'exécuter (contrôle positif — la fonction existe et répond)`, async () => {
      const { data, error } = await admin.rpc(fn);
      expect(error).toBeNull();
      expect(data, "une identité absente doit faire échouer le prédicat du côté SÛR").toBe(
        REPONSE_SANS_IDENTITE[fn],
      );
    });

    it(`${fn} : un client anonyme NE PEUT PLUS l'exécuter (grant anon retiré en 0007)`, async () => {
      const { error } = await anonClient().rpc(fn);
      expect(error).not.toBeNull(); // permission denied / non exposé à anon
    });
  }
});
