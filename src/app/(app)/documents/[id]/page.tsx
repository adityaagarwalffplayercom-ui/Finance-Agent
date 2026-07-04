import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { categoryLabel, formatFileSize } from "@/lib/document-categories";
import type { ExtractedDocumentData } from "@/lib/gemini";
import { ReviewActions } from "./ReviewActions";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type PreviewExtractedData = ExtractedDocumentData & {
  revenue?: number;
  expenses?: number;
  profit?: number;
  netIncome?: number;
  totalAmount?: number;
  totalAmountLabel?: string;
  currency?: string;
  documentDate?: string;
  periodStart?: string;
  periodEnd?: string;
  assets?: number;
  liabilities?: number;
  equity?: number;
  vendorOrCounterparty?: string;
  lineItems?: Array<{
    description?: string;
    amount?: number;
    category?: string;
  }>;
  transactions?: Array<{
    date?: string;
    description?: string;
    amount?: number;
    direction?: string;
  }>;
};

type ExtractionQuality = {
  label: "Strong" | "Partial" | "Weak" | "Not processed";
  score: number;
  toneColor: string;
  background: string;
  border: string;
  detected: string[];
  missing: string[];
  note: string;
};

const STATUS_STYLE: Record<
  string,
  {
    label: string;
    background: string;
    color: string;
    border: string;
  }
> = {
  UPLOADED: {
    label: "Uploaded",
    background: "rgba(88,166,255,0.12)",
    color: "#8abfff",
    border: "rgba(88,166,255,0.28)",
  },
  PROCESSING: {
    label: "Processing",
    background: "rgba(255,193,7,0.12)",
    color: "#ffd166",
    border: "rgba(255,193,7,0.28)",
  },
  PROCESSED: {
    label: "Processed",
    background: "rgba(46,213,115,0.12)",
    color: "#7bed9f",
    border: "rgba(46,213,115,0.28)",
  },
  FAILED: {
    label: "Failed",
    background: "rgba(255,71,87,0.12)",
    color: "#ff8a95",
    border: "rgba(255,71,87,0.28)",
  },
};

function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.UPLOADED;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        border: `1px solid ${style.border}`,
        background: style.background,
        color: style.color,
        borderRadius: 999,
        padding: "8px 11px",
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: style.color,
          boxShadow: `0 0 12px ${style.color}`,
        }}
      />
      {style.label}
    </span>
  );
}

function asExtractedData(value: unknown): PreviewExtractedData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as PreviewExtractedData;
}

function hasNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function formatNormalAmount(amount?: number | null, currency?: string | null) {
  if (!hasNumber(amount)) {
    return "-";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toLocaleString("en-US");
  }
}

function formatMillionAmount(amount?: number | null, currency?: string | null) {
  if (!hasNumber(amount)) {
    return "-";
  }

  const isNegative = amount < 0;
  const absoluteAmount = Math.abs(amount);

  try {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "INR",
      maximumFractionDigits: 2,
    }).format(absoluteAmount);

    return `${isNegative ? "-" : ""}${formatted}M`;
  } catch {
    return `${amount.toLocaleString("en-US")}M`;
  }
}

function formatDocumentAmount(
  amount?: number | null,
  currency?: string | null,
  category?: string | null,
) {
  if (category === "FINANCIAL_STATEMENT") {
    return formatMillionAmount(amount, currency);
  }

  return formatNormalAmount(amount, currency);
}

function formatDate(value?: string | Date | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-US");
}

function inferLineItemCategory(description?: string, existingCategory?: string) {
  if (existingCategory && existingCategory.trim()) {
    return existingCategory;
  }

  const text = description?.toLowerCase() ?? "";

  if (text.includes("exceptional")) {
    return "Exceptional Item";
  }

  if (
    text.includes("comprehensive income") ||
    text.includes("comprehensive loss")
  ) {
    return "Other Comprehensive Income";
  }

  if (
    text.includes("revenue") ||
    text.includes("sales") ||
    text.includes("turnover") ||
    text.includes("other income")
  ) {
    return "Revenue";
  }

  if (
    text.includes("cost") ||
    text.includes("expense") ||
    text.includes("purchase") ||
    text.includes("employee") ||
    text.includes("finance costs") ||
    text.includes("depreciation") ||
    text.includes("amortisation") ||
    text.includes("amortization") ||
    text.includes("tax") ||
    text.includes("materials consumed") ||
    text.includes("stock-in-trade") ||
    text.includes("inventories")
  ) {
    return "Expense";
  }

  if (
    text.includes("asset") ||
    text.includes("property") ||
    text.includes("plant") ||
    text.includes("equipment") ||
    text.includes("goodwill") ||
    text.includes("intangible") ||
    text.includes("investment") ||
    text.includes("capital work-in-progress") ||
    text.includes("cash") ||
    text.includes("bank")
  ) {
    return "Asset";
  }

  if (
    text.includes("liability") ||
    text.includes("borrowings") ||
    text.includes("payable") ||
    text.includes("debt") ||
    text.includes("lease liabilities") ||
    text.includes("provisions")
  ) {
    return "Liability";
  }

  if (
    text.includes("equity") ||
    text.includes("reserve") ||
    text.includes("share capital") ||
    text.includes("retained earnings")
  ) {
    return "Equity";
  }

  return "Other";
}

