import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getDocumentCompletenessReport,
  type DocumentCompletenessAction,
  type DocumentRequirement,
} from "@/lib/document-completeness-engine";

type Tone = "good" | "warning" | "danger" | "neutral";

function toneStyle(tone: Tone) {
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

function statusLabel(status: DocumentRequirement["status"]) {
  if (status === "COMPLETE") return "Complete";
  if (status === "PENDING_REVIEW") return "Pending review";
  if (status === "REJECTED_OR_FAILED") return "Rejected / failed";
  return "Missing";
}

function actionTone(priority: DocumentCompletenessAction["priority"]): Tone {
  if (priority === "HIGH") return "danger";
  if (priority === "MEDIUM") return "warning";
  return "good";
}

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: Tone;
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
          fontSize: "clamp(25px, 3vw, 36px)",
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

function RequirementCard({ requirement }: { requirement: DocumentRequirement }) {
  const style = toneStyle(requirement.tone);

  return (
    <article
      style={{
        border: `1px solid ${style.border}`,
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.052), rgba(255,255,255,0.024))",
        borderRadius: 22,
        padding: 16,
        display: "grid",
        gap: 13,
        minHeight: 235,
        minWidth: 0,
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
        <div>
          <strong
            style={{
              color: "var(--color-text-primary)",
              fontSize: 16,
              lineHeight: 1.25,
              display: "block",
            }}
          >
            {requirement.label}
          </strong>

          <span
            style={{
              display: "block",
              marginTop: 5,
              color: requirement.required
                ? "var(--color-gold)"
                : "var(--color-text-muted)",
              fontSize: 11,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {requirement.required ? "Required" : "Optional"}
          </span>
        </div>

        <span
          style={{
            border: `1px solid ${style.border}`,
            background: style.background,
            color: style.color,
            borderRadius: 999,
            padding: "7px 10px",
            fontSize: 11,
            fontWeight: 950,
            whiteSpace: "nowrap",
          }}
        >
          {statusLabel(requirement.status)}
        </span>
      </div>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 13,
          lineHeight: 1.65,
        }}
      >
        {requirement.description}
      </p>

      <div
        style={{
          display: "grid",
          gap: 8,
        }}
      >
        <div
          style={{
            height: 9,
            borderRadius: 999,
            background: "rgba(255,255,255,0.075)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${requirement.confidence}%`,
              height: "100%",
              borderRadius: 999,
              background: style.color,
            }}
          />
        </div>

        <span
          style={{
            color: style.color,
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          {requirement.confidence}% confidence
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
          marginTop: "auto",
        }}
      >
        <MiniCount label="Trusted" value={requirement.trustedCount} />
        <MiniCount label="Pending" value={requirement.pendingCount} />
        <MiniCount label="Rejected" value={requirement.rejectedCount} />
        <MiniCount label="Failed" value={requirement.failedCount} />
      </div>
    </article>
  );
}

function MiniCount({ label, value }: { label: string; value: number }) {
  return (
    <span
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.035)",
        borderRadius: 12,
        padding: "8px 6px",
        display: "grid",
        gap: 4,
        textAlign: "center",
        minWidth: 0,
      }}
    >
      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: 15,
          lineHeight: 1,
        }}
      >
        {value}
      </strong>

      <span
        style={{
          color: "var(--color-text-muted)",
          fontSize: 9,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </span>
    </span>
  );
}

function ActionCard({ action }: { action: DocumentCompletenessAction }) {
  const style = toneStyle(actionTone(action.priority));

  return (
    <article
      style={{
        border: `1px solid ${style.border}`,
        background: style.background,
        borderRadius: 18,
        padding: 14,
        display: "grid",
        gap: 8,
      }}
    >
      <span
        style={{
          color: style.color,
          fontSize: 11,
          fontWeight: 950,
          letterSpacing: "0.08em",
        }}
      >
        {action.priority} PRIORITY
      </span>

      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: 15,
          lineHeight: 1.3,
        }}
      >
        {action.title}
      </strong>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {action.detail}
      </p>
    </article>
  );
}

