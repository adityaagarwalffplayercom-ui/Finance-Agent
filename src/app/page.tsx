import Link from "next/link";
import { AureliLogo } from "@/components/AureliLogo";

const FEATURES = [
  {
    title: "AI document extraction",
    description:
      "Upload financial statements, invoices, bank statements, and expense documents. Aureli extracts trusted finance data using AI.",
    icon: "📄",
  },
  {
    title: "Finance health dashboard",
    description:
      "Track revenue, expenses, profit, cash flow, financial health score, alerts, and visual charts from approved data.",
    icon: "📊",
  },
  {
    title: "AI finance team",
    description:
      "Ask CFO, accountant, tax, analyst, cash flow, risk, and consultant agents business questions using your approved documents.",
    icon: "🧠",
  },
  {
    title: "CFO-style reports",
    description:
      "Generate executive finance summaries that explain business performance, risks, and recommended next actions.",
    icon: "📈",
  },
];

const WORKFLOW = [
  {
    step: "01",
    title: "Create business profile",
    description:
      "Add your business name, industry, country, currency, and financial year.",
  },
  {
    step: "02",
    title: "Upload finance documents",
    description:
      "Add statements, invoices, payroll, utility bills, or any finance-related file.",
  },
  {
    step: "03",
    title: "Review AI extraction",
    description:
      "Approve only the extracted numbers you trust. Pending and rejected data stay excluded.",
  },
  {
    step: "04",
    title: "Use dashboard and AI agents",
    description:
      "Monitor performance, ask finance questions, and generate CFO-style insights.",
  },
];

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article
      style={{
        border: "1px solid rgba(245,158,11,0.18)",
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.070), rgba(255,255,255,0.024))",
        borderRadius: 24,
        padding: 18,
        display: "grid",
        gap: 8,
        minWidth: 0,
        boxShadow:
          "0 18px 60px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)",
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
          fontSize: 32,
          lineHeight: 1,
          fontWeight: 950,
          letterSpacing: "-0.055em",
        }}
      >
        {value}
      </strong>

      <span
        style={{
          color: "var(--color-gold)",
          fontSize: 12,
          lineHeight: 1.45,
          fontWeight: 800,
        }}
      >
        {hint}
      </span>
    </article>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <article
      style={{
        border: "1px solid rgba(245,158,11,0.14)",
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.058), rgba(255,255,255,0.022))",
        borderRadius: 26,
        padding: 22,
        display: "grid",
        gap: 14,
        minHeight: 230,
        boxShadow:
          "0 18px 60px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.052)",
      }}
    >
      <span
        style={{
          width: 48,
          height: 48,
          borderRadius: 17,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid rgba(255,209,102,0.28)",
          background: "rgba(245,158,11,0.10)",
          fontSize: 20,
        }}
      >
        {icon}
      </span>

      <div
        style={{
          display: "grid",
          gap: 8,
        }}
      >
        <h3
          style={{
            margin: 0,
            color: "var(--color-text-primary)",
            fontSize: 19,
            lineHeight: 1.2,
            fontWeight: 950,
            letterSpacing: "-0.04em",
          }}
        >
          {title}
        </h3>

        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          {description}
        </p>
      </div>
    </article>
  );
}

function WorkflowCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <article
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.035)",
        borderRadius: 22,
        padding: 18,
        display: "grid",
        gap: 12,
      }}
    >
      <span
        style={{
          color: "var(--color-gold)",
          fontSize: 12,
          fontWeight: 950,
          letterSpacing: "0.10em",
        }}
      >
        {step}
      </span>

      <h3
        style={{
          margin: 0,
          color: "var(--color-text-primary)",
          fontSize: 17,
          lineHeight: 1.25,
          fontWeight: 950,
          letterSpacing: "-0.035em",
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 13,
          lineHeight: 1.65,
        }}
      >
        {description}
      </p>
    </article>
  );
}

