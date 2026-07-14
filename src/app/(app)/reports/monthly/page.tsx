"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type MonthlyReportMoney = {
  raw: number;
  formatted: string;
};

type MonthlyReportLineItem = {
  description: string;
  category: string;
  amount: MonthlyReportMoney;
  date: string | null;
  sourceFileName: string;
};

type MonthlyFinanceReport = {
  generatedAt: string;
  month: string;
  monthLabel: string;
  periodStart: string;
  periodEnd: string;
  business: {
    name: string;
    industry: string;
    businessType: string;
    country: string;
    currency: string;
    financialYear: string;
  };
  metrics: {
    revenue: MonthlyReportMoney;
    expenses: MonthlyReportMoney;
    profit: MonthlyReportMoney;
    cash: MonthlyReportMoney;
    profitMarginPercent: number | null;
    expenseRatioPercent: number | null;
    revenueCoveragePercent: number | null;
  };
  documentSummary: {
    approvedDocumentsUsed: number;
    pendingReviewDocuments: number;
    rejectedDocuments: number;
    processedDocuments: number;
    sourceDocuments: string[];
  };
  topRevenueItems: MonthlyReportLineItem[];
  topExpenseItems: MonthlyReportLineItem[];
  riskSignals: string[];
  opportunities: string[];
  missingData: string[];
  executiveSummary: string;
  aiNarrative: string;
  confidence: "High" | "Medium" | "Low";
};

