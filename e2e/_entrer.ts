import type { Page } from "@playwright/test";
import { adresseNeuve, codeDans, courrielPour, viderLaBoite } from "./_boite-aux-lettres";

/**
 * Ouvrir un compte NEUF et traverser le tunnel — pour que les parcours qui suivent partent d'un
 * état connu, jamais d'un compte qu'un test précédent aurait laissé à moitié rempli.
 *
 * ⚠️ ON PASSE PAR LES VRAIS ÉCRANS, JAMAIS PAR L'ADMIN. Poser la date de naissance et le
 * consentement avec une clé `service_role` irait plus vite et prouverait moins : c'est justement
 * le tunnel qu'on veut voir tenir, et une porte qu'on contourne dans les tests est une porte que
 * personne ne teste.
 */
export type Compte = { readonly adresse: string };

export async function ouvrirUnCompteNeuf(page: Page): Promise<Compte> {
  const adresse = adresseNeuve("parcours");
  await viderLaBoite();

  await page.goto("/entrer");
  await page.getByLabel(/adresse e-mail/i).fill(adresse);
  await page.getByRole("button", { name: /recevoir mon lien/i }).click();
  await page.getByLabel(/code reçu/i).waitFor();

  const code = codeDans((await courrielPour(adresse)).corps);
  await page.getByLabel(/code reçu/i).fill(code);
  await page.getByRole("button", { name: /entrer avec ce code/i }).click();

  // ── La date de naissance (FR-012 : la majorité s'établit ici, elle ne se déclare pas ailleurs)
  await page.waitForURL(/\/naissance/);
  await page.locator('input[name="prenom"]').fill("Louise");
  await page.locator('input[name="date_naissance"]').fill("1979-09-08");
  await page.getByRole("button", { name: /continuer|commencer|suivant/i }).click();

  // ── Le consentement article 9 — les deux cases, jamais une seule
  await page.waitForURL(/\/consentement/);
  await page.locator('input[name="art9"]').check();
  await page.locator('input[name="cgu"]').check();
  await page.getByRole("button", { name: /je commence/i }).click();

  await page.waitForURL((u) => !/\/(naissance|consentement|entrer)/.test(u.pathname));
  return { adresse };
}
