import "./styles/globals.css";
import type { ReactNode } from "react";
import { policeAnam, policeUi } from "./styles/polices";

export const metadata = {
  title: "Anam",
  description: "Compagne d'introspection",
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
