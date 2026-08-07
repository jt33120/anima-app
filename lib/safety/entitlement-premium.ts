import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { journaliserIncidentSecurite } from "@/lib/safety/rpc-repli";

/**
 * entitlement-premium.ts — LA LECTURE DE L'ENTITLEMENT SOUS JETON, une seule fois pour tout le produit.
 *
 * Extrait de `projection-arbre.ts` par la Story 3.3, qui en avait besoin une SECONDE fois (l'ouverture
 * d'une branche). Recopier `planOuvert` aurait fabriqué un deuxième prédicat premium : deux implémentations
 * du même invariant finissent par diverger — c'est la leçon R1-bis, celle qui a fait naître le miroir
 * `render/intention.ts` ⟺ `lib/domain/intention.ts` et son test d'équivalence. Ici, on ne duplique pas :
 * on nomme.
 *
 * ── LE SENS DU DOUTE ────────────────────────────────────────────────────────────────────────────────────
 *
 * Le repli est `false` — le doute FERME. Et ce n'est PAS le repli universel de ce projet, il faut donc le
 * dire : `limitesCommercialesLevees` retombe sur `true` (le doute suspend le commerce, AD-9) et
 * `estPremiumCourante` dans la route de message retombe sur `premium = true` (le doute ne coupe pas
 * l'accès, FR-058). Chaque garde a le repli de CE QU'ELLE PROTÈGE.
 *
 * Ici, ce qui est protégé est le fait de ne pas OFFRIR un geste que le point d'écriture refusera. Se
 * tromper en fermant coûte un champ absent ou une question non posée pendant quelques secondes ; se
 * tromper en ouvrant lui fait écrire un contenu art. 9 — deux phrases intimes, ou le nom d'une prise de
 * conscience — que la policy refusera ensuite. C'est la faute que les revues 4.7 puis 4.10 ont trouvée
 * deux fois. L'asymétrie tranche, et elle tranche toujours du même côté.
 *
 * ⚠️ CE DRAPEAU N'EST JAMAIS LA GARDE. Les barrières vivent dans le `WITH CHECK` des policies
 * (`intention_insertion`/`intention_revision` en 0036, `branche_insertion` en 0037) : `authenticated`
 * détient les grants table-level, donc un gate d'interface seul serait décoratif (leçon R1). Celui-ci ne
 * sert qu'à ne pas mentir par omission.
 */
export async function premiumSousJwt(supabase: SupabaseClient, motif: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("est_premium_courante");
    if (error) {
      journaliserIncidentSecurite(motif, error);
      return false;
    }
    return data === true;
  } catch (e) {
    journaliserIncidentSecurite(motif, e);
    return false;
  }
}
