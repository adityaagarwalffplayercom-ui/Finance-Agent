import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getFinancialProfile,
  type Alert,
  type StatBlock,
} from "@/lib/financial-profile";

type Tone = "sage" | "amber" | "gold" | "danger" | "neutral";

type AgentCardData = {
  id: string;
  icon: string;
  name: string;
  role: string;
  insight: string;
  tone: Tone;
};

type ChartMetric = {
  label: string;
  value: number | null;
  displayValue: string;
  tone: Tone;
};

function getToneStyle(tone: Tone) {
  return {
    sage: {
      color: "var(--color-sage)",
      border: "rgba(46,213,115,0.28)",
      background: "rgba(46,213,115,0.085)",
      glow: "rgba(46,213,115,0.12)",
    },
    amber: {
      color: "var(--color-amber)",
      border: "rgba(245,158,11,0.30)",
      background: "rgba(245,158,11,0.095)",
      glow: "rgba(245,158,11,0.13)",
    },
    gold: {
      color: "var(--color-gold)",
      border: "rgba(255,209,102,0.30)",
      background: "rgba(255,209,102,0.085)",
      glow: "rgba(255,209,102,0.12)",
    },
    danger: {
      color: "var(--color-danger)",
      border: "rgba(255,138,149,0.30)",
      background: "rgba(255,138,149,0.085)",
      glow: "rgba(255,138,149,0.10)",
    },
    neutral: {
      color: "var(--color-text-secondary)",
      border: "var(--color-border)",
      background: "rgba(255,255,255,0.045)",
      glow: "rgba(255,255,255,0.06)",
    },
  }[tone];
}

function normalizeValue(value: string) {
  if (!value || value.trim() === "" || value === "â€”") {
    return "Not available";
  }

  return value;
}

function displayValue(value?: string | null) {
  return value && value.trim().length > 0 ? value.trim() : "Not set";
}

function getGreetingName(value?: string | null) {
  if (!value) return "there";

  const cleanValue = value.trim();
  const name = cleanValue.includes("@") ? cleanValue.split("@")[0] : cleanValue;

  return name || "there";
}

function getAlertTone(severity: Alert["severity"]): Tone {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "gold";
  return "sage";
}