type MonthlyReportApiResponse = {
  message: string;
  report: MonthlyFinanceReport;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMonthlyReportApiResponse(
  value: unknown,
): value is MonthlyReportApiResponse {
  return isRecord(value) && isRecord(value.report);
}

function getApiErrorMessage(value: unknown) {
  if (!isRecord(value)) {
    return "Could not load monthly report.";
  }

  if (typeof value.error === "string" && value.error.trim()) {
    return value.error;
  }

  if (typeof value.detail === "string" && value.detail.trim()) {
    return value.detail;
  }

  return "Could not load monthly report.";
}

function getCurrentMonth() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getConfidenceClass(confidence: MonthlyFinanceReport["confidence"]) {
  if (confidence === "High") {
    return "monthly-confidence-high";
  }

  if (confidence === "Medium") {
    return "monthly-confidence-medium";
  }

  return "monthly-confidence-low";
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "N/A";
  }

  return `${value}%`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function MonthlyReportPage() {
  const [month, setMonth] = useState("");
  const [report, setReport] = useState<MonthlyFinanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const narrativeLines = useMemo(() => {
    if (!report?.aiNarrative) {
      return [];
    }

    return report.aiNarrative
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }, [report]);

  async function loadReport(inputMonth?: string) {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (inputMonth?.trim()) {
        params.set("month", inputMonth.trim());
      }

      const response = await fetch(`/api/reports/monthly?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const data: unknown = await response.json();

      if (!response.ok || !isMonthlyReportApiResponse(data)) {
        setError(getApiErrorMessage(data));
        return;
      }

      setReport(data.report);
      setMonth(data.report.month);
    } catch {
      setError("Something went wrong while loading monthly report.");
    } finally {
      setLoading(false);
    }
  }

  function printReport() {
    window.print();
  }

  useEffect(() => {
    void loadReport();
  }, []);

  return (
    <main>
      <style jsx>{`
        .monthly-page {
          display: grid;
          gap: 18px;
          width: 100%;
          min-width: 0;
        }

        .monthly-hero {
          overflow: hidden;
        }

        .monthly-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 24px;
          align-items: start;
        }

        .monthly-copy {
          min-width: 0;
          max-width: 880px;
        }

        .monthly-eyebrow {
          display: block;
          margin: 0 0 14px;
          font-size: 12px;
          line-height: 1.4 !important;
          font-weight: 800;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(245, 158, 11, 0.92);
        }

        .monthly-title {
          display: block;
          margin: 0;
          max-width: 880px;
          font-size: clamp(36px, 5.8vw, 72px) !important;
          line-height: 1.08 !important;
          letter-spacing: -0.045em;
          color: rgb(255, 255, 255);
          overflow-wrap: anywhere;
        }

        .monthly-description {
          display: block;
          margin: 18px 0 0 !important;
          max-width: 760px;
          color: rgba(226, 232, 240, 0.74);
          font-size: 15px !important;
          line-height: 1.75 !important;
        }

        .monthly-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
          align-items: center;
          padding-top: 32px;
        }

        .monthly-primary-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          border-radius: 999px;
          padding: 12px 18px;
          border: 1px solid rgba(245, 158, 11, 0.42);
          background: linear-gradient(
            135deg,
            rgba(245, 158, 11, 0.96),
            rgba(251, 191, 36, 0.9)
          );
          color: rgb(24, 24, 27);
          font-size: 13px;
          font-weight: 900;
          text-decoration: none;
          box-shadow: 0 18px 50px rgba(245, 158, 11, 0.18);
          white-space: nowrap;
          cursor: pointer;
        }

        .monthly-primary-action:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .monthly-filter-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto;
          gap: 12px;
          align-items: end;
        }

        .monthly-field {
          display: grid;
          gap: 7px;
          min-width: 0;
        }

        .monthly-label {
          color: rgba(226, 232, 240, 0.72);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .monthly-input {
          width: 100%;
          min-height: 44px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.22);
          padding: 12px 14px;
          color: white;
          outline: none;
          font-size: 13px;
        }

        .monthly-input:focus {
          border-color: rgba(245, 158, 11, 0.45);
          box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.08);
        }

        .monthly-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .monthly-stat-card,
        .monthly-card,
        .monthly-line-card,
        .monthly-report-card {
          min-width: 0;
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background:
            radial-gradient(
              circle at top left,
              rgba(245, 158, 11, 0.14),
              transparent 36%
            ),
            rgba(255, 255, 255, 0.045);
          padding: 18px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
        }

        .monthly-stat-label {
          margin: 0;
          color: rgba(226, 232, 240, 0.68);
          font-size: 12px;
          line-height: 1.4;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .monthly-stat-value {
          margin: 10px 0 0;
          color: white;
          font-size: 30px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.06em;
        }

        .monthly-stat-hint {
          margin: 8px 0 0;
          color: rgba(148, 163, 184, 0.92);
          font-size: 12px;
          line-height: 1.6;
        }

        .monthly-grid-2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .monthly-card-title {
          margin: 0;
          color: white;
          font-size: 22px;
          line-height: 1.15 !important;
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .monthly-card-text {
          margin: 10px 0 0;
          color: rgba(226, 232, 240, 0.72);
          font-size: 13px;
          line-height: 1.7 !important;
        }

        .monthly-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: max-content;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11px;
          line-height: 1;
          font-weight: 900;
          white-space: nowrap;
        }

        .monthly-confidence-high {
          border: 1px solid rgba(52, 211, 153, 0.28);
          background: rgba(52, 211, 153, 0.12);
          color: rgba(209, 250, 229, 0.98);
        }

        .monthly-confidence-medium {
          border: 1px solid rgba(245, 158, 11, 0.3);
          background: rgba(245, 158, 11, 0.12);
          color: rgba(254, 243, 199, 0.98);
        }

        .monthly-confidence-low {
          border: 1px solid rgba(248, 113, 113, 0.3);
          background: rgba(248, 113, 113, 0.12);
          color: rgba(254, 226, 226, 0.98);
        }

        .monthly-list {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }

        .monthly-list-item {
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.18);
          padding: 12px 13px;
          color: rgba(226, 232, 240, 0.8);
          font-size: 13px;
          line-height: 1.55 !important;
        }

        .monthly-list-item span {
          color: rgba(52, 211, 153, 0.96);
          font-weight: 900;
          margin-right: 8px;
        }

        .monthly-line-grid {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }

        .monthly-line-card {
          border-radius: 20px;
          padding: 14px;
          background:
            radial-gradient(
              circle at top left,
              rgba(255, 255, 255, 0.07),
              transparent 42%
            ),
            rgba(0, 0, 0, 0.16);
        }

        .monthly-line-top {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          justify-content: space-between;
        }

        .monthly-line-title {
          margin: 0;
          color: white;
          font-size: 14px;
          line-height: 1.35 !important;
          font-weight: 900;
        }

        .monthly-line-meta {
          margin: 5px 0 0;
          color: rgba(148, 163, 184, 0.9);
          font-size: 11px;
          line-height: 1.45 !important;
        }

        .monthly-line-amount {
          flex: 0 0 auto;
          color: white;
          font-size: 14px;
          font-weight: 950;
          white-space: nowrap;
        }

        .monthly-narrative {
          white-space: pre-wrap;
        }

        .monthly-narrative p {
          margin: 0 0 12px;
          color: rgba(226, 232, 240, 0.78);
          font-size: 13px;
          line-height: 1.75 !important;
        }

        .monthly-empty,
        .monthly-error {
          border-radius: 24px;
          padding: 16px;
          border: 1px solid rgba(245, 158, 11, 0.25);
          background: rgba(245, 158, 11, 0.1);
          color: rgba(254, 243, 199, 0.95);
          font-size: 13px;
          line-height: 1.6 !important;
          font-weight: 700;
        }

        .monthly-error {
          border-color: rgba(248, 113, 113, 0.28);
          background: rgba(248, 113, 113, 0.12);
          color: rgba(254, 226, 226, 0.96);
        }

        .monthly-note {
          margin: 0;
          color: rgba(148, 163, 184, 0.9);
          font-size: 12px;
          line-height: 1.7 !important;
        }

        @media print {
          .sidebar,
          .monthly-actions,
          .monthly-filter-section {
            display: none !important;
          }

          .dashboard-main {
            margin-left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }

          main {
            color: black !important;
            background: white !important;
          }
        }

        @media (max-width: 1180px) {
          .monthly-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .monthly-grid-2 {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 980px) {
          .monthly-hero-grid,
          .monthly-filter-grid,
          .monthly-stats-grid {
            grid-template-columns: 1fr;
          }

          .monthly-actions {
            justify-content: flex-start;
            padding-top: 0;
          }

          .monthly-primary-action,
          .monthly-actions .btn-ghost {
            width: 100%;
          }

          .monthly-title {
            font-size: clamp(34px, 11vw, 54px) !important;
            line-height: 1.1 !important;
            letter-spacing: -0.04em;
          }

          .monthly-description {
            font-size: 14px !important;
            line-height: 1.7 !important;
          }
        }

        @media (max-width: 560px) {
          .monthly-title {
            font-size: clamp(32px, 10vw, 44px) !important;
            line-height: 1.12 !important;
            letter-spacing: -0.035em;
          }

          .monthly-description {
            margin-top: 14px !important;
            font-size: 13px !important;
          }

          .monthly-line-top {
            flex-direction: column;
          }

          .monthly-line-amount {
            white-space: normal;
          }
        }
      `}</style>

      <div className="monthly-page">
        <section className="section-card monthly-hero">
          <div className="monthly-hero-grid">
            <div className="monthly-copy">
              <p className="monthly-eyebrow">Monthly AI Finance Report</p>

              <h1 className="monthly-title">
                CFO-style monthly financial review.
              </h1>

              <p className="monthly-description">
                Actic Finance reviews approved documents, extracted line items,
                financial metrics, and risk signals to create a monthly
                share-ready report for your business.
              </p>
            </div>

            <div className="monthly-actions">
              <button
                type="button"
                onClick={() => loadReport(month)}
                disabled={loading}
                className="monthly-primary-action"
              >
                {loading ? "Generating..." : "Regenerate report"}
              </button>

              <button type="button" onClick={printReport} className="btn-ghost">
                Print / Save PDF
              </button>
            </div>
          </div>
        </section>

        <section className="section-card monthly-filter-section">
          <div className="monthly-filter-grid">
            <label className="monthly-field">
              <span className="monthly-label">Report month</span>
              <input
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                type="month"
                placeholder={getCurrentMonth()}
                className="monthly-input"
              />
            </label>

            <button
              type="button"
              onClick={() => loadReport(month)}
              disabled={loading}
              className="monthly-primary-action"
            >
              Apply month
            </button>

            <Link href="/documents" className="btn-ghost">
              Review documents
            </Link>
          </div>
        </section>

        {error ? <div className="monthly-error">{error}</div> : null}

        {loading ? (
          <div className="monthly-empty">
            Generating monthly finance report...
          </div>
        ) : null}

        {!loading && !report ? (
          <div className="monthly-empty">No report available yet.</div>
        ) : null}

        {report ? (
          <>
            <section className="monthly-stats-grid">
              <article className="monthly-stat-card">
                <p className="monthly-stat-label">Revenue</p>
                <p className="monthly-stat-value">
                  {report.metrics.revenue.formatted}
                </p>
                <p className="monthly-stat-hint">{report.monthLabel}</p>
              </article>

              <article className="monthly-stat-card">
                <p className="monthly-stat-label">Expenses</p>
                <p className="monthly-stat-value">
                  {report.metrics.expenses.formatted}
                </p>
                <p className="monthly-stat-hint">
                  Expense ratio:{" "}
                  {formatPercent(report.metrics.expenseRatioPercent)}
                </p>
              </article>

              <article className="monthly-stat-card">
                <p className="monthly-stat-label">Profit / Loss</p>
                <p className="monthly-stat-value">
                  {report.metrics.profit.formatted}
                </p>
                <p className="monthly-stat-hint">
                  Margin: {formatPercent(report.metrics.profitMarginPercent)}
                </p>
              </article>

              <article className="monthly-stat-card">
                <p className="monthly-stat-label">Cash</p>
                <p className="monthly-stat-value">
                  {report.metrics.cash.formatted}
                </p>
                <p className="monthly-stat-hint">
                  Confidence:{" "}
                  <span
                    className={`monthly-pill ${getConfidenceClass(
                      report.confidence,
                    )}`}
                  >
                    {report.confidence}
                  </span>
                </p>
              </article>
            </section>

            <section className="section-card">
              <div className="monthly-hero-grid">
                <div>
                  <p className="monthly-eyebrow">Executive summary</p>
                  <h2 className="monthly-card-title">
                    {report.business.name || "Business"} · {report.monthLabel}
                  </h2>
                  <p className="monthly-card-text">
                    {report.executiveSummary}
                  </p>
                </div>

                <div className="monthly-actions">
                  <span
                    className={`monthly-pill ${getConfidenceClass(
                      report.confidence,
                    )}`}
                  >
                    {report.confidence} confidence
                  </span>
                </div>
              </div>
            </section>

            <section className="monthly-grid-2">
              <article className="monthly-report-card">
                <h2 className="monthly-card-title">AI CFO narrative</h2>

                <div className="monthly-narrative" style={{ marginTop: 14 }}>
                  {narrativeLines.length > 0 ? (
                    narrativeLines.map((line, index) => (
                      <p key={`monthly-narrative-${index}-${line}`}>{line}</p>
                    ))
                  ) : (
                    <p>No AI narrative available.</p>
                  )}
                </div>
              </article>

              <article className="monthly-report-card">
                <h2 className="monthly-card-title">Document trust status</h2>

                <div className="monthly-list">
                  <div className="monthly-list-item">
                    <span>✓</span>
                    Approved documents used:{" "}
                    {report.documentSummary.approvedDocumentsUsed}
                  </div>

                  <div className="monthly-list-item">
                    <span>!</span>
                    Pending review:{" "}
                    {report.documentSummary.pendingReviewDocuments}
                  </div>

                  <div className="monthly-list-item">
                    <span>!</span>
                    Rejected documents excluded:{" "}
                    {report.documentSummary.rejectedDocuments}
                  </div>

                  <div className="monthly-list-item">
                    <span>✓</span>
                    Processed documents total:{" "}
                    {report.documentSummary.processedDocuments}
                  </div>
                </div>
              </article>
            </section>

            <section className="monthly-grid-2">
              <article className="monthly-card">
                <h2 className="monthly-card-title">Top revenue items</h2>

                <div className="monthly-line-grid">
                  {report.topRevenueItems.length > 0 ? (
                    report.topRevenueItems.map((item, index) => (
                      <div
                        key={`${item.sourceFileName}-${item.description}-${index}`}
                        className="monthly-line-card"
                      >
                        <div className="monthly-line-top">
                          <div>
                            <p className="monthly-line-title">
                              {item.description}
                            </p>
                            <p className="monthly-line-meta">
                              {item.category} · {formatDate(item.date)} ·{" "}
                              {item.sourceFileName}
                            </p>
                          </div>

                          <div className="monthly-line-amount">
                            {item.amount.formatted}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="monthly-list-item">
                      No revenue line items found.
                    </div>
                  )}
                </div>
              </article>

              <article className="monthly-card">
                <h2 className="monthly-card-title">Top expense items</h2>

                <div className="monthly-line-grid">
                  {report.topExpenseItems.length > 0 ? (
                    report.topExpenseItems.map((item, index) => (
                      <div
                        key={`${item.sourceFileName}-${item.description}-${index}`}
                        className="monthly-line-card"
                      >
                        <div className="monthly-line-top">
                          <div>
                            <p className="monthly-line-title">
                              {item.description}
                            </p>
                            <p className="monthly-line-meta">
                              {item.category} · {formatDate(item.date)} ·{" "}
                              {item.sourceFileName}
                            </p>
                          </div>

                          <div className="monthly-line-amount">
                            {item.amount.formatted}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="monthly-list-item">
                      No expense line items found.
                    </div>
                  )}
                </div>
              </article>
            </section>

            <section className="monthly-grid-2">
              <article className="monthly-card">
                <h2 className="monthly-card-title">Risk signals</h2>

                <div className="monthly-list">
                  {report.riskSignals.map((risk, index) => (
                    <div key={`risk-${index}-${risk}`} className="monthly-list-item">
                      <span>!</span>
                      {risk}
                    </div>
                  ))}
                </div>
              </article>

              <article className="monthly-card">
                <h2 className="monthly-card-title">Recommended actions</h2>

                <div className="monthly-list">
                  {report.opportunities.map((opportunity, index) => (
                    <div
                      key={`opportunity-${index}-${opportunity}`}
                      className="monthly-list-item"
                    >
                      <span>✓</span>
                      {opportunity}
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="section-card">
              <h2 className="monthly-card-title">Missing data</h2>

              <div className="monthly-list">
                {report.missingData.map((item, index) => (
                  <div key={`missing-${index}-${item}`} className="monthly-list-item">
                    <span>?</span>
                    {item}
                  </div>
                ))}
              </div>
            </section>

            <section className="section-card">
              <h2 className="monthly-card-title">Source documents</h2>

              <div className="monthly-list">
                {report.documentSummary.sourceDocuments.length > 0 ? (
                  report.documentSummary.sourceDocuments.map((document, index) => (
                    <div
                      key={`source-${index}-${document}`}
                      className="monthly-list-item"
                    >
                      <span>✓</span>
                      {document}
                    </div>
                  ))
                ) : (
                  <div className="monthly-list-item">
                    No approved source documents were used.
                  </div>
                )}
              </div>
            </section>

            <section className="section-card">
              <p className="monthly-note">
                Report note: This is AI-generated financial support based on
                approved documents and extracted data. It is not legal, tax,
                audit, investment, or filing advice.
              </p>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}