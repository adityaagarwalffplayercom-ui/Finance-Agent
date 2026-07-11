"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DemoStatus = {
  demoDocuments: number;
  hasDemoData: boolean;
};

const DEMO_FLOW = [
  {
    title: "1. Dashboard",
    href: "/dashboard",
    detail: "Show revenue, expenses, profit, cash, health score, and alerts.",
  },
  {
    title: "2. Documents",
    href: "/documents",
    detail: "Show approved demo documents powering the system.",
  },
  {
    title: "3. Risk Score",
    href: "/risk-score",
    detail: "Show owner-level risk score and red flags.",
  },
  {
    title: "4. Cash Flow",
    href: "/cash-flow",
    detail: "Show runway, burn, inflows, outflows, and cash gap.",
  },
  {
    title: "5. Forecast",
    href: "/forecast",
    detail: "Show predictive analytics and what-if simulator.",
  },
  {
    title: "6. Decision Center",
    href: "/decision-center",
    detail: "Show what the owner should fix first.",
  },
  {
    title: "7. Learning Center",
    href: "/learning-center",
    detail: "Show feedback rewards and recommendation optimization.",
  },
  {
    title: "8. AI Chat",
    href: "/chat?agent=team",
    detail: "Show the AI executive finance team answering questions.",
  },
];

function toneStyle(tone: "good" | "warning" | "danger" | "neutral") {
  return {
    good: {
      color: "var(--color-sage)",
      border: "rgba(46,213,115,0.28)",
      background: "rgba(46,213,115,0.085)",
    },
    warning: {
      color: "var(--color-gold)",
      border: "rgba(255,209,102,0.30)",
      background: "rgba(255,209,102,0.085)",
    },
    danger: {
      color: "var(--color-danger)",
      border: "rgba(255,138,149,0.30)",
      background: "rgba(255,138,149,0.085)",
    },
    neutral: {
      color: "var(--color-text-secondary)",
      border: "var(--color-border)",
      background: "rgba(255,255,255,0.045)",
    },
  }[tone];
}

function FlowCard({
  title,
  href,
  detail,
}: {
  title: string;
  href: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      style={{
        border: "1px solid rgba(255,255,255,0.09)",
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.052), rgba(255,255,255,0.024))",
        borderRadius: 20,
        padding: 16,
        display: "grid",
        gap: 10,
        color: "inherit",
        textDecoration: "none",
        minWidth: 0,
      }}
    >
      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: 18,
          lineHeight: 1.2,
        }}
      >
        {title}
      </strong>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 13,
          lineHeight: 1.65,
        }}
      >
        {detail}
      </p>

      <span
        style={{
          color: "var(--color-gold)",
          fontSize: 12,
          fontWeight: 900,
        }}
      >
        Open {"->"}
      </span>
    </Link>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "good" | "warning" | "danger" | "neutral";
}) {
  const style = toneStyle(tone);

  return (
    <article
      style={{
        border: `1px solid ${style.border}`,
        background: style.background,
        borderRadius: 20,
        padding: 16,
        display: "grid",
        gap: 10,
        minWidth: 0,
      }}
    >
      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 11,
          fontWeight: 950,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </p>

      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: "clamp(24px, 3vw, 34px)",
          lineHeight: 1,
          fontWeight: 950,
          letterSpacing: "-0.06em",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </strong>

      <span
        style={{
          color: style.color,
          fontSize: 12,
          lineHeight: 1.5,
          fontWeight: 800,
        }}
      >
        {hint}
      </span>
    </article>
  );
}

