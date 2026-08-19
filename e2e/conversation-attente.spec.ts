import { test, expect } from "@playwright/test";
import { ouvrirUnCompteNeuf } from "./_entrer";

/**
 * conversation-attente.spec.ts — CE QU'ON VOIT PENDANT QUE ANAM CHERCHE SES MOTS
 *
 * ══ POURQUOI CE FICHIER EXISTE ════════════════════════════════════════════════════════════════
 *
 * Le tour de QA du 2026-08-19 a mesuré **5,5 à 8,1 secondes** entre l'envoi et le premier
 * caractère, et a conclu : « aucun signe à l'écran ». Sa preuve était l'élément `tourAnam` —
 * `height 0px`, `animation-name: none`, `::before content: none`.
 *
 * ⚠️ CETTE PREUVE VISAIT LE MAUVAIS ÉLÉMENT. Le signe d'attente n'est pas sur le tour d'Anam : il
 * est inséré EN BAS DU FIL, dans son propre bloc (`Fil.tsx`), et l'annonce aux lecteurs d'écran
 * passe par la région `aria-live` unique du fil. Les deux existent depuis la Story 6.9.
 *
 * Ce qui reste vrai et non mesuré, c'est la LATENCE. On la mesure donc ici, et on mesure aussi que
 * le signe paraît VITE — un indicateur qui arrive après trois secondes ne console personne.
 *
 * ⚠️ CE PARCOURS APPELLE LE VRAI MODÈLE. Il écrit dans le stack LOCAL (la garde de cible l'impose)
 * mais la réponse vient de l'API réelle : il coûte quelques centimes et quelques secondes. C'est
 * le prix d'une mesure honnête — un modèle simulé rendrait la latence, qui est tout le sujet,
 * inobservable.
 */

/** Au-delà, quelqu'un croit que son message n'est pas parti. */
const DELAI_SIGNE_MS = 1_000;

test.describe("L'attente d'une réponse", () => {
  test("un signe paraît vite, et il est dit aux lecteurs d'écran", async ({ page }) => {
    await ouvrirUnCompteNeuf(page);
    await page.goto("/");

    // ⚠️ LA SCÈNE EST UN MONDE À RÉGIONS. Le composeur existe dès le chargement mais reste CACHÉ
    // tant qu'on n'est pas dans la région « Anam » — d'où un `waitFor` qui expire sur un élément
    // pourtant présent dans le DOM. On y va comme quelqu'un y va.
    await page.getByRole("link", { name: /^anam$/i }).or(page.getByRole("button", { name: /^anam$/i })).first().click();
    const champ = page.getByLabel(/ton message à anam/i);
    await champ.waitFor({ state: "visible" });
    await champ.fill("j'ai passé une journée un peu étrange");

    const depart = Date.now();
    await page.getByRole("button", { name: /envoyer/i }).click();

    // Le signe visuel — `aria-hidden`, purement visuel, en bas du fil.
    const signe = page.locator("[class*='attente'] svg").first();
    await expect(signe, "aucun signe visuel pendant l'attente").toBeVisible({
      timeout: DELAI_SIGNE_MS,
    });
    const delaiSigne = Date.now() - depart;
    expect(delaiSigne, `le signe a mis ${delaiSigne} ms à paraître`).toBeLessThan(DELAI_SIGNE_MS);

    // Et l'annonce — quelqu'un sans écran vivait le même silence, sans même le glyphe.
    const vivante = page.locator("[aria-live]").first();
    await expect(vivante, "aucune région vivante dans le fil").toHaveCount(1);
    await expect
      .poll(async () => (await vivante.textContent())?.trim() ?? "", {
        timeout: DELAI_SIGNE_MS,
        message: "la région vivante reste muette pendant l'attente",
      })
      .not.toBe("");
  });

  test("[MESURE] la latence et la forme de l'écriture", async ({ page }) => {
    // Ce parcours ne CONDAMNE rien : il enregistre. La latence dépend du modèle et du réseau, et
    // un seuil gravé ici rougirait un matin sans qu'une ligne du produit ait changé. Ce qu'on
    // veut, c'est le CHIFFRE, à côté du correctif, à chaque exécution.
    await ouvrirUnCompteNeuf(page);
    await page.goto("/");

    // ⚠️ LA SCÈNE EST UN MONDE À RÉGIONS. Le composeur existe dès le chargement mais reste CACHÉ
    // tant qu'on n'est pas dans la région « Anam » — d'où un `waitFor` qui expire sur un élément
    // pourtant présent dans le DOM. On y va comme quelqu'un y va.
    await page.getByRole("link", { name: /^anam$/i }).or(page.getByRole("button", { name: /^anam$/i })).first().click();
    const champ = page.getByLabel(/ton message à anam/i);
    await champ.waitFor({ state: "visible" });
    await champ.fill("je ne sais pas trop pourquoi je suis fatiguée en ce moment");

    // ⚠️ ON ÉCHANTILLONNE, ON N'OBSERVE PAS LES MUTATIONS. Le premier jet posait un
    // `MutationObserver` et comptait un point par APPEL — or l'observateur regroupe ses
    // enregistrements dans une seule micro-tâche : « 5 mutations pour 292 caractères » ne disait
    // rien de la forme réelle, et j'ai failli en conclure que le flux arrivait par blocs.
    // Un relevé régulier de la LONGUEUR donne la courbe de croissance, qui est la vraie question.
    const releve = await page.evaluate(async () => {
      // Le document entier : la région vivante est un conteneur étroit qui n'a capté que
      // l'écriture optimiste du message envoyé (82 caractères, un seul palier) et pas un mot
      // de la réponse. Le reste de la page ne bouge pas — la croissance reste lisible.
      const fil = document.body;
      const t0 = performance.now();
      const points: { t: number; n: number }[] = [];
      (document.querySelector('button[aria-label="Envoyer"]') as HTMLButtonElement | null)?.click();
      for (let i = 0; i < 250; i++) {
        points.push({ t: Math.round(performance.now() - t0), n: (fil.textContent ?? "").length });
        await new Promise((r) => setTimeout(r, 100));
      }
      return points;
    });

    const base = releve[0].n;
    const paliers = releve.filter((p, i) => i > 0 && p.n !== releve[i - 1].n);
    expect(paliers.length, "le fil n'a jamais grandi : rien n'est arrivé").toBeGreaterThan(0);

    const premier = paliers[0];
    const dernier = paliers[paliers.length - 1];
    const plusGrandSaut = Math.max(...paliers.map((p, i) => p.n - (i ? paliers[i - 1].n : base)));
    // Le rapport concluait « pas un vrai streaming ». Le nombre de PALIERS le dit : deux ou trois
    // paliers pour trois cents caractères, c'est un texte livré par blocs ; trente paliers, c'est
    // une écriture qui se déroule. On enregistre, on ne condamne pas — la latence dépend du modèle
    // et du réseau, et un seuil gravé ici rougirait un matin sans qu'une ligne du produit change.
    console.log(
      `[attente] premier texte à ${premier.t} ms · fin à ${dernier.t} ms · ` +
        `${paliers.length} paliers · ${dernier.n - base} caractères · plus grand saut ${plusGrandSaut}`,
    );
  });
});
