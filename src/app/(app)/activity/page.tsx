import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceDataScope } from "@/lib/active-workspace-data";

type Tone = "green" | "amber" | "yellow" | "red" | "neutral";

type BusinessContext = {
  name: string | null;
  industry: string | null;
  businessType: string | null;
  financialYear: string | null;
  currency: string | null;
  country: string | null;
  updatedAt: Date;
} | null;

const TONE_STYLES: Record<
  Tone,
  {
    color: string;
    border: string;
    background: string;
    softBackground: string;
  }
> = {
  green: {
    color: "var(--color-sage)",
    border: "rgba(46,213,115,0.28)",
    background: "rgba(46,213,115,0.09)",
    softBackground: "rgba(46,213,115,0.055)",
  },
  amber: {
    color: "var(--color-gold)",
    border: "rgba(245,158,11,0.28)",
    background: "rgba(245,158,11,0.09)",
    softBackground: "rgba(245,158,11,0.055)",
  },
  yellow: {
    color: "var(--color-gold)",
    border: "rgba(255,209,102,0.30)",
    background: "rgba(255,209,102,0.09)",
    softBackground: "rgba(255,209,102,0.055)",
  },
  red: {
    color: "var(--color-danger)",
    border: "rgba(255,138,149,0.30)",
    background: "rgba(255,138,149,0.09)",
    softBackground: "rgba(255,138,149,0.055)",
  },
  neutral: {
    color: "var(--color-text-secondary)",
    border: "var(--color-border)",
    background: "rgba(255,255,255,0.045)",
    softBackground: "rgba(255,255,255,0.025)",
  },
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatDocumentCategory(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function shortenText(value: string, maxLength = 140) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}

function displayValue(value?: string | null) {
  return value && value.trim().length > 0 ? value.trim() : "Not set";
}

function getStatusTone(status: string): Tone {
  if (status === "PROCESSED" || status === "APPROVED") return "green";
  if (status === "FAILED" || status === "REJECTED") return "red";
  if (status === "PROCESSING" || status === "NEEDS_REVIEW") return "yellow";
  return "amber";
}

function getDocumentIcon(fileName: string, category: string) {
  if (fileName.startsWith("[Sample]")) return "🧪";
  if (category === "BANK_STATEMENT") return "🏦";
  if (category === "FINANCIAL_STATEMENT") return "📊";
  if (category === "SALES_INVOICE") return "📈";
  if (category === "PURCHASE_INVOICE") return "🧾";
  if (category === "PAYROLL") return "👥";
  return "📄";
}

function getProfileCompletion(business: BusinessContext) {
  const items = [
    Boolean(business?.name?.trim()),
    Boolean(business?.industry?.trim()),
    Boolean(business?.businessType?.trim()),
    Boolean(business?.country?.trim()),
    Boolean(business?.currency?.trim()),
    Boolean(business?.financialYear?.trim()),
  ];

  return Math.round((items.filter(Boolean).length / items.length) * 100);
}

function StatusPill({ label }: { label: string }) {
  const tone = getStatusTone(label);
  const toneStyle = TONE_STYLES[tone];

  return (
    <span
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: toneStyle.background,
        color: toneStyle.color,
        borderRadius: 999,
        padding: "6px 9px",
        fontSize: 11,
        fontWeight: 900,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        whiteSpace: "nowrap",
      }}
    >
      {label.replaceAll("_", " ")}
    </span>
  );
}

function SmallPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: Tone;
}) {
  const toneStyle = TONE_STYLES[tone];

  return (
    <span
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: toneStyle.background,
        color: toneStyle.color,
        borderRadius: 999,
        padding: "7px 10px",
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

      <strong style={{ color: "inherit" }}>{value}</strong>
    </span>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number | string;
  hint: string;
  tone: Tone;
}) {
  const toneStyle = TONE_STYLES[tone];

  return (
    <div
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: `linear-gradient(135deg, ${toneStyle.background}, rgba(255,255,255,0.025))`,
        borderRadius: 20,
        padding: 16,
        display: "grid",
        gap: 10,
        minHeight: 118,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.045)",
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
          fontSize: 32,
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
          lineHeight: 1.4,
          fontWeight: 750,
        }}
      >
        {hint}
      </p>
    </div>
  );
}

function SectionHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "flex-start",
        flexWrap: "wrap",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 6,
          minWidth: 0,
        }}
      >
        <p className="section-title" style={{ margin: 0 }}>
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

      {action}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  hint,
  actionHref,
  actionLabel,
}: {
  icon: string;
  title: string;
  hint: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div
      style={{
        border: "1px dashed rgba(245,158,11,0.22)",
        background:
          "linear-gradient(135deg, rgba(245,158,11,0.055), rgba(255,255,255,0.018))",
        borderRadius: 20,
        padding: 22,
        display: "grid",
        gap: 12,
        justifyItems: "start",
      }}
    >
      <span
        style={{
          width: 44,
          height: 44,
          borderRadius: 16,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(245,158,11,0.10)",
          border: "1px solid rgba(245,158,11,0.24)",
          fontSize: 20,
        }}
      >
        {icon}
      </span>

      <div style={{ display: "grid", gap: 6 }}>
        <strong
          style={{
            color: "var(--color-text-primary)",
            fontSize: 15,
          }}
        >
          {title}
        </strong>

        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          {hint}
        </p>
      </div>

      <Link href={actionHref} className="btn-ghost">
        {actionLabel}
      </Link>
    </div>
  );
}

function TimelineItem({
  icon,
  title,
  subtitle,
  time,
  children,
}: {
  icon: string;
  title: string;
  subtitle: string;
  time: string;
  children?: ReactNode;
}) {
  return (
    <article
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "44px minmax(0, 1fr)",
        gap: 13,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "grid",
          justifyItems: "center",
          gap: 8,
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
            background: "rgba(245,158,11,0.10)",
            border: "1px solid rgba(245,158,11,0.25)",
            fontSize: 18,
          }}
        >
          {icon}
        </span>

        <span
          aria-hidden="true"
          style={{
            width: 1,
            minHeight: 34,
            flex: 1,
            background:
              "linear-gradient(180deg, rgba(245,158,11,0.30), transparent)",
          }}
        />
      </div>

      <div
        style={{
          border: "1px solid rgba(245,158,11,0.14)",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02))",
          borderRadius: 18,
          padding: 15,
          display: "grid",
          gap: 11,
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 5,
              minWidth: 0,
            }}
          >
            <strong
              style={{
                color: "var(--color-text-primary)",
                fontSize: 14,
                lineHeight: 1.35,
                wordBreak: "break-word",
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
              {subtitle}
            </span>
          </div>

          <span
            style={{
              color: "var(--color-text-muted)",
              fontSize: 11,
              lineHeight: 1.4,
              whiteSpace: "nowrap",
            }}
          >
            {time}
          </span>
        </div>

        {children}
      </div>
    </article>
  );
}

function ChatPreviewCard({
  role,
  content,
  createdAt,
}: {
  role: string;
  content: string;
  createdAt: Date;
}) {
  const isUser = role === "user";

  return (
    <article
      style={{
        border: isUser
          ? "1px solid rgba(245,158,11,0.22)"
          : "1px solid rgba(46,213,115,0.20)",
        background: isUser
          ? "rgba(245,158,11,0.055)"
          : "rgba(46,213,115,0.050)",
        borderRadius: 18,
        padding: 14,
        display: "grid",
        gap: 9,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          justifyContent: "space-between",
          alignItems: "center",
          minWidth: 0,
        }}
      >
        <span
          style={{
            color: isUser ? "var(--color-amber)" : "var(--color-sage)",
            fontSize: 12,
            fontWeight: 950,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
          }}
        >
          {isUser ? "User" : "AI Finance Team"}
        </span>

        <span
          style={{
            color: "var(--color-text-muted)",
            fontSize: 11,
            whiteSpace: "nowrap",
          }}
        >
          {formatDateTime(createdAt)}
        </span>
      </div>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 13,
          lineHeight: 1.55,
          overflowWrap: "break-word",
        }}
      >
        {shortenText(content, 170)}
      </p>
    </article>
  );
}

