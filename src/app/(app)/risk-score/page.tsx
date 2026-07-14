"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

type RiskFactor = {
  id: string;
  title: string;
  level: RiskLevel;
  scoreImpact: number;
  message: string;
  recommendation: string;
};

type MoneyValue = {
  raw: number;
  formatted: string;
};

type BusinessRiskScore = {
  generatedAt: string;
  score: number;
  level: RiskLevel;
  label: string;
  summary: string;
  metrics: {
    revenue: MoneyValue;
    expenses: MoneyValue;
    profit: MoneyValue;
    cash: MoneyValue;
    assets: MoneyValue;
    liabilities: MoneyValue;
    profitMarginPercent: number | null;
    expenseRatioPercent: number | null;
    revenueCoveragePercent: number | null;
    debtToAssetPercent: number | null;
  };
  documentStatus: {
    totalDocuments: number;
    processedDocuments: number;
    approvedDocuments: number;
    pendingReviewDocuments: number;
    rejectedDocuments: number;
    failedDocuments: number;
  };
  riskFactors: RiskFactor[];
  strengths: string[];
  recommendedActions: string[];
  missingData: string[];
};

type RiskScoreApiResponse = {
  message: string;
  riskScore: BusinessRiskScore;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRiskScoreApiResponse(value: unknown): value is RiskScoreApiResponse {
  return isRecord(value) && isRecord(value.riskScore);
}

function getErrorMessage(value: unknown) {
  if (!isRecord(value)) {
    return "Could not load risk score.";
  }

  if (typeof value.error === "string" && value.error.trim()) {
    return value.error;
  }

  if (typeof value.detail === "string" && value.detail.trim()) {
    return value.detail;
  }

  return "Could not load risk score.";
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "N/A";
  }

  return `${value}%`;
}

function getRiskClass(level: RiskLevel) {
  if (level === "CRITICAL") {
    return "risk-critical";
  }

  if (level === "HIGH") {
    return "risk-high";
  }

  if (level === "MODERATE") {
    return "risk-moderate";
  }

  return "risk-low";
}

function getScoreText(score: number) {
  if (score >= 75) {
    return "Immediate action needed";
  }

  if (score >= 55) {
    return "High attention needed";
  }

  if (score >= 30) {
    return "Monitor closely";
  }

  return "Stable";
}

