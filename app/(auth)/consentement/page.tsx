// Placeholder — le vrai écran de consentement art.9 + déclaration IA est la Story 1.5.
export const metadata = { title: "Bientôt" };

export default function PageConsentement() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--esp-7) var(--marge-mobile)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--esp-4)",
          maxWidth: "var(--mesure)",
        }}
      >
        <p className="t-surtitre">Prochaine étape</p>
        <h1 className="t-display">Bientôt</h1>
        <p className="t-anam">
          Te voilà entrée. La suite — ce que tu acceptes de me confier — arrive très
          vite.
        </p>
      </div>
    </main>
  );
}