function ProfileDetail({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone: Tone;
}) {
  const toneStyle = TONE_STYLES[tone];

  return (
    <div
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: `linear-gradient(135deg, ${toneStyle.softBackground}, rgba(255,255,255,0.018))`,
        borderRadius: 16,
        padding: 12,
        display: "flex",
        gap: 10,
        alignItems: "center",
        minWidth: 0,
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 13,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: toneStyle.background,
          border: `1px solid ${toneStyle.border}`,
          fontSize: 15,
          flex: "0 0 auto",
        }}
      >
        {icon}
      </span>

      <span
        style={{
          display: "grid",
          gap: 3,
          minWidth: 0,
        }}
      >
        <span
          style={{
            color: "var(--color-text-muted)",
            fontSize: 11,
            fontWeight: 850,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </span>

        <strong
          style={{
            color: value === "Not set" ? toneStyle.color : "var(--color-text-primary)",
            fontSize: 13,
            lineHeight: 1.25,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value}
        </strong>
      </span>
    </div>
  );
}

function BusinessContextCard({ business }: { business: BusinessContext }) {
  const completion = getProfileCompletion(business);
  const isComplete = completion >= 100;
  const businessName = displayValue(business?.name);
  const tone: Tone = completion >= 80 ? "green" : completion >= 50 ? "yellow" : "neutral";
  const toneStyle = TONE_STYLES[tone];

  return (
    <section
      style={{
        border: `1px solid ${toneStyle.border}`,
        background:
          "radial-gradient(circle at top left, rgba(245,158,11,0.16), transparent 38%), linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.022))",
        borderRadius: 26,
        padding: 18,
        display: "grid",
        gap: 16,
        boxShadow:
          "0 20px 60px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)",
        overflow: "hidden",
        position: "relative",
        minWidth: 0,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          right: -42,
          top: -42,
          width: 130,
          height: 130,
          borderRadius: "50%",
          background: "rgba(245,158,11,0.10)",
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            minWidth: 0,
          }}
        >
          <span
            style={{
              width: 48,
              height: 48,
              borderRadius: 18,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "linear-gradient(135deg, rgba(245,158,11,0.22), rgba(255,255,255,0.04))",
              border: "1px solid rgba(245,158,11,0.34)",
              fontSize: 22,
              flex: "0 0 auto",
              boxShadow: "0 18px 38px rgba(245,158,11,0.10)",
            }}
          >
            🏢
          </span>

          <div
            style={{
              display: "grid",
              gap: 5,
              minWidth: 0,
            }}
          >
            <span
              style={{
                color: "var(--color-amber)",
                fontSize: 11,
                fontWeight: 950,
                textTransform: "uppercase",
                letterSpacing: "0.10em",
              }}
            >
              Business context
            </span>

            <h3
              style={{
                margin: 0,
                color: "var(--color-text-primary)",
                fontSize: 22,
                lineHeight: 1.1,
                fontWeight: 950,
                wordBreak: "break-word",
              }}
            >
              {businessName}
            </h3>

            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              Used by AI chat, dashboard, and CFO reports.
            </p>
          </div>
        </div>

        <span
          style={{
            border: `1px solid ${toneStyle.border}`,
            background: toneStyle.background,
            color: toneStyle.color,
            borderRadius: 999,
            padding: "7px 9px",
            fontSize: 11,
            fontWeight: 950,
            whiteSpace: "nowrap",
          }}
        >
          {isComplete ? "Ready" : `${completion}%`}
        </span>
      </div>

      <div
        style={{
          position: "relative",
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
            Profile strength
          </span>

          <strong
            style={{
              color: toneStyle.color,
              fontSize: 12,
            }}
          >
            {completion}%
          </strong>
        </div>

        <div
          style={{
            height: 8,
            borderRadius: 999,
            background: "rgba(255,255,255,0.075)",
            border: "1px solid var(--color-border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${completion}%`,
              height: "100%",
              borderRadius: 999,
              background: `linear-gradient(90deg, ${toneStyle.color}, var(--color-amber))`,
              boxShadow: `0 0 24px ${toneStyle.color}`,
            }}
          />
        </div>
      </div>

      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 9,
        }}
      >
        <ProfileDetail
          icon="🏭"
          label="Industry"
          value={displayValue(business?.industry)}
          tone={business?.industry ? "amber" : "yellow"}
        />

        <ProfileDetail
          icon="🏷️"
          label="Business type"
          value={displayValue(business?.businessType)}
          tone={business?.businessType ? "amber" : "yellow"}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 9,
          }}
        >
          <ProfileDetail
            icon="💰"
            label="Currency"
            value={displayValue(business?.currency)}
            tone={business?.currency ? "green" : "yellow"}
          />

          <ProfileDetail
            icon="🌍"
            label="Country"
            value={displayValue(business?.country)}
            tone={business?.country ? "green" : "yellow"}
          />
        </div>

        <ProfileDetail
          icon="📅"
          label="Financial year"
          value={displayValue(business?.financialYear)}
          tone={business?.financialYear ? "green" : "yellow"}
        />
      </div>

      <Link
        href="/business"
        className="btn-ghost"
        style={{
          position: "relative",
          justifyContent: "center",
          border: "1px solid rgba(245,158,11,0.32)",
          background: "rgba(245,158,11,0.09)",
          color: "var(--color-gold)",
        }}
      >
        {isComplete ? "Edit business profile" : "Complete business profile"}
      </Link>
    </section>
  );
}

