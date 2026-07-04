import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const workflowSteps = [
  {
    step: "01",
    title: "Upload business documents",
    text: "Add financial statements, bank statements, sales invoices, purchase invoices, payroll files, or bills.",
  },
  {
    step: "02",
    title: "AI extracts financial data",
    text: "Gemini reads the document, detects accounting units, and converts values into real full currency amounts.",
  },
  {
    step: "03",
    title: "Owner approves trusted numbers",
    text: "AI output is not blindly trusted. The business owner reviews extraction and approves only correct data.",
  },
  {
    step: "04",
    title: "Dashboard and agents update",
    text: "Approved data powers revenue, expenses, profit, cash, health score, alerts, and AI finance chat.",
  },
];

const agentCards = [
  {
    icon: "🤖",
    title: "Overall Finance Team",
    text: "A complete all-in-one finance assistant for general business decisions.",
  },
  {
    icon: "📊",
    title: "CFO Agent",
    text: "Explains financial health, profitability, risk, and next actions.",
  },
  {
    icon: "📚",
    title: "Accountant Agent",
    text: "Checks documents, missing records, trust status, and accounting gaps.",
  },
  {
    icon: "📈",
    title: "Financial Analyst Agent",
    text: "Analyzes margins, ratios, revenue coverage, and performance signals.",
  },
  {
    icon: "💧",
    title: "Cash Flow Agent",
    text: "Looks at liquidity, runway, burn rate, and bank statement readiness.",
  },
  {
    icon: "🛡️",
    title: "Risk Agent",
    text: "Surfaces warnings, weak signals, missing data, and financial red flags.",
  },
];

const trustCards = [
  {
    title: "Real accounting values",
    text: "The system detects whether statements are in thousands, lakhs, crores, millions, or actual values before saving numbers.",
  },
  {
    title: "Human approval layer",
    text: "Pending or rejected documents do not affect dashboard, AI team, or chat answers.",
  },
  {
    title: "Approved-data-only AI",
    text: "Agents answer only from trusted processed documents instead of inventing unsupported numbers.",
  },
];

function SectionHeader({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div
      style={{
        maxWidth: 760,
        display: "grid",
        gap: 10,
      }}
    >
      <p
        style={{
          margin: 0,
          color: "var(--color-amber)",
          fontSize: 12,
          fontWeight: 950,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
        }}
      >
        {eyebrow}
      </p>

      <h2
        style={{
          margin: 0,
          color: "var(--color-text-primary)",
          fontSize: "clamp(30px, 5vw, 48px)",
          lineHeight: 1.05,
          fontWeight: 950,
          letterSpacing: "-0.055em",
        }}
      >
        {title}
      </h2>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 16,
          lineHeight: 1.7,
        }}
      >
        {text}
      </p>
    </div>
  );
}

function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        background: "var(--color-amber)",
        color: "var(--color-base)",
        borderRadius: 14,
        padding: "13px 18px",
        textDecoration: "none",
        fontSize: 14,
        fontWeight: 950,
        boxShadow: "0 18px 45px rgba(245,158,11,0.22)",
      }}
    >
      {children}
    </Link>
  );
}

function SecondaryLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid var(--color-border)",
        background: "rgba(255,255,255,0.045)",
        color: "var(--color-text-primary)",
        borderRadius: 14,
        padding: "13px 18px",
        textDecoration: "none",
        fontSize: 14,
        fontWeight: 850,
      }}
    >
      {children}
    </Link>
  );
}