export default function DemoModePage() {
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadStatus() {
    try {
      const response = await fetch("/api/demo/sample-data", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to load demo status.");
      }

      setStatus(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load demo status.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function runDemoAction(action: "seed" | "reset") {
    setIsWorking(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/demo/sample-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Demo action failed.");
      }

      setMessage(data.message ?? "Demo action completed.");
      await loadStatus();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Demo action failed.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  const hasDemoData = Boolean(status?.hasDemoData);

  return (
    <main>
      <header
        style={{
          marginBottom: 24,
          border: "1px solid rgba(245,158,11,0.22)",
          background:
            "radial-gradient(circle at top left, rgba(245,158,11,0.16), transparent 34%), radial-gradient(circle at bottom right, rgba(56,189,248,0.10), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.062), rgba(255,255,255,0.026))",
          borderRadius: 30,
          padding: 26,
          display: "grid",
          gap: 18,
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              Hackathon Demo Mode
            </p>

            <h1
              style={{
                margin: "12px 0 0",
                color: "var(--color-text-primary)",
                fontSize: "clamp(38px, 5.2vw, 72px)",
                lineHeight: 0.98,
                letterSpacing: "-0.078em",
                maxWidth: 960,
              }}
            >
              Stable presentation flow.
            </h1>

            <p
              className="page-intro"
              style={{
                margin: "16px 0 0",
                lineHeight: 1.7,
                maxWidth: 850,
              }}
            >
              Seed a ready-made demo business with approved financial documents
              so Aureli works smoothly even if live uploads or AI quota fail.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => runDemoAction("seed")}
              disabled={isWorking}
              className="btn-ghost"
              style={{
                cursor: isWorking ? "not-allowed" : "pointer",
                border: "1px solid rgba(46,213,115,0.30)",
                color: "var(--color-sage)",
                background: "rgba(46,213,115,0.08)",
              }}
            >
              {isWorking ? "Working..." : "Seed demo data"}
            </button>

            <button
              type="button"
              onClick={() => runDemoAction("reset")}
              disabled={isWorking}
              className="btn-ghost"
              style={{
                cursor: isWorking ? "not-allowed" : "pointer",
                border: "1px solid rgba(255,138,149,0.30)",
                color: "var(--color-danger)",
                background: "rgba(255,138,149,0.08)",
              }}
            >
              Reset demo data
            </button>
          </div>
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 14,
          }}
        >
          <MetricCard
            label="Demo status"
            value={isLoading ? "Loading" : hasDemoData ? "Ready" : "Not seeded"}
            hint={
              hasDemoData
                ? "Demo documents are approved"
                : "Click seed demo data first"
            }
            tone={hasDemoData ? "good" : "warning"}
          />

          <MetricCard
            label="Demo documents"
            value={`${status?.demoDocuments ?? 0}`}
            hint="Only files starting with [DEMO]"
            tone={hasDemoData ? "good" : "neutral"}
          />

          <MetricCard
            label="Presentation safety"
            value="High"
            hint="No live upload required"
            tone="good"
          />

          <MetricCard
            label="Demo flow"
            value="8 steps"
            hint="From dashboard to AI chat"
            tone="good"
          />
        </div>

        {message ? (
          <section
            style={{
              border: "1px solid rgba(46,213,115,0.28)",
              background: "rgba(46,213,115,0.085)",
              color: "var(--color-sage)",
              borderRadius: 18,
              padding: 14,
              fontSize: 13,
              fontWeight: 850,
            }}
          >
            {message}
          </section>
        ) : null}

        {error ? (
          <section
            style={{
              border: "1px solid rgba(255,138,149,0.30)",
              background: "rgba(255,138,149,0.085)",
              color: "var(--color-danger)",
              borderRadius: 18,
              padding: 14,
              fontSize: 13,
              fontWeight: 850,
            }}
          >
            {error}
          </section>
        ) : null}

        <section
          className="section-card"
          style={{
            padding: 22,
            display: "grid",
            gap: 14,
          }}
        >
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              Demo script
            </p>

            <h2
              style={{
                margin: "8px 0 0",
                color: "var(--color-text-primary)",
                fontSize: 24,
                lineHeight: 1.15,
              }}
            >
              Follow this order during presentation
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 14,
            }}
          >
            {DEMO_FLOW.map((step) => (
              <FlowCard key={step.href} {...step} />
            ))}
          </div>
        </section>

        <section
          className="section-card"
          style={{
            padding: 22,
            display: "grid",
            gap: 14,
          }}
        >
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              Speaking points
            </p>

            <h2
              style={{
                margin: "8px 0 0",
                color: "var(--color-text-primary)",
                fontSize: 24,
                lineHeight: 1.15,
              }}
            >
              What to say in hackathon
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            {[
              "Aureli converts financial documents into trusted business intelligence.",
              "Only approved extracted data powers the dashboard and AI agents.",
              "The platform acts like a CFO, accountant, analyst, cash-flow manager, tax assistant, risk agent, and consultant.",
              "Forecast shows predictive analytics and what-if decisions.",
              "Learning Center demonstrates a feedback reward loop similar to reinforcement learning.",
              "Decision Center combines all engines and tells the owner what to fix first.",
            ].map((point) => (
              <div
                key={point}
                style={{
                  border: "1px solid rgba(255,255,255,0.09)",
                  background: "rgba(255,255,255,0.035)",
                  borderRadius: 16,
                  padding: 13,
                  color: "var(--color-text-secondary)",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                {point}
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}