export default async function ActivityPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { workspace, documentWhere, businessWhere } = await getActiveWorkspaceDataScope(session.user.id);
  const chatWhere = { OR: [{ workspaceId: workspace.id }, { workspaceId: null, userId: session.user.id }] };

  const [
    business,
    totalDocuments,
    approvedDocuments,
    needsReviewDocuments,
    failedDocuments,
    recentDocuments,
    recentChatMessages,
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
      where: { AND: [documentWhere, { status: "FAILED" }] },
    }),
    prisma.document.findMany({
      where: documentWhere,
      orderBy: {
        uploadedAt: "desc",
      },
      take: 8,
      select: {
        id: true,
        fileName: true,
        category: true,
        status: true,
        reviewStatus: true,
        uploadedAt: true,
        extractedAt: true,
        reviewedAt: true,
        processingError: true,
      },
    }),
    prisma.businessChatMessage.findMany({
      where: chatWhere,
      orderBy: {
        createdAt: "desc",
      },
      take: 6,
      select: {
        role: true,
        content: true,
        createdAt: true,
      },
    }),
  ]);

  const businessName = business?.name?.trim() || "Business profile not set";

  return (
    <>
      <style>
        {`
          @media (max-width: 980px) {
            .activity-main-grid {
              grid-template-columns: 1fr !important;
            }

            .activity-hero-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>

      <header
        style={{
          marginBottom: 24,
          border: "1px solid rgba(245,158,11,0.22)",
          background:
            "radial-gradient(circle at top left, rgba(245,158,11,0.15), transparent 35%), linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025))",
          borderRadius: 28,
          padding: 24,
          display: "grid",
          gap: 20,
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="activity-hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.3fr) minmax(300px, 0.7fr)",
            gap: 18,
            alignItems: "start",
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
              Activity center
            </p>

            <h1
              style={{
                margin: 0,
                lineHeight: 1.05,
              }}
            >
              Business operating timeline
            </h1>

            <p
              className="page-intro"
              style={{
                margin: 0,
                lineHeight: 1.65,
                maxWidth: 760,
              }}
            >
              A clean view of uploads, AI processing, approvals, and chat
              activity. Use this page during demo to show that the platform is
              not just a dashboard, but a finance workflow system.
            </p>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 4,
              }}
            >
              <SmallPill
                label="Business"
                value={businessName}
                tone={business?.name ? "green" : "yellow"}
              />

              <SmallPill
                label="Currency"
                value={business?.currency || "Not set"}
                tone={business?.currency ? "green" : "yellow"}
              />

              <SmallPill
                label="Country"
                value={business?.country || "Not set"}
                tone={business?.country ? "amber" : "yellow"}
              />
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(245,158,11,0.14)",
              background: "rgba(0,0,0,0.12)",
              borderRadius: 22,
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 12,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Quick actions
            </p>

            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              <Link href="/documents" className="btn-ghost">
                Review documents
              </Link>

              <Link href="/chat" className="btn-ghost">
                Open AI chat
              </Link>

              <Link href="/dashboard" className="btn-ghost">
                Back to dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <StatCard
          label="Total uploads"
          value={totalDocuments}
          hint="All uploaded files"
          tone="amber"
        />

        <StatCard
          label="Approved"
          value={approvedDocuments}
          hint="Used by dashboard and AI"
          tone={approvedDocuments > 0 ? "green" : "yellow"}
        />

        <StatCard
          label="Needs review"
          value={needsReviewDocuments}
          hint="Processed, pending approval"
          tone={needsReviewDocuments > 0 ? "yellow" : "green"}
        />

        <StatCard
          label="Failed"
          value={failedDocuments}
          hint="Needs retry or replacement"
          tone={failedDocuments > 0 ? "red" : "green"}
        />
      </section>

      <div
        className="activity-main-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.25fr) minmax(340px, 0.75fr)",
          gap: 24,
          alignItems: "start",
        }}
      >
        <section
          className="section-card"
          style={{
            display: "grid",
            gap: 18,
          }}
        >
          <SectionHeader
            title="Document timeline"
            hint="Recent uploads, AI processing, and review decisions."
            action={
              <Link href="/documents" className="btn-ghost">
                View all
              </Link>
            }
          />

          {recentDocuments.length === 0 ? (
            <EmptyState
              icon="📄"
              title="No document activity yet"
              hint="Upload documents or create demo sample data from the dashboard."
              actionHref="/documents"
              actionLabel="Upload documents"
            />
          ) : (
            <div
              style={{
                display: "grid",
                gap: 14,
              }}
            >
              {recentDocuments.map((document) => {
                const eventTime =
                  document.reviewedAt ??
                  document.extractedAt ??
                  document.uploadedAt;

                const timeLabel = document.reviewedAt
                  ? "Reviewed"
                  : document.extractedAt
                    ? "Processed"
                    : "Uploaded";

                return (
                  <TimelineItem
                    key={document.id}
                    icon={getDocumentIcon(document.fileName, document.category)}
                    title={document.fileName}
                    subtitle={`${formatDocumentCategory(
                      document.category,
                    )} · ${timeLabel} ${formatDateTime(eventTime)}`}
                    time={formatDateTime(document.uploadedAt)}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <StatusPill label={document.status} />
                      <StatusPill label={document.reviewStatus} />

                      <Link
                        href={`/documents/${document.id}`}
                        style={{
                          color: "var(--color-amber)",
                          fontSize: 12,
                          fontWeight: 950,
                          textDecoration: "none",
                          marginLeft: "auto",
                        }}
                      >
                        Details →
                      </Link>
                    </div>

                    {document.processingError && (
                      <p
                        style={{
                          margin: 0,
                          color: "var(--color-danger)",
                          fontSize: 12,
                          lineHeight: 1.45,
                        }}
                      >
                        {document.processingError}
                      </p>
                    )}
                  </TimelineItem>
                );
              })}
            </div>
          )}
        </section>

        <aside
          style={{
            display: "grid",
            gap: 24,
          }}
        >
          <section
            className="section-card"
            style={{
              display: "grid",
              gap: 16,
            }}
          >
            <SectionHeader
              title="Recent AI chat"
              hint="Latest messages from AI Business Chat."
              action={
                <Link href="/chat" className="btn-ghost">
                  Continue
                </Link>
              }
            />

            {recentChatMessages.length === 0 ? (
              <EmptyState
                icon="🤖"
                title="No AI chat yet"
                hint="Ask the AI Finance Team a question after approving documents."
                actionHref="/chat"
                actionLabel="Open chat"
              />
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 12,
                }}
              >
                {recentChatMessages.map((message, index) => (
                  <ChatPreviewCard
                    key={`${message.createdAt.toISOString()}-${index}`}
                    role={message.role}
                    content={message.content}
                    createdAt={message.createdAt}
                  />
                ))}
              </div>
            )}
          </section>

          <BusinessContextCard business={business} />
        </aside>
      </div>
    </>
  );
}