/**
 * Course contre un délai. Si `p` n'a pas résolu à temps, rejette avec `motif` — à charge de l'appelant
 * d'engager son repli sûr (AD-15).
 *
 * Extrait en Story 4.8 : la même fonction existait à l'identique dans `detecteur-detresse`,
 * `reconceptualisation-pipeline` et `retour-theme-pipeline`, ne différant que par le libellé du rejet.
 * L'ordonnanceur en aurait fait une quatrième copie — et une garantie qu'on recopie est une garantie qui
 * finit par diverger d'un seul côté.
 *
 * `p.finally(clearTimeout)` est ce qui empêche le minuteur de maintenir le processus en vie quand la
 * promesse gagne la course : sans lui, chaque appel laisserait un `setTimeout` pendant jusqu'à son terme.
 */
export function avecDelai<T>(p: Promise<T>, ms: number, motif: string): Promise<T> {
  let minuteur: ReturnType<typeof setTimeout>;
  const delai = new Promise<never>((_, rej) => {
    minuteur = setTimeout(() => rej(new Error(motif)), ms);
  });
  return Promise.race([p.finally(() => clearTimeout(minuteur)), delai]);
}
