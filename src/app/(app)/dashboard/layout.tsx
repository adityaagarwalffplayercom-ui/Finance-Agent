import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DemoSampleDataButton } from "./components/DemoSampleDataButton";

type DashboardLayoutProps = {
  children: ReactNode;
};

function displayValue(value?: string | null, fallback = "Not set") {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function WorkspaceChip({
  label,
  value,
  tone = "gold",
}: {
  label: string;
  value: string;
  tone?: "gold" | "sage" | "neutral";
}) {
  const color =
    tone === "sage"
      ? "var(--color-sage)"
      : tone === "gold"
        ? "var(--color-gold)"
        : "var(--color-text-secondary)";

  const border =
    tone === "sage"
      ? "rgba(46,213,115,0.28)"
      : tone === "gold"
        ? "rgba(255,209,102,0.28)"
        : "rgba(255,255,255,0.14)";

  const background =
    tone === "sage"
      ? "rgba(46,213,115,0.08)"
      : tone === "gold"
        ? "rgba(245,158,11,0.09)"
        : "rgba(255,255,255,0.04)";

  return (
    <span
      className="workspace-chip"
      style={{
        border: `1px solid ${border}`,
        background,
        color,
        borderRadius: 999,
        padding: "8px 11px",
        fontSize: 11,
        lineHeight: 1,
        fontWeight: 900,
        display: "inline-flex",
        gap: 6,
        alignItems: "center",
        maxWidth: "100%",
        minWidth: 0,
      }}
    >
      <span
        style={{
          color: "var(--color-text-secondary)",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          color,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </strong>
    </span>
  );
}

function StatBox({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: "sage" | "gold" | "neutral";
}) {
  const color =
    tone === "sage"
      ? "var(--color-sage)"
      : tone === "gold"
        ? "var(--color-gold)"
        : "var(--color-text-secondary)";

  const border =
    tone === "sage"
      ? "rgba(46,213,115,0.24)"
      : tone === "gold"
        ? "rgba(255,209,102,0.24)"
        : "rgba(255,255,255,0.12)";

  const background =
    tone === "sage"
      ? "rgba(46,213,115,0.075)"
      : tone === "gold"
        ? "rgba(245,158,11,0.080)"
        : "rgba(255,255,255,0.035)";

  return (
    <article
      className="workspace-stat-box"
      style={{
        border: `1px solid ${border}`,
        background,
        borderRadius: 18,
        padding: 14,
        display: "grid",
        gap: 8,
        minWidth: 0,
      }}
    >
      <span
        style={{
          color: "var(--color-text-secondary)",
          fontSize: 10,
          fontWeight: 950,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: 24,
          lineHeight: 1,
          fontWeight: 950,
          letterSpacing: "-0.055em",
        }}
      >
        {value}
      </strong>

      <span
        style={{
          color,
          fontSize: 11,
          lineHeight: 1.35,
          fontWeight: 800,
        }}
      >
        {hint}
      </span>
    </article>
  );
}

function ActionButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="btn-ghost workspace-action-button">
      {children}
    </Link>
  );
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [business, approvedDocuments, pendingDocuments, totalDocuments] =
    await Promise.all([
      prisma.business.findUnique({
        where: {
          userId: session.user.id,
        },
        select: {
          name: true,
          industry: true,
          businessType: true,
          financialYear: true,
          country: true,
          currency: true,
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
        },
      }),
    ]);

  const businessName = displayValue(business?.name, "Your workspace");
  const industry = displayValue(business?.industry);
  const businessType = displayValue(business?.businessType);
  const country = displayValue(business?.country);
  const currency = displayValue(business?.currency);
  const financialYear = displayValue(business?.financialYear);

  const profileReady =
    business?.name &&
    business?.industry &&
    business?.businessType &&
    business?.country &&
    business?.currency &&
    business?.financialYear;

  return (
    <>
      <section
        className="dashboard-workspace-hero"
        style={{
          border: "1px solid rgba(255,209,102,0.20)",
          background:
            "radial-gradient(circle at top right, rgba(245,158,11,0.16), transparent 32%), radial-gradient(circle at bottom left, rgba(46,213,115,0.10), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.060), rgba(255,255,255,0.024))",
          borderRadius: 30,
          padding: 24,
          display: "grid",
          gap: 20,
          marginBottom: 18,
          minWidth: 0,
          overflow: "hidden",
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="dashboard-workspace-hero-top"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 18,
            alignItems: "start",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 10,
              minWidth: 0,
            }}
          >
            <p className="eyebrow" style={{ margin: 0 }}>
              Executive workspace
            </p>

            <h1
              className="workspace-title"
              style={{
                margin: 0,
                color: "var(--color-text-primary)",
                fontSize: "clamp(34px, 4vw, 58px)",
                lineHeight: 1,
                letterSpacing: "-0.075em",
                fontWeight: 950,
                overflowWrap: "anywhere",
              }}
            >
              {businessName}
            </h1>

            <p
              className="workspace-copy"
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 14,
                lineHeight: 1.7,
                maxWidth: 820,
              }}
            >
              Dashboard insights are powered by your business profile and only
              approved financial documents. Pending and rejected files stay out
              of finance intelligence.
            </p>
          </div>

          <span
            className="workspace-status"
            style={{
              border: profileReady
                ? "1px solid rgba(46,213,115,0.28)"
                : "1px solid rgba(255,209,102,0.28)",
              background: profileReady
                ? "rgba(46,213,115,0.08)"
                : "rgba(245,158,11,0.09)",
              color: profileReady ? "var(--color-sage)" : "var(--color-gold)",
              borderRadius: 999,
              padding: "9px 12px",
              fontSize: 11,
              lineHeight: 1,
              fontWeight: 950,
              whiteSpace: "nowrap",
            }}
          >
            {profileReady ? "Dashboard ready" : "Setup needed"}
          </span>
        </div>

        <div
          className="workspace-chip-row"
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          <WorkspaceChip label="Industry" value={industry} tone="gold" />
          <WorkspaceChip label="Type" value={businessType} tone="gold" />
          <WorkspaceChip label="Country" value={country} tone="sage" />
          <WorkspaceChip label="Currency" value={currency} tone="sage" />
          <WorkspaceChip label="FY" value={financialYear} tone="sage" />
        </div>

        <div
          className="workspace-actions"
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <ActionButton href="/business">Edit business profile</ActionButton>
          <ActionButton href="/documents">Review documents</ActionButton>
          <ActionButton href="/reports/cfo">Export CFO report</ActionButton>
          <ActionButton href="/onboarding">Setup guide</ActionButton>
        </div>

        <div
          className="workspace-sample-actions"
          style={{
            border: "1px solid rgba(255,209,102,0.14)",
            background: "rgba(0,0,0,0.10)",
            borderRadius: 20,
            padding: 14,
            display: "grid",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 4,
            }}
          >
            <strong
              style={{
                color: "var(--color-text-primary)",
                fontSize: 13,
                lineHeight: 1.3,
              }}
            >
              Sample workspace
            </strong>

            <span
              style={{
                color: "var(--color-text-secondary)",
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              Load sample finance data to quickly demonstrate dashboard, charts,
              AI chat, and CFO report.
            </span>
          </div>

          <DemoSampleDataButton />
        </div>

        <div
          className="workspace-progress-card"
          style={{
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(0,0,0,0.12)",
            borderRadius: 22,
            padding: 14,
            display: "grid",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              color: "var(--color-text-secondary)",
              fontSize: 11,
              fontWeight: 850,
            }}
          >
            <span>Profile completeness</span>
            <span>{profileReady ? "100%" : "Needs setup"}</span>
          </div>

          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: profileReady ? "100%" : "45%",
                height: "100%",
                borderRadius: 999,
                background:
                  "linear-gradient(90deg, var(--color-sage), var(--color-gold))",
              }}
            />
          </div>

          <div
            className="workspace-stat-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            <StatBox
              label="Trusted docs"
              value={approvedDocuments}
              hint="Used by dashboard"
              tone="sage"
            />

            <StatBox
              label="Needs review"
              value={pendingDocuments}
              hint="Awaiting approval"
              tone={pendingDocuments > 0 ? "gold" : "sage"}
            />

            <StatBox
              label="Total uploads"
              value={totalDocuments}
              hint="All files"
              tone="gold"
            />

            <StatBox
              label="Context"
              value={profileReady ? "Ready" : "Incomplete"}
              hint="AI personalization"
              tone={profileReady ? "sage" : "gold"}
            />
          </div>
        </div>
      </section>

      <section
        className="dashboard-next-actions"
        style={{
          border: "1px solid rgba(255,209,102,0.14)",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.050), rgba(255,255,255,0.022))",
          borderRadius: 26,
          padding: 20,
          display: "grid",
          gap: 16,
          marginBottom: 18,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            alignItems: "start",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 6,
            }}
          >
            <p className="eyebrow" style={{ margin: 0 }}>
              Recommended next actions
            </p>

            <h2
              style={{
                margin: 0,
                color: "var(--color-text-primary)",
                fontSize: 24,
                lineHeight: 1.1,
                letterSpacing: "-0.05em",
                fontWeight: 950,
              }}
            >
              Improve your finance workspace
            </h2>

            <p
              className="section-hint"
              style={{
                margin: 0,
              }}
            >
              Complete these recommended steps to improve dashboard accuracy,
              AI answers, and CFO report quality.
            </p>
          </div>

          <span
            style={{
              border: "1px solid rgba(255,209,102,0.26)",
              background: "rgba(245,158,11,0.09)",
              color: "var(--color-gold)",
              borderRadius: 999,
              padding: "8px 11px",
              fontSize: 11,
              fontWeight: 950,
              lineHeight: 1,
            }}
          >
            Recommended
          </span>
        </div>

        <div
          className="next-actions-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <Link
            href="/documents"
            className="next-action-card"
            style={{
              border: "1px solid rgba(46,213,115,0.20)",
              background: "rgba(46,213,115,0.07)",
              borderRadius: 20,
              padding: 16,
              textDecoration: "none",
              display: "grid",
              gap: 8,
              color: "inherit",
            }}
          >
            <strong
              style={{
                color: "var(--color-text-primary)",
                fontSize: 14,
              }}
            >
              Upload more finance data
            </strong>

            <span
              style={{
                color: "var(--color-text-secondary)",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              Add bank statements, invoices, payroll, or financial statements
              for stronger analysis.
            </span>

            <span
              style={{
                color: "var(--color-sage)",
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              Upload documents →
            </span>
          </Link>

          <Link
            href="/chat"
            className="next-action-card"
            style={{
              border: "1px solid rgba(255,209,102,0.20)",
              background: "rgba(245,158,11,0.07)",
              borderRadius: 20,
              padding: 16,
              textDecoration: "none",
              display: "grid",
              gap: 8,
              color: "inherit",
            }}
          >
            <strong
              style={{
                color: "var(--color-text-primary)",
                fontSize: 14,
              }}
            >
              Ask the AI finance team
            </strong>

            <span
              style={{
                color: "var(--color-text-secondary)",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              Use approved data to ask about profit, expenses, cash flow, risks,
              and next actions.
            </span>

            <span
              style={{
                color: "var(--color-gold)",
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              Open AI chat →
            </span>
          </Link>
        </div>
      </section>

      {children}

      <style>
        {`
          @media (max-width: 980px) {
            .dashboard-workspace-hero {
              padding: 18px !important;
              border-radius: 24px !important;
              gap: 16px !important;
              margin-bottom: 12px !important;
            }

            .dashboard-workspace-hero-top {
              grid-template-columns: 1fr !important;
              gap: 12px !important;
            }

            .workspace-title {
              font-size: clamp(32px, 10vw, 44px) !important;
              letter-spacing: -0.06em !important;
            }

            .workspace-copy {
              font-size: 13px !important;
              line-height: 1.62 !important;
            }

            .workspace-status {
              width: fit-content !important;
            }

            .workspace-chip-row {
              gap: 7px !important;
            }

            .workspace-chip {
              padding: 8px 10px !important;
              font-size: 11px !important;
              max-width: 100% !important;
            }

            .workspace-actions {
              display: grid !important;
              grid-template-columns: 1fr 1fr !important;
              gap: 9px !important;
            }

            .workspace-action-button {
              width: 100% !important;
              justify-content: center !important;
              text-align: center !important;
            }

            .workspace-sample-actions {
              padding: 12px !important;
              border-radius: 18px !important;
            }

            .workspace-progress-card {
              padding: 12px !important;
              border-radius: 18px !important;
            }

            .workspace-stat-grid {
              grid-template-columns: 1fr 1fr !important;
              gap: 9px !important;
            }

            .workspace-stat-box {
              padding: 12px !important;
              border-radius: 16px !important;
            }

            .dashboard-next-actions {
              padding: 16px !important;
              border-radius: 22px !important;
              margin-bottom: 12px !important;
            }

            .next-actions-grid {
              grid-template-columns: 1fr !important;
            }

            .next-action-card {
              padding: 14px !important;
            }
          }

          @media (max-width: 560px) {
            .dashboard-workspace-hero {
              padding: 16px !important;
            }

            .workspace-actions {
              grid-template-columns: 1fr !important;
            }

            .workspace-stat-grid {
              grid-template-columns: 1fr !important;
            }

            .workspace-chip {
              width: 100% !important;
              justify-content: space-between !important;
            }
          }
        `}
      </style>
    </>
  );
}