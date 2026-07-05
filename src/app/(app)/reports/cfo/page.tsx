import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFinancialProfile } from "@/lib/financial-profile";
import { ExportCfoReportButton } from "./ExportCfoReportButton";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function ReportMetric({
  label,
  value,
  delta,
  tone,
}: {
  label: string;
  value: string;
  delta: string;
  tone: "green" | "red" | "blue" | "yellow";
}) {
  const toneStyle = {
    green: {
      color: "#7bed9f",
      border: "rgba(46,213,115,0.28)",
      background: "rgba(46,213,115,0.08)",
    },
    red: {
      color: "#ff8a95",
      border: "rgba(255,71,87,0.28)",
      background: "rgba(255,71,87,0.08)",
    },
    blue: {
      color: "#8abfff",
      border: "rgba(88,166,255,0.28)",
      background: "rgba(88,166,255,0.08)",
    },
    yellow: {
      color: "#ffd166",
      border: "rgba(255,193,7,0.28)",
      background: "rgba(255,193,7,0.08)",
    },
  }[tone];

  return (
    <div
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: toneStyle.background,
        borderRadius: 18,
        padding: 16,
        display: "grid",
        gap: 8,
        minHeight: 125,
      }}
    >
      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 12,
          fontWeight: 850,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </p>

      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: 26,
          lineHeight: 1.08,
        }}
      >
        {value}
      </strong>

      <p
        style={{
          margin: 0,
          color: toneStyle.color,
          fontSize: 12,
          lineHeight: 1.4,
          fontWeight: 750,
        }}
      >
        {delta}
      </p>
    </div>
  );
}

function InfoBox({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        background: "rgba(255,255,255,0.035)",
        borderRadius: 16,
        padding: 14,
        display: "grid",
        gap: 6,
      }}
    >
      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 12,
          fontWeight: 850,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </p>

      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: 22,
        }}
      >
        {value}
      </strong>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-muted)",
          fontSize: 12,
          lineHeight: 1.4,
        }}
      >
        {hint}
      </p>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="section-card report-section"
      style={{
        display: "grid",
        gap: 18,
        marginBottom: 24,
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
          {title}
        </p>

        <p
          className="section-hint"
          style={{
            margin: 0,
            lineHeight: 1.55,
          }}
        >
          {hint}
        </p>
      </div>

      {children}
    </section>
  );
}