function getAlertLabel(severity: Alert["severity"]) {
  if (severity === "critical") return "Critical";
  if (severity === "warning") return "Warning";
  return "Info";
}

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "0";

  const absolute = Math.abs(value);

  if (absolute >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }

  if (absolute >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (absolute >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return `${Math.round(value)}`;
}

function formatMoneyShort(value: number | null, currency: string) {
  if (value === null || !Number.isFinite(value)) {
    return "Not available";
  }

  const sign = value < 0 ? "-" : "";
  const prefix = currency && currency !== "Not set" ? `${currency} ` : "";

  return `${sign}${prefix}${formatCompactNumber(Math.abs(value))}`;
}

function parseMetricValue(value: string) {
  if (!value || value === "â€”" || value === "Not available") {
    return null;
  }

  const clean = value.replace(/,/g, "").trim();
  const numberMatch = clean.match(/-?\d+(\.\d+)?/);

  if (!numberMatch) {
    return null;
  }

  const baseValue = Number(numberMatch[0]);

  if (!Number.isFinite(baseValue)) {
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

  return baseValue * multiplier;
}

function buildLinePath(values: number[], width: number, height: number) {
  const paddingX = 20;
  const paddingY = 18;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x =
        values.length === 1
          ? width / 2
          : paddingX +
            (index / (values.length - 1)) * (width - paddingX * 2);

      const y =
        height -
        paddingY -
        ((value - min) / range) * (height - paddingY * 2);

      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(values: number[], width: number, height: number) {
  const linePath = buildLinePath(values, width, height);
  const paddingX = 20;

  return `${linePath} L ${width - paddingX} ${height - 18} L ${paddingX} ${
    height - 18
  } Z`;
}

function SectionHeading({
  eyebrow,
  title,
  hint,
  action,
}: {
  eyebrow?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
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
      <div
        style={{
          display: "grid",
          gap: 6,
          minWidth: 0,
        }}
      >
        {eyebrow ? (
          <p className="eyebrow" style={{ margin: 0 }}>
            {eyebrow}
          </p>
        ) : null}

        <h2
          style={{
            margin: 0,
            color: "var(--color-text-primary)",
            fontSize: 22,
            lineHeight: 1.15,
            fontWeight: 950,
            letterSpacing: "-0.045em",
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </h2>

        {hint ? (
          <p
            className="section-hint"
            style={{
              margin: 0,
              lineHeight: 1.55,
              maxWidth: 760,
            }}
          >
            {hint}
          </p>
        ) : null}
      </div>

      {action}
    </div>
  );
}

function HeroBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const toneStyle = getToneStyle(tone);

  return (
    <span
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: toneStyle.background,
        color: toneStyle.color,
        borderRadius: 999,
        padding: "9px 12px",
        fontSize: 11,
        fontWeight: 950,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function DashboardStatCard({
  label,
  stat,
  tone,
}: {
  label: string;
  stat: StatBlock;
  tone: Tone;
}) {
  const toneStyle = getToneStyle(tone);
  const value = normalizeValue(stat.value);

  return (
    <article
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: `linear-gradient(135deg, ${toneStyle.background}, rgba(255,255,255,0.024))`,
        borderRadius: 24,
        padding: 18,
        display: "grid",
        gap: 12,
        minHeight: 150,
        minWidth: 0,
        overflow: "hidden",
        boxShadow: `0 18px 48px ${toneStyle.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`,
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
          color: toneStyle.color,
          fontSize: 12,
          lineHeight: 1.45,
          fontWeight: 800,
          overflowWrap: "anywhere",
        }}
      >
        {stat.delta}
      </span>
    </article>
  );
}

function HealthScoreCard({
  score,
  label,
  hasData,
}: {
  score: number;
  label: string;
  hasData: boolean;
}) {
  const safeScore = Math.max(0, Math.min(score, 100));
  const tone: Tone = !hasData
    ? "neutral"
    : safeScore >= 75
      ? "sage"
      : safeScore >= 45
        ? "gold"
        : "danger";

  const toneStyle = getToneStyle(tone);

  const statusText = !hasData
    ? "Waiting for data"
    : safeScore >= 75
      ? "Strong position"
      : safeScore >= 45
        ? "Needs attention"
        : "High risk";

  return (
    <article
      style={{
        border: `1px solid ${toneStyle.border}`,
        background:
          "radial-gradient(circle at 18% 10%, rgba(245,158,11,0.16), transparent 30%), radial-gradient(circle at 90% 20%, rgba(46,213,115,0.10), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.064), rgba(255,255,255,0.024))",
        borderRadius: 30,
        padding: 22,
        minHeight: 285,
        display: "grid",
        gap: 18,
        minWidth: 0,
        overflow: "hidden",
        boxShadow:
          "0 24px 90px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.065)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 6,
            minWidth: 0,
          }}
        >
          <p
            style={{
              margin: 0,
              color: "var(--color-text-secondary)",
              fontSize: 12,
              fontWeight: 950,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Finance health
          </p>

          <h2
            style={{
              margin: 0,
              color: "var(--color-text-primary)",
              fontSize: 22,
              lineHeight: 1.15,
              fontWeight: 950,
              letterSpacing: "-0.045em",
            }}
          >
            {statusText}
          </h2>
        </div>

        <span
          style={{
            border: `1px solid ${toneStyle.border}`,
            background: toneStyle.background,
            color: toneStyle.color,
            borderRadius: 999,
            padding: "8px 11px",
            fontSize: 11,
            lineHeight: 1,
            fontWeight: 950,
            whiteSpace: "nowrap",
          }}
        >
          {hasData ? "Live score" : "No trusted data"}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "180px minmax(0, 1fr)",
          gap: 18,
          alignItems: "center",
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: 176,
            height: 176,
            borderRadius: "50%",
            padding: 10,
            background: `conic-gradient(${toneStyle.color} ${
              safeScore * 3.6
            }deg, rgba(255,255,255,0.075) 0deg)`,
            boxShadow: `0 22px 70px ${toneStyle.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background:
                "radial-gradient(circle at 35% 25%, rgba(255,255,255,0.08), transparent 30%), rgba(9,13,20,0.94)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                textAlign: "center",
                display: "grid",
                gap: 2,
              }}
            >
              <strong
                style={{
                  color: "var(--color-text-primary)",
                  fontSize: 54,
                  lineHeight: 0.95,
                  fontWeight: 950,
                  letterSpacing: "-0.08em",
                }}
              >
                {safeScore}
              </strong>

              <span
                style={{
                  color: "var(--color-text-secondary)",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                /100
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            minWidth: 0,
          }}
        >
          <p
            style={{
              margin: 0,
              color: toneStyle.color,
              fontSize: 15,
              lineHeight: 1.55,
              fontWeight: 900,
              overflowWrap: "anywhere",
            }}
          >
            {label}
          </p>

          <p
            style={{
              margin: 0,
              color: "var(--color-text-secondary)",
              fontSize: 13,
              lineHeight: 1.65,
              overflowWrap: "anywhere",
            }}
          >
            Score is calculated from approved financial documents only. Pending
            and rejected files are excluded from this health signal.
          </p>

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
                color: "var(--color-text-muted)",
                fontSize: 11,
                fontWeight: 850,
              }}
            >
              <span>Risk</span>
              <span>Stable</span>
              <span>Strong</span>
            </div>

            <div
              style={{
                height: 9,
                borderRadius: 999,
                background:
                  "linear-gradient(90deg, var(--color-danger), var(--color-gold), var(--color-sage))",
                opacity: 0.92,
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: `calc(${safeScore}% - 7px)`,
                  top: -5,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: toneStyle.color,
                  border: "3px solid rgba(9,13,20,0.95)",
                  boxShadow: `0 0 0 5px ${toneStyle.glow}`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function MiniTrustCard({
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
  const toneStyle = getToneStyle(tone);

  return (
    <article
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: toneStyle.background,
        borderRadius: 20,
        padding: 16,
        display: "grid",
        gap: 8,
        minWidth: 0,
        overflow: "hidden",
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
          fontWeight: 950,
          letterSpacing: "-0.055em",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </strong>

      <span
        style={{
          color: toneStyle.color,
          fontSize: 12,
          lineHeight: 1.45,
          fontWeight: 800,
          overflowWrap: "anywhere",
        }}
      >
        {hint}
      </span>
    </article>
  );
}

function FinanceMetricCard({
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
    <article
      style={{
        border: `1px solid ${toneStyle.border}`,
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.050), rgba(255,255,255,0.024))",
        borderRadius: 20,
        padding: 16,
        display: "grid",
        gap: 8,
        minWidth: 0,
        overflow: "hidden",
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
          fontSize: "clamp(22px, 2.6vw, 31px)",
          lineHeight: 1,
          fontWeight: 950,
          letterSpacing: "-0.055em",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </strong>

      <span
        style={{
          color: toneStyle.color,
          fontSize: 12,
          lineHeight: 1.45,
          fontWeight: 800,
          overflowWrap: "anywhere",
        }}
      >
        {hint}
      </span>
    </article>
  );
}

function ActionRow({
  title,
  hint,
  href,
  tone,
}: {
  title: string;
  hint: string;
  href: string;
  tone: Tone;
}) {
  const toneStyle = getToneStyle(tone);

  return (
    <Link
      href={href}
      style={{
        border: `1px solid ${toneStyle.border}`,
        background: toneStyle.background,
        color: "inherit",
        borderRadius: 18,
        padding: 14,
        display: "flex",
        justifyContent: "space-between",
        gap: 14,
        alignItems: "center",
        textDecoration: "none",
        minWidth: 0,
      }}
    >
      <span
        style={{
          display: "grid",
          gap: 4,
          minWidth: 0,
        }}
      >
        <strong
          style={{
            color: "var(--color-text-primary)",
            fontSize: 14,
            lineHeight: 1.25,
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </strong>

        <span
          style={{
            color: "var(--color-text-secondary)",
            fontSize: 12,
            lineHeight: 1.45,
            overflowWrap: "anywhere",
          }}
        >
          {hint}
        </span>
      </span>

      <span
        style={{
          color: toneStyle.color,
          fontWeight: 950,
          flex: "0 0 auto",
        }}
      >
        -&gt;
      </span>
    </Link>
  );
}

function MetricBarChart({
  metrics,
  currency,
}: {
  metrics: ChartMetric[];
  currency: string;
}) {
  const availableMetrics = metrics.filter((metric) => metric.value !== null);
  const maxValue = Math.max(
    ...availableMetrics.map((metric) => Math.abs(metric.value ?? 0)),
    1,
  );

  return (
    <section
      className="section-card"
      style={{
        padding: 22,
        display: "grid",
        gap: 18,
        overflow: "hidden",
        minHeight: 360,
        background:
          "radial-gradient(circle at 10% 0%, rgba(245,158,11,0.10), transparent 30%), linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.022))",
      }}
    >
      <SectionHeading
        eyebrow="Chart"
        title="Finance metric comparison"
        hint="A quick visual comparison of revenue, expenses, profit, and cash."
      />

      {availableMetrics.length === 0 ? (
        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          Not enough approved financial data to draw this chart yet.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 14,
          }}
        >
          {metrics.map((metric) => {
            const toneStyle = getToneStyle(metric.tone);
            const value = metric.value ?? 0;
            const width = Math.max(4, (Math.abs(value) / maxValue) * 100);
            const isNegative = value < 0;

            return (
              <div
                key={metric.label}
                style={{
                  display: "grid",
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    color: "var(--color-text-secondary)",
                    fontSize: 12,
                    fontWeight: 850,
                  }}
                >
                  <span>{metric.label}</span>
                  <span>{metric.displayValue}</span>
                </div>

                <div
                  style={{
                    height: 16,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.075)",
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      width: `${width}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: isNegative
                        ? "linear-gradient(90deg, var(--color-danger), rgba(255,138,149,0.35))"
                        : `linear-gradient(90deg, ${toneStyle.color}, rgba(255,255,255,0.18))`,
                      boxShadow: `0 10px 34px ${toneStyle.glow}`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p
        style={{
          margin: 0,
          color: "var(--color-text-muted)",
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        Values are normalized visually for comparison. Currency context:{" "}
        {currency}.
      </p>
    </section>
  );
}

function RevenueExpenseDonut({
  revenue,
  expenses,
  currency,
}: {
  revenue: number | null;
  expenses: number | null;
  currency: string;
}) {
  const safeRevenue = Math.max(0, revenue ?? 0);
  const safeExpenses = Math.max(0, expenses ?? 0);
  const total = safeRevenue + safeExpenses;
  const revenueShare = total > 0 ? (safeRevenue / total) * 100 : 0;
  const expensesShare = total > 0 ? (safeExpenses / total) * 100 : 0;

  return (
    <section
      className="section-card"
      style={{
        padding: 22,
        display: "grid",
        gap: 18,
        minHeight: 360,
        overflow: "hidden",
        background:
          "radial-gradient(circle at 85% 0%, rgba(46,213,115,0.10), transparent 30%), linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.022))",
      }}
    >
      <SectionHeading
        eyebrow="Chart"
        title="Revenue vs expenses mix"
        hint="Shows how much of the visible operating movement is income versus cost."
      />

      {total <= 0 ? (
        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          Add approved revenue and expense documents to activate this chart.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "170px minmax(0, 1fr)",
            gap: 18,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 168,
              height: 168,
              borderRadius: "50%",
              padding: 12,
              background: `conic-gradient(var(--color-sage) 0 ${revenueShare}%, var(--color-gold) ${revenueShare}% 100%)`,
              boxShadow:
                "0 22px 70px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background: "rgba(9,13,20,0.95)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: 2,
                  textAlign: "center",
                }}
              >
                <strong
                  style={{
                    color: "var(--color-text-primary)",
                    fontSize: 32,
                    lineHeight: 1,
                    letterSpacing: "-0.06em",
                  }}
                >
                  {Math.round(revenueShare)}%
                </strong>

                <span
                  style={{
                    color: "var(--color-text-secondary)",
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  revenue share
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
              minWidth: 0,
            }}
          >
            <MiniTrustCard
              label="Revenue"
              value={`${Math.round(revenueShare)}%`}
              hint={formatMoneyShort(safeRevenue, currency)}
              tone="sage"
            />

            <MiniTrustCard
              label="Expenses"
              value={`${Math.round(expensesShare)}%`}
              hint={formatMoneyShort(safeExpenses, currency)}
              tone="gold"
            />
          </div>
        </div>
      )}
    </section>
  );
}

function CashFlowTrendChart({
  trend,
  caption,
}: {
  trend: number[];
  caption: string;
}) {
  const values = trend.length > 0 ? trend.slice(-6) : [0, 0, 0, 0, 0, 0];
  const maxAbs = Math.max(...values.map((item) => Math.abs(item)), 1);
  const netMovement = values.reduce((total, item) => total + item, 0);
  const positivePeriods = values.filter((item) => item >= 0).length;
  const lineWidth = 620;
  const lineHeight = 180;
  const linePath = buildLinePath(values, lineWidth, lineHeight);
  const areaPath = buildAreaPath(values, lineWidth, lineHeight);
  const tone: Tone = netMovement >= 0 ? "sage" : "danger";
  const toneStyle = getToneStyle(tone);

  return (
    <section
      className="section-card"
      style={{
        display: "grid",
        gap: 18,
        padding: 22,
        minHeight: 420,
        overflow: "hidden",
        background:
          "radial-gradient(circle at 16% 0%, rgba(46,213,115,0.10), transparent 28%), radial-gradient(circle at 92% 12%, rgba(245,158,11,0.10), transparent 30%), linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.022))",
      }}
    >
      <SectionHeading
        eyebrow="Cash flow chart"
        title="Cash movement trend"
        hint={caption}
        action={
          <span
            style={{
              border: `1px solid ${toneStyle.border}`,
              background: toneStyle.background,
              color: toneStyle.color,
              borderRadius: 999,
              padding: "8px 11px",
              fontSize: 11,
              fontWeight: 950,
              whiteSpace: "nowrap",
            }}
          >
            Net {netMovement >= 0 ? "+" : ""}
            {formatCompactNumber(netMovement)}
          </span>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
          gap: 12,
        }}
      >
        <MiniTrustCard
          label="Net movement"
          value={`${netMovement >= 0 ? "+" : ""}${formatCompactNumber(
            netMovement,
          )}`}
          hint="Latest periods"
          tone={netMovement >= 0 ? "sage" : "danger"}
        />

        <MiniTrustCard
          label="Positive periods"
          value={`${positivePeriods}/${values.length}`}
          hint="Inflow stability"
          tone={positivePeriods >= Math.ceil(values.length / 2) ? "sage" : "gold"}
        />

        <MiniTrustCard
          label="Largest swing"
          value={formatCompactNumber(
            values.reduce(
              (largest, item) =>
                Math.abs(item) > Math.abs(largest) ? item : largest,
              0,
            ),
          )}
          hint="Highest movement"
          tone="amber"
        />
      </div>

      <div
        style={{
          border: "1px solid rgba(245,158,11,0.14)",
          background: "rgba(0,0,0,0.12)",
          borderRadius: 24,
          padding: 18,
          display: "grid",
          gap: 18,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <svg
          viewBox={`0 0 ${lineWidth} ${lineHeight}`}
          role="img"
          aria-label="Cash flow line chart"
          style={{
            width: "100%",
            height: 180,
            display: "block",
            overflow: "visible",
          }}
        >
          <defs>
            <linearGradient id="cashFlowAreaGradient" x1="0" x2="0" y1="0" y2="1">
              <stop
                offset="0%"
                stopColor={netMovement >= 0 ? "#2ed573" : "#ff8a95"}
                stopOpacity="0.22"
              />
              <stop
                offset="100%"
                stopColor={netMovement >= 0 ? "#2ed573" : "#ff8a95"}
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          <line
            x1="20"
            x2={lineWidth - 20}
            y1={lineHeight / 2}
            y2={lineHeight / 2}
            stroke="rgba(255,255,255,0.14)"
            strokeDasharray="6 8"
          />

          <path d={areaPath} fill="url(#cashFlowAreaGradient)" />

          <path
            d={linePath}
            fill="none"
            stroke={netMovement >= 0 ? "var(--color-sage)" : "var(--color-danger)"}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {values.map((value, index) => {
            const min = Math.min(...values, 0);
            const max = Math.max(...values, 0);
            const range = max - min || 1;
            const x =
              values.length === 1
                ? lineWidth / 2
                : 20 + (index / (values.length - 1)) * (lineWidth - 40);

            const y = lineHeight - 18 - ((value - min) / range) * (lineHeight - 36);

            return (
              <g key={`${value}-${index}`}>
                <circle
                  cx={x}
                  cy={y}
                  r="5"
                  fill={value >= 0 ? "var(--color-sage)" : "var(--color-danger)"}
                  stroke="rgba(9,13,20,0.95)"
                  strokeWidth="3"
                />

                <text
                  x={x}
                  y={value >= 0 ? y - 12 : y + 22}
                  textAnchor="middle"
                  fill="rgba(226,232,240,0.76)"
                  fontSize="11"
                  fontWeight="800"
                >
                  {value >= 0 ? "+" : ""}
                  {formatCompactNumber(value)}
                </text>
              </g>
            );
          })}
        </svg>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${values.length}, minmax(38px, 1fr))`,
            gap: 10,
            alignItems: "end",
            minHeight: 130,
          }}
        >
          {values.map((value, index) => {
            const isPositive = value >= 0;
            const height = Math.max(16, (Math.abs(value) / maxAbs) * 110);

            return (
              <div
                key={`${value}-bar-${index}`}
                style={{
                  display: "grid",
                  gap: 8,
                  alignItems: "end",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    height,
                    borderRadius: isPositive
                      ? "14px 14px 7px 7px"
                      : "7px 7px 14px 14px",
                    background: isPositive
                      ? "linear-gradient(180deg, var(--color-sage), rgba(46,213,115,0.22))"
                      : "linear-gradient(180deg, rgba(255,138,149,0.22), var(--color-danger))",
                    border: isPositive
                      ? "1px solid rgba(46,213,115,0.30)"
                      : "1px solid rgba(255,138,149,0.30)",
                    boxShadow: isPositive
                      ? "0 16px 42px rgba(46,213,115,0.12)"
                      : "0 16px 42px rgba(255,138,149,0.10)",
                  }}
                />

                <span
                  style={{
                    color: "var(--color-text-muted)",
                    fontSize: 10,
                    fontWeight: 900,
                    textAlign: "center",
                  }}
                >
                  P{index + 1}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AnalyticsChartsSection({
  revenue,
  expenses,
  profit,
  cash,
  currency,
}: {
  revenue: string;
  expenses: string;
  profit: string;
  cash: string;
  currency: string;
}) {
  const revenueValue = parseMetricValue(revenue);
  const expensesValue = parseMetricValue(expenses);
  const profitValue = parseMetricValue(profit);
  const cashValue = parseMetricValue(cash);

  const metrics: ChartMetric[] = [
    {
      label: "Revenue",
      value: revenueValue,
      displayValue: revenue,
      tone: "sage",
    },
    {
      label: "Expenses",
      value: expensesValue,
      displayValue: expenses,
      tone: "gold",
    },
    {
      label: "Profit",
      value: profitValue,
      displayValue: profit,
      tone: profit.includes("-") ? "danger" : "amber",
    },
    {
      label: "Cash",
      value: cashValue,
      displayValue: cash,
      tone: "sage",
    },
  ];

  return (
    <section
      style={{
        display: "grid",
        gap: 18,
      }}
    >
      <SectionHeading
        eyebrow="Charts and analytics"
        title="Visual finance intelligence"
        hint="Charts are generated from the latest trusted dashboard numbers."
      />

      <div
        className="dashboard-chart-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 0.78fr)",
          gap: 18,
          alignItems: "stretch",
        }}
      >
        <MetricBarChart metrics={metrics} currency={currency} />

        <RevenueExpenseDonut
          revenue={revenueValue}
          expenses={expensesValue}
          currency={currency}
        />
      </div>
    </section>
  );
}

function buildDashboardAgents({
  approvedDocuments,
  pendingReview,
  healthScore,
  revenue,
  profit,
  cash,
}: {
  approvedDocuments: number;
  pendingReview: number;
  healthScore: number;
  revenue: string;
  profit: string;
  cash: string;
}): AgentCardData[] {
  return [
    {
      id: "cfo",
      icon: "📊",
      name: "CFO Agent",
      role: "Executive decisions",
      insight:
        approvedDocuments > 0
          ? `Health score is ${healthScore}/100. Ask for runway, profitability, and strategic next steps.`
          : "Approve documents to unlock CFO-level decisions.",
      tone: "sage",
    },
    {
      id: "accountant",
      icon: "🧾",
      name: "Accountant Agent",
      role: "Document review",
      insight:
        pendingReview > 0
          ? `${pendingReview} document(s) need review before dashboard can trust them.`
          : "All processed trusted documents are ready for finance intelligence.",
      tone: pendingReview > 0 ? "gold" : "sage",
    },
    {
      id: "analyst",
      icon: "📈",
      name: "Analyst Agent",
      role: "Trends and ratios",
      insight:
        profit !== "Not available"
          ? `Profit signal is ${profit}. Ask for margin, growth, and expense ratio analysis.`
          : "Approve income and expense documents to unlock deeper analysis.",
      tone: "amber",
    },
    {
      id: "cashflow",
      icon: "💧",
      name: "Cash Flow Agent",
      role: "Liquidity monitor",
      insight:
        cash !== "Not available"
          ? `Cash signal is ${cash}. Ask about runway, burn rate, and cash gaps.`
          : "Upload bank statements to improve cash visibility.",
      tone: "sage",
    },
    {
      id: "risk",
      icon: "🛡️",
      name: "Risk Agent",
      role: "Red flags",
      insight:
        revenue !== "Not available"
          ? "Revenue is visible. Ask for risk, concentration, and document gap checks."
          : "Revenue is not visible yet. Add sales or financial statement data.",
      tone: revenue !== "Not available" ? "sage" : "gold",
    },
    {
      id: "consultant",
      icon: "🧭",
      name: "Business Consultant Agent",
      role: "Growth, pricing, hiring, and cost-control advisor",
      insight:
        profit !== "Not available"
          ? "Turns your finance signals into practical business actions for growth, pricing, hiring, cost control, and operations."
          : "Approve financial documents to unlock business consulting recommendations.",
      tone: "sage",
    },
    {
      id: "tax",
      icon: "🧾",
      name: "Tax Agent",
      role: "Tax readiness and compliance checklist",
      insight:
        approvedDocuments > 0
          ? "Checks tax readiness from approved documents and verified tax rules. Use it as a checklist before CA verification."
          : "Approve documents and upload tax sources to improve tax readiness checks.",
      tone: "gold",
    },
  ];
}

function AgentCard({ agent }: { agent: AgentCardData }) {
  const toneStyle = getToneStyle(agent.tone);

  return (
    <article
      style={{
        border: `1px solid ${toneStyle.border}`,
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.052), rgba(255,255,255,0.024))",
        borderRadius: 22,
        padding: 16,
        display: "grid",
        gap: 12,
        minHeight: 210,
        minWidth: 0,
        overflow: "hidden",
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
            borderRadius: 15,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1px solid ${toneStyle.border}`,
            background: toneStyle.background,
            fontSize: 18,
            flex: "0 0 auto",
          }}
        >
          {agent.icon}
        </span>

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
              fontSize: 16,
              lineHeight: 1.2,
              overflowWrap: "anywhere",
            }}
          >
            {agent.name}
          </strong>

          <span
            style={{
              color: "var(--color-text-secondary)",
              fontSize: 12,
              lineHeight: 1.35,
              fontWeight: 750,
              overflowWrap: "anywhere",
            }}
          >
            {agent.role}
          </span>
        </span>
      </div>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-secondary)",
          fontSize: 13,
          lineHeight: 1.65,
          overflowWrap: "anywhere",
        }}
      >
        {agent.insight}
      </p>

      <Link
        href={`/chat?agent=${agent.id}`}
        className="btn-ghost"
        style={{
          width: "fit-content",
          marginTop: "auto",
          border: `1px solid ${toneStyle.border}`,
          background: toneStyle.background,
          color: toneStyle.color,
        }}
      >
        Ask agent -&gt;
      </Link>
    </article>
  );
}

