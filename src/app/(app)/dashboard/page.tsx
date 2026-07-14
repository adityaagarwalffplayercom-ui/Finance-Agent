import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceDataScope } from "@/lib/active-workspace-data";
import { getLedgerDataConfidence } from "@/lib/ledger-data-confidence";
import { getFinancialProfile } from "@/lib/ledger-financial-profile";

type Tone = "good" | "warning" | "danger" | "neutral" | "gold";

type DashboardDocument = {
  id: string;
  fileName: string;
  category: string;
  status: string;
  reviewStatus: string | null;
  uploadedAt: Date;
};

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
    gold: {
      color: "var(--color-gold)",
      border: "rgba(245,158,11,0.32)",
      background: "rgba(245,158,11,0.10)",
    },
    neutral: {
      color: "var(--color-text-secondary)",
      border: "var(--color-border)",
      background: "rgba(255,255,255,0.045)",
    },
  }[tone];
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const clean = value
    .replace(/,/g, "")
    .replace(/Rs\./gi, "")
    .replace(/[₹$€£]/g, "")
    .trim();

  if (!clean || clean === "—" || clean === "Not available") {
    return null;
  }

  const isParenthesesNegative = /^\(.*\)$/.test(clean);
  const match = clean.match(/-?\d+(\.\d+)?/);

  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const lower = clean.toLowerCase();
  let multiplier = 1;

  if (lower.includes("crore") || lower.includes(" cr")) {
    multiplier = 10_000_000;
  } else if (lower.includes("lakh") || lower.includes(" lac")) {
    multiplier = 100_000;
  } else if (lower.includes("b")) {
    multiplier = 1_000_000_000;
  } else if (lower.includes("m")) {
    multiplier = 1_000_000;
  } else if (lower.includes("k")) {
    multiplier = 1_000;
  }

  const signed = isParenthesesNegative ? -Math.abs(parsed) : parsed;

  return signed * multiplier;
}

function compactNumber(value: number) {
  const absolute = Math.abs(value);

  if (absolute >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }

  if (absolute >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (absolute >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }

  return `${Math.round(value)}`;
}

function currencySymbol(currency: string) {
  const clean = currency.trim().toUpperCase();

  if (clean === "INR") return "Rs. ";
  if (clean === "USD" || currency.trim() === "$") return "$";
  if (clean === "GBP") return "GBP ";
  if (clean === "EUR") return "EUR ";

  return currency ? `${currency} ` : "";
}

function formatMoney(value: number | null, currency: string) {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }

  const sign = value < 0 ? "-" : "";

  return `${sign}${currencySymbol(currency)}${compactNumber(Math.abs(value))}`;
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }

  return `${value.toFixed(1)}%`;
}

function getProfitTone(profit: number | null): Tone {
  if (profit === null) return "neutral";
  return profit >= 0 ? "good" : "danger";
}

function getRatioTone(value: number | null, goodBelow = 80): Tone {
  if (value === null) return "neutral";
  if (value <= goodBelow) return "good";
  if (value <= 100) return "warning";
  return "danger";
}

function getDocumentTrustTone(approved: number, processed: number): Tone {
  if (processed === 0) return "warning";
  const ratio = approved / processed;

  if (ratio >= 0.8) return "good";
  if (ratio >= 0.45) return "warning";
  return "danger";
}

function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: Tone;
}) {
  const style = toneStyle(tone);

  return (
    <article
      style={{
        border: `1px solid ${style.border}`,
        background: style.background,
        borderRadius: 22,
        padding: 18,
        display: "grid",
        gap: 11,
        minWidth: 0,
        boxShadow: "0 18px 50px rgba(0,0,0,0.14)",
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
          fontSize: "clamp(26px, 3vw, 40px)",
          lineHeight: 1,
          fontWeight: 950,
          letterSpacing: "-0.065em",
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
          fontWeight: 850,
        }}
      >
        {hint}
      </span>
    </article>
  );
}

