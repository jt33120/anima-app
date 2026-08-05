/**
 * Réduit une erreur à un CODE écrivable en base et journalisable (NFR-020/NFR-022). Domaine pur (AD-1).
 *
 * Le raisonnement, plus strict qu'il n'en a l'air : un message d'erreur est un ramasse-miettes. Il peut
 * avoir traversé un adaptateur qui recopie l'entrée, une bibliothèque qui cite la valeur fautive, un
 * pilote qui rend la ligne. On ne peut donc pas ASSAINIR un message — on ne peut que RECONNAÎTRE les
 * nôtres et jeter le reste. D'où deux formes admises, et `erreur_non_identifiee` pour tout le reste.
 *
 * L'exigence de deux segments dans `CODE_INTERNE` n'est pas cosmétique : sans elle, un message réduit à
 * un seul mot en minuscules — c'est-à-dire un mot pris au verbatim d'une utilisatrice — passerait.
 *
 * Extrait de `lib/ordonnanceur/executer.ts` en Story 4.9 : le job de synthèse en a besoin, et le lui
 * faire importer depuis le répartiteur aurait fermé un cycle (répartiteur → registre → job → répartiteur).
 */

/** Un code au format de nos RPC : « reclamer_execution: 42501 ». */
const CODE_RPC = /^[a-z_]+: [A-Z0-9]+$/;
/** Un code interne : au moins deux segments en minuscules reliés par `_` — « synthese_prete_timeout ». */
const CODE_INTERNE = /^[a-z0-9]+(?:_[a-z0-9]+)+$/;

export function codeDErreur(e: unknown): string {
  const message = e instanceof Error ? e.message : "";
  return CODE_RPC.test(message) || CODE_INTERNE.test(message) ? message.slice(0, 120) : "erreur_non_identifiee";
}
