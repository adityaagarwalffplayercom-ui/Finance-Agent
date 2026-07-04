import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type ExtractedLineItem = {
  description?: string;
  amount?: number;
  category?: string;
  date?: string;
};

type ExtractedData = {
  summary?: string;
  description?: string;
  documentDate?: string;
  date?: string;
  periodStart?: string;
  startDate?: string;
  periodEnd?: string;
  endDate?: string;
  currency?: string;
  totalAmount?: number;
  amount?: number;
  revenue?: number;
  totalRevenue?: number;
  sales?: number;
  expenses?: number;
  totalExpenses?: number;
  profit?: number;
  netProfit?: number;
  loss?: number;
  netLoss?: number;
  cash?: number;
  closingBalance?: number;
  openingBalance?: number;
  balance?: number;
  lineItems?: ExtractedLineItem[];
  [key: string]: unknown;
};

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "-";

  const parsed = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(parsed.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatMoney(value: unknown, currency = "INR") {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";

  const absoluteValue = Math.abs(value);

  let compactValue = value;
  let suffix = "";

  if (absoluteValue >= 1_000_000_000) {
    compactValue = value / 1_000_000_000;
    suffix = "B";
  } else if (absoluteValue >= 1_000_000) {
    compactValue = value / 1_000_000;
    suffix = "M";
  } else if (absoluteValue >= 1_000) {
    compactValue = value / 1_000;
    suffix = "K";
  }

  const currencySymbols: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
  };

  const symbol = currencySymbols[currency] ?? `${currency} `;

  const formattedNumber = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: compactValue % 1 === 0 ? 0 : 2,
  }).format(compactValue);

  return `${symbol}${formattedNumber}${suffix}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function prettyCategory(category: string) {
  return category
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusStyle(status: string) {
  if (status === "PROCESSED" || status === "APPROVED") {
    return {
      border: "1px solid rgba(46,213,115,0.28)",
      background: "rgba(46,213,115,0.10)",
      color: "#7bed9f",
    };
  }

  if (status === "FAILED" || status === "REJECTED") {
    return {
      border: "1px solid rgba(255,71,87,0.28)",
      background: "rgba(255,71,87,0.10)",
      color: "#ff8a95",
    };
  }

  return {
    border: "1px solid rgba(255,193,7,0.28)",
    background: "rgba(255,193,7,0.10)",
    color: "#ffd166",
  };
}

function getNumber(data: ExtractedData | null, keys: string[]) {
  if (!data) return undefined;

  for (const key of keys) {
    const value = data[key];

    if (typeof value === "number" && !Number.isNaN(value)) {
      return value;
    }
  }

  return undefined;
}

function getString(data: ExtractedData | null, keys: string[]) {
  if (!data) return undefined;

  for (const key of keys) {
    const value = data[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return undefined;
}

function getLineItems(data: ExtractedData | null) {
  if (!data || !Array.isArray(data.lineItems)) return [];

  return data.lineItems.filter(
    (item) =>
      item &&
      (typeof item.description === "string" || typeof item.amount === "number"),
  );
}

function getAmountMultiplier(category: string) {
  // Most financial statements show values in thousands.
  // Example: 22,700 means 22,700,000, so display it as ₹22.7M.
  if (category === "FINANCIAL_STATEMENT") {
    return 1000;
  }

  return 1;
}

function scaleAmount(value: number | undefined, multiplier: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return value * multiplier;
}

async function getSessionUserId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session?.user?.id ?? null;
}

async function updateReviewStatus(formData: FormData) {
  "use server";

  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const documentId = String(formData.get("documentId") ?? "");
  const action = String(formData.get("action") ?? "");
  const reviewNote = String(formData.get("reviewNote") ?? "").trim();

  if (!documentId) {
    throw new Error("Document id missing.");
  }

  const reviewStatus = action === "approve" ? "APPROVED" : "REJECTED";

  await prisma.document.updateMany({
    where: {
      id: documentId,
      userId,
    },
    data: {
      reviewStatus,
      reviewedAt: new Date(),
      reviewNote: reviewNote || null,
    },
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/dashboard");

  redirect(`/documents/${documentId}`);
}

export default async function DocumentDetailsPage({ params }: PageProps) {
  const { id } = await params;

  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const document = await prisma.document.findFirst({
    where: {
      id,
      userId,
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      category: true,
      status: true,
      extractedData: true,
      extractedAt: true,
      processingError: true,
      reviewStatus: true,
      reviewedAt: true,
      reviewNote: true,
      uploadedAt: true,
    },
  });

  if (!document) {
    notFound();
  }

  const data = document.extractedData as ExtractedData | null;
  const currency = getString(data, ["currency"]) ?? "INR";

  const amountMultiplier = getAmountMultiplier(document.category);

  const totalAmount = getNumber(data, ["totalAmount", "amount"]);
  const revenue = getNumber(data, ["revenue", "totalRevenue", "sales"]);
  const expenses = getNumber(data, ["expenses", "totalExpenses"]);
  const profit = getNumber(data, ["profit", "netProfit"]);
  const loss = getNumber(data, ["loss", "netLoss"]);
  const cash = getNumber(data, ["cash", "closingBalance", "balance"]);

  const scaledTotalAmount = scaleAmount(totalAmount, amountMultiplier);
  const scaledRevenue = scaleAmount(revenue, amountMultiplier);
  const scaledExpenses = scaleAmount(expenses, amountMultiplier);
  const scaledProfit = scaleAmount(profit, amountMultiplier);
  const scaledLoss = scaleAmount(loss, amountMultiplier);
  const scaledCash = scaleAmount(cash, amountMultiplier);

  const summary =
    getString(data, ["summary", "description"]) ??
    "No AI summary was extracted for this document.";

  const documentDate = getString(data, ["documentDate", "date"]);
  const periodStart = getString(data, ["periodStart", "startDate"]);
  const periodEnd = getString(data, ["periodEnd", "endDate"]);
  const lineItems = getLineItems(data);

  const fallbackLineItemDate =
    documentDate ??
    periodEnd ??
    periodStart ??
    document.extractedAt ??
    document.uploadedAt;

  const fallbackLineItemCategory = prettyCategory(document.category);

  const isProcessed = document.status === "PROCESSED";
  const isApproved = document.reviewStatus === "APPROVED";
  const isRejected = document.reviewStatus === "REJECTED";
  const canReview = isProcessed;

  return (
    <>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Document details</p>
          <h1>{document.fileName}</h1>
        </div>

        <Link
          href="/documents"
          style={{
            border: "1px solid var(--color-border)",
            background: "rgba(255,255,255,0.04)",
            color: "var(--color-text-primary)",
            borderRadius: 12,
            padding: "10px 13px",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          ← Back to documents
        </Link>
      </header>

      <p className="page-intro">
        Review the AI extraction before trusting this document. Only approved
        documents are used in the dashboard, AI team, and finance chat.
      </p>

      <section
        className="alerts-card"
        style={{
          display: "grid",
          gap: 18,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p className="section-title">Trust status</p>
            <p className="section-hint">
              Check AI extraction quality before approving this file.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                ...statusStyle(document.status),
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 999,
                padding: "8px 11px",
                fontSize: 12,
                fontWeight: 850,
              }}
            >
              AI: {prettyCategory(document.status)}
            </span>

            <span
              style={{
                ...statusStyle(document.reviewStatus),
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 999,
                padding: "8px 11px",
                fontSize: 12,
                fontWeight: 850,
              }}
            >
              Review: {prettyCategory(document.reviewStatus)}
            </span>
          </div>
        </div>

        {document.processingError && (
          <div
            style={{
              border: "1px solid rgba(255,71,87,0.28)",
              background: "rgba(255,71,87,0.08)",
              borderRadius: 16,
              padding: 14,
            }}
          >
            <p
              style={{
                margin: "0 0 6px",
                color: "#ff8a95",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              Processing failed
            </p>

            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 13,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
              }}
            >
              {document.processingError}
            </p>
          </div>
        )}

        {canReview && (
          <form
            action={updateReviewStatus}
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            <input type="hidden" name="documentId" value={document.id} />

            <label
              style={{
                display: "grid",
                gap: 8,
                color: "var(--color-text-secondary)",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Review note optional
              <textarea
                name="reviewNote"
                defaultValue={document.reviewNote ?? ""}
                placeholder="Example: Numbers match the uploaded financial statement."
                rows={3}
                style={{
                  width: "100%",
                  resize: "vertical",
                  border: "1px solid var(--color-border)",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.035)",
                  color: "var(--color-text-primary)",
                  padding: 12,
                  fontFamily: "inherit",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </label>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                type="submit"
                name="action"
                value="approve"
                disabled={isApproved}
                style={{
                  border: "none",
                  background: "var(--color-amber)",
                  color: "var(--color-base)",
                  borderRadius: 12,
                  padding: "11px 15px",
                  fontSize: 14,
                  fontWeight: 850,
                  cursor: isApproved ? "not-allowed" : "pointer",
                  opacity: isApproved ? 0.65 : 1,
                }}
              >
                {isApproved ? "Approved" : "Approve for dashboard"}
              </button>

              <button
                type="submit"
                name="action"
                value="reject"
                disabled={isRejected}
                style={{
                  border: "1px solid rgba(255,71,87,0.34)",
                  background: "rgba(255,71,87,0.08)",
                  color: "#ff8a95",
                  borderRadius: 12,
                  padding: "11px 15px",
                  fontSize: 14,
                  fontWeight: 850,
                  cursor: isRejected ? "not-allowed" : "pointer",
                  opacity: isRejected ? 0.65 : 1,
                }}
              >
                {isRejected ? "Rejected" : "Reject document"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section
        className="dashboard-top-grid"
        style={{
          marginBottom: 24,
        }}
      >
        <div className="stat-card">
          <p className="stat-label">Total amount</p>
          <p className="stat-value">
            {formatMoney(scaledTotalAmount, currency)}
          </p>
          <p className="stat-delta stat-delta-neutral">
            Main extracted amount
          </p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Revenue</p>
          <p className="stat-value">{formatMoney(scaledRevenue, currency)}</p>
          <p className="stat-delta stat-delta-positive">
            Extracted from AI data
          </p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Expenses</p>
          <p className="stat-value">{formatMoney(scaledExpenses, currency)}</p>
          <p className="stat-delta stat-delta-warning">
            Extracted from AI data
          </p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Profit / Loss</p>
          <p className="stat-value">
            {scaledProfit !== undefined
              ? formatMoney(scaledProfit, currency)
              : scaledLoss !== undefined
                ? formatMoney(-Math.abs(scaledLoss), currency)
                : "-"}
          </p>
          <p className="stat-delta stat-delta-neutral">
            Used for dashboard health
          </p>
        </div>
      </section>

      <section
        className="dashboard-bottom-grid"
        style={{
          marginBottom: 24,
        }}
      >
        <div className="alerts-card">
          <div className="cashflow-header">
            <div>
              <p className="section-title">AI summary</p>
              <p className="section-hint">
                Human-readable interpretation of the document.
              </p>
            </div>
          </div>

          <p
            style={{
              margin: 0,
              color: "var(--color-text-secondary)",
              fontSize: 14,
              lineHeight: 1.7,
            }}
          >
            {summary}
          </p>
        </div>

        <div className="alerts-card">
          <div className="cashflow-header">
            <div>
              <p className="section-title">Document metadata</p>
              <p className="section-hint">
                File and accounting period details.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            {[
              ["Category", prettyCategory(document.category)],
              ["File size", formatBytes(document.fileSize)],
              ["MIME type", document.mimeType],
              ["Uploaded", formatDate(document.uploadedAt)],
              ["Extracted", formatDate(document.extractedAt)],
              ["Reviewed", formatDate(document.reviewedAt)],
              ["Document date", formatDate(documentDate)],
              [
                "Period",
                periodStart || periodEnd
                  ? `${formatDate(periodStart)} → ${formatDate(periodEnd)}`
                  : "-",
              ],
              ["Currency", currency],
              ["Cash / balance", formatMoney(scaledCash, currency)],
              [
                "Amount scale",
                amountMultiplier === 1000
                  ? "Values displayed after ×1000 financial statement scaling"
                  : "Actual extracted values",
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  paddingBottom: 9,
                }}
              >
                <span
                  style={{
                    color: "var(--color-text-secondary)",
                    fontSize: 13,
                  }}
                >
                  {label}
                </span>

                <span
                  style={{
                    color: "var(--color-text-primary)",
                    fontSize: 13,
                    fontWeight: 750,
                    textAlign: "right",
                    wordBreak: "break-word",
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="alerts-card"
        style={{
          marginBottom: 24,
        }}
      >
        <div className="cashflow-header">
          <div>
            <p className="section-title">Extracted line items</p>
            <p className="section-hint">
              Detailed items found by AI, if available.
            </p>
          </div>

          <span className="section-hint">{lineItems.length} items</span>
        </div>

        {lineItems.length === 0 ? (
          <p
            style={{
              margin: 0,
              color: "var(--color-text-secondary)",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            No line items were extracted. This is normal for summary financial
            statements, but invoices and bank statements should usually show
            rows here.
          </p>
        ) : (
          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 620,
              }}
            >
              <thead>
                <tr>
                  {["Description", "Category", "Date", "Amount"].map(
                    (heading) => (
                      <th
                        key={heading}
                        style={{
                          textAlign: heading === "Amount" ? "right" : "left",
                          color: "var(--color-text-secondary)",
                          fontSize: 12,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          padding: "0 0 12px",
                          borderBottom: "1px solid var(--color-border)",
                        }}
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>

              <tbody>
                {lineItems.map((item, index) => {
                  const scaledLineAmount =
                    typeof item.amount === "number"
                      ? item.amount * amountMultiplier
                      : undefined;

                  return (
                    <tr key={`${item.description ?? "item"}-${index}`}>
                      <td
                        style={{
                          padding: "13px 10px 13px 0",
                          color: "var(--color-text-primary)",
                          fontSize: 14,
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {item.description ?? "-"}
                      </td>

                      <td
                        style={{
                          padding: "13px 10px",
                          color: "var(--color-text-secondary)",
                          fontSize: 13,
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {item.category ?? fallbackLineItemCategory}
                      </td>

                      <td
                        style={{
                          padding: "13px 10px",
                          color: "var(--color-text-secondary)",
                          fontSize: 13,
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {formatDate(item.date ?? fallbackLineItemDate)}
                      </td>

                      <td
                        style={{
                          padding: "13px 0 13px 10px",
                          color: "var(--color-text-primary)",
                          fontSize: 14,
                          fontWeight: 800,
                          textAlign: "right",
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {formatMoney(scaledLineAmount, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="alerts-card">
        <div className="cashflow-header">
          <div>
            <p className="section-title">Raw AI extraction</p>
            <p className="section-hint">
              Developer view for checking Gemini output. Raw values are shown
              exactly as AI saved them.
            </p>
          </div>
        </div>

        <pre
          style={{
            margin: 0,
            maxHeight: 420,
            overflow: "auto",
            border: "1px solid var(--color-border)",
            borderRadius: 16,
            background: "rgba(0,0,0,0.22)",
            color: "var(--color-text-secondary)",
            padding: 16,
            fontSize: 12,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {JSON.stringify(data ?? {}, null, 2)}
        </pre>
      </section>
    </>
  );
}