export default async function RootPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const isLoggedIn = Boolean(session?.user?.id);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(245,158,11,0.16), transparent 34%), radial-gradient(circle at top right, rgba(255,255,255,0.07), transparent 32%), var(--color-base)",
        color: "var(--color-text-primary)",
      }}
    >
      <nav
        style={{
          width: "min(1180px, calc(100% - 32px))",
          margin: "0 auto",
          padding: "24px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            color: "var(--color-text-primary)",
          }}
        >
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: 14,
              display: "grid",
              placeItems: "center",
              background: "var(--color-amber)",
              color: "var(--color-base)",
              fontWeight: 950,
              boxShadow: "0 16px 36px rgba(245,158,11,0.22)",
            }}
          >
            L
          </span>

          <span
            style={{
              fontSize: 18,
              fontWeight: 950,
              letterSpacing: "-0.04em",
            }}
          >
            Ledger
          </span>
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          {isLoggedIn ? (
            <SecondaryLink href="/dashboard">Open dashboard</SecondaryLink>
          ) : (
            <>
              <SecondaryLink href="/login">Login</SecondaryLink>
              <PrimaryLink href="/signup">Get started</PrimaryLink>
            </>
          )}
        </div>
      </nav>

      <section
        style={{
          width: "min(1180px, calc(100% - 32px))",
          margin: "0 auto",
          padding: "54px 0 72px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.05fr) minmax(320px, 0.95fr)",
          gap: 34,
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 22,
          }}
        >
          <span
            style={{
              justifySelf: "start",
              border: "1px solid rgba(245,158,11,0.32)",
              background: "rgba(245,158,11,0.10)",
              color: "var(--color-amber)",
              borderRadius: 999,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            AI Executive Finance Team
          </span>

          <h1
            style={{
              margin: 0,
              color: "var(--color-text-primary)",
              fontSize: "clamp(46px, 7vw, 82px)",
              lineHeight: 0.94,
              fontWeight: 950,
              letterSpacing: "-0.075em",
              maxWidth: 780,
            }}
          >
            Turn business documents into financial decisions.
          </h1>

          <p
            style={{
              margin: 0,
              color: "var(--color-text-secondary)",
              fontSize: 18,
              lineHeight: 1.7,
              maxWidth: 680,
            }}
          >
            Ledger helps small businesses upload financial documents, extract
            real accounting values, approve trusted data, monitor dashboards,
            and ask an AI finance team what to do next.
          </p>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <PrimaryLink href={isLoggedIn ? "/dashboard" : "/signup"}>
              {isLoggedIn ? "Go to dashboard" : "Start free"}
            </PrimaryLink>

            <SecondaryLink href={isLoggedIn ? "/documents" : "/login"}>
              {isLoggedIn ? "Upload documents" : "Login"}
            </SecondaryLink>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 4,
            }}
          >
            {[
              "Human-approved data",
              "Real financial extraction",
              "AI CFO dashboard",
              "Specialist finance agents",
            ].map((item) => (
              <span
                key={item}
                style={{
                  border: "1px solid var(--color-border)",
                  background: "rgba(255,255,255,0.035)",
                  color: "var(--color-text-secondary)",
                  borderRadius: 999,
                  padding: "8px 11px",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div
          style={{
            border: "1px solid var(--color-border)",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.075), rgba(255,255,255,0.025))",
            borderRadius: 30,
            padding: 20,
            boxShadow: "0 28px 80px rgba(0,0,0,0.28)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 230,
              height: 230,
              borderRadius: "50%",
              background: "rgba(245,158,11,0.14)",
              filter: "blur(45px)",
              right: -90,
              top: -90,
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "grid",
              gap: 14,
            }}
          >
            <div
              style={{
                border: "1px solid var(--color-border)",
                background: "rgba(0,0,0,0.18)",
                borderRadius: 22,
                padding: 18,
                display: "grid",
                gap: 14,
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
                <div>
                  <p
                    style={{
                      margin: "0 0 5px",
                      color: "var(--color-text-secondary)",
                      fontSize: 12,
                      fontWeight: 850,
                      textTransform: "uppercase",
                      letterSpacing: "0.10em",
                    }}
                  >
                    Business health
                  </p>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--color-text-primary)",
                      fontSize: 30,
                      fontWeight: 950,
                      letterSpacing: "-0.04em",
                    }}
                  >
                    82/100
                  </p>
                </div>

                <span
                  style={{
                    border: "1px solid rgba(46,213,115,0.28)",
                    background: "rgba(46,213,115,0.10)",
                    color: "#7bed9f",
                    borderRadius: 999,
                    padding: "8px 11px",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  Trusted data
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
                {[
                  ["Revenue", "₹24.8M"],
                  ["Expenses", "₹18.2M"],
                  ["Profit", "₹6.6M"],
                  ["Cash", "₹9.4M"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      border: "1px solid var(--color-border)",
                      background: "rgba(255,255,255,0.035)",
                      borderRadius: 16,
                      padding: 14,
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        color: "var(--color-text-secondary)",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {label}
                    </span>

                    <strong
                      style={{
                        color: "var(--color-text-primary)",
                        fontSize: 20,
                        letterSpacing: "-0.04em",
                      }}
                    >
                      {value}
                    </strong>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                border: "1px solid rgba(255,193,7,0.26)",
                background: "rgba(255,193,7,0.08)",
                borderRadius: 20,
                padding: 16,
              }}
            >
              <p
                style={{
                  margin: "0 0 7px",
                  color: "#ffd166",
                  fontSize: 13,
                  fontWeight: 900,
                }}
              >
                AI CFO insight
              </p>

              <p
                style={{
                  margin: 0,
                  color: "var(--color-text-secondary)",
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                Expenses are rising faster than revenue. Review top cost
                drivers and upload bank statements to improve cash flow
                visibility.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              {["CFO", "Analyst", "Risk"].map((agent) => (
                <div
                  key={agent}
                  style={{
                    border: "1px solid var(--color-border)",
                    background: "rgba(255,255,255,0.035)",
                    borderRadius: 16,
                    padding: 12,
                    color: "var(--color-text-secondary)",
                    fontSize: 12,
                    fontWeight: 850,
                    textAlign: "center",
                  }}
                >
                  {agent} Agent
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          borderTop: "1px solid var(--color-border)",
          borderBottom: "1px solid var(--color-border)",
          background: "rgba(255,255,255,0.025)",
        }}
      >
        <div
          style={{
            width: "min(1180px, calc(100% - 32px))",
            margin: "0 auto",
            padding: "34px 0",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
          }}
        >
          {[
            ["Documents", "Upload financial records"],
            ["Extraction", "AI reads and normalizes"],
            ["Approval", "Owner verifies data"],
            ["Dashboard", "Trusted numbers only"],
            ["AI Team", "Ask business questions"],
          ].map(([title, text]) => (
            <div
              key={title}
              style={{
                display: "grid",
                gap: 5,
              }}
            >
              <strong
                style={{
                  color: "var(--color-text-primary)",
                  fontSize: 14,
                }}
              >
                {title}
              </strong>

              <span
                style={{
                  color: "var(--color-text-secondary)",
                  fontSize: 13,
                  lineHeight: 1.4,
                }}
              >
                {text}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          width: "min(1180px, calc(100% - 32px))",
          margin: "0 auto",
          padding: "82px 0",
          display: "grid",
          gap: 28,
        }}
      >
        <SectionHeader
          eyebrow="Workflow"
          title="From raw files to trusted finance intelligence."
          text="Ledger is designed around a real business workflow. AI helps with speed, but trusted dashboards are created only after the owner approves the extracted numbers."
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 14,
          }}
        >
          {workflowSteps.map((item) => (
            <article
              key={item.step}
              style={{
                border: "1px solid var(--color-border)",
                background: "rgba(255,255,255,0.035)",
                borderRadius: 22,
                padding: 18,
                display: "grid",
                gap: 12,
              }}
            >
              <span
                style={{
                  color: "var(--color-amber)",
                  fontSize: 12,
                  fontWeight: 950,
                  letterSpacing: "0.14em",
                }}
              >
                STEP {item.step}
              </span>

              <h3
                style={{
                  margin: 0,
                  color: "var(--color-text-primary)",
                  fontSize: 18,
                  fontWeight: 950,
                  letterSpacing: "-0.035em",
                }}
              >
                {item.title}
              </h3>

              <p
                style={{
                  margin: 0,
                  color: "var(--color-text-secondary)",
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        style={{
          width: "min(1180px, calc(100% - 32px))",
          margin: "0 auto",
          padding: "0 0 82px",
          display: "grid",
          gap: 28,
        }}
      >
        <SectionHeader
          eyebrow="AI finance team"
          title="Specialist agents for different finance decisions."
          text="Instead of one generic chatbot, Ledger gives the business owner a complete finance department with role-based agents."
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {agentCards.map((agent) => (
            <article
              key={agent.title}
              style={{
                border: "1px solid var(--color-border)",
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.052), rgba(255,255,255,0.022))",
                borderRadius: 22,
                padding: 18,
                display: "grid",
                gap: 12,
              }}
            >
              <span
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 16,
                  border: "1px solid var(--color-border)",
                  background: "rgba(255,255,255,0.04)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 22,
                }}
              >
                {agent.icon}
              </span>

              <h3
                style={{
                  margin: 0,
                  color: "var(--color-text-primary)",
                  fontSize: 18,
                  fontWeight: 950,
                  letterSpacing: "-0.035em",
                }}
              >
                {agent.title}
              </h3>

              <p
                style={{
                  margin: 0,
                  color: "var(--color-text-secondary)",
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                {agent.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        style={{
          width: "min(1180px, calc(100% - 32px))",
          margin: "0 auto",
          padding: "0 0 82px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.9fr) minmax(320px, 1.1fr)",
          gap: 24,
          alignItems: "center",
        }}
      >
        <SectionHeader
          eyebrow="Trust layer"
          title="AI does the extraction. The owner controls the truth."
          text="Financial dashboards can be dangerous if wrong data is trusted automatically. Ledger solves this with a human approval layer before data reaches the dashboard or AI agents."
        />

        <div
          style={{
            display: "grid",
            gap: 14,
          }}
        >
          {trustCards.map((card) => (
            <article
              key={card.title}
              style={{
                border: "1px solid var(--color-border)",
                background: "rgba(255,255,255,0.035)",
                borderRadius: 20,
                padding: 18,
                display: "grid",
                gap: 8,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "var(--color-text-primary)",
                  fontSize: 18,
                  fontWeight: 950,
                  letterSpacing: "-0.035em",
                }}
              >
                {card.title}
              </h3>

              <p
                style={{
                  margin: 0,
                  color: "var(--color-text-secondary)",
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                {card.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        style={{
          width: "min(1180px, calc(100% - 32px))",
          margin: "0 auto",
          padding: "0 0 86px",
        }}
      >
        <div
          style={{
            border: "1px solid rgba(245,158,11,0.28)",
            background:
              "linear-gradient(135deg, rgba(245,158,11,0.14), rgba(255,255,255,0.035))",
            borderRadius: 30,
            padding: "clamp(24px, 5vw, 42px)",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 22,
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            <p
              style={{
                margin: 0,
                color: "var(--color-amber)",
                fontSize: 12,
                fontWeight: 950,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
              }}
            >
              Ready to run finance smarter?
            </p>

            <h2
              style={{
                margin: 0,
                color: "var(--color-text-primary)",
                fontSize: "clamp(30px, 5vw, 46px)",
                lineHeight: 1.05,
                fontWeight: 950,
                letterSpacing: "-0.055em",
              }}
            >
              Build your AI finance command center.
            </h2>

            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 15,
                lineHeight: 1.7,
                maxWidth: 720,
              }}
            >
              Upload documents, approve trusted numbers, and ask your AI finance
              team what to fix next.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <PrimaryLink href={isLoggedIn ? "/dashboard" : "/signup"}>
              {isLoggedIn ? "Open dashboard" : "Create account"}
            </PrimaryLink>

            <SecondaryLink href={isLoggedIn ? "/chat" : "/login"}>
              {isLoggedIn ? "Ask AI team" : "Login"}
            </SecondaryLink>
          </div>
        </div>
      </section>
    </main>
  );
}