export default function HomePage() {
  return (
    <>
      <main
        style={{
          minHeight: "100dvh",
          background:
            "radial-gradient(circle at top left, rgba(245,158,11,0.18), transparent 32%), radial-gradient(circle at 88% 14%, rgba(46,213,115,0.10), transparent 30%), linear-gradient(180deg, #090d14 0%, #0b111b 52%, #090d14 100%)",
          color: "var(--color-text-primary)",
          overflow: "hidden",
        }}
      >
        <nav
          className="aureli-home-nav"
          style={{
            width: "min(1180px, calc(100% - 32px))",
            margin: "0 auto",
            padding: "22px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <Link
            href="/"
            className="aureli-home-brand"
            style={{
              color: "inherit",
              textDecoration: "none",
              minWidth: 0,
            }}
          >
            <AureliLogo size={38} showWordmark tagline="Your AI finance team" />
          </Link>

          <div
            className="aureli-home-nav-actions"
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <Link href="/login" className="btn-ghost aureli-nav-button">
              Sign in
            </Link>

            <Link
              href="/signup"
              className="btn-ghost aureli-nav-button aureli-nav-primary"
              style={{
                border: "1px solid rgba(255,209,102,0.34)",
                background: "rgba(245,158,11,0.12)",
                color: "var(--color-gold)",
              }}
            >
              Start free
            </Link>
          </div>
        </nav>

        <section
          style={{
            width: "min(1180px, calc(100% - 32px))",
            margin: "0 auto",
            padding: "58px 0 72px",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.05fr) minmax(320px, 0.95fr)",
            gap: 34,
            alignItems: "center",
          }}
          className="aureli-home-hero"
        >
          <div
            style={{
              display: "grid",
              gap: 22,
              minWidth: 0,
            }}
          >
            <span
              className="aureli-home-eyebrow-pill"
              style={{
                width: "fit-content",
                border: "1px solid rgba(255,209,102,0.26)",
                background: "rgba(245,158,11,0.10)",
                color: "var(--color-gold)",
                borderRadius: 999,
                padding: "10px 14px",
                fontSize: 12,
                fontWeight: 950,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              AI executive finance workspace
            </span>

            <h1
              className="aureli-home-title"
              style={{
                margin: 0,
                color: "var(--color-text-primary)",
                fontSize: "clamp(48px, 8vw, 92px)",
                lineHeight: 0.92,
                letterSpacing: "-0.088em",
                maxWidth: 900,
                fontWeight: 950,
              }}
            >
              Meet Aureli, your AI finance team.
            </h1>

            <p
              className="aureli-home-intro"
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 18,
                lineHeight: 1.75,
                maxWidth: 740,
              }}
            >
              Upload financial documents, approve trusted numbers, monitor cash
              flow, understand business health, and ask CFO-style questions from
              one intelligent workspace.
            </p>

            <div
              className="aureli-home-hero-actions"
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <Link
                href="/signup"
                className="btn-ghost aureli-hero-button"
                style={{
                  border: "1px solid rgba(255,209,102,0.38)",
                  background:
                    "linear-gradient(135deg, rgba(245,158,11,0.22), rgba(255,209,102,0.10))",
                  color: "var(--color-gold)",
                  padding: "13px 18px",
                }}
              >
                Launch Aureli
              </Link>

              <Link
                href="/login"
                className="btn-ghost aureli-hero-button"
                style={{
                  padding: "13px 18px",
                }}
              >
                Sign in
              </Link>
            </div>
          </div>

          <section
            className="aureli-home-preview"
            style={{
              border: "1px solid rgba(245,158,11,0.18)",
              background:
                "radial-gradient(circle at top right, rgba(245,158,11,0.18), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.075), rgba(255,255,255,0.026))",
              borderRadius: 34,
              padding: 22,
              display: "grid",
              gap: 16,
              boxShadow:
                "0 28px 100px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.08)",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 14,
                alignItems: "center",
              }}
            >
              <AureliLogo size={44} showWordmark tagline="Finance command" />

              <span
                style={{
                  border: "1px solid rgba(46,213,115,0.28)",
                  background: "rgba(46,213,115,0.09)",
                  color: "var(--color-sage)",
                  borderRadius: 999,
                  padding: "8px 11px",
                  fontSize: 11,
                  fontWeight: 950,
                }}
              >
                Live insights
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 12,
              }}
              className="aureli-home-metrics"
            >
              <MetricCard label="Revenue" value="₹42.8L" hint="+18% trend" />
              <MetricCard label="Profit" value="₹9.4L" hint="Healthy margin" />
              <MetricCard label="Cash" value="₹16.2L" hint="Stable runway" />
              <MetricCard label="Health" value="84/100" hint="Strong position" />
            </div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(0,0,0,0.14)",
                borderRadius: 24,
                padding: 18,
                display: "grid",
                gap: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <strong
                  style={{
                    color: "var(--color-text-primary)",
                    fontSize: 14,
                  }}
                >
                  Cash flow trend
                </strong>

                <span
                  style={{
                    color: "var(--color-sage)",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  +₹6.8L net
                </span>
              </div>

              <div
                style={{
                  height: 120,
                  display: "flex",
                  gap: 10,
                  alignItems: "end",
                }}
              >
                {[42, 56, 38, 72, 64, 92].map((height, index) => (
                  <span
                    key={index}
                    style={{
                      flex: 1,
                      height,
                      borderRadius: "14px 14px 7px 7px",
                      background:
                        "linear-gradient(180deg, var(--color-sage), rgba(46,213,115,0.18))",
                      border: "1px solid rgba(46,213,115,0.25)",
                      boxShadow: "0 16px 42px rgba(46,213,115,0.12)",
                    }}
                  />
                ))}
              </div>
            </div>
          </section>
        </section>

        <section
          style={{
            width: "min(1180px, calc(100% - 32px))",
            margin: "0 auto",
            padding: "22px 0 76px",
            display: "grid",
            gap: 22,
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 8,
              maxWidth: 760,
            }}
          >
            <p className="eyebrow" style={{ margin: 0 }}>
              What Aureli does
            </p>

            <h2
              style={{
                margin: 0,
                color: "var(--color-text-primary)",
                fontSize: "clamp(32px, 4vw, 56px)",
                lineHeight: 1,
                letterSpacing: "-0.07em",
                fontWeight: 950,
              }}
            >
              From documents to decisions.
            </h2>

            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 16,
                lineHeight: 1.7,
              }}
            >
              Aureli converts raw finance documents into dashboards, charts,
              alerts, reports, and AI-powered business answers.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 16,
            }}
            className="aureli-home-feature-grid"
          >
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </section>

        <section
          style={{
            width: "min(1180px, calc(100% - 32px))",
            margin: "0 auto",
            padding: "0 0 88px",
            display: "grid",
            gridTemplateColumns: "minmax(0, 0.85fr) minmax(0, 1.15fr)",
            gap: 22,
            alignItems: "start",
          }}
          className="aureli-home-workflow"
        >
          <div
            style={{
              border: "1px solid rgba(255,209,102,0.18)",
              background:
                "linear-gradient(135deg, rgba(245,158,11,0.11), rgba(255,255,255,0.024))",
              borderRadius: 30,
              padding: 24,
              display: "grid",
              gap: 14,
            }}
          >
            <AureliLogo size={48} showWordmark tagline="Classic AI finance" />

            <h2
              style={{
                margin: 0,
                color: "var(--color-text-primary)",
                fontSize: "clamp(30px, 4vw, 52px)",
                lineHeight: 1,
                letterSpacing: "-0.07em",
                fontWeight: 950,
              }}
            >
              Built for trust, not guesswork.
            </h2>

            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 15,
                lineHeight: 1.7,
              }}
            >
              Aureli only uses approved processed documents for dashboard
              metrics and AI recommendations, so business owners stay in
              control of trusted financial data.
            </p>

            <Link
              href="/signup"
              className="btn-ghost"
              style={{
                width: "fit-content",
                border: "1px solid rgba(255,209,102,0.34)",
                background: "rgba(245,158,11,0.12)",
                color: "var(--color-gold)",
              }}
            >
              Start with Aureli
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 14,
            }}
            className="aureli-home-workflow-grid"
          >
            {WORKFLOW.map((item) => (
              <WorkflowCard key={item.step} {...item} />
            ))}
          </div>
        </section>
      </main>

      <style>
        {`
          @media (max-width: 1060px) {
            .aureli-home-hero,
            .aureli-home-workflow {
              grid-template-columns: 1fr !important;
            }

            .aureli-home-feature-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
          }

          @media (max-width: 760px) {
            .aureli-home-nav {
              width: min(100% - 24px, 1180px) !important;
              padding: 16px 0 !important;
              display: grid !important;
              grid-template-columns: minmax(0, 1fr) auto !important;
              align-items: center !important;
              gap: 10px !important;
            }

            .aureli-home-brand {
              overflow: hidden !important;
              min-width: 0 !important;
            }

            .aureli-home-brand .aureli-logo {
              gap: 8px !important;
              min-width: 0 !important;
              max-width: 100% !important;
            }

            .aureli-home-brand .aureli-logo-mark {
              width: 34px !important;
              height: 34px !important;
            }

            .aureli-home-brand .aureli-logo-name {
              font-size: 18px !important;
              white-space: nowrap !important;
            }

            .aureli-home-brand .aureli-logo-tagline {
              display: none !important;
            }

            .aureli-home-nav-actions {
              display: flex !important;
              flex-wrap: nowrap !important;
              gap: 7px !important;
              justify-content: flex-end !important;
              align-items: center !important;
            }

            .aureli-nav-button {
              min-height: 34px !important;
              padding: 8px 10px !important;
              font-size: 11px !important;
              line-height: 1 !important;
              border-radius: 999px !important;
              white-space: nowrap !important;
              width: auto !important;
            }

            .aureli-home-hero {
              width: min(100% - 24px, 1180px) !important;
              padding: 42px 0 54px !important;
              gap: 28px !important;
            }

            .aureli-home-eyebrow-pill {
              font-size: 10px !important;
              padding: 9px 12px !important;
              letter-spacing: 0.05em !important;
            }

            .aureli-home-title {
              font-size: clamp(46px, 16vw, 68px) !important;
              line-height: 0.94 !important;
              letter-spacing: -0.08em !important;
            }

            .aureli-home-intro {
              font-size: 16px !important;
              line-height: 1.65 !important;
            }

            .aureli-home-hero-actions {
              display: grid !important;
              grid-template-columns: 1fr !important;
              gap: 10px !important;
            }

            .aureli-hero-button {
              width: 100% !important;
              justify-content: center !important;
              min-height: 48px !important;
            }

            .aureli-home-preview {
              border-radius: 26px !important;
              padding: 18px !important;
            }
          }

          @media (max-width: 680px) {
            .aureli-home-feature-grid,
            .aureli-home-workflow-grid,
            .aureli-home-metrics {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 390px) {
            .aureli-nav-button {
              padding: 8px 8px !important;
              font-size: 10px !important;
            }

            .aureli-home-brand .aureli-logo-name {
              font-size: 16px !important;
            }

            .aureli-home-brand .aureli-logo-mark {
              width: 30px !important;
              height: 30px !important;
            }
          }
        `}
      </style>
    </>
  );
}
