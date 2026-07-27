// generer-assets-anam.mjs — pipeline d'assets du personnage (Story 2.2, Phase C).
//
// ÉTAPE 1 (manuelle, une fois) — détourage du fond par matte IA (rembg / U2Net), car le fond des
// PNG Gemini (#574B5F / #343549) ne matche pas le `--fond` #0C0A1E et laisse un rectangle + un
// watermark. Produit les cutouts transparents `images/phase-c/anam-{presence,veille}-cut.png` :
//   uv run --python 3.9 --with rembg --with onnxruntime --with pillow python - <<'PY'
//   from rembg import remove; from PIL import Image
//   for src,out in [("ospcvrospcvrospc","presence"),("h78jn1h78jn1h78j","veille")]:
//       remove(Image.open(f"images/phase-c/Gemini_Generated_Image_{src}.png").convert("RGBA")).save(f"images/phase-c/anam-{out}-cut.png")
//   PY
//
// ÉTAPE 2 (ce script, sharp) — depuis les cutouts : dissout le BAS du buste dans la nuit (le matte
// coupe net → « émerge de l'ombre »), redimensionne, et écrit les 6 fichiers attendus par
// `render/conversation/ImageAnam.tsx` ({avif,webp,png} × {1x,@2x}) sous `public/scene/`.
//
//   node scripts/generer-assets-anam.mjs

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const racine = process.cwd();

/** Un asset = son cutout détouré (rembg) + son dossier + sa largeur d'affichage 1x (px CSS). */
const SOURCES = [
  { nom: "presence", source: "images/phase-c/anam-presence-cut.png", largeur1x: 220 },
  { nom: "veille", source: "images/phase-c/anam-veille-cut.png", largeur1x: 180 },
];

/** Encodeurs (qualités calibrées pour une peinture douce : nettes mais légères, alpha préservé). */
const FORMATS = [
  { ext: "avif", encode: (img) => img.avif({ quality: 55, effort: 6 }) },
  { ext: "webp", encode: (img) => img.webp({ quality: 82 }) },
  { ext: "png", encode: (img) => img.png({ compressionLevel: 9 }) },
];

/**
 * Fond plumeux du BAS : le matte est propre mais coupe le buste net → on dissout les ~22 % inférieurs
 * dans le noir. `dest-in` multiplie l'alpha du matte par celui d'un dégradé vertical → seul le bas
 * fond, le reste (cheveux, visage) garde le matte propre.
 */
async function plumer(cheminSource, largeur) {
  const { data, info } = await sharp(cheminSource)
    .resize({ width: largeur })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  const svg = `<svg width="${w}" height="${h}"><defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#fff" stop-opacity="1"/>
    <stop offset="78%" stop-color="#fff" stop-opacity="1"/>
    <stop offset="100%" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#f)"/></svg>`;

  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).composite([
    { input: Buffer.from(svg), blend: "dest-in" },
  ]);
}

async function genererUn({ nom, source, largeur1x }) {
  const cheminSource = resolve(racine, source);
  const dossier = resolve(racine, "public/scene", nom);
  await mkdir(dossier, { recursive: true });

  const tailles = [
    { suffixe: "", largeur: largeur1x }, // 1x
    { suffixe: "@2x", largeur: largeur1x * 2 }, // 2x (retina)
  ];

  let ecrits = 0;
  for (const { suffixe, largeur } of tailles) {
    const feutre = await plumer(cheminSource, largeur); // matte + bas dissous
    const png = await feutre.png().toBuffer(); // pivot RGBA réutilisé par tous les formats
    for (const { ext, encode } of FORMATS) {
      const sortie = resolve(dossier, `anam-${nom}${suffixe}.${ext}`);
      await mkdir(dirname(sortie), { recursive: true });
      await encode(sharp(png)).toFile(sortie);
      ecrits++;
    }
  }
  console.log(`✓ ${nom} : ${ecrits} fichiers (détourés + bas plumeux) → public/scene/${nom}/`);
}

for (const asset of SOURCES) {
  await genererUn(asset);
}
console.log("Terminé.");
