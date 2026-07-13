import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceDataScope } from "@/lib/active-workspace-data";
import { getFinancialProfile } from "@/lib/financial-profile";
import { ExportCfoReportButton } from "./ExportCfoReportButton";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function displayValue(value?: string | null) {
  return value && value.trim().length > 0 ? value : "Not set";
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
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint: string;
  tone?: "green" | "yellow" | "blue" | "red" | "neutral";
}) {
  const toneStyle = {
    green: {
      color: "#7bed9f",
      border: "rgba(46,213,115,0.26)",
      background: "rgba(46,213,115,0.08)",
    },
    yellow: {
      color: "#ffd166",
      border: "rgba(255,193,7,0.28)",
      background: "rgba(255,193,7,0.08)",
    },
    blue: {
      color: "#8abfff",
      border: "rgba(88,166,255,0.28)",
      background: "rgba(88,166,255,0.08)",
    },
    red: {
      color: "#ff8a95",
      border: "rgba(255,71,87,0.28)",
      background: "rgba(255,71,87,0.08)",
    },
    neutral: {
      color: "var(--color-text-muted)",
      border: "var(--color-border)",
      background: "rgba(255,255,255,0.035)",
    },
  }[tone];

  return (
    <div
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: toneStyle.background,
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
          lineHeight: 1.15,
          wordBreak: "break-word",
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
          fontWeight: 700,
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
  const { documentWhere, businessWhere } = await getActiveWorkspaceDataScope(session.user.id);

  const [
    business,
    totalDocuments,
    approvedDocuments,
    needsReviewDocuments,
    rejectedDocuments,
    failedDocuments,
    latestApprovedDocument,
  ] = await Promise.all([
    prisma.business.findFirst({
      where: businessWhere,
      select: {
        name: true,
        industry: true,
        businessType: true,
        financialYear: true,
        currency: true,
        country: true,
        updatedAt: true,
      },
    }),
    prisma.document.count({
      where: documentWhere,
    }),
    prisma.document.count({
      where: { AND: [documentWhere, { status: "PROCESSED", reviewStatus: "APPROVED" }] },
    }),
    prisma.document.count({
      where: { AND: [documentWhere, { status: "PROCESSED", reviewStatus: "NEEDS_REVIEW" }] },
    }),
    prisma.document.count({
      where: { AND: [documentWhere, { reviewStatus: "REJECTED" }] },
    }),
    prisma.document.count({
      where: { AND: [documentWhere, { status: "FAILED" }] },
    }),
    prisma.document.findFirst({
      where: { AND: [documentWhere, { status: "PROCESSED", reviewStatus: "APPROVED" }] },
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

  const businessName =
    displayValue(business?.name) !== "Not set"
      ? displayValue(business?.name)
      : "Your Business";

  const businessIndustry = displayValue(business?.industry);
  const businessType = displayValue(business?.businessType);
  const businessFinancialYear = displayValue(business?.financialYear);
  const businessCurrency = displayValue(business?.currency);
  const businessCountry = displayValue(business?.country);

  const hasBusinessProfile = Boolean(business?.name);

  const lastTrustedUpdate =
    latestApprovedDocument?.reviewedAt ??
    latestApprovedDocument?.extractedAt ??
    latestApprovedDocument?.uploadedAt ??
    null;

  const healthTone: "green" | "yellow" | "red" =
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
            maxWidth: 840,
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
              maxWidth: 780,
            }}
          >
            For <strong>{businessName}</strong>. This printable CFO-style
            summary is generated from approved financial documents. Pending and
            rejected documents are excluded from the core financial intelligence.
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

          <Link href="/business" className="btn-ghost no-print">
            Edit business profile
          </Link>

          <Link href="/documents" className="btn-ghost no-print">
            Review documents
          </Link>
        </div>
      </header>

      {!hasBusinessProfile && (
        <section
          className="section-card no-print"
          style={{
            marginBottom: 24,
            border: "1px solid rgba(255,193,7,0.28)",
            background: "rgba(255,193,7,0.08)",
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
            Business profile missing
          </p>

          <p
            className="section-hint"
            style={{
              margin: 0,
              lineHeight: 1.55,
            }}
          >
            Add your company name, industry, currency, country, and financial
            year to make this report more professional.
          </p>

          <div>
            <Link href="/business" className="btn-ghost">
              Complete business profile
            </Link>
          </div>
        </section>
      )}

      <Section
        title="Business profile"
        hint="Company context used to personalize this CFO report."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 12,
          }}
        >
          <InfoBox
            label="Business name"
            value={businessName}
            hint={
              hasBusinessProfile
                ? "Company profile connected"
                : "Default report name"
            }
            tone={hasBusinessProfile ? "green" : "yellow"}
          />

          <InfoBox
            label="Industry"
            value={businessIndustry}
            hint="Used for finance interpretation"
            tone={businessIndustry !== "Not set" ? "blue" : "yellow"}
          />

          <InfoBox
            label="Business type"
            value={businessType}
            hint="Ownership and structure context"
            tone={businessType !== "Not set" ? "blue" : "yellow"}
          />

          <InfoBox
            label="Country"
            value={businessCountry}
            hint="Tax and compliance context"
            tone={businessCountry !== "Not set" ? "green" : "yellow"}
          />

          <InfoBox
            label="Currency"
            value={businessCurrency}
            hint="Default reporting currency"
            tone={businessCurrency !== "Not set" ? "green" : "yellow"}
          />

          <InfoBox
            label="Financial year"
            value={businessFinancialYear}
            hint="Period context for analysis"
            tone={businessFinancialYear !== "Not set" ? "green" : "yellow"}
          />
        </div>
      </Section>

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
            tone="blue"
          />

          <InfoBox
            label="Trusted documents"
            value={approvedDocuments}
            hint="Approved and included in analysis"
            tone={approvedDocuments > 0 ? "green" : "yellow"}
          />

          <InfoBox
            label="Health score"
            value={`${profile.healthScore}/100`}
            hint={profile.healthLabel}
            tone={healthTone}
          />

          <InfoBox
            label="Last trusted update"
            value={
              lastTrustedUpdate
                ? formatDateTime(lastTrustedUpdate)
                : "Not available"
            }
            hint={latestApprovedDocument?.fileName ?? "No approved document yet"}
            tone={lastTrustedUpdate ? "green" : "yellow"}
          />
        </div>
      </Section>

      <Section
        title="Financial overview"
        hint={`Core finance metrics detected from approved documents for ${businessName}.`}
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
            <strong>{businessName}</strong>
            {businessIndustry !== "Not set"
              ? ` operates in the ${businessIndustry} industry`
              : ""}
            {businessCountry !== "Not set" ? ` in ${businessCountry}` : ""}.
            The business currently has a financial health score of{" "}
            <strong>{profile.healthScore}/100</strong>, classified as{" "}
            <strong>{profile.healthLabel}</strong>.
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
            <strong>{profile.cash.value}</strong>. This report reflects only
            approved financial documents, so pending and rejected documents stay
            excluded until reviewed.
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
            tone="blue"
          />

          <InfoBox
            label="Approved"
            value={approvedDocuments}
            hint="Used by dashboard and AI"
            tone={approvedDocuments > 0 ? "green" : "yellow"}
          />

          <InfoBox
            label="Needs review"
            value={needsReviewDocuments}
            hint="Processed but not trusted yet"
            tone={needsReviewDocuments > 0 ? "yellow" : "green"}
          />

          <InfoBox
            label="Rejected"
            value={rejectedDocuments}
            hint="Excluded from analysis"
            tone={rejectedDocuments > 0 ? "yellow" : "green"}
          />

          <InfoBox
            label="Failed"
            value={failedDocuments}
            hint="Needs retry or replacement"
            tone={failedDocuments > 0 ? "yellow" : "green"}
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
          This report is generated by Ledger from AI-extracted financial data
          for {businessName}. It is designed for decision support and
          hackathon/demo review. Final accounting, tax, and audit decisions
          should be verified against source documents and professional advice.
        </p>
      </section>
    </>
  );
}