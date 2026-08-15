import { describe, it, expect, beforeAll } from "vitest";
import {
  base64url,
  debase64url,
  origineDe,
  clesValides,
  enteteVapid,
  signerJeton,
  importerClePublique,
  VALIDITE_JETON_S,
  type ClesVapid,
} from "@/lib/poussee/vapid";

/**
 * Story 6.2 (T3) — VAPID (RFC 8292), ÉCRIT À LA MAIN ET DONC VÉRIFIÉ À LA MAIN.
 *
 * ⚠️ C'est la raison d'être de ce fichier, et elle vaut d'être écrite. Une signature ES256 fausse ne
 * casse rien de visible : elle produit un 401 chez le service de poussée, tous les jours, chez toutes
 * les abonnées, sans qu'aucune exception ne remonte. Le seul moyen de le savoir avant elles est de
 * REPRENDRE le jeton produit et de le vérifier avec la clé publique — ce qu'on ne peut faire d'aucune
 * bibliothèque tierce sans la réimplémenter.
 *
 * Les clés sont engendrées ici, par WebCrypto, jamais écrites en dur : une clé privée dans un dépôt
 * public est une clé brûlée, même de test.
 */

let cles: ClesVapid;
let publique: CryptoKey;

beforeAll(async () => {
  const paire = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const brut = new Uint8Array(await crypto.subtle.exportKey("raw", paire.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", paire.privateKey);
  cles = { publique: base64url(brut), privee: jwk.d as string, sujet: "mailto:contact@exemple.fr" };
  publique = await importerClePublique(cles.publique);
});

/** Reprend un JWT et vérifie sa signature avec la clé publique. Rend aussi les revendications. */
async function verifier(jwt: string): Promise<{ valide: boolean; claims: Record<string, unknown> }> {
  const [e, c, s] = jwt.split(".");
  const valide = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publique,
    debase64url(s),
    new TextEncoder().encode(`${e}.${c}`),
  );
  return { valide, claims: JSON.parse(new TextDecoder().decode(debase64url(c))) };
}

describe("[6.2/T3] base64url — sans remplissage, et sans `+` ni `/`", () => {
  it("fait l'aller-retour sur des octets qui produisent les deux caractères piégeux", () => {
    // 0xfb 0xff produit `+` et `/` en base64 standard. Un encodage qui les laisse passer produit un
    // JWT que le service refuse, et l'erreur ressemble à une signature fausse.
    const octets = new Uint8Array([0xfb, 0xff, 0xbf, 0x00, 0x10, 0x83]);
    const encode = base64url(octets);
    expect(encode).not.toMatch(/[+/=]/);
    expect(Array.from(debase64url(encode))).toEqual(Array.from(octets));
  });

  it("tolère l'absence de remplissage et refuse un caractère hors alphabet", () => {
    expect(Array.from(debase64url("AQ"))).toEqual([0x01]);
    expect(() => debase64url("ab+cd")).toThrow(/base64url_invalide/);
    expect(() => debase64url("ab cd")).toThrow(/base64url_invalide/);
  });
});

describe("[6.2/T3] l'audience est l'ORIGINE, jamais l'URL", () => {
  it("[LE CŒUR] le chemin de l'endpoint ne part PAS dans le jeton", async () => {
    // ⚠️ Mutation-cible : `aud: endpoint`. Deux dégâts distincts, et le second est le pire :
    //   • RFC 8292 §2 exige l'origine ; certains services rejettent l'URL complète et d'autres
    //     l'acceptent — donc une panne qui ne touche qu'une partie des abonnées ;
    //   • le chemin d'un endpoint EST un secret : quiconque le connaît peut pousser sur cet appareil.
    //     Il n'a rien à faire dans un jeton, fût-il de douze heures.
    expect(origineDe("https://web.push.apple.com/QAgh7...secret")).toBe("https://web.push.apple.com");
    expect(origineDe("https://fcm.googleapis.com/fcm/send/abc?x=1")).toBe("https://fcm.googleapis.com");

    const jwt = await signerJeton(cles, origineDe("https://web.push.apple.com/secret-du-jour"), new Date());
    const { claims } = await verifier(jwt);
    expect(String(claims.aud)).toBe("https://web.push.apple.com");
    expect(JSON.stringify(claims)).not.toContain("secret-du-jour");
  });

  it("un endpoint sans TLS lève plutôt que de signer", () => {
    expect(() => origineDe("http://web.push.apple.com/x")).toThrow(/endpoint_non_tls/);
  });
});

describe("[6.2/T3] le jeton signé est VALIDE — et une signature fausse se voit", () => {
  it("[LE CŒUR] la signature se vérifie avec la clé publique", async () => {
    const jwt = await signerJeton(cles, "https://web.push.apple.com", new Date());
    const { valide } = await verifier(jwt);
    expect(valide, "le jeton produit ne se vérifie pas — un 401 quotidien en production").toBe(true);
  });

  it("[ANTI-VACUITÉ] un jeton altéré ne se vérifie PAS", async () => {
    // Sans ce test, `verifier` pourrait rendre `true` pour tout et le test ci-dessus serait décoratif.
    const jwt = await signerJeton(cles, "https://web.push.apple.com", new Date());
    const [e, , s] = jwt.split(".");
    const claimsTruques = base64url(
      new TextEncoder().encode(JSON.stringify({ aud: "https://evil.example", exp: 9e9, sub: cles.sujet })),
    );
    const { valide } = await verifier(`${e}.${claimsTruques}.${s}`);
    expect(valide).toBe(false);
  });

  it("[LE CŒUR] une clé privée dépareillée de sa publique LÈVE, elle ne signe pas dans le vide", async () => {
    // ⚠️ Le mutant visé était : reconstruire `x` et `y` à côté de la plaque, ou importer la privée
    // sans le point public qui va avec. On s'attendait à une signature invalide ; la réalité est
    // meilleure et vaut d'être fixée par un test, parce que c'est elle qu'on tient pour acquise :
    // **Node valide la cohérence `d` ↔ `(x, y)` à l'import** et refuse le couple.
    //
    // La conséquence pratique est celle qui compte : deux variables d'environnement mélangées (la
    // publique d'un projet, la privée d'un autre — un copier-coller de dix secondes) font échouer le
    // BOOT du port, bruyamment, plutôt que de produire douze heures de 401 muets.
    const autre = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
    const jwkAutre = await crypto.subtle.exportKey("jwk", autre.privateKey);
    await expect(
      signerJeton({ ...cles, privee: jwkAutre.d as string }, "https://web.push.apple.com", new Date()),
    ).rejects.toThrow();

    // ⚠️ Et `clesValides` ne l'attrape PAS — elle vérifie des longueurs, pas une courbe elliptique.
    // C'est écrit ici pour que personne ne croie l'inverse en la lisant.
    expect(clesValides({ ...cles, privee: jwkAutre.d as string })).toBe(true);
  });

  it("l'échéance suit l'instant reçu, et reste sous les 24 h de la RFC", async () => {
    // `instant` entre par la porte (AD-10) : c'est ce qui rend `exp` testable, et ce qui empêche ce
    // module de porter une horloge.
    const t0 = new Date("2026-08-15T06:00:00Z");
    const { claims } = await verifier(await signerJeton(cles, "https://web.push.apple.com", t0));
    expect(claims.exp).toBe(Math.floor(t0.getTime() / 1000) + VALIDITE_JETON_S);
    expect(VALIDITE_JETON_S).toBeLessThanOrEqual(24 * 3_600);
    expect(claims.sub).toBe("mailto:contact@exemple.fr");
  });

  it("l'en-tête a la forme `vapid t=…, k=…` et porte la clé publique", async () => {
    const entete = await enteteVapid(cles, "https://fcm.googleapis.com/fcm/send/abc", new Date());
    expect(entete).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
    expect(entete.endsWith(`k=${cles.publique}`)).toBe(true);
    const { valide, claims } = await verifier(entete.slice("vapid t=".length).split(",")[0]);
    expect(valide).toBe(true);
    expect(claims.aud).toBe("https://fcm.googleapis.com");
  });
});

describe("[6.2/T3] la forme des clés est vérifiée AVANT le premier POST", () => {
  it("[CONTRÔLE POSITIF] un vrai jeu de clés passe", () => {
    expect(clesValides(cles)).toBe(true);
  });

  it.each([
    ["clé publique absente", { privee: "x", sujet: "mailto:a@b.fr" }],
    ["sujet qui n'est ni mailto ni https", { publique: "", privee: "", sujet: "contact@exemple.fr" }],
  ])("refuse — %s", (_cas, partiel) => {
    expect(clesValides(partiel as Partial<ClesVapid>)).toBe(false);
  });

  it("[LE CŒUR] refuse une clé publique de 64 octets — le préfixe `0x04` oublié en la recopiant", () => {
    // C'est la faute la plus probable de toute cette story, et la plus vicieuse : le navigateur
    // ACCEPTE de souscrire avec une clé tronquée, et c'est le service de poussée qui refuse ensuite.
    // La panne ne se voit donc qu'en production, chez l'utilisatrice, des jours plus tard.
    const brut = debase64url(cles.publique);
    expect(clesValides({ ...cles, publique: base64url(brut.slice(1)) })).toBe(false);
    // Bonne longueur, mauvais préfixe (une clé compressée, 0x02/0x03) : refusée aussi.
    const compressee = new Uint8Array(brut);
    compressee[0] = 0x02;
    expect(clesValides({ ...cles, publique: base64url(compressee) })).toBe(false);
  });

  it("refuse un scalaire privé qui n'a pas 32 octets, et du non-base64url", () => {
    expect(clesValides({ ...cles, privee: base64url(new Uint8Array(31)) })).toBe(false);
    expect(clesValides({ ...cles, privee: "pas du base64url !" })).toBe(false);
  });
});