export default async function DocumentCompletenessPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const report = await getDocumentCompletenessReport(session.user.id);

  const statusTone: Tone =
    report.overallStatus === "STRONG"
      ? "good"
      : report.overallStatus === "PARTIAL"
        ? "warning"
        : "danger";

  return (
    <main>
      <header
        style={{
          marginBottom: 24,
          border: "1px solid rgba(245,158,11,0.22)",
          background:
            "radial-gradient(circle at top left, rgba(245,158,11,0.16), transparent 34%), radial-gradient(circle at bottom right, rgba(46,213,115,0.08), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.062), rgba(255,255,255,0.026))",
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
              Accountant Agent
            </p>

            <h1
              style={{
                margin: "12px 0 0",
                color: "var(--color-text-primary)",
                fontSize: "clamp(38px, 5.2vw, 72px)",
                lineHeight: 0.98,
                letterSpacing: "-0.078em",
                maxWidth: 920,
              }}
            >
              Document completeness engine.
            </h1>

            <p
              className="page-intro"
              style={{
                margin: "16px 0 0",
                lineHeight: 1.7,
                maxWidth: 850,
              }}
            >
              {report.summary}
            </p>
          </div>

          <Link href="/documents" className="btn-ghost">
            Upload documents →
          </Link>
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
            label="Completeness score"
            value={`${report.score}/100`}
            hint={report.overallStatus}
            tone={statusTone}
          />

          <MetricCard
            label="Required coverage"
            value={`${report.metrics.coveragePercent}%`}
            hint={`${report.metrics.completedRequiredAreas}/${report.metrics.requiredAreas} required areas complete`}
            tone={
              report.metrics.coveragePercent >= 80
                ? "good"
                : report.metrics.coveragePercent >= 45
                  ? "warning"
                  : "danger"
            }
          />

          <MetricCard
            label="Approved documents"
            value={report.metrics.approvedDocuments}
            hint="Trusted by AI"
            tone={report.metrics.approvedDocuments > 0 ? "good" : "warning"}
          />

          <MetricCard
            label="Pending review"
            value={report.metrics.pendingReviewDocuments}
            hint="Not trusted until approved"
            tone={
              report.metrics.pendingReviewDocuments > 0 ? "warning" : "good"
            }
          />
        </div>

        <section
          className="section-card"
          style={{
            padding: 22,
            display: "grid",
            gap: 18,
          }}
        >
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              Coverage map
            </p>

            <h2
              style={{
                margin: "8px 0 0",
                color: "var(--color-text-primary)",
                fontSize: 24,
                lineHeight: 1.15,
              }}
            >
              Required and optional document areas
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 14,
            }}
          >
            {report.requirements.map((requirement) => (
              <RequirementCard
                key={requirement.id}
                requirement={requirement}
              />
            ))}
          </div>
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(280px, 0.9fr)",
            gap: 18,
            alignItems: "start",
          }}
        >
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
                Accountant actions
              </p>

              <h2
                style={{
                  margin: "8px 0 0",
                  color: "var(--color-text-primary)",
                  fontSize: 24,
                  lineHeight: 1.15,
                }}
              >
                What to upload or review next
              </h2>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              {report.actions.map((action) => (
                <ActionCard
                  key={`${action.priority}-${action.title}`}
                  action={action}
                />
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
                Data quality
              </p>

              <h2
                style={{
                  margin: "8px 0 0",
                  color: "var(--color-text-primary)",
                  fontSize: 24,
                  lineHeight: 1.15,
                }}
              >
                Extraction strength
              </h2>
            </div>

            <MetricCard
              label="Readable score"
              value={`${report.dataQuality.readableDataScore}%`}
              hint="Totals, dates, currency, and line items"
              tone={
                report.dataQuality.readableDataScore >= 70
                  ? "good"
                  : report.dataQuality.readableDataScore >= 40
                    ? "warning"
                    : "danger"
              }
            />

            <div
              style={{
                display: "grid",
                gap: 8,
              }}
            >
              <MiniCount
                label="Totals"
                value={report.dataQuality.documentsWithTotals}
              />
              <MiniCount
                label="Dates"
                value={report.dataQuality.documentsWithDates}
              />
              <MiniCount
                label="Currency"
                value={report.dataQuality.documentsWithCurrency}
              />
              <MiniCount
                label="Line items"
                value={report.dataQuality.documentsWithLineItems}
              />
            </div>
          </section>
        </div>

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
              Recent documents
            </p>

            <h2
              style={{
                margin: "8px 0 0",
                color: "var(--color-text-primary)",
                fontSize: 24,
                lineHeight: 1.15,
              }}
            >
              Latest uploaded files
            </h2>
          </div>

          {report.recentDocuments.length > 0 ? (
            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              {report.recentDocuments.map((document) => (
                <Link
                  key={document.id}
                  href={`/documents/${document.id}`}
                  style={{
                    border: "1px solid rgba(255,255,255,0.09)",
                    background: "rgba(255,255,255,0.035)",
                    borderRadius: 16,
                    padding: 13,
                    display: "grid",
                    gap: 6,
                    color: "inherit",
                    textDecoration: "none",
                  }}
                >
                  <strong
                    style={{
                      color: "var(--color-text-primary)",
                      fontSize: 14,
                      lineHeight: 1.35,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {document.fileName}
                  </strong>

                  <span
                    style={{
                      color: "var(--color-text-secondary)",
                      fontSize: 12,
                      lineHeight: 1.45,
                    }}
                  >
                    {document.category} · {document.status} ·{" "}
                    {document.reviewStatus} · Quality: {document.quality}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 13,
                lineHeight: 1.65,
              }}
            >
              No documents uploaded yet.
            </p>
          )}
        </section>
      </section>
    </main>
  );
}