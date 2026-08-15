import "./styles/globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { policeAnam, policeUi } from "./styles/polices";
import { CouvercleConfidentialite } from "@/render/confidentialite/CouvercleConfidentialite";

// NFR-015 — identité discrète : « Anam » sur TOUTES les routes. Le `template` littéral
// (sans %s) absorbe tout title enfant en « Anam » ; les pages l'explicitent aussi
// (ceinture + bretelles). og/description volontairement neutres et impersonnels : le nom,
// l'aperçu et l'icône ne doivent trahir ni l'intimité ni l'ésotérisme.
export const metadata: Metadata = {
  title: { default: "Anam", template: "Anam" },
  description: "Un espace calme pour faire le point.",
  openGraph: {
    title: "Anam",
    description: "Un espace calme pour faire le point.",
    type: "website",
  },
  // Story 6.2 — le manifeste PWA. Il porte le MÊME mot que le titre et que l'aperçu de notification :
  // trois surfaces exposées au monde, une seule identité, aucune n'apprend rien à qui regarde.
  manifest: "/manifest.webmanifest",
  // ⚠️ iOS IGNORE le manifeste pour l'icône d'écran d'accueil et lit `apple-touch-icon`. Sans elle, il
  // prend une CAPTURE DE LA PAGE — c'est-à-dire l'imagerie de séance, épinglée sur l'écran d'accueil,
  // exactement ce que le privacy-cover existe pour empêcher (AC5, NFR-015). L'omission serait une
  // violation par défaut, et invisible tant que personne n'installe l'app.
  appleWebApp: { capable: true, title: "Anam", statusBarStyle: "black-translucent" },
  icons: {
    icon: "/icon.svg",
    apple: "/marque/icone-apple-180.png",
  },
};

// UX-DR-42 / Story 2.2 (AC8) : `interactive-widget=resizes-content` → à l'ouverture du clavier
// virtuel (surtout Android), le viewport de mise en page rétrécit et le composeur reste visible
// (iOS s'appuie en plus sur `visualViewport`, câblé dans la conversation). On NE fixe NI
// maximumScale NI userScalable=no : le zoom 200 %/400 % doit rester possible (AC8, WCAG 1.4.4).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

// UX-DR-36 : lang="fr" sur le document.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${policeAnam.variable} ${policeUi.variable}`}>
      {/* suppressHydrationWarning : des extensions (Grammarly…) injectent des attributs
          dans <body> avant l'hydratation — mitigation recommandée par Next/React. */}
      <body suppressHydrationWarning>
        {children}
        {/* Story 6.2 (AC5) — la vignette du sélecteur de tâches ne montre jamais l'intérieur d'une
            séance. Monté ici, donc sur TOUTES les routes : une halte oubliée serait une halte
            découverte, et c'est justement une conversation qu'on ne veut pas voir photographiée. */}
        <CouvercleConfidentialite />
      </body>
    </html>
  );
}