function DashboardAiTeam({ agents }: { agents: AgentCardData[] }) {
  return (
    <section
      className="section-card"
      style={{
        display: "grid",
        gap: 18,
        padding: 22,
        overflow: "hidden",
      }}
    >
      <SectionHeading
        eyebrow="AI finance team"
        title="Agents watching your business"
        hint="Each agent uses your business profile and approved documents only."
        action={
          <Link href="/ai-team" className="btn-ghost">
            View full team
          </Link>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 14,
          alignItems: "stretch",
          minWidth: 0,
        }}
      >
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </section>
  );
}

function ExecutiveSummary({
  approvedDocuments,
  pendingReview,
  rejectedDocuments,
  hasData,
}: {
  approvedDocuments: number;
  pendingReview: number;
  rejectedDocuments: number;
  hasData: boolean;
}) {
  return (
    <section
      className="section-card"
      style={{
        display: "grid",
        gap: 16,
        padding: 22,
        overflow: "hidden",
      }}
    >
      <SectionHeading
        eyebrow="Executive summary"
        title={
          hasData
            ? "Workspace is using trusted data."
            : "Workspace needs trusted data."
        }
        hint={
          hasData
            ? "Dashboard, report, and AI chat are based only on approved processed documents."
            : "Upload, process, and approve finance documents to activate dashboard intelligence."
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 12,
        }}
      >
        <MiniTrustCard
          label="Approved"
          value={approvedDocuments}
          hint="Trusted by AI"
          tone="sage"
        />

        <MiniTrustCard
          label="Pending"
          value={pendingReview}
          hint="Needs review"
          tone={pendingReview > 0 ? "gold" : "neutral"}
        />

        <MiniTrustCard
          label="Rejected"
          value={rejectedDocuments}
          hint="Excluded"
          tone={rejectedDocuments > 0 ? "danger" : "neutral"}
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
        }}
      >
        <ActionRow
          title="Upload more documents"
          hint="Add financial statements, bank statements, invoices, or expenses."
          href="/documents"
          tone="amber"
        />

        <ActionRow
          title="Ask AI about this business"
          hint="Get CFO, accountant, analyst, and cash-flow answers."
          href="/chat"
          tone="sage"
        />
      </div>
    </section>
  );
}

