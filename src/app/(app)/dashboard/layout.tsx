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

type Tone = "sage" | "amber" | "gold" | "neutral";

function displayValue(value?: string | null) {
  return value && value.trim().length > 0 ? value.trim() : "Not set";
}

function getToneStyle(tone: Tone) {
  return {
    sage: {
      color: "var(--color-sage)",
      border: "rgba(46,213,115,0.28)",
      background: "rgba(46,213,115,0.085)",
      glow: "rgba(46,213,115,0.13)",
    },
    amber: {
      color: "var(--color-amber)",
      border: "rgba(245,158,11,0.30)",
      background: "rgba(245,158,11,0.095)",
      glow: "rgba(245,158,11,0.13)",
    },
    gold: {
      color: "var(--color-gold)",
      border: "rgba(255,209,102,0.28)",
      background: "rgba(255,209,102,0.085)",
      glow: "rgba(255,209,102,0.12)",
    },
    neutral: {
      color: "var(--color-text-secondary)",
      border: "var(--color-border)",
      background: "rgba(255,255,255,0.045)",
      glow: "rgba(255,255,255,0.06)",
    },
  }[tone];
}

function ContextPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: Tone;
}) {
  const toneStyle = getToneStyle(tone);

  return (
    <span
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: toneStyle.background,
        color: toneStyle.color,
        borderRadius: 999,
        padding: "8px 11px",
        fontSize: 12,
        fontWeight: 850,
        display: "inline-flex",
        gap: 6,
        alignItems: "center",
        whiteSpace: "nowrap",
        boxShadow: `0 12px 30px ${toneStyle.glow}`,
      }}
    >
      <span
        style={{
          color: "var(--color-text-muted)",
          fontWeight: 750,
        }}
      >
        {label}
      </span>

      <strong style={{ color: "inherit" }}>{value}</strong>
    </span>
  );
}

function MiniStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: Tone;
}) {
  const toneStyle = getToneStyle(tone);

  return (
    <div
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: `linear-gradient(135deg, ${toneStyle.background}, rgba(255,255,255,0.024))`,
        borderRadius: 18,
        padding: 14,
        minHeight: 102,
        display: "grid",
        alignContent: "space-between",
        gap: 8,
        boxShadow: `0 16px 40px ${toneStyle.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`,
        minWidth: 0,
      }}
    >
      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 11,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </p>

      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: 24,
          lineHeight: 1,
          fontWeight: 950,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </strong>

      <p
        style={{
          margin: 0,
          color: toneStyle.color,
          fontSize: 12,
          lineHeight: 1.35,
          fontWeight: 750,
        }}
      >
        {hint}
      </p>
    </div>
  );
}

function CompletionBar({ percent }: { percent: number }) {
  const tone: Tone = percent >= 80 ? "sage" : percent >= 50 ? "gold" : "neutral";
  const toneStyle = getToneStyle(tone);

  return (
    <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "center",
        }}
      >
        <span
          style={{
            color: "var(--color-text-secondary)",
            fontSize: 12,
            fontWeight: 850,
          }}
        >
          Profile completeness
        </span>

        <strong
          style={{
            color: toneStyle.color,
            fontSize: 12,
          }}
        >
          {percent}%
        </strong>
      </div>

      <div
        style={{
          width: "100%",
          height: 8,
          borderRadius: 999,
          background: "rgba(255,255,255,0.07)",
          overflow: "hidden",
          border: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            borderRadius: 999,
            background: `linear-gradient(90deg, ${toneStyle.color}, var(--color-amber))`,
            boxShadow: `0 0 22px ${toneStyle.glow}`,
          }}
        />
      </div>
    </div>
  );
}

function NextActionCard({
  icon,
  title,
  hint,
  href,
  actionLabel,
  tone,
}: {
  icon: string;
  title: string;
  hint: string;
  href: string;
  actionLabel: string;
  tone: Tone;
}) {
  const toneStyle = getToneStyle(tone);

  return (
    <article
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: `linear-gradient(135deg, ${toneStyle.background}, rgba(255,255,255,0.022))`,
        borderRadius: 20,
        padding: 15,
        display: "grid",
        gap: 12,
        minHeight: 170,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.045)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          minWidth: 0,
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
            background: toneStyle.background,
            border: `1px solid ${toneStyle.border}`,
            fontSize: 19,
            flex: "0 0 auto",
          }}
        >
          {icon}
        </span>

        <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
          <strong
            style={{
              color: "var(--color-text-primary)",
              fontSize: 14,
              lineHeight: 1.3,
              overflowWrap: "break-word",
            }}
          >
            {title}
          </strong>

          <p
            style={{
              margin: 0,
              color: "var(--color-text-secondary)",
              fontSize: 12,
              lineHeight: 1.55,
              overflowWrap: "break-word",
            }}
          >
            {hint}
          </p>
        </div>
      </div>

      <Link
        href={href}
        className="btn-ghost"
        style={{
          alignItems: "center",
          justifyContent: "center",
          width: "fit-content",
          minWidth: 160,
          maxWidth: "100%",
          background: toneStyle.background,
          border: `1px solid ${toneStyle.border}`,
          color: toneStyle.color,
        }}
      >
        {actionLabel}
      </Link>
    </article>
  );
}

