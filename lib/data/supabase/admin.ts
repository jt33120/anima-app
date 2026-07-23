import "server-only"; // barrière de compilation : erreur si jamais importé côté client (AD-12)
import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase ADMIN (clé `service_role`) — CONTOURNE la RLS.
 *
 * ⚠️ RÉSERVÉ AUX TÂCHES SYSTÈME. Interdit sur du contenu applicatif dans une requête
 * utilisateur (AD-12) : ce module ne doit JAMAIS être importé par un écran/route de
 * lecture ou d'écriture de contenu. Le contenu passe TOUJOURS par la session RLS
 * (`lib/data/supabase/server.ts`).
 *
 * Seul usage en Story 1.5 : la SUPPRESSION IMMÉDIATE du compte au refus du consentement
 * (AC6). C'est une suppression de COMPTE (tâche système), pas un accès `service_role`
 * à du contenu ; et aucune donnée art. 9 n'existe encore à ce stade (AD-4).
 * L'appelant doit d'abord vérifier `getUser()` pour ne supprimer QUE le compte courant.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