export default async function CfoReportPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await getFinancialProfile(session.user.id);

  const [
    totalDocuments,
    approvedDocuments,
    needsReviewDocuments,
    rejectedDocuments,
    failedDocuments,
    latestApprovedDocument,
  ] = await Promise.all([
    prisma.document.count({
      where: {
        userId: session.user.id,
      },
    }),
    prisma.document.count({
      where: {
        userId: session.user.id,
        status: "PROCESSED",
        reviewStatus: "APPROVED",
      },
    }),
    prisma.document.count({
      where: {
        userId: session.user.id,
        status: "PROCESSED",
        reviewStatus: "NEEDS_REVIEW",
      },
    }),
    prisma.document.count({
      where: {
        userId: session.user.id,
        reviewStatus: "REJECTED",
      },
    }),
    prisma.document.count({
      where: {
        userId: session.user.id,
        status: "FAILED",
      },
    }),
    prisma.document.findFirst({
      where: {
        userId: session.user.id,
        status: "PROCESSED",
        reviewStatus: "APPROVED",
      },
      orderBy: [
        {
          reviewedAt: "desc",
        },
        {
          extractedAt: "desc",
        },
        {
          uploadedAt: "desc",
        },
      ],
      select: {
        fileName: true,
        reviewedAt: true,
        extractedAt: true,
        uploadedAt: true,
      },
    }),
  ]);

  const reportDate = new Date();

  const lastTrustedUpdate =
    latestApprovedDocument?.reviewedAt ??
    latestApprovedDocument?.extractedAt ??
    latestApprovedDocument?.uploadedAt ??
    null;

  const healthTone =
    profile.healthScore >= 70
      ? "green"
      : profile.healthScore >= 45
        ? "yellow"
        : "red";

  const alertSummary =
    profile.alerts.length > 0
      ? profile.alerts
      : [
          {
            id: "no-alerts",
            severity: "info" as const,
            message:
              "No major financial alerts were detected from approved documents.",
          },
        ];

  return (
    <>
      <style>
        {`
          @media print {
            body {
              background: #ffffff !important;
              color: #111827 !important;
            }

            .sidebar,
            .no-print {
              display: none !important;
            }

            .dashboard-shell {
              display: block !important;
            }

            .dashboard-main {
              width: 100% !important;
              max-width: none !important;
              padding: 0 !important;
              margin: 0 !important;
            }

            .section-card,
            .report-section {
              break-inside: avoid;
              page-break-inside: avoid;
              background: #ffffff !important;
              color: #111827 !important;
              border: 1px solid #d1d5db !important;
              box-shadow: none !important;
            }

            .section-title,
            .section-hint,
            .page-intro,
            .eyebrow,
            p,
            span,
            strong,
            h1,
            h2,
            h3 {
              color: #111827 !important;
            }

            a {
              color: #111827 !important;
              text-decoration: none !important;
            }

            pre {
              white-space: pre-wrap !important;
            }
          }
        `}
      </style>

      <header
        className="dashboard-header"
        style={{
          alignItems: "flex-start",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 10,
            maxWidth: 820,
          }}
        >
          <Link
            href="/dashboard"
            className="no-print"
            style={{
              color: "var(--color-amber)",
              fontSize: 13,
              fontWeight: 900,
              textDecoration: "none",
            }}
          >
            ← Back to dashboard
          </Link>

          <p
            className="eyebrow"
            style={{
              margin: 0,
            }}
          >
            CFO report
          </p>

          <h1
            style={{
              margin: 0,
              lineHeight: 1.08,
            }}
          >
            AI Executive Finance Report
          </h1>

          <p
            className="page-intro"
            style={{
              margin: 0,
              lineHeight: 1.6,
              maxWidth: 760,
            }}
          >
            A printable CFO-style summary generated from approved financial
            documents. Pending and rejected documents are excluded from the core
            financial intelligence.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <ExportCfoReportButton />

          <Link href="/documents" className="btn-ghost no-print">
            Review documents
          </Link>
        </div>
      </header>

      <Section
        title="Report summary"
        hint="Generated from trusted documents and current dashboard intelligence."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 12,
          }}
        >
          <InfoBox
            label="Generated on"
            value={formatDateTime(reportDate)}
            hint="Current report timestamp"
          />

          <InfoBox
            label="Trusted documents"
            value={approvedDocuments}
            hint="Approved and included in analysis"
          />

          <InfoBox
            label="Health score"
            value={`${profile.healthScore}/100`}
            hint={profile.healthLabel}
          />

          <InfoBox
            label="Last trusted update"
            value={
              lastTrustedUpdate ? formatDateTime(lastTrustedUpdate) : "Not available"
            }
            hint={latestApprovedDocument?.fileName ?? "No approved document yet"}
          />
        </div>
      </Section>

      <Section
        title="Financial overview"
        hint="Core finance metrics detected from approved documents."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <ReportMetric
            label="Revenue"
            value={profile.revenue.value}
            delta={profile.revenue.delta}
            tone="green"
          />

          <ReportMetric
            label="Expenses"
            value={profile.expenses.value}
            delta={profile.expenses.delta}
            tone="red"
          />

          <ReportMetric
            label="Profit"
            value={profile.profit.value}
            delta={profile.profit.delta}
            tone={profile.profit.value.includes("-") ? "red" : "green"}
          />

          <ReportMetric
            label="Cash"
            value={profile.cash.value}
            delta={profile.cash.delta}
            tone="blue"
          />

          <ReportMetric
            label="Health"
            value={`${profile.healthScore}/100`}
            delta={profile.healthLabel}
            tone={healthTone}
          />
        </div>
      </Section>

      <Section
        title="AI CFO interpretation"
        hint="Plain-English interpretation for founders, owners, and reviewers."
      >
        <div
          style={{
            border: "1px solid var(--color-border)",
            background: "rgba(255,255,255,0.035)",
            borderRadius: 18,
            padding: 16,
            display: "grid",
            gap: 12,
          }}
        >
          <p
            style={{
              margin: 0,
              color: "var(--color-text-secondary)",
              fontSize: 14,
              lineHeight: 1.7,
            }}
          >
            The business currently has a financial health score of{" "}
            <strong>{profile.healthScore}/100</strong>, classified as{" "}
            <strong>{profile.healthLabel}</strong>. The current dashboard
            reflects only approved financial documents, so this report should be
            treated as a trusted summary of reviewed data rather than all
            uploaded files.
          </p>

          <p
            style={{
              margin: 0,
              color: "var(--color-text-secondary)",
              fontSize: 14,
              lineHeight: 1.7,
            }}
          >
            Revenue is reported as <strong>{profile.revenue.value}</strong>,
            expenses as <strong>{profile.expenses.value}</strong>, profit as{" "}
            <strong>{profile.profit.value}</strong>, and cash as{" "}
            <strong>{profile.cash.value}</strong>. Any pending or rejected
            document is excluded until reviewed and approved.
          </p>
        </div>
      </Section>

      <Section
        title="Document trust status"
        hint="Shows whether enough approved data exists for reliable dashboard output."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 12,
          }}
        >
          <InfoBox
            label="Total uploads"
            value={totalDocuments}
            hint="All documents uploaded"
          />

          <InfoBox
            label="Approved"
            value={approvedDocuments}
            hint="Used by dashboard and AI"
          />

          <InfoBox
            label="Needs review"
            value={needsReviewDocuments}
            hint="Processed but not trusted yet"
          />

          <InfoBox
            label="Rejected"
            value={rejectedDocuments}
            hint="Excluded from analysis"
          />

          <InfoBox
            label="Failed"
            value={failedDocuments}
            hint="Needs retry or replacement"
          />
        </div>
      </Section>

      <Section
        title="Alerts and recommendations"
        hint="Important observations from the AI finance dashboard."
      >
        <div
          style={{
            display: "grid",
            gap: 12,
          }}
        >
          {alertSummary.map((alert) => {
            const isCritical = alert.severity === "critical";
            const isWarning = alert.severity === "warning";

            return (
              <div
                key={alert.id}
                style={{
                  border: isCritical
                    ? "1px solid rgba(255,71,87,0.30)"
                    : isWarning
                      ? "1px solid rgba(255,193,7,0.30)"
                      : "1px solid rgba(88,166,255,0.25)",
                  background: isCritical
                    ? "rgba(255,71,87,0.08)"
                    : isWarning
                      ? "rgba(255,193,7,0.08)"
                      : "rgba(88,166,255,0.07)",
                  borderRadius: 16,
                  padding: 14,
                  display: "grid",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    color: isCritical
                      ? "#ff8a95"
                      : isWarning
                        ? "#ffd166"
                        : "#8abfff",
                    fontSize: 12,
                    fontWeight: 950,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {alert.severity}
                </span>

                <p
                  style={{
                    margin: 0,
                    color: "var(--color-text-secondary)",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  {alert.message}
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      <section
        className="section-card report-section"
        style={{
          display: "grid",
          gap: 12,
        }}
      >
        <p
          className="section-title"
          style={{
            margin: 0,
          }}
        >
          Report note
        </p>

        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            fontSize: 13,
            lineHeight: 1.65,
          }}
        >
          This report is generated by Ledger from AI-extracted financial data.
          It is designed for decision support and hackathon/demo review. Final
          accounting, tax, and audit decisions should be verified against source
          documents and professional advice.
        </p>
      </section>
    </>
  );
}