import localFont from "next/font/local";

// Polices variables self-hostées (next/font/local) — AUCUNE requête externe au runtime
// ni au build (privacy art.9, CI déterministe). Voir Story 1.2 → décision next/font/local.
//
// Les axes non-standard de Fraunces (opsz, SOFT, WONK) NE se déclarent PAS ici :
// ils vivent dans le woff2 et se pilotent en CSS via `font-variation-settings`
// (globals.css). `weight: "100 900"` déclare seulement l'axe wght variable.

export const policeAnam = localFont({
  src: "./fonts/fraunces-variable.woff2",
  variable: "--police-anam",
  weight: "100 900",
  style: "normal",
  display: "swap",
  // repli assorti au sérif humaniste — voir globals.css pour la pile complète
  fallback: ["Iowan Old Style", "Georgia", "serif"],
});

export const policeUi = localFont({
  src: "./fonts/inter-variable.woff2",
  variable: "--police-ui",
  weight: "100 900",
  style: "normal",
  display: "swap",
  fallback: ["-apple-system", "Segoe UI", "system-ui", "sans-serif"],
});
