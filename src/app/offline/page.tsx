import Link from "next/link";
import { AureliLogo } from "@/components/AureliLogo";

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(circle at top left, rgba(245,158,11,0.18), transparent 34%), linear-gradient(180deg, #090d14 0%, #0b111b 100%)",
      }}
    >
      <section
        style={{
          width: "min(520px, 100%)",
          border: "1px solid rgba(255,209,102,0.18)",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.070), rgba(255,255,255,0.026))",
          borderRadius: 30,
          padding: 26,
          display: "grid",
          gap: 18,
          textAlign: "center",
          boxShadow: "0 28px 100px rgba(0,0,0,0.32)",
        }}
      >
        <div style={{ display: "grid", placeItems: "center" }}>
          <AureliLogo size={54} showWordmark tagline="AI finance workspace" />
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <h1
            style={{
              margin: 0,
              color: "var(--color-text-primary)",
              fontSize: 38,
              lineHeight: 1,
              letterSpacing: "-0.07em",
              fontWeight: 950,
            }}
          >
            You are offline
          </h1>

          <p
            style={{
              margin: 0,
              color: "var(--color-text-secondary)",
              fontSize: 15,
              lineHeight: 1.7,
            }}
          >
            Aureli needs internet access to sync documents, dashboard insights,
            AI chat, and CFO reports.
          </p>
        </div>

        <Link href="/" className="btn-ghost" style={{ justifyContent: "center" }}>
          Try again
        </Link>
      </section>
    </main>
  );
}