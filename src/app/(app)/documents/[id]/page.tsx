import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { categoryLabel, formatFileSize } from "@/lib/document-categories";
import type { ExtractedDocumentData } from "@/lib/gemini";
import { DocumentTimeline } from "../components/DocumentTimeline";
import { DocumentReviewPanel } from "./DocumentReviewPanel";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type LineItem = {
  description: string;
  category: string;
  amount: number | null;
};

const STATUS_COPY: Record<
  string,
  {
    label: string;
    color: string;
    border: string;
    background: string;
  }
> = {
  UPLOADED: {
    label: "Uploaded",
    color: "#8abfff",
    border: "rgba(88,166,255,0.30)",
    background: "rgba(88,166,255,0.10)",
  },
  PROCESSING: {
    label: "Processing",
    color: "#ffd166",
    border: "rgba(255,193,7,0.30)",
    background: "rgba(255,193,7,0.10)",
  },
  PROCESSED: {
    label: "Processed",
    color: "#7bed9f",
    border: "rgba(46,213,115,0.30)",
    background: "rgba(46,213,115,0.10)",
  },
  FAILED: {
    label: "Failed",
    color: "#ff8a95",
    border: "rgba(255,71,87,0.30)",
    background: "rgba(255,71,87,0.10)",
  },
};

const REVIEW_COPY: Record<
  string,
  {
    label: string;
    color: string;
    border: string;
    background: string;
  }
> = {
  NEEDS_REVIEW: {
    label: "Needs review",
    color: "#ffd166",
    border: "rgba(255,193,7,0.30)",
    background: "rgba(255,193,7,0.10)",
  },
  APPROVED: {
    label: "Trusted",
    color: "#7bed9f",
    border: "rgba(46,213,115,0.30)",
    background: "rgba(46,213,115,0.10)",
  },
  REJECTED: {
    label: "Rejected",
    color: "#ff8a95",
    border: "rgba(255,71,87,0.30)",
    background: "rgba(255,71,87,0.10)",
  },
};

function formatDateTime(value?: Date | string | null) {
  if (!value) return "Not available";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getRecord(data: ExtractedDocumentData | null) {
  return (data ?? {}) as unknown as Record<string, unknown>;
}

function getNumberValue(
  data: ExtractedDocumentData | null,
  keys: string[],
): number | null {
  const record = getRecord(data);

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function getStringValue(
  data: ExtractedDocumentData | null,
  keys: string[],
): string | null {
  const record = getRecord(data);

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
}

function formatAmount(amount: number | null, currency?: string | null) {
  if (amount === null) return "Not found";

  const finalCurrency = currency ?? "INR";
  const absoluteValue = Math.abs(amount);

  let compactValue = amount;
  let suffix = "";

  if (absoluteValue >= 1_000_000_000) {
    compactValue = amount / 1_000_000_000;
    suffix = "B";
  } else if (absoluteValue >= 1_000_000) {
    compactValue = amount / 1_000_000;
    suffix = "M";
  } else if (absoluteValue >= 1_000) {
    compactValue = amount / 1_000;
    suffix = "K";
  }

  const currencySymbols: Record<string, string> = {
    INR: "Rs. ",
    USD: "$",
    EUR: "€",
    GBP: "£",
    CHF: "CHF ",
  };

  const symbol = currencySymbols[finalCurrency] ?? `${finalCurrency} `;

  const formattedNumber = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: compactValue % 1 === 0 ? 0 : 2,
  }).format(compactValue);

  return `${symbol}${formattedNumber}${suffix}`;
}

function getLineItems(data: ExtractedDocumentData | null): LineItem[] {
  const record = getRecord(data);
  const rawLineItems = record.lineItems;

  if (!Array.isArray(rawLineItems)) return [];

  return rawLineItems
    .map((item) => {
      const lineItem = item as Record<string, unknown>;

      return {
        description:
          typeof lineItem.description === "string"
            ? lineItem.description
            : "Untitled line item",
        category:
          typeof lineItem.category === "string" ? lineItem.category : "Other",
        amount:
          typeof lineItem.amount === "number" && Number.isFinite(lineItem.amount)
            ? lineItem.amount
            : null,
      };
    })
    .slice(0);
}

