import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAiTeam, type AiAgent, type AiAgentStatus } from "@/lib/ai-team";

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
        gap: 7,
        border: `1px solid ${style.border}`,
        background: style.background,
        color: style.color,
        borderRadius: 999,
        padding: "7px 10px",
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: style.color,
          boxShadow: `0 0 12px ${style.color}`,
        }}
      />
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

function MiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        background: "rgba(255,255,255,0.035)",
        borderRadius: 18,
        padding: 16,
      }}
    >
      <p
        style={{
          margin: "0 0 8px",
          color: "var(--color-text-secondary)",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>

      <p
        style={{
          margin: "0 0 6px",
          color: "var(--color-text-primary)",
          fontSize: 28,
          fontWeight: 900,
          lineHeight: 1,
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
      className="alerts-card"
      style={{
        display: "grid",
        gap: 16,
        padding: 20,
        borderRadius: 22,
        minHeight: 360,
        border: `1px solid ${style.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 13,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 16,
              display: "grid",
              placeItems: "center",
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))",
              border: "1px solid var(--color-border)",
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            {getAgentIcon(agent.id)}
          </div>

          <div>
            <h2
              style={{
                margin: "0 0 6px",
                color: "var(--color-text-primary)",
                fontSize: 19,
                lineHeight: 1.25,
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
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        {agent.summary}
      </p>

      <div
        style={{
          border: "1px solid var(--color-border)",
          background: "rgba(255,255,255,0.025)",
          borderRadius: 16,
          padding: 14,
        }}
      >
        <p
          style={{
            margin: "0 0 10px",
            color: "var(--color-text-primary)",
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          Current insight
        </p>

        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          {agent.currentFindings[0] ?? "Waiting for approved financial data."}
        </p>
      </div>

      <div>
        <p
          style={{
            margin: "0 0 10px",
            color: "var(--color-text-primary)",
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          Focus
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {agent.focusAreas.slice(0, 4).map((focus) => (
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
          borderTop: "1px solid var(--color-border)",
          paddingTop: 14,
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          {agent.confidenceLabel}
        </p>

        <Link
          href={`/chat?agent=${agent.id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--color-border)",
            background: "rgba(255,255,255,0.045)",
            color: "var(--color-text-primary)",
            borderRadius: 13,
            padding: "10px 13px",
            fontSize: 13,
            fontWeight: 850,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Ask agent →
        </Link>
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
            border: "1px solid rgba(255,255,255,0.16)",
            background: "linear-gradient(135deg, var(--color-accent), #7c3aed)",
            color: "white",
            borderRadius: 14,
            padding: "11px 15px",
            textDecoration: "none",
            fontWeight: 900,
            fontSize: 13,
            boxShadow: "0 14px 34px rgba(0,0,0,0.22)",
          }}
        >
          Ask AI Team
        </Link>
      </header>

      <section
        className="alerts-card"
        style={{
          display: "grid",
          gap: 18,
          marginBottom: 24,
          padding: 22,
          borderRadius: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div>
            <p className="section-title">Team operating mode</p>
            <p className="section-hint">
              Your agents use only approved documents. Pending and rejected data
              stays out of dashboard, chat, and analysis.
            </p>
          </div>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              border: "1px solid rgba(46,213,115,0.28)",
              background: "rgba(46,213,115,0.10)",
              color: "#7bed9f",
              borderRadius: 999,
              padding: "8px 11px",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            Trusted data mode
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
            gap: 14,
          }}
        >
          <MiniStat
            label="Trusted"
            value={String(team.trustedDocuments)}
            hint="Approved docs used by agents."
          />

          <MiniStat
            label="Pending"
            value={String(team.pendingReview)}
            hint="Need human review."
          />

          <MiniStat
            label="Rejected"
            value={String(team.rejectedDocuments)}
            hint="Excluded from analysis."
          />

          <MiniStat
            label="Total"
            value={String(team.totalDocuments)}
            hint="All uploaded documents."
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