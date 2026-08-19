import { test, expect } from "@playwright/test";
import { adresseNeuve, codeDans, courrielPour, viderLaBoite } from "./_boite-aux-lettres";

/**
 * entree.spec.ts — LA PORTE, TRAVERSÉE COMME UNE PERSONNE LA TRAVERSE
 *
 * ══ POURQUOI CETTE SUITE EXISTE ═══════════════════════════════════════════════════════════════
 *
 * Le 2026-08-19, Julian ne pouvait pas se reconnecter en production. Rien n'était cassé : la
 * configuration Supabase était juste, le gabarit portait bien le code, `verifyOtp` ouvrait bien
 * une session. Le défaut était que l'écran « tape ton code » ne vivait que dans la mémoire de
 * React — et que le geste NORMAL sur un téléphone (aller lire le code dans sa boîte mail, revenir)
 * recharge l'onglet. La page repartait au formulaire d'adresse, avec un code valide une heure et
 * plus aucun endroit où le taper.
 *
 * 5 007 tests unitaires étaient verts. Aucun ne pouvait voir ça : il faut un vrai navigateur, un
 * vrai rechargement, un vrai courriel.
 */

test.describe("La porte d'entrée", () => {
  test("le code reste tapable après un rechargement d'onglet", async ({ page }) => {
    const adresse = adresseNeuve("rechargement");
    await viderLaBoite();

    await page.goto("/entrer");
    await page.getByLabel(/adresse e-mail/i).fill(adresse);
    await page.getByRole("button", { name: /recevoir mon lien/i }).click();

    await expect(page.getByLabel(/code reçu/i)).toBeVisible();

    // ⚠️ LE GESTE QUI CASSAIT TOUT. Sur un téléphone, on bascule sur son courrier et on revient ;
    // iOS a très souvent rechargé l'onglet entre-temps. `reload()` est exactement ça.
    await page.reload();

    await expect(
      page.getByLabel(/code reçu/i),
      "l'écran de code n'a pas survécu au rechargement — le code reçu est intapable",
    ).toBeVisible();
    await expect(
      page.getByLabel(/adresse e-mail/i),
      "la page est repartie demander une adresse, avec un code déjà en main",
    ).toHaveCount(0);
    // L'adresse visée reste affichée : c'est ce qui permet de voir, AVANT de taper, que le code
    // demandé ne concerne pas la sienne.
    await expect(page.getByText(adresse)).toBeVisible();
  });

  test("le code reçu ouvre la porte", async ({ page }) => {
    const adresse = adresseNeuve("ouverture");
    await viderLaBoite();

    await page.goto("/entrer");
    await page.getByLabel(/adresse e-mail/i).fill(adresse);
    await page.getByRole("button", { name: /recevoir mon lien/i }).click();
    await expect(page.getByLabel(/code reçu/i)).toBeVisible();

    const code = codeDans((await courrielPour(adresse)).corps);
    await page.getByLabel(/code reçu/i).fill(code);
    await page.getByRole("button", { name: /entrer avec ce code/i }).click();

    // Un compte neuf n'a ni date de naissance ni consentement : la machine d'état l'envoie
    // d'abord déclarer son âge. Arriver ailleurs signifierait qu'une porte du tunnel a sauté.
    await expect(page).toHaveURL(/\/naissance/);
  });

  test("[SORTIR N'EST JAMAIS GARDÉ] on peut toujours repartir d'une autre adresse", async ({
    page,
  }) => {
    // Sans cette porte, une adresse tapée de travers enferme une heure sur un écran réclamant un
    // code qui n'arrivera jamais — le cookie d'attente vit aussi longtemps que le code.
    const adresse = adresseNeuve("faute-de-frappe");
    await viderLaBoite();

    await page.goto("/entrer");
    await page.getByLabel(/adresse e-mail/i).fill(adresse);
    await page.getByRole("button", { name: /recevoir mon lien/i }).click();
    await expect(page.getByLabel(/code reçu/i)).toBeVisible();

    await page.getByRole("button", { name: /recommencer/i }).click();

    await expect(page.getByLabel(/adresse e-mail/i)).toBeVisible();
    // Et l'abandon doit TENIR au rechargement : si le cookie survivait, on serait renvoyée sur
    // l'écran de code dont on vient de sortir.
    await page.reload();
    await expect(page.getByLabel(/adresse e-mail/i)).toBeVisible();
  });

  test("un code faux ne fait pas perdre l'écran où le retaper", async ({ page }) => {
    const adresse = adresseNeuve("code-faux");
    await viderLaBoite();

    await page.goto("/entrer");
    await page.getByLabel(/adresse e-mail/i).fill(adresse);
    await page.getByRole("button", { name: /recevoir mon lien/i }).click();
    await expect(page.getByLabel(/code reçu/i)).toBeVisible();

    const vrai = codeDans((await courrielPour(adresse)).corps);
    // Un code VOISIN, pas un code absurde : on éprouve la comparaison, pas la longueur.
    const faux = String((Number(vrai) + 1) % 1_000_000).padStart(vrai.length, "0");
    await page.getByLabel(/code reçu/i).fill(faux);
    await page.getByRole("button", { name: /entrer avec ce code/i }).click();

    await expect(page.getByText(/ne correspond pas/i)).toBeVisible();
    await expect(
      page.getByLabel(/code reçu/i),
      "l'erreur a emporté l'écran : il faudrait redemander un code pour une simple faute de frappe",
    ).toBeVisible();
  });

  test("l'écran ne se contredit pas une fois le code parti", async ({ page }) => {
    const adresse = adresseNeuve("coherence");
    await viderLaBoite();

    await page.goto("/entrer");
    await page.getByLabel(/adresse e-mail/i).fill(adresse);
    await page.getByRole("button", { name: /recevoir mon lien/i }).click();
    await expect(page.getByLabel(/code reçu/i)).toBeVisible();

    // « Laisse-moi ton adresse » au-dessus de « c'est parti vers … » ferait dire à l'écran deux
    // choses contraires en même temps.
    await expect(page.getByText(/laisse-moi ton adresse/i)).toHaveCount(0);
  });
});