export default function RiskScorePage() {
  const [riskScore, setRiskScore] = useState<BusinessRiskScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const sortedFactors = useMemo(() => {
    return [...(riskScore?.riskFactors ?? [])].sort(
      (a, b) => b.scoreImpact - a.scoreImpact,
    );
  }, [riskScore]);

  async function loadRiskScore() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/risk-score", {
        method: "GET",
        cache: "no-store",
      });

      const data: unknown = await response.json();

      if (!response.ok || !isRiskScoreApiResponse(data)) {
        setError(getErrorMessage(data));
        return;
      }

      setRiskScore(data.riskScore);
    } catch {
      setError("Something went wrong while loading risk score.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRiskScore();
  }, []);

  return (
    <main>
      <style jsx>{`
        .risk-page {
          display: grid;
          gap: 18px;
          width: 100%;
          min-width: 0;
        }

        .risk-hero {
          overflow: hidden;
        }

        .risk-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 24px;
          align-items: start;
        }

        .risk-copy {
          min-width: 0;
          max-width: 880px;
        }

        .risk-eyebrow {
          display: block;
          margin: 0 0 14px;
          font-size: 12px;
          line-height: 1.4 !important;
          font-weight: 800;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(248, 113, 113, 0.92);
        }

        .risk-title {
          display: block;
          margin: 0;
          max-width: 900px;
          font-size: clamp(36px, 5.8vw, 72px) !important;
          line-height: 1.08 !important;
          letter-spacing: -0.045em;
          color: rgb(255, 255, 255);
          overflow-wrap: anywhere;
        }

        .risk-description {
          display: block;
          margin: 18px 0 0 !important;
          max-width: 760px;
          color: rgba(226, 232, 240, 0.74);
          font-size: 15px !important;
          line-height: 1.75 !important;
        }

        .risk-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
          align-items: center;
          padding-top: 32px;
        }

        .risk-primary-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          border-radius: 999px;
          padding: 12px 18px;
          border: 1px solid rgba(248, 113, 113, 0.42);
          background: linear-gradient(
            135deg,
            rgba(248, 113, 113, 0.96),
            rgba(251, 146, 60, 0.9)
          );
          color: rgb(24, 24, 27);
          font-size: 13px;
          font-weight: 900;
          text-decoration: none;
          box-shadow: 0 18px 50px rgba(248, 113, 113, 0.18);
          white-space: nowrap;
          cursor: pointer;
        }

        .risk-primary-action:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .risk-score-card {
          border-radius: 34px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background:
            radial-gradient(
              circle at top left,
              rgba(248, 113, 113, 0.16),
              transparent 38%
            ),
            rgba(255, 255, 255, 0.045);
          padding: 22px;
          box-shadow: 0 22px 70px rgba(0, 0, 0, 0.22);
        }

        .risk-score-grid {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 22px;
          align-items: center;
        }

        .risk-meter {
          width: 164px;
          height: 164px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background:
            radial-gradient(circle at center, rgba(0, 0, 0, 0.52), transparent 54%),
            conic-gradient(
              from 180deg,
              rgba(52, 211, 153, 0.9),
              rgba(245, 158, 11, 0.9),
              rgba(248, 113, 113, 0.95)
            );
        }

        .risk-meter-inner {
          width: 124px;
          height: 124px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: rgba(2, 6, 23, 0.92);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .risk-score-number {
          margin: 0;
          color: white;
          font-size: 44px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.08em;
        }

        .risk-score-caption {
          margin: 4px 0 0;
          color: rgba(148, 163, 184, 0.9);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .risk-pill {
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

        .risk-critical {
          border: 1px solid rgba(248, 113, 113, 0.3);
          background: rgba(248, 113, 113, 0.13);
          color: rgba(254, 226, 226, 0.98);
        }

        .risk-high {
          border: 1px solid rgba(251, 146, 60, 0.3);
          background: rgba(251, 146, 60, 0.13);
          color: rgba(255, 237, 213, 0.98);
        }

        .risk-moderate {
          border: 1px solid rgba(245, 158, 11, 0.3);
          background: rgba(245, 158, 11, 0.13);
          color: rgba(254, 243, 199, 0.98);
        }

        .risk-low {
          border: 1px solid rgba(52, 211, 153, 0.3);
          background: rgba(52, 211, 153, 0.13);
          color: rgba(209, 250, 229, 0.98);
        }

        .risk-score-title {
          margin: 12px 0 0;
          color: white;
          font-size: 30px;
          line-height: 1.1 !important;
          font-weight: 950;
          letter-spacing: -0.045em;
        }

        .risk-score-summary {
          margin: 12px 0 0;
          max-width: 860px;
          color: rgba(226, 232, 240, 0.76);
          font-size: 14px;
          line-height: 1.75 !important;
        }

        .risk-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .risk-stat-card,
        .risk-card,
        .risk-factor-card {
          min-width: 0;
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background:
            radial-gradient(
              circle at top left,
              rgba(255, 255, 255, 0.07),
              transparent 42%
            ),
            rgba(255, 255, 255, 0.045);
          padding: 18px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
        }

        .risk-stat-label {
          margin: 0;
          color: rgba(226, 232, 240, 0.68);
          font-size: 12px;
          line-height: 1.4;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .risk-stat-value {
          margin: 10px 0 0;
          color: white;
          font-size: 28px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.06em;
        }

        .risk-stat-hint {
          margin: 8px 0 0;
          color: rgba(148, 163, 184, 0.92);
          font-size: 12px;
          line-height: 1.6;
        }

        .risk-grid-2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .risk-card-title {
          margin: 0;
          color: white;
          font-size: 22px;
          line-height: 1.15 !important;
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .risk-list {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }

        .risk-list-item {
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.18);
          padding: 12px 13px;
          color: rgba(226, 232, 240, 0.8);
          font-size: 13px;
          line-height: 1.55 !important;
        }

        .risk-list-item span {
          color: rgba(52, 211, 153, 0.96);
          font-weight: 900;
          margin-right: 8px;
        }

        .risk-factor-card {
          border-radius: 22px;
          padding: 15px;
        }

        .risk-factor-top {
          display: flex;
          gap: 12px;
          justify-content: space-between;
          align-items: flex-start;
        }

        .risk-factor-title {
          margin: 0;
          color: white;
          font-size: 15px;
          line-height: 1.35 !important;
          font-weight: 950;
        }

        .risk-factor-message {
          margin: 8px 0 0;
          color: rgba(226, 232, 240, 0.72);
          font-size: 13px;
          line-height: 1.65 !important;
        }

        .risk-factor-rec {
          margin: 8px 0 0;
          color: rgba(148, 163, 184, 0.95);
          font-size: 12px;
          line-height: 1.6 !important;
        }

        .risk-impact {
          flex: 0 0 auto;
          color: white;
          font-size: 13px;
          font-weight: 950;
          white-space: nowrap;
        }

        .risk-empty,
        .risk-error {
          border-radius: 24px;
          padding: 16px;
          border: 1px solid rgba(245, 158, 11, 0.25);
          background: rgba(245, 158, 11, 0.1);
          color: rgba(254, 243, 199, 0.95);
          font-size: 13px;
          line-height: 1.6 !important;
          font-weight: 700;
        }

        .risk-error {
          border-color: rgba(248, 113, 113, 0.28);
          background: rgba(248, 113, 113, 0.12);
          color: rgba(254, 226, 226, 0.96);
        }

        @media (max-width: 1180px) {
          .risk-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .risk-grid-2 {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 980px) {
          .risk-hero-grid,
          .risk-score-grid,
          .risk-stats-grid {
            grid-template-columns: 1fr;
          }

          .risk-actions {
            justify-content: flex-start;
            padding-top: 0;
          }

          .risk-primary-action,
          .risk-actions .btn-ghost {
            width: 100%;
          }

          .risk-meter {
            width: 142px;
            height: 142px;
          }

          .risk-meter-inner {
            width: 108px;
            height: 108px;
          }

          .risk-title {
            font-size: clamp(34px, 11vw, 54px) !important;
            line-height: 1.1 !important;
          }
        }

        @media (max-width: 560px) {
          .risk-factor-top {
            flex-direction: column;
          }

          .risk-impact {
            white-space: normal;
          }
        }
      `}</style>

      <div className="risk-page">
        <section className="section-card risk-hero">
          <div className="risk-hero-grid">
            <div className="risk-copy">
              <p className="risk-eyebrow">Risk Score Engine</p>

              <h1 className="risk-title">
                Know how risky your business looks right now.
              </h1>

              <p className="risk-description">
                Actic Finance scores financial risk using approved documents, profit
                signals, expenses, liabilities, cash position, missing data, and
                extracted line items.
              </p>
            </div>

            <div className="risk-actions">
              <button
                type="button"
                onClick={loadRiskScore}
                disabled={loading}
                className="risk-primary-action"
              >
                {loading ? "Calculating..." : "Refresh score"}
              </button>

              <Link href="/documents" className="btn-ghost">
                Review documents
              </Link>
            </div>
          </div>
        </section>

        {error ? <div className="risk-error">{error}</div> : null}

        {loading ? (
          <div className="risk-empty">Calculating risk score...</div>
        ) : null}

        {!loading && !riskScore ? (
          <div className="risk-empty">No risk score available yet.</div>
        ) : null}

        {riskScore ? (
          <>
            <section className="risk-score-card">
              <div className="risk-score-grid">
                <div className="risk-meter">
                  <div className="risk-meter-inner">
                    <div>
                      <p className="risk-score-number">{riskScore.score}</p>
                      <p className="risk-score-caption">Risk / 100</p>
                    </div>
                  </div>
                </div>

                <div>
                  <span
                    className={`risk-pill ${getRiskClass(riskScore.level)}`}
                  >
                    {riskScore.level} · {getScoreText(riskScore.score)}
                  </span>

                  <h2 className="risk-score-title">{riskScore.label}</h2>

                  <p className="risk-score-summary">{riskScore.summary}</p>
                </div>
              </div>
            </section>

            <section className="risk-stats-grid">
              <article className="risk-stat-card">
                <p className="risk-stat-label">Revenue</p>
                <p className="risk-stat-value">
                  {riskScore.metrics.revenue.formatted}
                </p>
                <p className="risk-stat-hint">
                  Coverage:{" "}
                  {formatPercent(riskScore.metrics.revenueCoveragePercent)}
                </p>
              </article>

              <article className="risk-stat-card">
                <p className="risk-stat-label">Expenses</p>
                <p className="risk-stat-value">
                  {riskScore.metrics.expenses.formatted}
                </p>
                <p className="risk-stat-hint">
                  Expense ratio:{" "}
                  {formatPercent(riskScore.metrics.expenseRatioPercent)}
                </p>
              </article>

              <article className="risk-stat-card">
                <p className="risk-stat-label">Profit / Loss</p>
                <p className="risk-stat-value">
                  {riskScore.metrics.profit.formatted}
                </p>
                <p className="risk-stat-hint">
                  Margin: {formatPercent(riskScore.metrics.profitMarginPercent)}
                </p>
              </article>

              <article className="risk-stat-card">
                <p className="risk-stat-label">Liability pressure</p>
                <p className="risk-stat-value">
                  {formatPercent(riskScore.metrics.debtToAssetPercent)}
                </p>
                <p className="risk-stat-hint">
                  Assets: {riskScore.metrics.assets.formatted}
                </p>
              </article>
            </section>

            <section className="risk-grid-2">
              <article className="risk-card">
                <h2 className="risk-card-title">Main risk factors</h2>

                <div className="risk-list">
                  {sortedFactors.length > 0 ? (
                    sortedFactors.map((factor) => (
                      <div key={factor.id} className="risk-factor-card">
                        <div className="risk-factor-top">
                          <div>
                            <span
                              className={`risk-pill ${getRiskClass(
                                factor.level,
                              )}`}
                            >
                              {factor.level}
                            </span>

                            <p className="risk-factor-title">
                              {factor.title}
                            </p>
                          </div>

                          <div className="risk-impact">
                            +{factor.scoreImpact}
                          </div>
                        </div>

                        <p className="risk-factor-message">{factor.message}</p>

                        <p className="risk-factor-rec">
                          Fix: {factor.recommendation}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="risk-list-item">
                      <span>✓</span>
                      No major risk factors detected.
                    </div>
                  )}
                </div>
              </article>

              <article className="risk-card">
                <h2 className="risk-card-title">Recommended actions</h2>

                <div className="risk-list">
                  {riskScore.recommendedActions.length > 0 ? (
                    riskScore.recommendedActions.map((action) => (
                      <div key={action} className="risk-list-item">
                        <span>→</span>
                        {action}
                      </div>
                    ))
                  ) : (
                    <div className="risk-list-item">
                      <span>✓</span>
                      No urgent action required.
                    </div>
                  )}
                </div>
              </article>
            </section>

            <section className="risk-grid-2">
              <article className="risk-card">
                <h2 className="risk-card-title">Strengths</h2>

                <div className="risk-list">
                  {riskScore.strengths.length > 0 ? (
                    riskScore.strengths.map((strength) => (
                      <div key={strength} className="risk-list-item">
                        <span>✓</span>
                        {strength}
                      </div>
                    ))
                  ) : (
                    <div className="risk-list-item">
                      <span>!</span>
                      No strong positive signal detected yet.
                    </div>
                  )}
                </div>
              </article>

              <article className="risk-card">
                <h2 className="risk-card-title">Missing data</h2>

                <div className="risk-list">
                  {riskScore.missingData.length > 0 ? (
                    riskScore.missingData.map((item) => (
                      <div key={item} className="risk-list-item">
                        <span>?</span>
                        {item}
                      </div>
                    ))
                  ) : (
                    <div className="risk-list-item">
                      <span>✓</span>
                      No major missing data detected.
                    </div>
                  )}
                </div>
              </article>
            </section>

            <section className="risk-stats-grid">
              <article className="risk-stat-card">
                <p className="risk-stat-label">Total docs</p>
                <p className="risk-stat-value">
                  {riskScore.documentStatus.totalDocuments}
                </p>
                <p className="risk-stat-hint">Uploaded documents</p>
              </article>

              <article className="risk-stat-card">
                <p className="risk-stat-label">Approved</p>
                <p className="risk-stat-value">
                  {riskScore.documentStatus.approvedDocuments}
                </p>
                <p className="risk-stat-hint">Used in risk score</p>
              </article>

              <article className="risk-stat-card">
                <p className="risk-stat-label">Pending</p>
                <p className="risk-stat-value">
                  {riskScore.documentStatus.pendingReviewDocuments}
                </p>
                <p className="risk-stat-hint">Needs review</p>
              </article>

              <article className="risk-stat-card">
                <p className="risk-stat-label">Failed</p>
                <p className="risk-stat-value">
                  {riskScore.documentStatus.failedDocuments}
                </p>
                <p className="risk-stat-hint">Processing failed</p>
              </article>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}