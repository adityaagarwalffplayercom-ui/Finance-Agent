import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type StepStatus = "done" | "active" | "locked";

function StepCard({
  number,
  title,
  hint,
  status,
  href,
  actionLabel,
}: {
  number: string;
  title: string;
  hint: string;
  status: StepStatus;
  href: string;
  actionLabel: string;
}) {
  const tone = {
    done: {
      color: "#7bed9f",
      border: "rgba(46,213,115,0.28)",
      background: "rgba(46,213,115,0.08)",
      label: "Done",
    },
    active: {
      color: "var(--color-amber)",
      border: "rgba(245,158,11,0.34)",
      background: "rgba(245,158,11,0.10)",
      label: "Next",
    },
    locked: {
      color: "var(--color-text-muted)",
      border: "var(--color-border)",
      background: "rgba(255,255,255,0.035)",
      label: "Locked",
    },
  }[status];

  return (
    <article
      style={{
        border: `1px solid ${tone.border}`,
        background:
          status === "active"
            ? "radial-gradient(circle at top left, rgba(245,158,11,0.16), transparent 38%), linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))"
            : tone.background,
        borderRadius: 22,
        padding: 18,
        display: "grid",
        gap: 14,
        minHeight: 210,
        boxShadow:
          status === "active"
            ? "0 22px 60px rgba(245,158,11,0.10), inset 0 1px 0 rgba(255,255,255,0.05)"
            : "inset 0 1px 0 rgba(255,255,255,0.04)",
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
        <span
          style={{
            width: 42,
            height: 42,
            borderRadius: 16,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: tone.background,
            border: `1px solid ${tone.border}`,
            color: tone.color,
            fontSize: 15,
            fontWeight: 950,
          }}
        >
          {number}
        </span>

        <span
          style={{
            border: `1px solid ${tone.border}`,
            background: tone.background,
            color: tone.color,
            borderRadius: 999,
            padding: "6px 9px",
            fontSize: 11,
            fontWeight: 950,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {tone.label}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: 7,
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "var(--color-text-primary)",
            fontSize: 20,
            lineHeight: 1.15,
          }}
        >
          {title}
        </h2>

        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {hint}
        </p>
      </div>

      <div>
        {status === "locked" ? (
          <span
            style={{
              color: "var(--color-text-muted)",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            Complete previous step first
          </span>
        ) : (
          <Link
            href={href}
            className="btn-ghost"
            style={{
              border:
                status === "active"
                  ? "1px solid rgba(245,158,11,0.35)"
                  : undefined,
              background:
                status === "active" ? "rgba(245,158,11,0.10)" : undefined,
              color: status === "active" ? "var(--color-amber)" : undefined,
            }}
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </article>
  );
}

function ReadinessMetric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: "green" | "yellow" | "blue" | "neutral";
}) {
  const toneStyle = {
    green: {
      color: "#7bed9f",
      border: "rgba(46,213,115,0.28)",
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
    neutral: {
      color: "var(--color-text-secondary)",
      border: "var(--color-border)",
      background: "rgba(255,255,255,0.035)",
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
          fontSize: 28,
          lineHeight: 1,
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
        {hint}
      </p>
    </div>
  );
}

function ReadyFeature({
  icon,
  title,
  hint,
}: {
  icon: string;
  title: string;
  hint: string;
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(0,0,0,0.12)",
        borderRadius: 18,
        padding: 14,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
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
          background: "rgba(46,213,115,0.10)",
          border: "1px solid rgba(46,213,115,0.24)",
          fontSize: 17,
          flex: "0 0 auto",
        }}
      >
        {icon}
      </span>

      <span
        style={{
          display: "grid",
          gap: 4,
        }}
      >
        <strong
          style={{
            color: "var(--color-text-primary)",
            fontSize: 13,
            lineHeight: 1.25,
          }}
        >
          {title}
        </strong>

        <span
          style={{
            color: "var(--color-text-secondary)",
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          {hint}
        </span>
      </span>
    </div>
  );
}

function WorkspaceReadyCard() {
  return (
    <section
      style={{
        border: "1px solid rgba(46,213,115,0.24)",
        background:
          "radial-gradient(circle at top left, rgba(46,213,115,0.16), transparent 34%), radial-gradient(circle at bottom right, rgba(245,158,11,0.12), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025))",
        borderRadius: 30,
        padding: 24,
        display: "grid",
        gap: 20,
        position: "relative",
        overflow: "hidden",
        boxShadow:
          "0 26px 90px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          right: -70,
          top: -70,
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: "rgba(46,213,115,0.10)",
        }}
      />

      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)",
          gap: 20,
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 14,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                width: 52,
                height: 52,
                borderRadius: 20,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  "linear-gradient(135deg, rgba(46,213,115,0.22), rgba(255,255,255,0.05))",
                border: "1px solid rgba(46,213,115,0.34)",
                fontSize: 24,
                boxShadow: "0 18px 42px rgba(46,213,115,0.10)",
              }}
            >
              ✅
            </span>

            <span
              style={{
                border: "1px solid rgba(46,213,115,0.30)",
                background: "rgba(46,213,115,0.10)",
                color: "#7bed9f",
                borderRadius: 999,
                padding: "8px 11px",
                fontSize: 12,
                fontWeight: 950,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Workspace ready
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gap: 8,
            }}
          >
            <h2
              style={{
                margin: 0,
                color: "var(--color-text-primary)",
                fontSize: 30,
                lineHeight: 1.08,
                fontWeight: 950,
              }}
            >
              Your finance workspace is live
            </h2>

            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 14,
                lineHeight: 1.65,
                maxWidth: 720,
              }}
            >
              Business profile and approved documents are connected. You can now
              use the executive dashboard, ask the AI finance team questions,
              and export a CFO-style report.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Link
              href="/dashboard"
              className="btn-ghost"
              style={{
                border: "1px solid rgba(46,213,115,0.32)",
                background: "rgba(46,213,115,0.10)",
                color: "#7bed9f",
              }}
            >
              Open dashboard
            </Link>

            <Link href="/chat" className="btn-ghost">
              Ask AI team
            </Link>

            <Link href="/reports/cfo" className="btn-ghost">
              Export CFO report
            </Link>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          <ReadyFeature
            icon="📊"
            title="Dashboard connected"
            hint="Approved documents are powering live financial insights."
          />

          <ReadyFeature
            icon="🤖"
            title="AI finance team ready"
            hint="Chat answers now use your business profile and trusted data."
          />

          <ReadyFeature
            icon="📄"
            title="CFO report enabled"
            hint="Generate a printable report for review or presentation."
          />
        </div>
      </div>
    </section>
  );
}

export default async function OnboardingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [
    business,
    totalDocuments,
    approvedDocuments,
    needsReviewDocuments,
  ] = await Promise.all([
    prisma.business.findUnique({
      where: {
        userId: session.user.id,
      },
      select: {
        name: true,
        industry: true,
        businessType: true,
        country: true,
        currency: true,
        financialYear: true,
      },
    }),
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
  ]);

  const hasBusinessProfile = Boolean(business?.name?.trim());
  const hasUploadedDocuments = totalDocuments > 0;
  const hasApprovedDocuments = approvedDocuments > 0;
  const isDashboardReady = hasBusinessProfile && hasApprovedDocuments;

  const businessStepStatus: StepStatus = hasBusinessProfile ? "done" : "active";

  const uploadStepStatus: StepStatus = !hasBusinessProfile
    ? "locked"
    : hasUploadedDocuments
      ? "done"
      : "active";

  const reviewStepStatus: StepStatus =
    !hasBusinessProfile || !hasUploadedDocuments
      ? "locked"
      : hasApprovedDocuments
        ? "done"
        : "active";

  const dashboardStepStatus: StepStatus = isDashboardReady ? "done" : "locked";

  return (
    <>
      <style>
        {`
          @media (max-width: 980px) {
            .setup-ready-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>

      <header
        style={{
          marginBottom: 24,
          border: "1px solid rgba(245,158,11,0.24)",
          background:
            "radial-gradient(circle at top left, rgba(245,158,11,0.16), transparent 36%), linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025))",
          borderRadius: 30,
          padding: 26,
          display: "grid",
          gap: 18,
          boxShadow:
            "0 26px 90px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)",
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
          <div
            style={{
              display: "grid",
              gap: 10,
              maxWidth: 820,
            }}
          >
            <p
              className="eyebrow"
              style={{
                margin: 0,
              }}
            >
              Smart onboarding
            </p>

            <h1
              style={{
                margin: 0,
                lineHeight: 1.05,
              }}
            >
              Set up your AI finance workspace
            </h1>

            <p
              className="page-intro"
              style={{
                margin: 0,
                lineHeight: 1.65,
              }}
            >
              Complete these steps once. After your business profile and
              approved financial documents are ready, the dashboard, AI chat,
              and CFO report become fully personalized.
            </p>
          </div>

          <span
            style={{
              border: isDashboardReady
                ? "1px solid rgba(46,213,115,0.30)"
                : "1px solid rgba(255,193,7,0.30)",
              background: isDashboardReady
                ? "rgba(46,213,115,0.10)"
                : "rgba(255,193,7,0.10)",
              color: isDashboardReady ? "#7bed9f" : "#ffd166",
              borderRadius: 999,
              padding: "9px 12px",
              fontSize: 12,
              fontWeight: 950,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
            }}
          >
            {isDashboardReady ? "Dashboard ready" : "Setup needed"}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 12,
          }}
        >
          <ReadinessMetric
            label="Business profile"
            value={hasBusinessProfile ? "Ready" : "Missing"}
            hint={
              hasBusinessProfile
                ? "Company context connected"
                : "Add business details"
            }
            tone={hasBusinessProfile ? "green" : "yellow"}
          />

          <ReadinessMetric
            label="Uploaded docs"
            value={totalDocuments}
            hint="All documents in workspace"
            tone={totalDocuments > 0 ? "blue" : "neutral"}
          />

          <ReadinessMetric
            label="Approved docs"
            value={approvedDocuments}
            hint="Trusted by dashboard and AI"
            tone={approvedDocuments > 0 ? "green" : "yellow"}
          />

          <ReadinessMetric
            label="Needs review"
            value={needsReviewDocuments}
            hint="Approve before dashboard use"
            tone={needsReviewDocuments > 0 ? "yellow" : "green"}
          />
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StepCard
          number="01"
          title="Create business profile"
          hint="Add company name, industry, business type, country, currency, and financial year."
          status={businessStepStatus}
          href="/business"
          actionLabel={hasBusinessProfile ? "Edit profile" : "Start profile"}
        />

        <StepCard
          number="02"
          title="Upload finance documents"
          hint="Upload bank statements, invoices, payroll, bills, or financial statements."
          status={uploadStepStatus}
          href="/documents"
          actionLabel={
            hasUploadedDocuments ? "View documents" : "Upload documents"
          }
        />

        <StepCard
          number="03"
          title="Review AI extraction"
          hint="Approve processed documents before they are trusted by dashboard and reports."
          status={reviewStepStatus}
          href="/documents"
          actionLabel={hasApprovedDocuments ? "Review more" : "Approve documents"}
        />

        <StepCard
          number="04"
          title="Open executive dashboard"
          hint="Once trusted documents exist, your dashboard, AI chat, and CFO report are ready."
          status={dashboardStepStatus}
          href="/dashboard"
          actionLabel="Open dashboard"
        />
      </section>

      {isDashboardReady && <WorkspaceReadyCard />}
    </>
  );
}