function WorkspaceNextActions({
  completionPercent,
  totalDocuments,
  approvedDocuments,
  needsReviewDocuments,
}: {
  completionPercent: number;
  totalDocuments: number;
  approvedDocuments: number;
  needsReviewDocuments: number;
}) {
  const shouldShow =
    completionPercent < 100 || totalDocuments < 3 || needsReviewDocuments > 0;

  if (!shouldShow) {
    return null;
  }

  return (
    <section
      style={{
        marginBottom: 28,
        border: "1px solid rgba(245,158,11,0.20)",
        background:
          "radial-gradient(circle at top left, rgba(245,158,11,0.12), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.052), rgba(255,255,255,0.024))",
        borderRadius: 26,
        padding: 18,
        display: "grid",
        gap: 16,
        boxShadow:
          "0 18px 60px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.05)",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "flex-start",
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
          <p className="eyebrow" style={{ margin: 0 }}>
            Recommended next actions
          </p>

          <h2
            style={{
              margin: 0,
              color: "var(--color-text-primary)",
              fontSize: 24,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              wordBreak: "normal",
              overflowWrap: "normal",
              hyphens: "none",
            }}
          >
            Improve your finance workspace
          </h2>

          <p
            className="section-hint"
            style={{
              margin: 0,
              lineHeight: 1.55,
              maxWidth: 760,
              overflowWrap: "break-word",
            }}
          >
            Complete these recommended steps to improve dashboard accuracy, AI
            answers, and CFO report quality.
          </p>
        </div>

        <span
          style={{
            border: "1px solid rgba(245,158,11,0.30)",
            background: "rgba(245,158,11,0.09)",
            color: "var(--color-amber)",
            borderRadius: 999,
            padding: "8px 11px",
            fontSize: 12,
            fontWeight: 950,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            whiteSpace: "nowrap",
          }}
        >
          Recommended
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
          minWidth: 0,
        }}
      >
        {needsReviewDocuments > 0 && (
          <NextActionCard
            icon="✅"
            title="Approve pending documents"
            hint={`${needsReviewDocuments} processed document(s) are waiting for review. Approve them to improve dashboard accuracy.`}
            href="/documents"
            actionLabel="Review documents"
            tone="gold"
          />
        )}

        {completionPercent < 100 && (
          <NextActionCard
            icon="🏢"
            title="Complete business profile"
            hint="Add missing profile fields so AI chat and CFO reports become more personalized."
            href="/business"
            actionLabel="Update profile"
            tone="amber"
          />
        )}

        {totalDocuments < 3 && (
          <NextActionCard
            icon="📄"
            title="Upload more finance data"
            hint="Add bank statements, invoices, payroll, or financial statements for stronger analysis."
            href="/documents"
            actionLabel="Upload documents"
            tone="sage"
          />
        )}

        {approvedDocuments > 0 && (
          <NextActionCard
            icon="🤖"
            title="Ask the AI finance team"
            hint="Use approved data to ask about profit, expenses, cash flow, risks, and next actions."
            href="/chat"
            actionLabel="Open AI chat"
            tone="amber"
          />
        )}
      </div>
    </section>
  );
}

