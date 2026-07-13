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
  sourcePage: number | null;
  sourceStatement: string | null;
  sourceColumn: string | null;
  confidence: number | null;
  extractionEngine: string | null;
};

type ExtractionDiagnostics = {
  engine: string;
  confidence: number;
  quality: "high" | "medium" | "low";
  requiresReview: boolean;
  selectedScope?: string | null;
  statementPages?: number[];
  detectedSections?: string[];
  lineItemCount?: number;
  currentPeriod?: string | null;
  warnings?: string[];
  checks?: {
    key: string;
    passed: boolean;
    message: string;
  }[];
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

function getMetricValidation(data: ExtractedDocumentData | null) {
  const validation = data?.metricValidation;

  if (!validation || typeof validation !== "object") {
    return null;
  }

  return validation;
}

function getExtractionDiagnostics(
  data: ExtractedDocumentData | null,
): ExtractionDiagnostics | null {
  const diagnostics = data?.extractionDiagnostics;

  if (!diagnostics || typeof diagnostics !== "object") {
    return null;
  }

  const confidence =
    typeof diagnostics.confidence === "number" &&
    Number.isFinite(diagnostics.confidence)
      ? Math.max(0, Math.min(1, diagnostics.confidence))
      : 0;

  return {
    engine:
      typeof diagnostics.engine === "string"
        ? diagnostics.engine
        : "unknown",
    confidence,
    quality:
      diagnostics.quality === "high" ||
      diagnostics.quality === "medium" ||
      diagnostics.quality === "low"
        ? diagnostics.quality
        : confidence >= 0.9
          ? "high"
          : confidence >= 0.72
            ? "medium"
            : "low",
    requiresReview: diagnostics.requiresReview !== false,
    selectedScope:
      typeof diagnostics.selectedScope === "string"
        ? diagnostics.selectedScope
        : null,
    statementPages: Array.isArray(diagnostics.statementPages)
      ? diagnostics.statementPages.filter(
          (page): page is number =>
            typeof page === "number" && Number.isFinite(page),
        )
      : [],
    detectedSections: Array.isArray(diagnostics.detectedSections)
      ? diagnostics.detectedSections.filter(
          (section): section is string => typeof section === "string",
        )
      : [],
    lineItemCount:
      typeof diagnostics.lineItemCount === "number"
        ? diagnostics.lineItemCount
        : undefined,
    currentPeriod:
      typeof diagnostics.currentPeriod === "string"
        ? diagnostics.currentPeriod
        : null,
    warnings: Array.isArray(diagnostics.warnings)
      ? diagnostics.warnings.filter(
          (warning): warning is string => typeof warning === "string",
        )
      : [],
    checks: Array.isArray(diagnostics.checks)
      ? diagnostics.checks
          .filter(
            (check): check is {
              key: string;
              passed: boolean;
              message: string;
            } =>
              Boolean(check) &&
              typeof check === "object" &&
              typeof check.key === "string" &&
              typeof check.passed === "boolean" &&
              typeof check.message === "string",
          )
      : [],
  };
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
        sourcePage:
          typeof lineItem.sourcePage === "number" &&
          Number.isFinite(lineItem.sourcePage)
            ? lineItem.sourcePage
            : typeof lineItem.pageNumber === "number" &&
                Number.isFinite(lineItem.pageNumber)
              ? lineItem.pageNumber
              : null,
        sourceStatement:
          typeof lineItem.sourceStatement === "string"
            ? lineItem.sourceStatement
            : null,
        sourceColumn:
          typeof lineItem.sourceColumn === "string"
            ? lineItem.sourceColumn
            : null,
        confidence:
          typeof lineItem.confidence === "number" &&
          Number.isFinite(lineItem.confidence)
            ? Math.max(0, Math.min(1, lineItem.confidence))
            : null,
        extractionEngine:
          typeof lineItem.extractionEngine === "string"
            ? lineItem.extractionEngine
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

  const positiveOrSignedNetIncome = getNumberValue(extracted, [
    "netIncome",
    "profit",
    "netProfit",
  ]);
  const reportedLoss = getNumberValue(extracted, ["loss", "netLoss"]);
  const profit =
    positiveOrSignedNetIncome ??
    (reportedLoss === null ? null : -Math.abs(reportedLoss));

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
  const metricValidation = getMetricValidation(extracted);
  const extractionDiagnostics = getExtractionDiagnostics(extracted);
  const invalidatedMetrics = new Set(metricValidation?.invalidatedFields ?? []);
  const validationNeedsReview = metricValidation?.status === "needs_review";

  function metricValue(
    metric: "revenue" | "expenses" | "netIncome" | "cash" | "assets" | "liabilities" | "equity",
    value: number | null,
  ) {
    return invalidatedMetrics.has(metric)
      ? "Needs verification"
      : formatAmount(value, currency);
  }

  function metricHint(
    metric: "revenue" | "expenses" | "netIncome" | "cash" | "assets" | "liabilities" | "equity",
    normalHint: string,
  ) {
    return invalidatedMetrics.has(metric)
      ? "Hidden after accounting consistency check"
      : normalHint;
  }

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
            ← Back to documents
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
            value={metricValue("revenue", revenue)}
            hint={metricHint("revenue", "Detected income / sales")}
            tone={invalidatedMetrics.has("revenue") ? "yellow" : "green"}
          />

          <MetricCard
            label="Expenses"
            value={metricValue("expenses", expenses)}
            hint={metricHint("expenses", "Detected costs")}
            tone={invalidatedMetrics.has("expenses") ? "yellow" : "red"}
          />

          <MetricCard
            label="Profit"
            value={metricValue("netIncome", profit)}
            hint={metricHint("netIncome", "Net result")}
            tone={
              invalidatedMetrics.has("netIncome")
                ? "yellow"
                : profit !== null && profit < 0
                  ? "red"
                  : "green"
            }
          />

          <MetricCard
            label="Cash"
            value={metricValue("cash", cash)}
            hint={metricHint("cash", "Detected balance")}
            tone={invalidatedMetrics.has("cash") ? "yellow" : "blue"}
          />

          <MetricCard
            label="Assets"
            value={metricValue("assets", assets)}
            hint={metricHint("assets", "Balance sheet total")}
            tone={invalidatedMetrics.has("assets") ? "yellow" : "blue"}
          />

          <MetricCard
            label="Liabilities"
            value={metricValue("liabilities", liabilities)}
            hint={metricHint("liabilities", "Obligations")}
            tone="yellow"
          />

          <MetricCard
            label="Equity"
            value={metricValue("equity", equity)}
            hint={metricHint("equity", "Owner value")}
            tone={invalidatedMetrics.has("equity") ? "yellow" : "green"}
          />
        </div>

        {extractionDiagnostics && (
          <div
            style={{
              border: `1px solid ${
                extractionDiagnostics.quality === "high"
                  ? "rgba(46,213,115,0.28)"
                  : extractionDiagnostics.quality === "medium"
                    ? "rgba(255,193,7,0.30)"
                    : "rgba(255,71,87,0.30)"
              }`,
              background:
                extractionDiagnostics.quality === "high"
                  ? "rgba(46,213,115,0.07)"
                  : extractionDiagnostics.quality === "medium"
                    ? "rgba(255,193,7,0.07)"
                    : "rgba(255,71,87,0.07)",
              borderRadius: 18,
              padding: 16,
              display: "grid",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <strong style={{ color: "var(--color-text-primary)", fontSize: 14 }}>
                Extraction confidence
              </strong>
              <span className="badge-sample">
                {Math.round(extractionDiagnostics.confidence * 100)}% · {extractionDiagnostics.engine}
              </span>
            </div>

            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {extractionDiagnostics.selectedScope
                ? `${extractionDiagnostics.selectedScope} scope`
                : "Scope not identified"}
              {extractionDiagnostics.statementPages?.length
                ? ` · pages ${extractionDiagnostics.statementPages.join(", ")}`
                : ""}
              {typeof extractionDiagnostics.lineItemCount === "number"
                ? ` · ${extractionDiagnostics.lineItemCount} detailed rows`
                : ""}
              {extractionDiagnostics.currentPeriod
                ? ` · period ${extractionDiagnostics.currentPeriod}`
                : ""}
            </p>

            {extractionDiagnostics.checks?.map((check) => (
              <p
                key={check.key}
                style={{
                  margin: 0,
                  color: check.passed ? "#7bed9f" : "#ff8a95",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                {check.passed ? "✓" : "!"} {check.message}
              </p>
            ))}

            {extractionDiagnostics.warnings?.slice(0, 4).map((warning) => (
              <p
                key={warning}
                style={{
                  margin: 0,
                  color: "#ffd166",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                ! {warning}
              </p>
            ))}
          </div>
        )}

        {validationNeedsReview && (
          <div
            style={{
              border: "1px solid rgba(255, 138, 149, 0.30)",
              background: "rgba(255, 138, 149, 0.08)",
              borderRadius: 18,
              padding: 16,
              display: "grid",
              gap: 8,
            }}
          >
            <strong style={{ color: "#ff8a95", fontSize: 14 }}>
              Some numbers failed validation
            </strong>
            <p
              style={{
                margin: 0,
                color: "var(--color-text-secondary)",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              Aureli hid inconsistent values instead of sending incorrect figures
              to the ledger and dashboard. Verify the original statement or retry
              extraction.
            </p>
            {metricValidation?.warnings?.slice(0, 3).map((warning) => (
              <p
                key={warning}
                style={{
                  margin: 0,
                  color: "var(--color-text-secondary)",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                • {warning}
              </p>
            ))}
          </div>
        )}

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
                minWidth: 920,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "rgba(255,255,255,0.045)",
                  }}
                >
                  {["Description", "Source", "Category", "Confidence", "Amount"].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        color: "var(--color-text-secondary)",
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        textAlign:
                          heading === "Amount" || heading === "Confidence"
                            ? "right"
                            : "left",
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
                        fontSize: 12,
                        borderBottom: "1px solid var(--color-border)",
                        minWidth: 210,
                      }}
                      title={item.sourceColumn ?? undefined}
                    >
                      <div style={{ display: "grid", gap: 3 }}>
                        <span>{item.sourceStatement ?? "Source not mapped"}</span>
                        <span>
                          {item.sourcePage ? `Page ${item.sourcePage}` : "Page unavailable"}
                          {item.extractionEngine
                            ? ` · ${item.extractionEngine}`
                            : ""}
                        </span>
                      </div>
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
                          item.confidence !== null && item.confidence >= 0.9
                            ? "#7bed9f"
                            : item.confidence !== null && item.confidence >= 0.72
                              ? "#ffd166"
                              : "var(--color-text-secondary)",
                        fontSize: 12,
                        fontWeight: 800,
                        textAlign: "right",
                        borderBottom: "1px solid var(--color-border)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.confidence === null
                        ? "—"
                        : `${Math.round(item.confidence * 100)}%`}
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
