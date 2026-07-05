import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAuditEventsForUser } from "@/lib/audit-log";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function prettyEventType(eventType: string) {
  return eventType
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function getSeverity(eventType: string): "critical" | "warning" | "info" {
  if (eventType.includes("FAILED") || eventType.includes("BLOCKED")) {
    return "critical";
  }

  if (eventType.includes("REJECTED")) {
    return "warning";
  }

  return "info";
}

function getSeverityLabel(severity: "critical" | "warning" | "info") {
  if (severity === "critical") return "Critical";
  if (severity === "warning") return "Watch";
  return "Note";
}

function SummaryBox({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        background: "rgba(255,255,255,0.035)",
        borderRadius: 16,
        padding: 14,
        minHeight: 104,
        display: "grid",
        alignContent: "space-between",
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
          margin: "8px 0 4px",
          color: "var(--color-text-primary)",
          fontSize: 28,
          fontWeight: 950,
          lineHeight: 1,
        }}
      >
        {value}
      </p>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-muted)",
          fontSize: 12,
          lineHeight: 1.35,
        }}
      >
        {hint}
      </p>
    </div>
  );
}

export default async function ActivityPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const events = await getAuditEventsForUser(session.user.id, 80);

  const totalEvents = events.length;

  const trustedEvents = events.filter(
    (event) =>
      event.eventType.includes("APPROVED") ||
      event.eventType.includes("COMPLETED"),
  ).length;

  const attentionEvents = events.filter(
    (event) =>
      event.eventType.includes("FAILED") ||
      event.eventType.includes("BLOCKED") ||
      event.eventType.includes("REJECTED"),
  ).length;

  const processingEvents = events.filter((event) =>
    event.eventType.includes("PROCESSING"),
  ).length;

  return (
    <>
      <header
        className="dashboard-header"
        style={{
          marginBottom: 20,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 10,
            maxWidth: 760,
          }}
        >
          <p
            className="eyebrow"
            style={{
              margin: 0,
            }}
          >
            Production audit trail
          </p>

          <h1
            style={{
              margin: 0,
              lineHeight: 1.08,
            }}
          >
            Activity history
          </h1>

          <p
            className="page-intro"
            style={{
              margin: 0,
              lineHeight: 1.6,
              maxWidth: 680,
            }}
          >
            Track uploads, AI processing, approvals, rejections, blocked
            actions, and deleted documents.
          </p>
        </div>

        <span className="badge-sample">
          {totalEvents > 0
            ? `${totalEvents} event${totalEvents === 1 ? "" : "s"}`
            : "No activity yet"}
        </span>
      </header>

      <section
        className="alerts-card"
        style={{
          display: "grid",
          gap: 18,
          marginBottom: 22,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 12,
          }}
        >
          <SummaryBox
            label="Total events"
            value={totalEvents}
            hint="All tracked actions"
          />
          <SummaryBox
            label="Trusted"
            value={trustedEvents}
            hint="Approved or completed"
          />
          <SummaryBox
            label="Processing"
            value={processingEvents}
            hint="AI workflow activity"
          />
          <SummaryBox
            label="Attention"
            value={attentionEvents}
            hint="Failed or blocked"
          />
        </div>
      </section>

      <section
        className="alerts-card"
        style={{
          display: "grid",
          gap: 18,
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
          <div
            style={{
              display: "grid",
              gap: 6,
            }}
          >
            <p
              className="section-title"
              style={{
                margin: 0,
              }}
            >
              Recent activity
            </p>
            <p
              className="section-hint"
              style={{
                margin: 0,
              }}
            >
              Newest events first. This shows how financial data became trusted.
            </p>
          </div>

          <Link href="/documents" className="btn-ghost">
            Review documents
          </Link>
        </div>

        {events.length === 0 ? (
          <div
            style={{
              border: "1px dashed var(--color-border)",
              borderRadius: 16,
              padding: 18,
              background: "rgba(255,255,255,0.03)",
              display: "grid",
              gap: 10,
            }}
          >
            <strong
              style={{
                color: "var(--color-text-primary)",
              }}
            >
              No activity yet
            </strong>

            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 14,
                lineHeight: 1.55,
              }}
            >
              Upload and process a document. Activity will appear here after
              upload, processing, approval, rejection, or deletion.
            </p>

            <div>
              <Link href="/documents" className="btn-ghost">
                Upload document
              </Link>
            </div>
          </div>
        ) : (
          <ul className="alerts-list">
            {events.map((event) => {
              const severity = getSeverity(event.eventType);

              return (
                <li
                  key={event.id}
                  className={`alert-item alert-${severity}`}
                  style={{
                    alignItems: "flex-start",
                    paddingBottom: 12,
                  }}
                >
                  <span className="alert-dot" />

                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        marginBottom: 4,
                      }}
                    >
                      <span className="alert-severity">
                        {getSeverityLabel(severity)}
                      </span>

                      <span
                        style={{
                          color: "var(--color-text-muted)",
                          fontSize: 12,
                        }}
                      >
                        {formatDate(event.createdAt)}
                      </span>
                    </div>

                    <p
                      style={{
                        margin: 0,
                        color: "var(--color-text-primary)",
                        fontWeight: 750,
                      }}
                    >
                      {event.title}
                    </p>

                    {event.description && (
                      <p
                        style={{
                          margin: "5px 0 0",
                          color: "var(--color-text-secondary)",
                          fontSize: 13,
                          lineHeight: 1.5,
                        }}
                      >
                        {event.description}
                      </p>
                    )}

                    <p
                      style={{
                        margin: "6px 0 0",
                        color: "var(--color-text-muted)",
                        fontSize: 12,
                        lineHeight: 1.4,
                      }}
                    >
                      {prettyEventType(event.eventType)}
                      {event.fileName ? ` · ${event.fileName}` : ""}
                    </p>

                    {event.documentId &&
                      event.eventType !== "DOCUMENT_DELETED" && (
                        <Link
                          href={`/documents/${event.documentId}`}
                          style={{
                            display: "inline-block",
                            marginTop: 6,
                            color: "var(--color-amber)",
                            fontSize: 12,
                            fontWeight: 850,
                            textDecoration: "none",
                          }}
                        >
                          Open document →
                        </Link>
                      )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}