function Pill({ type, value }: { type: "status" | "review"; value: string }) {
  const copy =
    type === "status"
      ? STATUS_COPY[value] ?? STATUS_COPY.UPLOADED
      : REVIEW_COPY[value] ?? REVIEW_COPY.NEEDS_REVIEW;

  return (
    <span
      style={{
        border: `1px solid ${copy.border}`,
        background: copy.background,
        color: copy.color,
        borderRadius: 999,
        padding: "8px 11px",
        fontSize: 12,
        fontWeight: 950,
        whiteSpace: "nowrap",
      }}
    >
      {copy.label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "green" | "red" | "blue" | "yellow" | "neutral";
}) {
  const toneStyle = {
    green: {
      color: "#7bed9f",
      border: "rgba(46,213,115,0.25)",
      background: "rgba(46,213,115,0.08)",
    },
    red: {
      color: "#ff8a95",
      border: "rgba(255,71,87,0.25)",
      background: "rgba(255,71,87,0.08)",
    },
    blue: {
      color: "#8abfff",
      border: "rgba(88,166,255,0.25)",
      background: "rgba(88,166,255,0.08)",
    },
    yellow: {
      color: "#ffd166",
      border: "rgba(255,193,7,0.25)",
      background: "rgba(255,193,7,0.08)",
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
        minHeight: 124,
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
          fontSize: 25,
          lineHeight: 1.1,
        }}
      >
        {value}
      </strong>

      <p
        style={{
          margin: 0,
          color: toneStyle.color,
          fontSize: 12,
          fontWeight: 750,
          lineHeight: 1.4,
        }}
      >
        {hint}
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderBottom: "1px solid var(--color-border)",
        padding: "12px 0",
        display: "flex",
        justifyContent: "space-between",
        gap: 18,
        alignItems: "flex-start",
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

      <strong
        style={{
          color: "var(--color-text-primary)",
          fontSize: 13,
          textAlign: "right",
          wordBreak: "break-word",
        }}
      >
        {value}
      </strong>
    </div>
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
      extractedData: true,
      extractedAt: true,
      processingError: true,
      reviewStatus: true,
      reviewedAt: true,
      reviewNote: true,
    },
  });

  if (!document) {
    notFound();
  }

  const extracted = document.extractedData as ExtractedDocumentData | null;
  const currency = getStringValue(extracted, ["currency"]) ?? "INR";
  const lineItems = getLineItems(extracted);

  const summary = getStringValue(extracted, ["summary"]);
  const reportedUnit = getStringValue(extracted, ["reportedUnit"]);
  const unitEvidence = getStringValue(extracted, ["unitDetectionEvidence"]);
  const documentDate = getStringValue(extracted, ["documentDate"]);
  const periodStart = getStringValue(extracted, ["periodStart"]);
  const periodEnd = getStringValue(extracted, ["periodEnd"]);

  const revenue = getNumberValue(extracted, [
    "revenue",
    "totalRevenue",
    "sales",
    "income",
  ]);

  const expenses = getNumberValue(extracted, [
    "expenses",
    "totalExpenses",
    "expenditure",
  ]);

  const profit = getNumberValue(extracted, [
    "profit",
    "netIncome",
    "netProfit",
    "netLoss",
    "loss",
  ]);

  const cash = getNumberValue(extracted, [
    "cash",
    "closingBalance",
    "bankBalance",
  ]);

  const assets = getNumberValue(extracted, ["assets", "totalAssets"]);

  const liabilities = getNumberValue(extracted, [
    "liabilities",
    "totalLiabilities",
  ]);

  const equity = getNumberValue(extracted, ["equity", "totalEquity"]);

  return (
    <>
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
            maxWidth: 820,
          }}
        >
          <Link
            href="/documents"
            style={{
              color: "var(--color-amber)",
              fontSize: 13,
              fontWeight: 900,
              textDecoration: "none",
            }}
          >
            &lt;- Back to documents
          </Link>

          <p
            className="eyebrow"
            style={{
              margin: 0,
            }}
          >
            Document review
          </p>

          <h1
            style={{
              margin: 0,
              lineHeight: 1.08,
              wordBreak: "break-word",
            }}
          >
            {document.fileName}
          </h1>

          <p
            className="page-intro"
            style={{
              margin: 0,
              lineHeight: 1.6,
              maxWidth: 760,
            }}
          >
            Review AI extraction, approve trusted numbers, and decide whether
            this document can update your dashboard and AI finance team.
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
          <Pill type="status" value={document.status} />
          <Pill type="review" value={document.reviewStatus} />
        </div>
      </header>

      <section
        className="section-card"
        style={{
          marginBottom: 24,
          display: "grid",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 12,
              maxWidth: 760,
            }}
          >
            <p
              className="section-title"
              style={{
                margin: 0,
                lineHeight: 1.25,
              }}
            >
              Extraction overview
            </p>

            <p
              className="section-hint"
              style={{
                margin: 0,
                lineHeight: 1.65,
                maxWidth: 720,
              }}
            >
              These are the main numbers the AI detected from this document.
            </p>
          </div>

          <a
            href={`/api/documents/${document.id}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
            style={{
              flex: "0 0 auto",
              marginTop: 2,
            }}
          >
            Open original file
          </a>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <MetricCard
            label="Revenue"
            value={formatAmount(revenue, currency)}
            hint="Detected income / sales"
            tone="green"
          />

          <MetricCard
            label="Expenses"
            value={formatAmount(expenses, currency)}
            hint="Detected costs"
            tone="red"
          />

          <MetricCard
            label="Profit"
            value={formatAmount(profit, currency)}
            hint="Net result"
            tone={profit !== null && profit < 0 ? "red" : "green"}
          />

          <MetricCard
            label="Cash"
            value={formatAmount(cash, currency)}
            hint="Detected balance"
            tone="blue"
          />

          <MetricCard
            label="Assets"
            value={formatAmount(assets, currency)}
            hint="Balance sheet total"
            tone="blue"
          />

          <MetricCard
            label="Liabilities"
            value={formatAmount(liabilities, currency)}
            hint="Obligations"
            tone="yellow"
          />

          <MetricCard
            label="Equity"
            value={formatAmount(equity, currency)}
            hint="Owner value"
            tone="green"
          />
        </div>

        {summary && (
          <div
            style={{
              border: "1px solid var(--color-border)",
              background: "rgba(255,255,255,0.035)",
              borderRadius: 18,
              padding: 16,
            }}
          >
            <p
              style={{
                margin: "0 0 8px",
                color: "var(--color-text-primary)",
                fontWeight: 900,
              }}
            >
              AI summary
            </p>

            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                lineHeight: 1.65,
                fontSize: 14,
              }}
            >
              {summary}
            </p>
          </div>
        )}
      </section>

      <section
        className="section-card"
        style={{
          marginBottom: 24,
          display: "grid",
          gap: 18,
        }}
      >
        <div
          className="section-heading"
          style={{
            alignItems: "flex-start",
          }}
        >
          <div>
            <p className="section-title">Processing timeline</p>
            <p className="section-hint">
              See how this document moved from upload to dashboard impact.
            </p>
          </div>
        </div>

        <DocumentTimeline
          status={document.status}
          reviewStatus={document.reviewStatus}
          uploadedAt={document.uploadedAt}
          extractedAt={document.extractedAt}
          reviewedAt={document.reviewedAt}
          processingError={document.processingError}
        />
      </section>

      <DocumentReviewPanel
        documentId={document.id}
        fileName={document.fileName}
        status={document.status}
        initialReviewStatus={document.reviewStatus}
        initialReviewNote={document.reviewNote}
      />

      <div
        style={{
          height: 24,
        }}
      />

      <section
        className="section-card"
        style={{
          marginBottom: 24,
          display: "grid",
          gap: 18,
        }}
      >
        <div
          className="section-heading"
          style={{
            alignItems: "flex-start",
          }}
        >
          <div>
            <p className="section-title">Document metadata</p>
            <p className="section-hint">
              File details and extraction metadata used by the review workflow.
            </p>
          </div>
        </div>

        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: 18,
            padding: "4px 16px",
            background: "rgba(255,255,255,0.025)",
          }}
        >
          <InfoRow label="Category" value={categoryLabel(document.category)} />
          <InfoRow label="File type" value={document.mimeType} />
          <InfoRow label="File size" value={formatFileSize(document.fileSize)} />
          <InfoRow label="Uploaded" value={formatDateTime(document.uploadedAt)} />
          <InfoRow
            label="Extracted"
            value={formatDateTime(document.extractedAt)}
          />
          <InfoRow label="Reviewed" value={formatDateTime(document.reviewedAt)} />
          <InfoRow label="Currency" value={currency} />
          <InfoRow label="Reported unit" value={reportedUnit ?? "Not detected"} />
          <InfoRow
            label="Unit evidence"
            value={unitEvidence ?? "Not available"}
          />
          <InfoRow label="Document date" value={documentDate ?? "Not found"} />
          <InfoRow
            label="Period"
            value={
              periodStart || periodEnd
                ? `${periodStart ?? "?"} to ${periodEnd ?? "?"}`
                : "Not found"
            }
          />
        </div>
      </section>

      <section
        className="section-card"
        style={{
          marginBottom: 24,
          display: "grid",
          gap: 18,
        }}
      >
        <div
          className="section-heading"
          style={{
            alignItems: "flex-start",
          }}
        >
          <div>
            <p className="section-title">Extracted line items</p>
            <p className="section-hint">
              All line items detected by AI. Use this to verify whether the extraction looks reasonable.
            </p>
          </div>

          <span className="badge-sample">
            {lineItems.length} item{lineItems.length === 1 ? "" : "s"}
          </span>
        </div>

        {lineItems.length === 0 ? (
          <div
            style={{
              border: "1px dashed var(--color-border)",
              background: "rgba(255,255,255,0.03)",
              borderRadius: 18,
              padding: 20,
              color: "var(--color-text-secondary)",
              fontSize: 14,
            }}
          >
            No line items were extracted from this document.
          </div>
        ) : (
          <div
            style={{
              overflowX: "auto",
              border: "1px solid var(--color-border)",
              borderRadius: 18,
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 680,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "rgba(255,255,255,0.045)",
                  }}
                >
                  {["Description", "Category", "Amount"].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        color: "var(--color-text-secondary)",
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        textAlign: heading === "Amount" ? "right" : "left",
                        padding: 13,
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {lineItems.map((item, index) => (
                  <tr key={`${item.description}-${index}`}>
                    <td
                      style={{
                        padding: 13,
                        color: "var(--color-text-primary)",
                        fontSize: 13,
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      {item.description}
                    </td>

                    <td
                      style={{
                        padding: 13,
                        color: "var(--color-text-secondary)",
                        fontSize: 13,
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      {item.category}
                    </td>

                    <td
                      style={{
                        padding: 13,
                        color:
                          item.amount !== null && item.amount < 0
                            ? "#ff8a95"
                            : "var(--color-text-primary)",
                        fontSize: 13,
                        fontWeight: 850,
                        textAlign: "right",
                        borderBottom: "1px solid var(--color-border)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatAmount(item.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        className="section-card"
        style={{
          display: "grid",
          gap: 14,
        }}
      >
        <details>
          <summary
            style={{
              cursor: "pointer",
              color: "var(--color-text-primary)",
              fontWeight: 900,
            }}
          >
            Raw AI extraction JSON
          </summary>

          <pre
            style={{
              marginTop: 14,
              border: "1px solid var(--color-border)",
              background: "rgba(0,0,0,0.20)",
              borderRadius: 18,
              padding: 16,
              overflowX: "auto",
              color: "var(--color-text-secondary)",
              fontSize: 12,
              lineHeight: 1.55,
            }}
          >
            {JSON.stringify(document.extractedData ?? {}, null, 2)}
          </pre>
        </details>
      </section>
    </>
  );
}
