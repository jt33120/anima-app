import type { ReactNode } from "react";

export const metadata = {
  title: "Anam",
  description: "Compagne d'introspection",
};

// UX-DR-36 : lang="fr" sur le document.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      {/* suppressHydrationWarning : des extensions (Grammarly…) injectent des attributs
          dans <body> avant l'hydratation — mitigation recommandée par Next/React. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
