import Link from "next/link";

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
          "linear-gradient(135deg, rgba(245,158,11,0.055), rgba(255,255,255,0.025))",
        borderRadius: 24,
        padding: 22,
        display: "grid",
        gap: 14,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.055)",
      }}
    >
      <span
        style={{
          width: 48,
          height: 48,
          borderRadius: 18,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(245,158,11,0.12)",
          border: "1px solid rgba(245,158,11,0.28)",
          fontSize: 22,
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
            color: "#f8fafc",
            fontSize: 19,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h3>

        <p
          style={{
            margin: 0,
            color: "rgba(226,232,240,0.74)",
            fontSize: 14,
            lineHeight: 1.65,
          }}
        >
          {description}
        </p>
      </div>
    </article>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <article
      style={{
        border: "1px solid rgba(245,158,11,0.12)",
        background: "rgba(255,255,255,0.035)",
        borderRadius: 22,
        padding: 20,
        display: "grid",
        gap: 14,
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: 16,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(245,158,11,0.12)",
          border: "1px solid rgba(245,158,11,0.26)",
          color: "#f59e0b",
          fontSize: 13,
          fontWeight: 950,
        }}
      >
        {number}
      </span>

      <div
        style={{
          display: "grid",
          gap: 7,
        }}
      >
        <h3
          style={{
            margin: 0,
            color: "#f8fafc",
            fontSize: 18,
            lineHeight: 1.25,
          }}
        >
          {title}
        </h3>

        <p
          style={{
            margin: 0,
            color: "rgba(226,232,240,0.72)",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>
      </div>
    </article>
  );
}

function MetricPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span
      style={{
        border: "1px solid rgba(245,158,11,0.18)",
        background: "rgba(245,158,11,0.075)",
        borderRadius: 999,
        padding: "9px 12px",
        display: "inline-flex",
        gap: 7,
        alignItems: "center",
        color: "rgba(226,232,240,0.78)",
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {label}
      <strong
        style={{
          color: "#f8fafc",
        }}
      >
        {value}
      </strong>
    </span>
  );
}

function AgentCard({
  name,
  role,
  icon,
}: {
  name: string;
  role: string;
  icon: string;
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(245,158,11,0.13)",
        background: "rgba(245,158,11,0.045)",
        borderRadius: 18,
        padding: 14,
        display: "flex",
        gap: 12,
        alignItems: "center",
      }}
    >
      <span
        style={{
          width: 38,
          height: 38,
          borderRadius: 14,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(245,158,11,0.11)",
          border: "1px solid rgba(245,158,11,0.24)",
          fontSize: 18,
          flex: "0 0 auto",
        }}
      >
        {icon}
      </span>

      <span
        style={{
          display: "grid",
          gap: 3,
        }}
      >
        <strong
          style={{
            color: "#f8fafc",
            fontSize: 13,
            lineHeight: 1.2,
          }}
        >
          {name}
        </strong>

        <span
          style={{
            color: "rgba(226,232,240,0.65)",
            fontSize: 12,
            lineHeight: 1.35,
          }}
        >
          {role}
        </span>
      </span>
    </div>
  );
}

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(245,158,11,0.20), transparent 34%), radial-gradient(circle at bottom right, rgba(46,213,115,0.08), transparent 30%), linear-gradient(135deg, #080d14, #0d1117 48%, #090d13)",
        color: "#f8fafc",
        overflow: "hidden",
      }}
    >
      <style>
        {`
          @media (max-width: 980px) {
            .landing-hero-grid,
            .landing-final-grid {
              grid-template-columns: 1fr !important;
            }

            .landing-nav {
              justify-content: center !important;
            }

            .landing-hero-title {
              font-size: 44px !important;
            }
          }

          @media (max-width: 640px) {
            .landing-page-shell {
              padding: 18px !important;
            }

            .landing-hero {
              padding: 28px !important;
            }

            .landing-hero-title {
              font-size: 36px !important;
            }

            .landing-section {
              padding: 22px !important;
            }
          }
        `}
      </style>

      <div
        className="landing-page-shell"
        style={{
          width: "100%",
          maxWidth: 1180,
          margin: "0 auto",
          padding: 24,
          display: "grid",
          gap: 24,
        }}
      >
        <nav
          className="landing-nav"
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            alignItems: "center",
            flexWrap: "wrap",
            padding: "10px 0",
          }}
        >
          <Link
            href="/"
            style={{
              display: "inline-flex",
              gap: 10,
              alignItems: "center",
              textDecoration: "none",
            }}
          >
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 15,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  "linear-gradient(135deg, rgba(245,158,11,0.24), rgba(255,255,255,0.06))",
                border: "1px solid rgba(245,158,11,0.32)",
                fontSize: 18,
              }}
            >
              📊
            </span>

            <span
              style={{
                color: "#f8fafc",
                fontSize: 18,
                fontWeight: 950,
                letterSpacing: "-0.03em",
              }}
            >
              Ledger
            </span>
          </Link>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/login"
              style={{
                border: "1px solid rgba(245,158,11,0.16)",
                background: "rgba(255,255,255,0.045)",
                color: "#f8fafc",
                borderRadius: 999,
                padding: "10px 14px",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              Login
            </Link>

            <Link
              href="/signup"
              style={{
                border: "1px solid rgba(245,158,11,0.42)",
                background:
                  "linear-gradient(135deg, rgba(245,158,11,0.95), #ffd166)",
                color: "#090d13",
                borderRadius: 999,
                padding: "10px 14px",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 950,
                boxShadow: "0 18px 44px rgba(245,158,11,0.18)",
              }}
            >
              Start workspace
            </Link>
          </div>
        </nav>

        <section
          className="landing-hero"
          style={{
            border: "1px solid rgba(245,158,11,0.22)",
            background:
              "radial-gradient(circle at top left, rgba(245,158,11,0.17), transparent 38%), linear-gradient(135deg, rgba(255,255,255,0.070), rgba(255,255,255,0.026))",
            borderRadius: 34,
            padding: 34,
            display: "grid",
            gap: 26,
            boxShadow:
              "0 30px 100px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.07)",
          }}
        >
          <div
            className="landing-hero-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.1fr) minmax(340px, 0.9fr)",
              gap: 30,
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "grid",
                gap: 22,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <MetricPill label="AI CFO" value="24/7" />
                <MetricPill label="Docs" value="PDF, Excel, CSV" />
                <MetricPill label="Reports" value="CFO-ready" />
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 14,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    color: "#f59e0b",
                    fontSize: 13,
                    fontWeight: 950,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  AI Executive Finance Team
                </p>

                <h1
                  className="landing-hero-title"
                  style={{
                    margin: 0,
                    color: "#f8fafc",
                    fontSize: 62,
                    lineHeight: 0.98,
                    letterSpacing: "-0.07em",
                    maxWidth: 760,
                  }}
                >
                  Turn business documents into CFO-level decisions.
                </h1>

                <p
                  style={{
                    margin: 0,
                    color: "rgba(226,232,240,0.76)",
                    fontSize: 17,
                    lineHeight: 1.75,
                    maxWidth: 700,
                  }}
                >
                  Ledger understands financial statements, invoices, bank
                  statements, payroll, and bills — then converts them into a
                  dashboard, AI finance chat, risk insights, and printable CFO
                  reports.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <Link
                  href="/signup"
                  style={{
                    border: "1px solid rgba(245,158,11,0.42)",
                    background:
                      "linear-gradient(135deg, rgba(245,158,11,0.98), #ffd166)",
                    color: "#080d14",
                    borderRadius: 999,
                    padding: "13px 17px",
                    textDecoration: "none",
                    fontSize: 14,
                    fontWeight: 950,
                    boxShadow: "0 18px 50px rgba(245,158,11,0.18)",
                  }}
                >
                  Build my finance workspace
                </Link>

                <Link
                  href="/login"
                  style={{
                    border: "1px solid rgba(245,158,11,0.16)",
                    background: "rgba(255,255,255,0.045)",
                    color: "#f8fafc",
                    borderRadius: 999,
                    padding: "13px 17px",
                    textDecoration: "none",
                    fontSize: 14,
                    fontWeight: 900,
                  }}
                >
                  Open existing workspace
                </Link>
              </div>
            </div>

            <div
              style={{
                border: "1px solid rgba(245,158,11,0.16)",
                background: "rgba(0,0,0,0.18)",
                borderRadius: 30,
                padding: 18,
                display: "grid",
                gap: 14,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.055)",
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
                <span
                  style={{
                    color: "rgba(226,232,240,0.72)",
                    fontSize: 12,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.10em",
                  }}
                >
                  Live dashboard preview
                </span>

                <span
                  style={{
                    border: "1px solid rgba(46,213,115,0.28)",
                    background: "rgba(46,213,115,0.09)",
                    color: "#7bed9f",
                    borderRadius: 999,
                    padding: "6px 9px",
                    fontSize: 11,
                    fontWeight: 950,
                  }}
                >
                  AI ready
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    border: "1px solid rgba(46,213,115,0.25)",
                    background: "rgba(46,213,115,0.075)",
                    borderRadius: 20,
                    padding: 15,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      color: "rgba(226,232,240,0.66)",
                      fontSize: 11,
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Revenue
                  </span>

                  <strong
                    style={{
                      color: "#f8fafc",
                      fontSize: 25,
                    }}
                  >
                    ₹48.5L
                  </strong>

                  <span
                    style={{
                      color: "#7bed9f",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    Healthy inflow
                  </span>
                </div>

                <div
                  style={{
                    border: "1px solid rgba(245,158,11,0.25)",
                    background: "rgba(245,158,11,0.075)",
                    borderRadius: 20,
                    padding: 15,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      color: "rgba(226,232,240,0.66)",
                      fontSize: 11,
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Health
                  </span>

                  <strong
                    style={{
                      color: "#f8fafc",
                      fontSize: 25,
                    }}
                  >
                    82/100
                  </strong>

                  <span
                    style={{
                      color: "#ffd166",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    Stable business
                  </span>
                </div>
              </div>

              <div
                style={{
                  border: "1px solid rgba(245,158,11,0.25)",
                  background:
                    "linear-gradient(135deg, rgba(245,158,11,0.09), rgba(255,255,255,0.025))",
                  borderRadius: 22,
                  padding: 16,
                  display: "grid",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    color: "#ffd166",
                    fontSize: 12,
                    fontWeight: 950,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  CFO insight
                </span>

                <p
                  style={{
                    margin: 0,
                    color: "rgba(226,232,240,0.78)",
                    fontSize: 13,
                    lineHeight: 1.65,
                  }}
                >
                  Profit is positive, but expense ratio is still high. Review
                  payroll and operating costs before increasing fixed expenses.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                }}
              >
                <AgentCard
                  icon="🧠"
                  name="CFO Agent"
                  role="Strategy, profit, risk, runway"
                />

                <AgentCard
                  icon="🧾"
                  name="Accountant Agent"
                  role="Documents, review, trust status"
                />

                <AgentCard
                  icon="📈"
                  name="Analyst Agent"
                  role="Margins, trends, ratios"
                />
              </div>
            </div>
          </div>
        </section>

        <section
          className="landing-section"
          style={{
            border: "1px solid rgba(245,158,11,0.12)",
            background: "rgba(255,255,255,0.030)",
            borderRadius: 30,
            padding: 28,
            display: "grid",
            gap: 20,
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 8,
              maxWidth: 720,
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#f59e0b",
                fontSize: 12,
                fontWeight: 950,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              }}
            >
              What Ledger does
            </p>

            <h2
              style={{
                margin: 0,
                color: "#f8fafc",
                fontSize: 36,
                lineHeight: 1.08,
                letterSpacing: "-0.045em",
              }}
            >
              Not just accounting reports. Actual business intelligence.
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 14,
            }}
          >
            <FeatureCard
              icon="📁"
              title="Upload finance documents"
              description="Upload statements, invoices, payroll sheets, bills, and financial reports in common formats."
            />

            <FeatureCard
              icon="🤖"
              title="AI extracts key numbers"
              description="The AI reads the documents and extracts revenue, expenses, cash, profit, assets, liabilities, and line items."
            />

            <FeatureCard
              icon="✅"
              title="Approve trusted data"
              description="Review extracted results before they power the dashboard, chat, and reports."
            />

            <FeatureCard
              icon="📊"
              title="Executive dashboard"
              description="See health score, revenue, expenses, profit, cash, trends, alerts, and recommendations."
            />

            <FeatureCard
              icon="💬"
              title="AI finance chat"
              description="Ask your AI finance team questions like what to fix first, why losses happened, or how to improve cash flow."
            />

            <FeatureCard
              icon="📄"
              title="CFO report export"
              description="Generate a printable CFO-style report for reviews, demos, or business decision meetings."
            />
          </div>
        </section>

        <section
          className="landing-section"
          style={{
            border: "1px solid rgba(245,158,11,0.18)",
            background:
              "radial-gradient(circle at top right, rgba(245,158,11,0.12), transparent 34%), rgba(255,255,255,0.030)",
            borderRadius: 30,
            padding: 28,
            display: "grid",
            gap: 20,
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 8,
              maxWidth: 720,
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#f59e0b",
                fontSize: 12,
                fontWeight: 950,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              }}
            >
              Workflow
            </p>

            <h2
              style={{
                margin: 0,
                color: "#f8fafc",
                fontSize: 36,
                lineHeight: 1.08,
                letterSpacing: "-0.045em",
              }}
            >
              From raw documents to executive decisions.
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <StepCard
              number="01"
              title="Set business profile"
              description="Add company name, industry, country, currency, and financial year."
            />

            <StepCard
              number="02"
              title="Upload documents"
              description="Add the financial files that describe how the business actually works."
            />

            <StepCard
              number="03"
              title="Review AI extraction"
              description="Approve only the documents you trust for dashboard and chat intelligence."
            />

            <StepCard
              number="04"
              title="Use AI finance team"
              description="Open dashboard, ask finance questions, and export CFO-style reports."
            />
          </div>
        </section>

        <section
          className="landing-section landing-final-grid"
          style={{
            border: "1px solid rgba(46,213,115,0.20)",
            background:
              "radial-gradient(circle at top left, rgba(46,213,115,0.13), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.060), rgba(255,255,255,0.024))",
            borderRadius: 30,
            padding: 28,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 20,
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 9,
              maxWidth: 760,
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#7bed9f",
                fontSize: 12,
                fontWeight: 950,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              }}
            >
              Ready to start
            </p>

            <h2
              style={{
                margin: 0,
                color: "#f8fafc",
                fontSize: 34,
                lineHeight: 1.08,
                letterSpacing: "-0.045em",
              }}
            >
              Build your AI finance workspace.
            </h2>

            <p
              style={{
                margin: 0,
                color: "rgba(226,232,240,0.72)",
                fontSize: 14,
                lineHeight: 1.65,
              }}
            >
              Create your profile, upload documents, approve trusted data, and
              let the AI finance team explain what is happening in the business.
            </p>
          </div>

          <Link
            href="/signup"
            style={{
              border: "1px solid rgba(46,213,115,0.32)",
              background: "rgba(46,213,115,0.10)",
              color: "#7bed9f",
              borderRadius: 999,
              padding: "13px 17px",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 950,
              whiteSpace: "nowrap",
            }}
          >
            Start now
          </Link>
        </section>
      </div>
    </main>
  );
}