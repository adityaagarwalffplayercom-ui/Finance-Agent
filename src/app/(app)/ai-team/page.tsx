import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getAiTeam,
  type AiAgent,
  type AiAgentStatus,
} from "@/lib/ai-team";

const STATUS_STYLE: Record<
  AiAgentStatus,
  {
    label: string;
    color: string;
    background: string;
    border: string;
  }
> = {
  active: {
    label: "Active",
    color: "#7bed9f",
    background: "rgba(46,213,115,0.10)",
    border: "rgba(46,213,115,0.28)",
  },
  waiting: {
    label: "Waiting",
    color: "#8abfff",
    background: "rgba(88,166,255,0.10)",
    border: "rgba(88,166,255,0.28)",
  },
  warning: {
    label: "Attention",
    color: "#ffd166",
    background: "rgba(255,193,7,0.10)",
    border: "rgba(255,193,7,0.28)",
  },
  critical: {
    label: "Critical",
    color: "#ff8a95",
    background: "rgba(255,71,87,0.10)",
    border: "rgba(255,71,87,0.28)",
  },
};

function StatusBadge({ status }: { status: AiAgentStatus }) {
  const style = STATUS_STYLE[status];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${style.border}`,
        background: style.background,
        color: style.color,
        borderRadius: 999,
        padding: "7px 10px",
        fontSize: 12,
        fontWeight: 850,
        whiteSpace: "nowrap",
      }}
    >
      {style.label}
    </span>
  );
}

function getAgentIcon(agentId: string) {
  if (agentId === "cfo") return "📊";
  if (agentId === "accountant") return "📚";
  if (agentId === "analyst") return "📈";
  if (agentId === "cashflow") return "💧";
  if (agentId === "consultant") return "🧠";
  if (agentId === "risk") return "🛡️";
  return "🤖";
}

function getAgentQuestion(agentId: string) {
  if (agentId === "cfo") return "Give me a CFO summary of my business.";
  if (agentId === "accountant") return "Which documents are missing?";
  if (agentId === "analyst") return "Analyze my profit margin.";
  if (agentId === "cashflow") return "Can you calculate my cash runway?";
  if (agentId === "consultant") return "Give me a 7-day action plan.";
  if (agentId === "risk") return "What is my biggest financial risk?";
  return "Give me an overall summary of my business.";
}

function getAgentHref(agentId: string) {
  return `/chat?agent=${agentId}`;
}

function MiniStat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint: string;
  tone?: "neutral" | "good" | "warning" | "danger";
}) {
  const toneStyle =
    tone === "good"
      ? {
          border: "rgba(46,213,115,0.22)",
          background: "rgba(46,213,115,0.07)",
        }
      : tone === "warning"
        ? {
            border: "rgba(255,193,7,0.22)",
            background: "rgba(255,193,7,0.07)",
          }
        : tone === "danger"
          ? {
              border: "rgba(255,71,87,0.22)",
              background: "rgba(255,71,87,0.07)",
            }
          : {
              border: "var(--color-border)",
              background: "rgba(255,255,255,0.035)",
            };

  return (
    <div
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: toneStyle.background,
        borderRadius: 18,
        padding: 16,
        display: "grid",
        gap: 7,
      }}
    >
      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 12,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </p>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-primary)",
          fontSize: 26,
          fontWeight: 950,
          letterSpacing: "-0.04em",
        }}
      >
        {value}
      </p>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        {hint}
      </p>
    </div>
  );
}

function AgentCard({ agent }: { agent: AiAgent }) {
  const style = STATUS_STYLE[agent.status];

  return (
    <article
      style={{
        border: "1px solid var(--color-border)",
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.052), rgba(255,255,255,0.022))",
        borderRadius: 24,
        padding: 20,
        display: "grid",
        gap: 18,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 170,
          height: 170,
          borderRadius: "50%",
          background: style.background,
          filter: "blur(42px)",
          top: -70,
          right: -70,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 16,
              border: "1px solid var(--color-border)",
              background: "rgba(255,255,255,0.045)",
              display: "grid",
              placeItems: "center",
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            {getAgentIcon(agent.id)}
          </div>

          <div>
            <h2
              style={{
                margin: "0 0 5px",
                color: "var(--color-text-primary)",
                fontSize: 19,
                fontWeight: 950,
                letterSpacing: "-0.03em",
              }}
            >
              {agent.name}
            </h2>

            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 13,
                lineHeight: 1.45,
              }}
            >
              {agent.title}
            </p>
          </div>
        </div>

        <StatusBadge status={agent.status} />
      </div>

      <p
        style={{
          position: "relative",
          zIndex: 1,
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 14,
          lineHeight: 1.65,
        }}
      >
        {agent.summary}
      </p>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          border: `1px solid ${style.border}`,
          background: style.background,
          borderRadius: 18,
          padding: 14,
          display: "grid",
          gap: 8,
        }}
      >
        <p
          style={{
            margin: 0,
            color: style.color,
            fontSize: 12,
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Current signal
        </p>

        <p
          style={{
            margin: 0,
            color: "var(--color-text-primary)",
            fontSize: 14,
            lineHeight: 1.55,
            fontWeight: 700,
          }}
        >
          {agent.currentFindings[0] ?? "Waiting for approved financial data."}
        </p>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gap: 10,
        }}
      >
        <p
          style={{
            margin: 0,
            color: "var(--color-text-primary)",
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          What this agent checks
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {agent.focusAreas.slice(0, 5).map((focus) => (
            <span
              key={focus}
              style={{
                border: "1px solid var(--color-border)",
                background: "rgba(255,255,255,0.035)",
                color: "var(--color-text-secondary)",
                borderRadius: 999,
                padding: "7px 10px",
                fontSize: 12,
                fontWeight: 750,
              }}
            >
              {focus}
            </span>
          ))}
        </div>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gap: 10,
        }}
      >
        <p
          style={{
            margin: 0,
            color: "var(--color-text-primary)",
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          Recommended actions
        </p>

        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            display: "grid",
            gap: 8,
            color: "var(--color-text-secondary)",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {agent.recommendedActions.slice(0, 3).map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          paddingTop: 14,
        }}
      >
        <span
          style={{
            color: "var(--color-text-secondary)",
            fontSize: 12,
            lineHeight: 1.45,
            maxWidth: 300,
          }}
        >
          {agent.confidenceLabel}
        </span>

        <Link
          href={getAgentHref(agent.id)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: "var(--color-amber)",
            color: "var(--color-base)",
            borderRadius: 12,
            padding: "10px 13px",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 900,
            whiteSpace: "nowrap",
          }}
        >
          Ask agent →
        </Link>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          border: "1px solid var(--color-border)",
          background: "rgba(0,0,0,0.12)",
          borderRadius: 14,
          padding: 12,
        }}
      >
        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          Demo question:{" "}
          <span
            style={{
              color: "var(--color-text-primary)",
              fontWeight: 800,
            }}
          >
            {getAgentQuestion(agent.id)}
          </span>
        </p>
      </div>
    </article>
  );
}

export default async function AiTeamPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const team = await getAiTeam(session.user.id);

  const activeAgents = team.agents.filter(
    (agent) => agent.status === "active",
  ).length;

  const attentionAgents = team.agents.filter(
    (agent) => agent.status === "warning" || agent.status === "critical",
  ).length;

  const waitingAgents = team.agents.filter(
    (agent) => agent.status === "waiting",
  ).length;

  return (
    <>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">AI executive finance team</p>
          <h1>{team.businessName}</h1>
        </div>

        <Link
          href="/chat"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: "var(--color-amber)",
            color: "var(--color-base)",
            borderRadius: 12,
            padding: "11px 15px",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 900,
            whiteSpace: "nowrap",
          }}
        >
          Ask Overall Team
        </Link>
      </header>

      <p className="page-intro">
        This is your AI finance department. Each agent uses only approved
        documents, so unreviewed or rejected files do not affect dashboard,
        chat, or business recommendations.
      </p>

      <section
        className="alerts-card"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.35fr) minmax(280px, 0.85fr)",
          gap: 18,
          marginBottom: 24,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "relative",
            border: "1px solid var(--color-border)",
            borderRadius: 24,
            padding: 24,
            background:
              "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(255,255,255,0.025))",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 280,
              height: 280,
              borderRadius: "50%",
              background: "rgba(245,158,11,0.14)",
              filter: "blur(50px)",
              right: -90,
              top: -120,
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "grid",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                border: "1px solid rgba(245,158,11,0.32)",
                background: "rgba(245,158,11,0.12)",
                display: "grid",
                placeItems: "center",
                fontSize: 26,
              }}
            >
              🤖
            </div>

            <div>
              <p className="section-title">Overall Finance Team</p>

              <h2
                style={{
                  margin: "9px 0 12px",
                  color: "var(--color-text-primary)",
                  fontSize: 32,
                  lineHeight: 1.08,
                  fontWeight: 950,
                  letterSpacing: "-0.045em",
                  maxWidth: 760,
                }}
              >
                One complete finance department for your business.
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "var(--color-text-secondary)",
                  fontSize: 14,
                  lineHeight: 1.7,
                  maxWidth: 740,
                }}
              >
                The overall chat combines CFO, accountant, financial analyst,
                cash flow, consultant, and risk views into one answer. Use it
                for general decisions, then open specialist agents for deeper
                analysis.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <Link
                href="/chat"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  background: "var(--color-amber)",
                  color: "var(--color-base)",
                  borderRadius: 12,
                  padding: "11px 15px",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 900,
                }}
              >
                Ask overall team
              </Link>

              <Link
                href="/documents"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid var(--color-border)",
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--color-text-primary)",
                  borderRadius: 12,
                  padding: "11px 15px",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 850,
                }}
              >
                Review documents
              </Link>
            </div>
          </div>
        </div>

        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: 24,
            padding: 18,
            background: "rgba(255,255,255,0.025)",
            display: "grid",
            gap: 12,
          }}
        >
          <div>
            <p className="section-title">Team operating mode</p>
            <p className="section-hint">
              Your agents are powered by approved financial documents only.
            </p>
          </div>

          <div
            style={{
              border: "1px solid rgba(46,213,115,0.24)",
              background: "rgba(46,213,115,0.08)",
              color: "#7bed9f",
              borderRadius: 16,
              padding: 14,
              display: "grid",
              gap: 5,
            }}
          >
            <strong
              style={{
                fontSize: 14,
              }}
            >
              Trusted data mode
            </strong>

            <span
              style={{
                color: "var(--color-text-secondary)",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              Pending and rejected documents are excluded from AI answers.
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            <MiniStat
              label="Trusted"
              value={team.trustedDocuments}
              hint="Approved docs"
              tone={team.trustedDocuments > 0 ? "good" : "warning"}
            />

            <MiniStat
              label="Pending"
              value={team.pendingReview}
              hint="Need review"
              tone={team.pendingReview > 0 ? "warning" : "neutral"}
            />

            <MiniStat
              label="Rejected"
              value={team.rejectedDocuments}
              hint="Excluded"
              tone={team.rejectedDocuments > 0 ? "danger" : "neutral"}
            />

            <MiniStat
              label="Processed"
              value={team.processedDocuments}
              hint="AI analyzed"
              tone={team.processedDocuments > 0 ? "good" : "neutral"}
            />
          </div>
        </div>
      </section>

      <section
        className="alerts-card"
        style={{
          display: "grid",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p className="section-title">Team status</p>
            <p className="section-hint">
              Live readiness of each finance specialist.
            </p>
          </div>

          <span className="badge-sample">
            {team.agents.length} agents · {activeAgents} active ·{" "}
            {attentionAgents} attention · {waitingAgents} waiting
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <MiniStat
            label="Active agents"
            value={activeAgents}
            hint="Ready to answer with trusted data"
            tone={activeAgents > 0 ? "good" : "warning"}
          />

          <MiniStat
            label="Need attention"
            value={attentionAgents}
            hint="Agents seeing warnings or risks"
            tone={attentionAgents > 0 ? "warning" : "neutral"}
          />

          <MiniStat
            label="Waiting agents"
            value={waitingAgents}
            hint="Need approved data"
            tone={waitingAgents > 0 ? "warning" : "good"}
          />

          <MiniStat
            label="Total documents"
            value={team.totalDocuments}
            hint="Uploaded into the system"
            tone={team.totalDocuments > 0 ? "good" : "neutral"}
          />
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 18,
        }}
      >
        {team.agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </section>
    </>
  );
}