function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  return (
    <section
      className="section-card"
      style={{
        display: "grid",
        gap: 16,
        padding: 22,
        minHeight: 320,
        overflow: "hidden",
      }}
    >
      <SectionHeading
        eyebrow="Risk watch"
        title="Alerts and recommendations"
        hint="Important signals detected from approved documents."
      />

      <div
        style={{
          display: "grid",
          gap: 10,
        }}
      >
        {alerts.length > 0 ? (
          alerts.map((alert) => {
            const tone = getAlertTone(alert.severity);
            const toneStyle = getToneStyle(tone);

            return (
              <article
                key={alert.id}
                style={{
                  border: `1px solid ${toneStyle.border}`,
                  background: toneStyle.background,
                  borderRadius: 18,
                  padding: 14,
                  display: "grid",
                  gap: 7,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    color: toneStyle.color,
                    fontSize: 11,
                    fontWeight: 950,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {getAlertLabel(alert.severity)}
                </span>

                <p
                  style={{
                    margin: 0,
                    color: "var(--color-text-primary)",
                    fontSize: 13,
                    lineHeight: 1.55,
                    fontWeight: 760,
                    overflowWrap: "anywhere",
                  }}
                >
                  {alert.message}
                </p>
              </article>
            );
          })
        ) : (
          <article
            style={{
              border: "1px solid rgba(46,213,115,0.22)",
              background: "rgba(46,213,115,0.08)",
              borderRadius: 18,
              padding: 14,
            }}
          >
            <p
              style={{
                margin: 0,
                color: "var(--color-sage)",
                fontSize: 13,
                lineHeight: 1.55,
                fontWeight: 800,
              }}
            >
              No major alerts right now.
            </p>
          </article>
        )}
      </div>
    </section>
  );
}

function FinanceMetricsSection({
  revenue,
  expenses,
  profit,
  cash,
}: {
  revenue: string;
  expenses: string;
  profit: string;
  cash: string;
}) {
  return (
    <section
      className="section-card"
      style={{
        display: "grid",
        gap: 18,
        padding: 22,
        overflow: "hidden",
      }}
    >
      <SectionHeading
        eyebrow="Finance metrics"
        title="Latest trusted numbers"
        hint="These values come from approved processed documents only."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 14,
          alignItems: "stretch",
        }}
      >
        <FinanceMetricCard
          label="Revenue"
          value={revenue}
          hint="Income signal"
          tone="sage"
        />

        <FinanceMetricCard
          label="Expenses"
          value={expenses}
          hint="Cost signal"
          tone="gold"
        />

        <FinanceMetricCard
          label="Profit"
          value={profit}
          hint="Profitability signal"
          tone={profit.includes("-") ? "danger" : "sage"}
        />

        <FinanceMetricCard
          label="Cash"
          value={cash}
          hint="Liquidity signal"
          tone="amber"
        />
      </div>
    </section>
  );
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const sessionUser = session.user as {
    id: string;
    name?: string | null;
    email?: string | null;
  };

  const [profile, business, approvedDocuments, pendingReview, rejectedDocuments] =
    await Promise.all([
      getFinancialProfile(sessionUser.id),
      prisma.business.findUnique({
        where: {
          userId: sessionUser.id,
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
          userId: sessionUser.id,
          status: "PROCESSED",
          reviewStatus: "APPROVED",
        },
      }),
      prisma.document.count({
        where: {
          userId: sessionUser.id,
          status: "PROCESSED",
          reviewStatus: "NEEDS_REVIEW",
        },
      }),
      prisma.document.count({
        where: {
          userId: sessionUser.id,
          reviewStatus: "REJECTED",
        },
      }),
    ]);

  const revenue = normalizeValue(profile.revenue.value);
  const expenses = normalizeValue(profile.expenses.value);
  const profit = normalizeValue(profile.profit.value);
  const cash = normalizeValue(profile.cash.value);

  const userLabel = getGreetingName(sessionUser.name ?? sessionUser.email);
  const businessName = displayValue(business?.name);
  const industry = displayValue(business?.industry);
  const country = displayValue(business?.country);
  const currency = displayValue(business?.currency);

  const agents = buildDashboardAgents({
    approvedDocuments,
    pendingReview,
    healthScore: profile.healthScore,
    revenue,
    profit,
    cash,
  });
