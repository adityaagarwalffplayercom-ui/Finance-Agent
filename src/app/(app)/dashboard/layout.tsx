import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DemoSampleDataButton } from "./components/DemoSampleDataButton";

type DashboardLayoutProps = {
  children: React.ReactNode;
};

type Tone = "green" | "blue" | "yellow" | "neutral";

function displayValue(value?: string | null) {
  return value && value.trim().length > 0 ? value.trim() : "Not set";
}

function getToneStyle(tone: Tone) {
  return {
    green: {
      color: "#7bed9f",
      border: "rgba(46,213,115,0.26)",
      background: "rgba(46,213,115,0.08)",
      glow: "rgba(46,213,115,0.18)",
    },
    blue: {
      color: "#8abfff",
      border: "rgba(88,166,255,0.28)",
      background: "rgba(88,166,255,0.08)",
      glow: "rgba(88,166,255,0.16)",
    },
    yellow: {
      color: "#ffd166",
      border: "rgba(255,193,7,0.28)",
      background: "rgba(255,193,7,0.08)",
      glow: "rgba(255,193,7,0.16)",
    },
    neutral: {
      color: "var(--color-text-secondary)",
      border: "var(--color-border)",
      background: "rgba(255,255,255,0.04)",
      glow: "rgba(255,255,255,0.08)",
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

      <strong
        style={{
          color: "inherit",
        }}
      >
        {value}
      </strong>
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
        background: `linear-gradient(135deg, ${toneStyle.background}, rgba(255,255,255,0.025))`,
        borderRadius: 18,
        padding: 14,
        minHeight: 102,
        display: "grid",
        alignContent: "space-between",
        gap: 8,
        boxShadow: `0 16px 40px ${toneStyle.glow}`,
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
  const tone = percent >= 80 ? "green" : percent >= 50 ? "yellow" : "neutral";
  const toneStyle = getToneStyle(tone);

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
      }}
    >
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

async function getDashboardBusinessContext(userId: string) {
  const [business, approvedDocuments, totalDocuments, needsReviewDocuments] =
    await Promise.all([
      prisma.business.findUnique({
        where: {
          userId,
        },
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
        where: {
          userId,
        },
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

  const businessName = hasBusinessProfile
    ? displayValue(business?.name)
    : "Set up your business profile";

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
          border: hasBusinessProfile
            ? "1px solid rgba(245,158,11,0.22)"
            : "1px solid rgba(255,193,7,0.30)",
          background:
            "radial-gradient(circle at top left, rgba(245,158,11,0.14), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.062), rgba(255,255,255,0.026))",
          borderRadius: 28,
          padding: 22,
          display: "grid",
          gap: 18,
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)",
          position: "relative",
          overflow: "hidden",
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
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: 9,
                  minWidth: 0,
                }}
              >
                <p
                  className="eyebrow"
                  style={{
                    margin: 0,
                  }}
                >
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
                  border: hasBusinessProfile
                    ? "1px solid rgba(46,213,115,0.28)"
                    : "1px solid rgba(255,193,7,0.30)",
                  background: hasBusinessProfile
                    ? "rgba(46,213,115,0.10)"
                    : "rgba(255,193,7,0.10)",
                  color: hasBusinessProfile ? "#7bed9f" : "#ffd166",
                  borderRadius: 999,
                  padding: "8px 11px",
                  fontSize: 12,
                  fontWeight: 950,
                  whiteSpace: "nowrap",
                }}
              >
                {hasBusinessProfile ? "Profile connected" : "Profile missing"}
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
                tone={industry !== "Not set" ? "blue" : "yellow"}
              />

              <ContextPill
                label="Type"
                value={businessType}
                tone={businessType !== "Not set" ? "blue" : "yellow"}
              />

              <ContextPill
                label="Country"
                value={country}
                tone={country !== "Not set" ? "green" : "yellow"}
              />

              <ContextPill
                label="Currency"
                value={currency}
                tone={currency !== "Not set" ? "green" : "yellow"}
              />

              <ContextPill
                label="FY"
                value={financialYear}
                tone={financialYear !== "Not set" ? "green" : "yellow"}
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
                {hasBusinessProfile ? "Edit business profile" : "Complete profile"}
              </Link>

              <Link href="/documents" className="btn-ghost">
                Review documents
              </Link>

              <Link href="/reports/cfo" className="btn-ghost">
                Export CFO report
              </Link>

              <DemoSampleDataButton />
            </div>
          </div>

          <aside
            style={{
              border: "1px solid var(--color-border)",
              background: "rgba(0,0,0,0.12)",
              borderRadius: 22,
              padding: 16,
              display: "grid",
              gap: 14,
              alignContent: "start",
              minWidth: 0,
            }}
          >
            <CompletionBar percent={completionPercent} />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              <MiniStat
                label="Trusted docs"
                value={String(approvedDocuments)}
                hint="Used by dashboard"
                tone={approvedDocuments > 0 ? "green" : "neutral"}
              />

              <MiniStat
                label="Needs review"
                value={String(needsReviewDocuments)}
                hint="Awaiting approval"
                tone={needsReviewDocuments > 0 ? "yellow" : "green"}
              />

              <MiniStat
                label="Total uploads"
                value={String(totalDocuments)}
                hint="All files"
                tone={totalDocuments > 0 ? "blue" : "neutral"}
              />

              <MiniStat
                label="Context"
                value={hasBusinessProfile ? "Ready" : "Missing"}
                hint="AI personalization"
                tone={hasBusinessProfile ? "green" : "yellow"}
              />
            </div>
          </aside>
        </div>
      </section>

      {children}
    </>
  );
}