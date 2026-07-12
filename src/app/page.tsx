import Link from "next/link";
import { AureliLogo } from "@/components/AureliLogo";

const modules = [
  {
    title: "Executive Dashboard",
    detail: "Revenue, expenses, profit, cash, health score, and owner priorities.",
  },
  {
    title: "AI Finance Team",
    detail: "CFO, accountant, analyst, tax, risk, cash-flow, and consultant agents.",
  },
  {
    title: "Decision Center",
    detail: "Ranked actions for what the business owner should fix first.",
  },
  {
    title: "Forecast Engine",
    detail: "Predictive analytics and what-if planning for future financial risk.",
  },
];

const signals = [
  "Document intelligence",
  "Risk scoring",
  "Cash runway",
  "Forecasting",
  "AI chat",
  "User demo mode",
];

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "clamp(20px, 4vw, 56px)",
        display: "grid",
        alignItems: "center",
      }}
    >
      <section
        style={{
          width: "min(1180px, 100%)",
          margin: "0 auto",
          display: "grid",
          gap: 24,
        }}
      >
        <nav
          style={{
            border: "1px solid rgba(255,255,255,0.11)",
            background: "rgba(255,255,255,0.052)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            borderRadius: 999,
            padding: "10px 12px",
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            alignItems: "center",
            boxShadow: "0 12px 34px rgba(0,0,0,0.14)",
          }}
        >
          <Link
            href="/"
            style={{
              color: "rgba(255,255,255,0.94)",
              textDecoration: "none",
              fontWeight: 900,
              letterSpacing: "-0.04em",
              fontSize: 22,
              display: "flex",
              alignItems: "center",
              gap: 10,
              paddingLeft: 4,
            }}
          >
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 14,
                display: "grid",
                placeItems: "center",
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.045)",
                overflow: "hidden",
              }}
            >
              <AureliLogo />
            </span>
            <span>Aureli</span>
          </Link>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <Link href="/demo" className="btn-ghost">
              User Demo
            </Link>

            <Link href="/sign-in" className="btn-ghost">
              Sign in
            </Link>
          </div>
        </nav>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.02fr) minmax(320px, 0.78fr)",
            gap: 22,
            alignItems: "stretch",
          }}
        >
          <section
            style={{
              border: "1px solid rgba(255,255,255,0.115)",
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.074), rgba(255,255,255,0.036))",
              backdropFilter: "blur(20px) saturate(1.06)",
              WebkitBackdropFilter: "blur(20px) saturate(1.06)",
              borderRadius: 34,
              padding: "clamp(28px, 5vw, 58px)",
              boxShadow: "0 18px 52px rgba(0,0,0,0.18)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: 74,
                height: 74,
                borderRadius: 24,
                display: "grid",
                placeItems: "center",
                border: "1px solid rgba(255,255,255,0.11)",
                background: "rgba(255,255,255,0.050)",
                marginBottom: 24,
              }}
            >
              <AureliLogo />
            </div>

            <p className="eyebrow" style={{ margin: 0 }}>
              AI finance operating system
            </p>

            <h1
              style={{
                margin: "18px 0 0",
                color: "rgba(255,255,255,0.96)",
                fontSize: "clamp(52px, 8vw, 112px)",
                lineHeight: 0.9,
                letterSpacing: "-0.09em",
                maxWidth: 880,
              }}
            >
              Finance clarity, without accounting chaos.
            </h1>

            <p
              style={{
                margin: "22px 0 0",
                color: "rgba(235,241,250,0.64)",
                fontSize: "clamp(16px, 2vw, 20px)",
                lineHeight: 1.75,
                maxWidth: 760,
              }}
            >
              Aureli turns business documents into an executive finance team:
              CFO decisions, risk score, cash runway, forecasts, tax readiness,
              and AI explanations in one clean workspace.
            </p>

            <div
              style={{
                marginTop: 28,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <Link href="/sign-in" className="btn-ghost">
                Enter workspace {"->"}
              </Link>

              <Link href="/demo" className="btn-ghost">
                Try user demo
              </Link>
            </div>

            <div
              style={{
                marginTop: 30,
                display: "flex",
                gap: 9,
                flexWrap: "wrap",
              }}
            >
              {signals.map((signal) => (
                <span
                  key={signal}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.048)",
                    color: "rgba(235,241,250,0.62)",
                    borderRadius: 999,
                    padding: "8px 11px",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {signal}
                </span>
              ))}
            </div>
          </section>

          <aside
            style={{
              border: "1px solid rgba(255,255,255,0.105)",
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.068), rgba(255,255,255,0.034))",
              backdropFilter: "blur(20px) saturate(1.06)",
              WebkitBackdropFilter: "blur(20px) saturate(1.06)",
              borderRadius: 34,
              padding: 22,
              boxShadow: "0 18px 52px rgba(0,0,0,0.16)",
              display: "grid",
              gap: 14,
              alignContent: "start",
            }}
          >
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.09)",
                background: "rgba(255,255,255,0.042)",
                borderRadius: 24,
                padding: 18,
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "rgba(235,241,250,0.48)",
                  fontSize: 12,
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                }}
              >
                Live intelligence preview
              </p>

              <h2
                style={{
                  margin: "12px 0 0",
                  color: "rgba(255,255,255,0.92)",
                  fontSize: 32,
                  lineHeight: 1.05,
                  letterSpacing: "-0.055em",
                }}
              >
                Owner-first financial decisions.
              </h2>
            </div>

            {modules.map((module) => (
              <div
                key={module.title}
                style={{
                  border: "1px solid rgba(255,255,255,0.085)",
                  background: "rgba(255,255,255,0.038)",
                  borderRadius: 20,
                  padding: 15,
                  display: "grid",
                  gap: 7,
                }}
              >
                <strong
                  style={{
                    color: "rgba(255,255,255,0.90)",
                    fontSize: 15,
                  }}
                >
                  {module.title}
                </strong>

                <p
                  style={{
                    margin: 0,
                    color: "rgba(235,241,250,0.56)",
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  {module.detail}
                </p>
              </div>
            ))}
          </aside>
        </div>

        <p
          style={{
            margin: "4px 0 0",
            textAlign: "center",
            color: "rgba(235,241,250,0.42)",
            fontSize: 12,
          }}
        >
          Built for small businesses that need CFO-level clarity without waiting
          for manual reports.
        </p>
      </section>
    </main>
  );
}