function buildExtractionQuality(params: {
  extracted: PreviewExtractedData | null;
  status: string;
  isFinancialStatement: boolean;
}) {
  const { extracted, status, isFinancialStatement } = params;

  if (status !== "PROCESSED" || !extracted) {
    return {
      label: "Not processed",
      score: 0,
      toneColor: "#8abfff",
      background: "rgba(88,166,255,0.10)",
      border: "rgba(88,166,255,0.28)",
      detected: [],
      missing: ["AI extraction has not been completed for this document."],
      note: "Process this document first to generate a quality check.",
    } satisfies ExtractionQuality;
  }

  const detected: string[] = [];
  const missing: string[] = [];

  if (hasText(extracted.summary)) detected.push("AI summary");
  else missing.push("Summary");

  if (hasText(extracted.currency)) detected.push("Currency");
  else missing.push("Currency");

  if (hasText(extracted.documentDate)) detected.push("Document date");
  else missing.push("Document date");

  if (hasText(extracted.periodStart) && hasText(extracted.periodEnd)) {
    detected.push("Reporting period");
  } else if (isFinancialStatement) {
    missing.push("Reporting period");
  }

  if (hasNumber(extracted.revenue)) detected.push("Revenue");
  else if (isFinancialStatement) missing.push("Revenue");

  if (hasNumber(extracted.expenses)) detected.push("Expenses");
  else if (isFinancialStatement) missing.push("Expenses");

  if (hasNumber(extracted.profit) || hasNumber(extracted.netIncome)) {
    detected.push("Profit / loss");
  } else if (isFinancialStatement) {
    missing.push("Profit / loss");
  }

  if (hasNumber(extracted.assets)) detected.push("Assets");
  else if (isFinancialStatement) missing.push("Assets");

  if (hasNumber(extracted.liabilities)) detected.push("Liabilities");
  else if (isFinancialStatement) missing.push("Liabilities");

  if (hasNumber(extracted.equity)) detected.push("Equity");
  else if (isFinancialStatement) missing.push("Equity");

  if (Array.isArray(extracted.lineItems) && extracted.lineItems.length > 0) {
    detected.push(`${extracted.lineItems.length} line items`);
  } else {
    missing.push("Line items");
  }

  if (
    Array.isArray(extracted.transactions) &&
    extracted.transactions.length > 0
  ) {
    detected.push(`${extracted.transactions.length} transactions`);
  } else {
    missing.push("Transactions");
  }

  const requiredFieldCount = isFinancialStatement ? 10 : 7;
  const score = Math.min(
    100,
    Math.round((detected.length / requiredFieldCount) * 100),
  );

  if (score >= 75) {
    return {
      label: "Strong",
      score,
      toneColor: "#7bed9f",
      background: "rgba(46,213,115,0.10)",
      border: "rgba(46,213,115,0.28)",
      detected,
      missing,
      note:
        "The extraction looks strong because key financial fields were detected. Still verify important values before using them for business decisions.",
    } satisfies ExtractionQuality;
  }

  if (score >= 45) {
    return {
      label: "Partial",
      score,
      toneColor: "#ffd166",
      background: "rgba(255,193,7,0.10)",
      border: "rgba(255,193,7,0.28)",
      detected,
      missing,
      note:
        "The extraction is usable, but some important fields are missing. Upload cleaner documents or supporting documents for better analysis.",
    } satisfies ExtractionQuality;
  }

  return {
    label: "Weak",
    score,
    toneColor: "#ff8a95",
    background: "rgba(255,71,87,0.10)",
    border: "rgba(255,71,87,0.28)",
    detected,
    missing,
    note:
      "The extraction is weak because several important fields are missing. Re-process the file or upload a clearer document before trusting the analysis.",
  } satisfies ExtractionQuality;
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 18,
        padding: 16,
      }}
    >
      <p
        style={{
          margin: "0 0 8px",
          color: "var(--color-text-secondary)",
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 700,
        }}
      >
        {label}
      </p>

      <p
        style={{
          margin: "0 0 6px",
          color: "var(--color-text-primary)",
          fontSize: 22,
          fontWeight: 800,
          wordBreak: "break-word",
        }}
      >
        {value}
      </p>

      {hint && (
        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function ExtractionQualityCard({ quality }: { quality: ExtractionQuality }) {
  return (
    <section
      className="alerts-card"
      style={{
        display: "grid",
        gap: 18,
        marginBottom: 28,
        border: `1px solid ${quality.border}`,
        background: quality.background,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <p className="section-title">AI extraction quality</p>
          <p className="section-hint">
            Rule-based verification of what the AI successfully extracted.
          </p>
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            border: `1px solid ${quality.border}`,
            background: "rgba(0,0,0,0.16)",
            color: quality.toneColor,
            borderRadius: 999,
            padding: "9px 12px",
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: quality.toneColor,
              boxShadow: `0 0 12px ${quality.toneColor}`,
            }}
          />
          {quality.label} · {quality.score}/100
        </span>
      </div>

      <p
        style={{
          margin: 0,
          color: "var(--color-text-primary)",
          fontSize: 14,
          lineHeight: 1.65,
        }}
      >
        {quality.note}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <div
          style={{
            border: "1px solid var(--color-border)",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 16,
            padding: 14,
          }}
        >
          <p
            style={{
              margin: "0 0 10px",
              color: "var(--color-text-primary)",
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            Detected
          </p>

          {quality.detected.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {quality.detected.map((item) => (
                <span
                  key={item}
                  style={{
                    border: "1px solid rgba(46,213,115,0.24)",
                    background: "rgba(46,213,115,0.08)",
                    color: "#7bed9f",
                    borderRadius: 999,
                    padding: "7px 10px",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  ✓ {item}
                </span>
              ))}
            </div>
          ) : (
            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 13,
              }}
            >
              No extracted fields detected yet.
            </p>
          )}
        </div>

        <div
          style={{
            border: "1px solid var(--color-border)",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 16,
            padding: 14,
          }}
        >
          <p
            style={{
              margin: "0 0 10px",
              color: "var(--color-text-primary)",
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            Missing / needs verification
          </p>

          {quality.missing.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {quality.missing.map((item) => (
                <span
                  key={item}
                  style={{
                    border: "1px solid rgba(255,193,7,0.24)",
                    background: "rgba(255,193,7,0.08)",
                    color: "#ffd166",
                    borderRadius: 999,
                    padding: "7px 10px",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  ! {item}
                </span>
              ))}
            </div>
          ) : (
            <p
              style={{
                margin: 0,
                color: "#7bed9f",
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              No major missing fields detected.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default async function DocumentDetailsPage({ params }: PageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;

  const document = await prisma.document.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      category: true,
      status: true,
      uploadedAt: true,
      extractedAt: true,
      processingError: true,
      reviewStatus: true,
      reviewedAt: true,
      reviewNote: true,
      extractedData: true,
    },
  });

  if (!document) {
    notFound();
  }

  const extracted = asExtractedData(document.extractedData);
  const currency = extracted?.currency ?? "INR";
  const isFinancialStatement = document.category === "FINANCIAL_STATEMENT";

  const quality = buildExtractionQuality({
    extracted,
    status: document.status,
    isFinancialStatement,
  });

  const money = (amount?: number | null) =>
    formatDocumentAmount(amount, currency, document.category);

  const profit =
    typeof extracted?.profit === "number"
      ? extracted.profit
      : typeof extracted?.netIncome === "number"
        ? extracted.netIncome
        : null;

  const lineItems = extracted?.lineItems ?? [];
  const transactions = extracted?.transactions ?? [];

  return (
    <>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Document intelligence</p>
          <h1>AI extraction preview</h1>
        </div>

        <Link
          href="/documents"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--color-border)",
            background: "rgba(255,255,255,0.04)",
            color: "var(--color-text-primary)",
            borderRadius: 14,
            padding: "11px 14px",
            textDecoration: "none",
            fontWeight: 800,
            fontSize: 13,
          }}
        >
          ← Back to documents
        </Link>
      </header>

      <section
        className="alerts-card"
        style={{
          display: "grid",
          gap: 18,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div style={{ minWidth: 0, flex: "1 1 420px" }}>
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  color: "var(--color-text-secondary)",
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontWeight: 800,
                }}
              >
                {categoryLabel(document.category)}
              </span>

              <StatusPill status={document.status} />

              {isFinancialStatement && (
                <span
                  style={{
                    border: "1px solid rgba(88,166,255,0.28)",
                    background: "rgba(88,166,255,0.10)",
                    color: "#8abfff",
                    borderRadius: 999,
                    padding: "8px 11px",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  Values shown in millions
                </span>
              )}
            </div>

            <h2
              style={{
                margin: "0 0 8px",
                color: "var(--color-text-primary)",
                fontSize: 24,
                lineHeight: 1.3,
                wordBreak: "break-word",
              }}
            >
              {document.fileName}
            </h2>

            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {formatFileSize(document.fileSize)} · {document.mimeType} ·
              Uploaded {formatDate(document.uploadedAt)}
              {document.extractedAt
                ? ` · Extracted ${formatDate(document.extractedAt)}`
                : ""}
            </p>
          </div>
        </div>

        {document.status === "FAILED" && document.processingError && (
          <p
            style={{
              margin: 0,
              color: "#ff8a95",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {document.processingError}
          </p>
        )}

        {extracted?.summary ? (
          <div
            style={{
              border: "1px solid var(--color-border)",
              background: "rgba(255,255,255,0.03)",
              borderRadius: 18,
              padding: 16,
            }}
          >
            <p className="section-title">AI summary</p>
            <p
              style={{
                margin: "10px 0 0",
                color: "var(--color-text-primary)",
                fontSize: 14,
                lineHeight: 1.65,
              }}
            >
              {extracted.summary}
            </p>
          </div>
        ) : (
          <div
            style={{
              border: "1px solid var(--color-border)",
              background: "rgba(255,255,255,0.03)",
              borderRadius: 18,
              padding: 16,
            }}
          >
            <p className="section-title">AI summary</p>
            <p
              style={{
                margin: "10px 0 0",
                color: "var(--color-text-secondary)",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              No extracted summary is available yet. Process this document first
              to view AI results.
            </p>
          </div>
        )}
      </section>

      <ReviewActions
        documentId={document.id}
        reviewStatus={document.reviewStatus}
        processingStatus={document.status}
        reviewNote={document.reviewNote}
        reviewedAt={document.reviewedAt?.toISOString() ?? null}
      />

      <ExtractionQualityCard quality={quality} />

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <MetricCard
          label="Revenue"
          value={money(extracted?.revenue)}
          hint={
            isFinancialStatement
              ? "Revenue detected from this document, shown in millions."
              : "Revenue detected from this document."
          }
        />

        <MetricCard
          label="Expenses"
          value={money(extracted?.expenses)}
          hint={
            isFinancialStatement
              ? "Expenses detected from this document, shown in millions."
              : "Expenses detected from this document."
          }
        />

        <MetricCard
          label="Profit / Loss"
          value={money(profit)}
          hint={
            isFinancialStatement
              ? "Net result found in extracted data, shown in millions."
              : "Net result found in extracted data."
          }
        />

        <MetricCard
          label={extracted?.totalAmountLabel ?? "Total amount"}
          value={money(extracted?.totalAmount)}
          hint={
            isFinancialStatement
              ? "Main total value detected by AI, shown in millions."
              : "Main total value detected by AI."
          }
        />

        <MetricCard
          label="Document date"
          value={formatDate(extracted?.documentDate)}
          hint="Date detected from the document."
        />

        <MetricCard
          label="Period"
          value={`${formatDate(extracted?.periodStart)} → ${formatDate(
            extracted?.periodEnd,
          )}`}
          hint="Reporting period detected by AI."
        />
      </section>

      <section
        className="alerts-card"
        style={{
          display: "grid",
          gap: 18,
          marginBottom: 28,
        }}
      >
        <div>
          <p className="section-title">Balance sheet signals</p>
          <p className="section-hint">
            Assets, liabilities, and equity detected from the document.
            {isFinancialStatement ? " Values are shown in millions." : ""}
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
          }}
        >
          <MetricCard label="Assets" value={money(extracted?.assets)} />

          <MetricCard
            label="Liabilities"
            value={money(extracted?.liabilities)}
          />

          <MetricCard label="Equity" value={money(extracted?.equity)} />
        </div>
      </section>

      <section
        className="alerts-card"
        style={{
          display: "grid",
          gap: 18,
          marginBottom: 28,
        }}
      >
        <div>
          <p className="section-title">Line items</p>
          <p className="section-hint">
            Key rows or extracted items found by AI.
            {isFinancialStatement ? " Amounts are shown in millions." : ""}
          </p>
        </div>

        {lineItems.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      color: "var(--color-text-secondary)",
                      padding: "10px 8px",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    Description
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      color: "var(--color-text-secondary)",
                      padding: "10px 8px",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    Category
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      color: "var(--color-text-secondary)",
                      padding: "10px 8px",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                {lineItems.slice(0, 20).map((item, index) => (
                  <tr key={`${item.description ?? "line"}-${index}`}>
                    <td
                      style={{
                        color: "var(--color-text-primary)",
                        padding: "12px 8px",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      {item.description ?? "-"}
                    </td>
                    <td
                      style={{
                        color: "var(--color-text-secondary)",
                        padding: "12px 8px",
                        borderBottom: "1px solid var(--color-border)",
                        fontWeight: 700,
                      }}
                    >
                      {inferLineItemCategory(item.description, item.category)}
                    </td>
                    <td
                      style={{
                        color: "var(--color-text-primary)",
                        padding: "12px 8px",
                        borderBottom: "1px solid var(--color-border)",
                        textAlign: "right",
                        fontWeight: 700,
                      }}
                    >
                      {money(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p
            style={{
              margin: 0,
              color: "var(--color-text-secondary)",
              fontSize: 14,
            }}
          >
            No line items were extracted from this document.
          </p>
        )}
      </section>

      <section
        className="alerts-card"
        style={{
          display: "grid",
          gap: 18,
          marginBottom: 28,
        }}
      >
        <div>
          <p className="section-title">Transactions</p>
          <p className="section-hint">
            Transaction-style entries detected by AI.
            {isFinancialStatement ? " Amounts are shown in millions." : ""}
          </p>
        </div>

        {transactions.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      color: "var(--color-text-secondary)",
                      padding: "10px 8px",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    Date
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      color: "var(--color-text-secondary)",
                      padding: "10px 8px",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    Description
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      color: "var(--color-text-secondary)",
                      padding: "10px 8px",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    Direction
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      color: "var(--color-text-secondary)",
                      padding: "10px 8px",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                {transactions.slice(0, 30).map((transaction, index) => (
                  <tr key={`${transaction.description ?? "txn"}-${index}`}>
                    <td
                      style={{
                        color: "var(--color-text-secondary)",
                        padding: "12px 8px",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      {formatDate(transaction.date)}
                    </td>
                    <td
                      style={{
                        color: "var(--color-text-primary)",
                        padding: "12px 8px",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      {transaction.description ?? "-"}
                    </td>
                    <td
                      style={{
                        color: "var(--color-text-secondary)",
                        padding: "12px 8px",
                        borderBottom: "1px solid var(--color-border)",
                        textTransform: "capitalize",
                      }}
                    >
                      {transaction.direction ?? "-"}
                    </td>
                    <td
                      style={{
                        color: "var(--color-text-primary)",
                        padding: "12px 8px",
                        borderBottom: "1px solid var(--color-border)",
                        textAlign: "right",
                        fontWeight: 700,
                      }}
                    >
                      {money(transaction.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p
            style={{
              margin: 0,
              color: "var(--color-text-secondary)",
              fontSize: 14,
            }}
          >
            No transactions were extracted from this document.
          </p>
        )}
      </section>

      <section
        className="alerts-card"
        style={{
          display: "grid",
          gap: 14,
        }}
      >
        <div>
          <p className="section-title">Raw AI extracted data</p>
          <p className="section-hint">
            Developer view of the structured JSON saved for this document.
            {isFinancialStatement
              ? " Raw financial statement values are stored in millions."
              : ""}
          </p>
        </div>

        <pre
          style={{
            margin: 0,
            maxHeight: 420,
            overflow: "auto",
            border: "1px solid var(--color-border)",
            background: "rgba(0,0,0,0.22)",
            color: "var(--color-text-primary)",
            borderRadius: 16,
            padding: 16,
            fontSize: 12,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {extracted
            ? JSON.stringify(extracted, null, 2)
            : "No extracted JSON available yet."}
        </pre>
      </section>
    </>
  );
}