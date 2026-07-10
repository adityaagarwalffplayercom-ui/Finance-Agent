"use client";

import Link from "next/link";

const AGENTS = [
  {
    id: "team",
    name: "AI Finance Team",
    title: "Combined executive finance team",
    description:
      "Combines CFO, accountant, tax, analyst, cash flow, consultant, and risk perspectives into one practical answer.",
    icon: "🧠",
    color: "#ffd166",
  },
  {
    id: "cfo",
    name: "CFO Agent",
    title: "Strategic finance decisions",
    description:
      "Profitability, financial health, runway, hiring, investment decisions, and executive priorities.",
    icon: "📈",
    color: "#ffd166",
  },
  {
    id: "accountant",
    name: "Accountant Agent",
    title: "Books and document control",
    description:
      "Document completeness, approved data, rejected data, missing records, and bookkeeping accuracy.",
    icon: "📚",
    color: "#7bed9f",
  },
  {
    id: "tax",
    name: "Tax Agent",
    title: "Tax readiness and compliance checklist",
    description:
      "Checks tax readiness from approved documents and verified tax rules. Gives conservative checklist-style guidance, not final tax certification.",
    icon: "🧾",
    color: "#ffd166",
  },
  {
    id: "analyst",
    name: "Financial Analyst Agent",
    title: "Performance and trend analysis",
    description:
      "Revenue, expenses, margins, extracted line items, unusual cost patterns, and monthly trends.",
    icon: "📊",
    color: "#93c5fd",
  },
  {
    id: "cashflow",
    name: "Cash Flow Agent",
    title: "Liquidity and cash movement",
    description:
      "Cash position, inflows, outflows, working capital, liquidity risk, and near-term cash planning.",
    icon: "💧",
    color: "#7bed9f",
  },
  {
    id: "consultant",
    name: "Business Consultant Agent",
    title: "Growth and operational advisor",
    description:
      "Converts finance signals into practical actions around growth, pricing, hiring, cost control, and operations.",
    icon: "🧭",
    color: "#7bed9f",
  },
  {
    id: "risk",
    name: "Risk Agent",
    title: "Financial risk monitoring",
    description:
      "Flags losses, weak coverage, missing data, compliance uncertainty, unusual patterns, and red flags.",
    icon: "⚠️",
    color: "#ff8a95",
  },
];

export default function AiTeamPage() {
  return (
    <main>
      <style jsx>{`
        .ai-team-page {
          display: grid;
          gap: 22px;
          width: 100%;
          min-width: 0;
        }

        .ai-team-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 20px;
          align-items: start;
          margin-bottom: 2px;
        }

        .ai-team-eyebrow {
          margin: 0 0 12px;
          color: rgba(245, 158, 11, 0.95);
          font-size: 12px;
          line-height: 1.4;
          font-weight: 900;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .ai-team-title {
          margin: 0;
          color: white;
          font-size: clamp(42px, 6vw, 76px);
          line-height: 1.05;
          letter-spacing: -0.06em;
          font-weight: 950;
        }

        .ai-team-intro {
          margin: 16px 0 0;
          max-width: 760px;
          color: rgba(226, 232, 240, 0.74);
          font-size: 15px;
          line-height: 1.75;
        }

        .agents-card {
          display: grid;
          gap: 18px;
          padding: 22px;
        }

        .agents-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 14px;
          align-items: stretch;
        }

        .agent-card {
          min-height: 245px;
          display: grid;
          gap: 14px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background:
            radial-gradient(
              circle at top left,
              rgba(245, 158, 11, 0.1),
              transparent 42%
            ),
            rgba(255, 255, 255, 0.045);
          border-radius: 20px;
          padding: 16px;
          min-width: 0;
        }

        .agent-top {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          min-width: 0;
        }

        .agent-icon {
          width: 44px;
          height: 44px;
          border-radius: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 19px;
          flex: 0 0 auto;
        }

        .agent-name {
          margin: 0;
          color: white;
          font-size: 17px;
          line-height: 1.25;
          font-weight: 950;
          overflow-wrap: anywhere;
        }

        .agent-title {
          margin: 5px 0 0;
          font-size: 12px;
          line-height: 1.4;
          font-weight: 850;
          overflow-wrap: anywhere;
        }

        .agent-desc {
          margin: 0;
          color: rgba(226, 232, 240, 0.74);
          font-size: 13px;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }

        .agent-action {
          width: fit-content;
          margin-top: auto;
        }

        @media (max-width: 980px) {
          .ai-team-header {
            grid-template-columns: 1fr;
          }

          .ai-team-title {
            font-size: clamp(34px, 11vw, 54px);
            line-height: 1.08;
          }

          .ai-team-intro {
            font-size: 14px;
            line-height: 1.7;
          }

          .agents-card {
            padding: 16px;
          }
        }
      `}</style>

      <div className="ai-team-page">
        <section className="section-card">
          <div className="ai-team-header">
            <div>
              <p className="ai-team-eyebrow">AI Finance Team</p>

              <h1 className="ai-team-title">Your executive finance agents</h1>

              <p className="ai-team-intro">
                Each agent uses your business profile and approved documents
                only. Pending and rejected data stays excluded from dashboard,
                chat, and recommendations.
              </p>
            </div>

            <Link href="/chat" className="btn-ghost">
              Open chat →
            </Link>
          </div>
        </section>

        <section className="section-card agents-card">
          <div>
            <p className="section-title" style={{ margin: 0 }}>
              Choose an agent
            </p>

            <p className="section-hint" style={{ margin: "6px 0 0" }}>
              Use AI Finance Team for combined answers, or choose a specialist
              for focused advice.
            </p>
          </div>

          <div className="agents-grid">
            {AGENTS.map((agent) => (
              <article key={agent.id} className="agent-card">
                <div className="agent-top">
                  <span className="agent-icon">{agent.icon}</span>

                  <div>
                    <h2 className="agent-name">{agent.name}</h2>

                    <p
                      className="agent-title"
                      style={{
                        color: agent.color,
                      }}
                    >
                      {agent.title}
                    </p>
                  </div>
                </div>

                <p className="agent-desc">{agent.description}</p>

                <Link
                  href={`/chat?agent=${agent.id}`}
                  className="btn-ghost agent-action"
                >
                  Ask agent →
                </Link>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