function QuickAction({
  title,
  detail,
  href,
  tone = "neutral",
}: {
  title: string;
  detail: string;
  href: string;
  tone?: Tone;
}) {
  const style = toneStyle(tone);

  return (
    <Link
      href={href}
      style={{
        border: `1px solid ${style.border}`,
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.022))",
        borderRadius: 20,
        padding: 16,
        display: "grid",
        gap: 10,
        color: "inherit",
        textDecoration: "none",
        minWidth: 0,
        boxShadow: "0 16px 46px rgba(0,0,0,0.14)",
      }}
    >
      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: 17,
          lineHeight: 1.22,
        }}
      >
        {title}
      </strong>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {detail}
      </p>

      <span
        style={{
          color: style.color,
          fontSize: 12,
          fontWeight: 950,
        }}
      >
        Open {"->"}
      </span>
    </Link>
  );
}

function AgentCard({
  name,
  role,
  href,
  tone,
}: {
  name: string;
  role: string;
  href: string;
  tone: Tone;
}) {
  const style = toneStyle(tone);

  return (
    <Link
      href={href}
      style={{
        border: `1px solid ${style.border}`,
        background: style.background,
        borderRadius: 18,
        padding: 15,
        display: "grid",
        gap: 8,
        color: "inherit",
        textDecoration: "none",
        minWidth: 0,
      }}
    >
      <span
        style={{
          color: style.color,
          fontSize: 11,
          fontWeight: 950,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        AI Agent
      </span>

      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: 16,
          lineHeight: 1.25,
        }}
      >
        {name}
      </strong>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 12,
          lineHeight: 1.55,
        }}
      >
        {role}
      </p>
    </Link>
  );
}

