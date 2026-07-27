import "./styles/globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { policeAnam, policeUi } from "./styles/polices";

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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
