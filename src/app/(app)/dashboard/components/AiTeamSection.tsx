import Link from "next/link";
import { getAiTeam, type AiAgentStatus } from "@/lib/ai-team";

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

function getAgentIcon(agentId: string) {
  if (agentId === "cfo") return "📊";
  if (agentId === "accountant") return "📚";
  if (agentId === "analyst") return "📈";
  if (agentId === "cashflow") return "💧";
  if (agentId === "consultant") return "🧠";
  if (agentId === "risk") return "🛡️";

  return "🤖";
}

function StatusDot({ status }: { status: AiAgentStatus }) {
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
        fontWeight: 850,
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

export async function AiTeamSection({ userId }: { userId: string }) {
  const team = await getAiTeam(userId);

  return (
    <section
      className="alerts-card"
      style={{
        display: "grid",
        gap: 18,
        marginBottom: 24,
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
          <p className="section-title">AI Finance Team</p>
          <p className="section-hint">
            Your agents use only approved documents. Pending and rejected data
            stays out of dashboard, chat, and recommendations.
          </p>
        </div>

        <Link
          href="/ai-team"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--color-border)",
            background: "rgba(255,255,255,0.04)",
            color: "var(--color-text-primary)",
            borderRadius: 14,
            padding: "10px 13px",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 850,
            whiteSpace: "nowrap",
          }}
        >
          View full team →
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 12,
        }}
      >
        <div
          style={{
            border: "1px solid rgba(46,213,115,0.25)",
            background: "rgba(46,213,115,0.08)",
            borderRadius: 16,
            padding: 14,
          }}
        >
          <p
            style={{
              margin: "0 0 6px",
              color: "var(--color-text-secondary)",
              fontSize: 12,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Trusted docs
          </p>

          <p
            style={{
              margin: 0,
              color: "#7bed9f",
              fontSize: 26,
              fontWeight: 950,
              lineHeight: 1,
            }}
          >
            {team.trustedDocuments}
          </p>
        </div>

        <div
          style={{
            border: "1px solid rgba(255,193,7,0.25)",
            background: "rgba(255,193,7,0.08)",
            borderRadius: 16,
            padding: 14,
          }}
        >
          <p
            style={{
              margin: "0 0 6px",
              color: "var(--color-text-secondary)",
              fontSize: 12,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Pending review
          </p>

          <p
            style={{
              margin: 0,
              color: "#ffd166",
              fontSize: 26,
              fontWeight: 950,
              lineHeight: 1,
            }}
          >
            {team.pendingReview}
          </p>
        </div>

        <div
          style={{
            border: "1px solid rgba(255,71,87,0.25)",
            background: "rgba(255,71,87,0.08)",
            borderRadius: 16,
            padding: 14,
          }}
        >
          <p
            style={{
              margin: "0 0 6px",
              color: "var(--color-text-secondary)",
              fontSize: 12,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Rejected
          </p>

          <p
            style={{
              margin: 0,
              color: "#ff8a95",
              fontSize: 26,
              fontWeight: 950,
              lineHeight: 1,
            }}
          >
            {team.rejectedDocuments}
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 14,
        }}
      >
        {team.agents.slice(0, 6).map((agent) => (
          <article
            key={agent.id}
            style={{
              border: "1px solid var(--color-border)",
              background: "rgba(255,255,255,0.025)",
              borderRadius: 18,
              padding: 15,
              display: "grid",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 14,
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid var(--color-border)",
                    background: "rgba(255,255,255,0.04)",
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  {getAgentIcon(agent.id)}
                </span>

                <div style={{ minWidth: 0 }}>
                  <h3
                    style={{
                      margin: "0 0 4px",
                      color: "var(--color-text-primary)",
                      fontSize: 15,
                      lineHeight: 1.3,
                    }}
                  >
                    {agent.name}
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--color-text-secondary)",
                      fontSize: 12,
                      lineHeight: 1.4,
                    }}
                  >
                    {agent.title}
                  </p>
                </div>
              </div>

              <StatusDot status={agent.status} />
            </div>

            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              {agent.currentFindings[0] ?? agent.summary}
            </p>

            <Link
              href={`/chat?agent=${agent.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                justifySelf: "start",
                border: "1px solid var(--color-border)",
                background: "rgba(255,255,255,0.04)",
                color: "var(--color-text-primary)",
                borderRadius: 12,
                padding: "9px 11px",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 850,
              }}
            >
              Ask agent →
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}