function SectionHeader({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
}) {
  return (
    <div>
      <p className="eyebrow" style={{ margin: 0 }}>
        {eyebrow}
      </p>

      <h2
        style={{
          margin: "8px 0 0",
          color: "var(--color-text-primary)",
          fontSize: 24,
          lineHeight: 1.15,
          letterSpacing: "-0.03em",
        }}
      >
        {title}
      </h2>

      {detail ? (
        <p
          style={{
            margin: "8px 0 0",
            color: "var(--color-text-secondary)",
            fontSize: 13,
            lineHeight: 1.65,
            maxWidth: 760,
          }}
        >
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: Tone;
}) {
  const style = toneStyle(tone);

  return (
    <span
      style={{
        border: `1px solid ${style.border}`,
        background: style.background,
        color: style.color,
        borderRadius: 999,
        padding: "7px 10px",
        fontSize: 11,
        lineHeight: 1,
        fontWeight: 950,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

function RecentDocumentRow({ document }: { document: DashboardDocument }) {
  const approved = String(document.reviewStatus) === "APPROVED";
  const failed = String(document.status) === "FAILED";
  const tone: Tone = failed ? "danger" : approved ? "good" : "warning";

  return (
    <Link
      href={`/documents/${document.id}`}
      style={{
        border: "1px solid rgba(255,255,255,0.09)",
        background: "rgba(255,255,255,0.035)",
        borderRadius: 16,
        padding: 13,
        display: "flex",
        justifyContent: "space-between",
        gap: 14,
        alignItems: "center",
        flexWrap: "wrap",
        color: "inherit",
        textDecoration: "none",
      }}
    >
      <span
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
          {document.category} - {new Date(document.uploadedAt).toLocaleDateString()}
        </span>
      </span>

      <StatusPill
        label={`${document.status} / ${document.reviewStatus ?? "UNREVIEWED"}`}
        tone={tone}
      />
    </Link>
  );
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const userId = session.user.id;
  const { documentWhere, businessWhere } = await getActiveWorkspaceDataScope(userId);

  const [
    profile,
    dataConfidence,
    business,
    documents,
    totalDocuments,
    processedDocuments,
    approvedDocuments,
    failedDocuments,
    demoDocuments,
  ] = await Promise.all([
    getFinancialProfile(userId),
    getLedgerDataConfidence(userId),
    prisma.business.findFirst({
      where: businessWhere,
      select: {
        name: true,
        industry: true,
        businessType: true,
        financialYear: true,
        currency: true,
        country: true,
      },
    }),
    prisma.document.findMany({
      where: documentWhere,
      select: {
        id: true,
        fileName: true,
        category: true,
        status: true,
        reviewStatus: true,
        uploadedAt: true,
      },
      orderBy: {
        uploadedAt: "desc",
      },
      take: 8,
    }),
    prisma.document.count({
      where: documentWhere,
    }),
    prisma.document.count({
      where: { AND: [documentWhere, { status: "PROCESSED" }] },
    }),
    prisma.document.count({
      where: { AND: [documentWhere, { reviewStatus: "APPROVED" }] },
    }),
    prisma.document.count({
      where: { AND: [documentWhere, { status: "FAILED" }] },
    }),
    prisma.document.count({
      where: { AND: [documentWhere, { fileName: { startsWith: "[DEMO]" } }] },
    }),
  ]);

  const currency = business?.currency || "INR";

  const revenue = toNumber(profile.revenue.value);
  const expenses = toNumber(profile.expenses.value);
  let profit = toNumber(profile.profit.value);
  const cash = toNumber(profile.cash.value);

  if (profit === null && revenue !== null && expenses !== null) {
    profit = revenue - expenses;
  }

  const profitMargin =
    revenue !== null && revenue > 0 && profit !== null
      ? (profit / revenue) * 100
      : null;

  const expenseRatio =
    revenue !== null && revenue > 0 && expenses !== null
      ? (expenses / revenue) * 100
      : null;

  const monthlyBurn =
    profit !== null && profit < 0
      ? Math.abs(profit / 12)
      : expenses !== null
        ? expenses / 12
        : null;

  const runway =
    cash !== null && monthlyBurn !== null && monthlyBurn > 0
      ? cash / monthlyBurn
      : null;

  const healthTone: Tone =
    profile.healthScore >= 75
      ? "good"
      : profile.healthScore >= 50
        ? "warning"
        : "danger";

  
  const confidenceTone: Tone =
    dataConfidence.level === "HIGH"
      ? "good"
      : dataConfidence.level === "MEDIUM"
        ? "warning"
        : "danger";
const documentTone = getDocumentTrustTone(approvedDocuments, processedDocuments);

  const ownerFocus =
    profit !== null && profit < 0
      ? "Fix loss before scaling"
      : runway !== null && runway < 3
        ? "Protect cash runway"
        : approvedDocuments < 2
          ? "Approve more documents"
          : "Monitor growth and risk";

  const ownerFocusTone: Tone =
    profit !== null && profit < 0
      ? "danger"
      : runway !== null && runway < 3
        ? "danger"
        : approvedDocuments < 2
          ? "warning"
          : "good";

  return (
    <main>
      <header
        style={{
          marginBottom: 24,
          border: "1px solid rgba(245,158,11,0.24)",
          background:
            "radial-gradient(circle at top left, rgba(245,158,11,0.20), transparent 34%), radial-gradient(circle at bottom right, rgba(46,213,115,0.10), transparent 30%), linear-gradient(135deg, rgba(255,255,255,0.070), rgba(255,255,255,0.026))",
          borderRadius: 34,
          padding: 28,
          display: "grid",
          gap: 20,
          boxShadow:
            "0 28px 90px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.07)",
          overflow: "hidden",
          minWidth: 0,
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
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              Executive Command Center
            </p>

            <h1
              style={{
                margin: "12px 0 0",
                color: "var(--color-text-primary)",
                fontSize: "clamp(42px, 6vw, 84px)",
                lineHeight: 0.94,
                letterSpacing: "-0.085em",
                maxWidth: 1040,
              }}
            >
              {business?.name || "Actic Finance Finance Dashboard"}
            </h1>

            <p
              className="page-intro"
              style={{
                margin: "16px 0 0",
                lineHeight: 1.7,
                maxWidth: 880,
              }}
            >
              Live executive view of financial health, trusted documents,
              runway, risks, decisions, forecasts, and AI finance agents.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <Link href="/demo" className="btn-ghost">
              User Demo {"->"}
            </Link>

            <Link href="/documents" className="btn-ghost">
              Upload Documents {"->"}
            </Link>

            <Link href="/chat?agent=team" className="btn-ghost">
              Ask AI Team {"->"}
            </Link>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <StatusPill
            label={`Health ${profile.healthScore}/100`}
            tone={healthTone}
          />
          <StatusPill label={profile.healthLabel} tone={healthTone} />
          <StatusPill
            label={`Data confidence ${dataConfidence.score}/100`}
            tone={confidenceTone}
          />
          <StatusPill
            label={`${approvedDocuments} approved docs`}
            tone={documentTone}
          />
          <StatusPill
            label={demoDocuments > 0 ? "Demo data active" : "Live user data"}
            tone={demoDocuments > 0 ? "gold" : "neutral"}
          />
          <StatusPill
            label={business?.financialYear || "FY not set"}
            tone="neutral"
          />
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
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          <MetricCard
            label="Revenue"
            value={formatMoney(revenue, currency)}
            hint={profile.revenue.delta || "Approved revenue signal"}
            tone="good"
          />

          <MetricCard
            label="Expenses"
            value={formatMoney(expenses, currency)}
            hint={profile.expenses.delta || "Approved expense signal"}
            tone={getRatioTone(expenseRatio)}
          />

          <MetricCard
            label="Profit / Loss"
            value={formatMoney(profit, currency)}
            hint={`Margin: ${formatPercent(profitMargin)}`}
            tone={getProfitTone(profit)}
          />

          <MetricCard
            label="Cash runway"
            value={runway === null ? "Not available" : `${runway.toFixed(1)} months`}
            hint={`Cash: ${formatMoney(cash, currency)}`}
            tone={
              runway === null
                ? "neutral"
                : runway >= 6
                  ? "good"
                  : runway >= 3
                    ? "warning"
                    : "danger"
            }
          />
        </div>

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
              gap: 16,
            }}
          >
            <SectionHeader
              eyebrow="Owner priority"
              title={ownerFocus}
              detail="Actic Finance combines profit, cash, document trust, and risk signals to show what the owner should focus on first."
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              <MetricCard
                label="Health score"
                value={`${profile.healthScore}/100`}
                hint={profile.healthLabel}
                tone={healthTone}
              />
              <MetricCard
                label="Data confidence"
                value={`${dataConfidence.score}/100`}
                hint={`${dataConfidence.label} · ${dataConfidence.historyMonths} month(s) · ${dataConfidence.pendingEntries} pending`}
                tone={confidenceTone}
              />


              <MetricCard
                label="Document trust"
                value={`${approvedDocuments}/${Math.max(processedDocuments, 1)}`}
                hint={`${failedDocuments} failed document(s)`}
                tone={documentTone}
              />

              <MetricCard
                label="Monthly burn"
                value={formatMoney(monthlyBurn, currency)}
                hint="Estimated monthly cash need"
                tone={
                  profit !== null && profit < 0
                    ? "danger"
                    : monthlyBurn !== null
                      ? "warning"
                      : "neutral"
                }
              />
            </div>

            <div
              style={{
                border: `1px solid ${toneStyle(ownerFocusTone).border}`,
                background: toneStyle(ownerFocusTone).background,
                borderRadius: 18,
                padding: 15,
                display: "grid",
                gap: 8,
              }}
            >
              <strong
                style={{
                  color: "var(--color-text-primary)",
                  fontSize: 16,
                }}
              >
                Recommended next move
              </strong>

              <p
                style={{
                  margin: 0,
                  color: "var(--color-text-secondary)",
                  fontSize: 13,
                  lineHeight: 1.65,
                }}
              >
                Open Decision Center to get ranked actions for today, this
                week, and this month based on your financial signals.
              </p>

              <Link
                href="/decision-center"
                style={{
                  color: toneStyle(ownerFocusTone).color,
                  fontSize: 13,
                  fontWeight: 950,
                  textDecoration: "none",
                }}
              >
                Open Decision Center {"->"}
              </Link>
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
            <SectionHeader
              eyebrow="Quick actions"
              title="Run the executive workflow"
            />

            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              <QuickAction
                title="Start user demo"
                detail="Seed sample business data and explore the full product."
                href="/demo"
                tone="gold"
              />

              <QuickAction
                title="Forecast what-if"
                detail="See predictive analytics for 3, 6, and 12 months."
                href="/forecast"
                tone="good"
              />

              <QuickAction
                title="Cash flow runway"
                detail="Check burn, runway, inflows, outflows, and cash gap."
                href="/cash-flow"
                tone="warning"
              />

              <QuickAction
                title="Risk score"
                detail="Review financial risk and unsafe decision signals."
                href="/risk-score"
                tone="danger"
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
          <SectionHeader
            eyebrow="AI executive team"
            title="Specialized agents connected to your finance data"
            detail="Each agent focuses on one business problem, while AI Team gives the combined executive answer."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 12,
            }}
          >
            <AgentCard
              name="AI Finance Team"
              role="Combined CFO, accountant, analyst, tax, risk, and consultant view."
              href="/chat?agent=team"
              tone="gold"
            />
            <AgentCard
              name="CFO Agent"
              role="Profit, break-even, hiring, and owner-level decisions."
              href="/chat?agent=cfo"
              tone="good"
            />
            <AgentCard
              name="Cash Flow Agent"
              role="Runway, burn, liquidity, inflows, and outflows."
              href="/chat?agent=cashflow"
              tone="warning"
            />
            <AgentCard
              name="Risk Agent"
              role="Red flags, missing data, losses, and unsafe decisions."
              href="/chat?agent=risk"
              tone="danger"
            />
            <AgentCard
              name="Tax Agent"
              role="Tax readiness, GST checklist, and CA verification."
              href="/chat?agent=tax"
              tone="gold"
            />
            <AgentCard
              name="Analyst Agent"
              role="Line items, anomalies, trends, and cost patterns."
              href="/chat?agent=analyst"
              tone="neutral"
            />
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
          <SectionHeader
            eyebrow="Intelligence modules"
            title="Your finance engines"
            detail="Jump directly into the modules powering the executive dashboard."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 14,
            }}
          >
            <QuickAction
              title="Document Check"
              detail="Find missing documents and weak extraction quality."
              href="/document-completeness"
              tone="warning"
            />
            <QuickAction
              title="Anomaly Insights"
              detail="Find unusual expenses, duplicates, and risky line items."
              href="/anomaly-insights"
              tone="danger"
            />
            <QuickAction
              title="CFO Decisions"
              detail="Break-even, expense reduction, hiring, and profit actions."
              href="/cfo-decisions"
              tone="good"
            />
            <QuickAction
              title="Decision Center"
              detail="One ranked owner action plan for today, week, and month."
              href="/decision-center"
              tone="gold"
            />
            <QuickAction
              title="Learning Center"
              detail="Feedback reward loop that improves recommendations."
              href="/learning-center"
              tone="good"
            />
            <QuickAction
              title="Tax Coverage"
              detail="Tax source readiness and verification coverage."
              href="/tax-coverage"
              tone="warning"
            />
          </div>
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 0.78fr)",
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
            <SectionHeader
              eyebrow="Recent documents"
              title="Latest trusted data sources"
              detail="Approved processed documents power Actic Finance’s dashboard and agents."
            />

            {documents.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gap: 10,
                }}
              >
                {documents.map((document) => (
                  <RecentDocumentRow
                    key={document.id}
                    document={{
                      id: document.id,
                      fileName: document.fileName,
                      category: String(document.category),
                      status: String(document.status),
                      reviewStatus: document.reviewStatus
                        ? String(document.reviewStatus)
                        : null,
                      uploadedAt: document.uploadedAt,
                    }}
                  />
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
                No documents yet. Upload documents or start User Demo Mode.
              </p>
            )}
          </section>

          <section
            className="section-card"
            style={{
              padding: 22,
              display: "grid",
              gap: 14,
            }}
          >
            <SectionHeader
              eyebrow="Business profile"
              title="Current setup"
            />

            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              {[
                ["Industry", business?.industry || "Not set"],
                ["Business type", business?.businessType || "Not set"],
                ["Country", business?.country || "Not set"],
                ["Currency", currency],
                ["Financial year", business?.financialYear || "Not set"],
                ["Documents", `${totalDocuments} total file(s)`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.035)",
                    borderRadius: 14,
                    padding: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      color: "var(--color-text-secondary)",
                      fontSize: 12,
                      fontWeight: 850,
                    }}
                  >
                    {label}
                  </span>

                  <strong
                    style={{
                      color: "var(--color-text-primary)",
                      fontSize: 13,
                      textAlign: "right",
                    }}
                  >
                    {value}
                  </strong>
                </div>
              ))}
            </div>

            <Link href="/business" className="btn-ghost">
              Update Business Profile {"->"}
            </Link>
          </section>
        </div>
      </section>
    </main>
  );
}