return (
    <>
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
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 12,
              minWidth: 0,
            }}
          >
            <p className="eyebrow" style={{ margin: 0 }}>
              Executive command center
            </p>

            <h1
              style={{
                margin: 0,
                color: "var(--color-text-primary)",
                fontSize: "clamp(38px, 5.2vw, 72px)",
                lineHeight: 0.98,
                letterSpacing: "-0.078em",
                maxWidth: 880,
                overflowWrap: "anywhere",
              }}
            >
              Welcome back, {userLabel}.
            </h1>

            <p
              className="page-intro"
              style={{
                margin: 0,
                lineHeight: 1.7,
                maxWidth: 850,
              }}
            >
              Your dashboard is built from approved financial documents only.
              Review pending files before they affect AI answers, reports, and
              finance metrics.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <HeroBadge tone={profile.hasData ? "sage" : "gold"}>
              {profile.hasData ? "Live trusted data" : "Needs approved data"}
            </HeroBadge>

            <HeroBadge tone="amber">{approvedDocuments} approved</HeroBadge>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <Link href="/chat" className="btn-ghost">
            Ask AI team
          </Link>

          <Link href="/documents" className="btn-ghost">
            Review documents
          </Link>

          <Link href="/reports/cfo" className="btn-ghost">
            Open CFO report
          </Link>
        </div>
      </header>

      <section
        className="dashboard-top-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(360px, 1fr) minmax(0, 1fr)",
          gap: 18,
          alignItems: "stretch",
          marginBottom: 18,
        }}
      >
        <HealthScoreCard
          score={profile.healthScore}
          label={profile.healthLabel}
          hasData={profile.hasData}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 14,
            minWidth: 0,
          }}
        >
          <DashboardStatCard label="Revenue" stat={profile.revenue} tone="sage" />

          <DashboardStatCard
            label="Expenses"
            stat={profile.expenses}
            tone="gold"
          />

          <DashboardStatCard label="Profit" stat={profile.profit} tone="amber" />

          <DashboardStatCard label="Cash" stat={profile.cash} tone="sage" />
        </div>
      </section>

      <div
        style={{
          display: "grid",
          gap: 18,
        }}
      >
        <AnalyticsChartsSection
          revenue={revenue}
          expenses={expenses}
          profit={profit}
          cash={cash}
          currency={currency}
        />

        <DashboardAiTeam agents={agents} />

        <div
          className="dashboard-middle-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(280px, 0.82fr) minmax(0, 1.18fr)",
            gap: 18,
            alignItems: "stretch",
          }}
        >
          <ExecutiveSummary
            approvedDocuments={approvedDocuments}
            pendingReview={pendingReview}
            rejectedDocuments={rejectedDocuments}
            hasData={profile.hasData}
          />

          <FinanceMetricsSection
            revenue={revenue}
            expenses={expenses}
            profit={profit}
            cash={cash}
          />
        </div>

        <div
          className="dashboard-bottom-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)",
            gap: 18,
            alignItems: "stretch",
          }}
        >
          <CashFlowTrendChart
            trend={profile.cashFlowTrend}
            caption={profile.cashFlowCaption}
          />

          <AlertsPanel alerts={profile.alerts} />
        </div>

        <section
          className="section-card"
          style={{
            padding: 20,
            display: "grid",
            gap: 12,
            overflow: "hidden",
          }}
        >
          <SectionHeading
            eyebrow="Business context"
            title={businessName}
            hint={`${industry} Â· ${country} Â· Currency: ${currency}`}
            action={
              <Link href="/business" className="btn-ghost">
                Edit profile
              </Link>
            }
          />
        </section>
      </div>

      <style>
        {`
          @media (max-width: 1260px) {
            .dashboard-top-grid,
            .dashboard-middle-grid,
            .dashboard-bottom-grid,
            .dashboard-chart-grid {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 760px) {
            main header {
              padding: 20px !important;
              border-radius: 24px !important;
            }

            .dashboard-top-grid article div[style*="180px"],
            .dashboard-chart-grid section div[style*="170px"] {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </>
  );
}