async function getDashboardBusinessContext(userId: string) {
  const [business, approvedDocuments, totalDocuments, needsReviewDocuments] =
    await Promise.all([
      prisma.business.findUnique({
        where: { userId },
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
        where: {
          userId,
          status: "PROCESSED",
          reviewStatus: "APPROVED",
        },
      }),
      prisma.document.count({
        where: { userId },
      }),
      prisma.document.count({
        where: {
          userId,
          status: "PROCESSED",
          reviewStatus: "NEEDS_REVIEW",
        },
      }),
    ]);

  return {
    business,
    approvedDocuments,
    totalDocuments,
    needsReviewDocuments,
  };
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return <>{children}</>;
  }

  const { business, approvedDocuments, totalDocuments, needsReviewDocuments } =
    await getDashboardBusinessContext(session.user.id);

  const hasBusinessProfile = Boolean(business?.name?.trim());
  const hasApprovedDocuments = approvedDocuments > 0;

  if (!hasBusinessProfile || !hasApprovedDocuments) {
    redirect("/onboarding");
  }

  const businessName = displayValue(business?.name);
  const industry = displayValue(business?.industry);
  const businessType = displayValue(business?.businessType);
  const country = displayValue(business?.country);
  const currency = displayValue(business?.currency);
  const financialYear = displayValue(business?.financialYear);

  const completionItems = [
    Boolean(business?.name?.trim()),
    Boolean(business?.industry?.trim()),
    Boolean(business?.businessType?.trim()),
    Boolean(business?.country?.trim()),
    Boolean(business?.currency?.trim()),
    Boolean(business?.financialYear?.trim()),
  ];

  const completionPercent = Math.round(
    (completionItems.filter(Boolean).length / completionItems.length) * 100,
  );

  return (
    <>
      <section
        style={{
          marginBottom: 28,
          border: "1px solid rgba(245,158,11,0.22)",
          background:
            "radial-gradient(circle at top left, rgba(245,158,11,0.15), transparent 34%), radial-gradient(circle at bottom right, rgba(46,213,115,0.08), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.062), rgba(255,255,255,0.026))",
          borderRadius: 28,
          padding: 22,
          display: "grid",
          gap: 18,
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)",
          position: "relative",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            width: 220,
            height: 220,
            right: -80,
            top: -90,
            borderRadius: "50%",
            background: "rgba(245,158,11,0.10)",
            filter: "blur(2px)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.8fr)",
            gap: 18,
            alignItems: "stretch",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 16,
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
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: 9,
                  minWidth: 0,
                }}
              >
                <p className="eyebrow" style={{ margin: 0 }}>
                  Executive workspace
                </p>

                <h2
                  style={{
                    margin: 0,
                    color: "var(--color-text-primary)",
                    fontSize: 30,
                    lineHeight: 1.08,
                    fontWeight: 950,
                    wordBreak: "break-word",
                    letterSpacing: "-0.055em",
                  }}
                >
                  {businessName}
                </h2>

                <p
                  className="section-hint"
                  style={{
                    margin: 0,
                    lineHeight: 1.6,
                    maxWidth: 760,
                  }}
                >
                  Dashboard insights are powered by your business profile and
                  only approved financial documents. This keeps the AI finance
                  team focused on trusted data.
                </p>
              </div>

              <span
                style={{
                  border: "1px solid rgba(46,213,115,0.28)",
                  background: "rgba(46,213,115,0.10)",
                  color: "var(--color-sage)",
                  borderRadius: 999,
                  padding: "8px 11px",
                  fontSize: 12,
                  fontWeight: 950,
                  whiteSpace: "nowrap",
                }}
              >
                Dashboard ready
              </span>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <ContextPill
                label="Industry"
                value={industry}
                tone={industry !== "Not set" ? "amber" : "gold"}
              />

              <ContextPill
                label="Type"
                value={businessType}
                tone={businessType !== "Not set" ? "amber" : "gold"}
              />

              <ContextPill
                label="Country"
                value={country}
                tone={country !== "Not set" ? "sage" : "gold"}
              />

              <ContextPill
                label="Currency"
                value={currency}
                tone={currency !== "Not set" ? "sage" : "gold"}
              />

              <ContextPill
                label="FY"
                value={financialYear}
                tone={financialYear !== "Not set" ? "sage" : "gold"}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "flex-start",
              }}
            >
              <Link href="/business" className="btn-ghost">
                Edit business profile
              </Link>

              <Link href="/documents" className="btn-ghost">
                Review documents
              </Link>

              <Link href="/reports/cfo" className="btn-ghost">
                Export CFO report
              </Link>

              <Link href="/onboarding" className="btn-ghost">
                Setup guide
              </Link>

              <DemoSampleDataButton />
            </div>
          </div>

          <aside
            style={{
              border: "1px solid rgba(245,158,11,0.15)",
              background:
                "linear-gradient(135deg, rgba(0,0,0,0.16), rgba(255,255,255,0.025))",
              borderRadius: 22,
              padding: 16,
              display: "grid",
              gap: 14,
              alignContent: "start",
              minWidth: 0,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <CompletionBar percent={completionPercent} />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 10,
                minWidth: 0,
              }}
            >
              <MiniStat
                label="Trusted docs"
                value={String(approvedDocuments)}
                hint="Used by dashboard"
                tone="sage"
              />

              <MiniStat
                label="Needs review"
                value={String(needsReviewDocuments)}
                hint="Awaiting approval"
                tone={needsReviewDocuments > 0 ? "gold" : "sage"}
              />

              <MiniStat
                label="Total uploads"
                value={String(totalDocuments)}
                hint="All files"
                tone={totalDocuments > 0 ? "amber" : "neutral"}
              />

              <MiniStat
                label="Context"
                value="Ready"
                hint="AI personalization"
                tone="sage"
              />
            </div>
          </aside>
        </div>
      </section>

      <WorkspaceNextActions
        completionPercent={completionPercent}
        totalDocuments={totalDocuments}
        approvedDocuments={approvedDocuments}
        needsReviewDocuments={needsReviewDocuments}
      />

      {children}
    </>
  );
}