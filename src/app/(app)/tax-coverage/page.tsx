"use client";

import { useEffect, useMemo, useState } from "react";

type TaxCoverageStatus = "STRONG" | "PARTIAL" | "MISSING";

type TaxCoverageTypeResult = {
  taxType: string;
  label: string;
  priority: "core" | "important" | "optional";
  status: TaxCoverageStatus;
  confidence: "High" | "Medium" | "Low";
  verifiedRulesCount: number;
  verifiedSourceDocumentsCount: number;
  verifiedKnowledgeChunksCount: number;
  sourceNames: string[];
  latestVerifiedAt: string | null;
  message: string;
};

type TaxCoverageCountryResult = {
  countryCode: string;
  countryName: string;
  financialYear: string;
  overallStatus: TaxCoverageStatus;
  readinessScore: number;
  verifiedRulesCount: number;
  verifiedSourceDocumentsCount: number;
  verifiedKnowledgeChunksCount: number;
  taxTypes: TaxCoverageTypeResult[];
};

type TaxCoverageResponse = {
  financialYear: string;
  countries: TaxCoverageCountryResult[];
  generatedAt: string;
  privacy: {
    userDataAccessed: boolean;
    scope: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeStatus(value: unknown): TaxCoverageStatus {
  if (value === "STRONG" || value === "PARTIAL" || value === "MISSING") {
    return value;
  }

  return "MISSING";
}

function normalizeConfidence(value: unknown): "High" | "Medium" | "Low" {
  if (value === "High" || value === "Medium" || value === "Low") {
    return value;
  }

  return "Low";
}

function normalizePriority(
  value: unknown,
): "core" | "important" | "optional" {
  if (value === "core" || value === "important" || value === "optional") {
    return value;
  }

  return "optional";
}

function normalizeSourceNames(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function findCoveragePayload(data: unknown): unknown {
  if (!isRecord(data)) {
    return null;
  }

  if (Array.isArray(data.countries)) {
    return data;
  }

  if (isRecord(data.result) && Array.isArray(data.result.countries)) {
    return data.result;
  }

  if (isRecord(data.coverage) && Array.isArray(data.coverage.countries)) {
    return data.coverage;
  }

  if (isRecord(data.data) && Array.isArray(data.data.countries)) {
    return data.data;
  }

  return data;
}

function normalizeTaxCoverageResponse(data: unknown): TaxCoverageResponse {
  const payload = findCoveragePayload(data);

  if (!isRecord(payload)) {
    return {
      financialYear: "2025-26",
      countries: [],
      generatedAt: new Date().toISOString(),
      privacy: {
        userDataAccessed: false,
        scope: "Global verified tax rules and tax knowledge only",
      },
    };
  }

  const countriesRaw = Array.isArray(payload.countries)
    ? payload.countries
    : [];

  const countries: TaxCoverageCountryResult[] = countriesRaw
    .filter(isRecord)
    .map((country) => {
      const taxTypesRaw = Array.isArray(country.taxTypes)
        ? country.taxTypes
        : [];

      const taxTypes: TaxCoverageTypeResult[] = taxTypesRaw
        .filter(isRecord)
        .map((item) => ({
          taxType: cleanString(item.taxType, "OTHER"),
          label: cleanString(item.label, cleanString(item.taxType, "Tax type")),
          priority: normalizePriority(item.priority),
          status: normalizeStatus(item.status),
          confidence: normalizeConfidence(item.confidence),
          verifiedRulesCount: cleanNumber(item.verifiedRulesCount),
          verifiedSourceDocumentsCount: cleanNumber(
            item.verifiedSourceDocumentsCount,
          ),
          verifiedKnowledgeChunksCount: cleanNumber(
            item.verifiedKnowledgeChunksCount,
          ),
          sourceNames: normalizeSourceNames(item.sourceNames),
          latestVerifiedAt:
            typeof item.latestVerifiedAt === "string"
              ? item.latestVerifiedAt
              : null,
          message: cleanString(
            item.message,
            "Coverage details are not available for this tax type.",
          ),
        }));

      return {
        countryCode: cleanString(country.countryCode, "NA"),
        countryName: cleanString(country.countryName, "Unknown country"),
        financialYear: cleanString(
          country.financialYear,
          cleanString(payload.financialYear, "2025-26"),
        ),
        overallStatus: normalizeStatus(country.overallStatus),
        readinessScore: cleanNumber(country.readinessScore),
        verifiedRulesCount: cleanNumber(country.verifiedRulesCount),
        verifiedSourceDocumentsCount: cleanNumber(
          country.verifiedSourceDocumentsCount,
        ),
        verifiedKnowledgeChunksCount: cleanNumber(
          country.verifiedKnowledgeChunksCount,
        ),
        taxTypes,
      };
    });

  const privacy = isRecord(payload.privacy)
    ? {
        userDataAccessed: Boolean(payload.privacy.userDataAccessed),
        scope: cleanString(
          payload.privacy.scope,
          "Global verified tax rules and tax knowledge only",
        ),
      }
    : {
        userDataAccessed: false,
        scope: "Global verified tax rules and tax knowledge only",
      };

  return {
    financialYear: cleanString(payload.financialYear, "2025-26"),
    countries,
    generatedAt: cleanString(payload.generatedAt, new Date().toISOString()),
    privacy,
  };
}

function getStatusLabel(status: TaxCoverageStatus) {
  if (status === "STRONG") {
    return "Strong";
  }

  if (status === "PARTIAL") {
    return "Partial";
  }

  return "Missing";
}

function getStatusClass(status: TaxCoverageStatus) {
  if (status === "STRONG") {
    return "coverage-status-strong";
  }

  if (status === "PARTIAL") {
    return "coverage-status-partial";
  }

  return "coverage-status-missing";
}

function getPriorityLabel(priority: TaxCoverageTypeResult["priority"]) {
  if (priority === "core") {
    return "Core";
  }

  if (priority === "important") {
    return "Important";
  }

  return "Optional";
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not verified yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not verified yet";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getCountryEmoji(countryCode: string) {
  if (countryCode === "IN") {
    return "🇮🇳";
  }

  if (countryCode === "US") {
    return "🇺🇸";
  }

  if (countryCode === "UK") {
    return "🇬🇧";
  }

  return "🌍";
}

function buildCoverageSummary(countries: TaxCoverageCountryResult[]) {
  const totals = countries.reduce(
    (acc, country) => {
      acc.rules += country.verifiedRulesCount;
      acc.sources += country.verifiedSourceDocumentsCount;
      acc.chunks += country.verifiedKnowledgeChunksCount;

      for (const item of country.taxTypes) {
        acc.taxTypes += 1;

        if (item.status === "STRONG") {
          acc.strong += 1;
        } else if (item.status === "PARTIAL") {
          acc.partial += 1;
        } else {
          acc.missing += 1;
        }
      }

      return acc;
    },
    {
      rules: 0,
      sources: 0,
      chunks: 0,
      taxTypes: 0,
      strong: 0,
      partial: 0,
      missing: 0,
    },
  );

  const averageReadiness =
    countries.length > 0
      ? Math.round(
          countries.reduce(
            (total, country) => total + country.readinessScore,
            0,
          ) / countries.length,
        )
      : 0;

  return {
    ...totals,
    averageReadiness,
  };
}

export default function TaxCoveragePage() {
  const [financialYear, setFinancialYear] = useState("2025-26");
  const [countryCode, setCountryCode] = useState("");
  const [coverage, setCoverage] = useState<TaxCoverageResponse>({
    financialYear: "2025-26",
    countries: [],
    generatedAt: new Date().toISOString(),
    privacy: {
      userDataAccessed: false,
      scope: "Global verified tax rules and tax knowledge only",
    },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const countries = useMemo(() => coverage.countries ?? [], [coverage.countries]);

  const summary = useMemo(() => buildCoverageSummary(countries), [countries]);

  async function loadCoverage() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (financialYear.trim()) {
        params.set("financialYear", financialYear.trim());
      }

      if (countryCode.trim()) {
        params.set("country", countryCode.trim());
      }

      const response = await fetch(`/api/tax/coverage?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not load tax coverage.");
        setCoverage(normalizeTaxCoverageResponse(data));
        return;
      }

      setCoverage(normalizeTaxCoverageResponse(data));
    } catch {
      setError("Something went wrong while loading tax coverage.");
      setCoverage(normalizeTaxCoverageResponse(null));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCoverage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main>
      <style jsx>{`
        .coverage-page {
          display: grid;
          gap: 18px;
          width: 100%;
          min-width: 0;
        }

        .coverage-hero {
          overflow: hidden;
        }

        .coverage-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 24px;
          align-items: start;
        }

        .coverage-copy {
          min-width: 0;
          max-width: 860px;
        }

        .coverage-eyebrow {
          display: block;
          margin: 0 0 14px;
          font-size: 12px;
          line-height: 1.4 !important;
          font-weight: 800;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(245, 158, 11, 0.92);
        }

        .coverage-title {
          display: block;
          margin: 0;
          max-width: 860px;
          font-size: clamp(36px, 5.8vw, 72px) !important;
          line-height: 1.08 !important;
          letter-spacing: -0.045em;
          color: rgb(255, 255, 255);
          overflow-wrap: anywhere;
        }

        .coverage-description {
          display: block;
          margin: 18px 0 0 !important;
          max-width: 760px;
          color: rgba(226, 232, 240, 0.74);
          font-size: 15px !important;
          line-height: 1.75 !important;
        }

        .coverage-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
          align-items: center;
          padding-top: 32px;
        }

        .coverage-primary-action {
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

        .coverage-primary-action:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .coverage-filters {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          gap: 12px;
          align-items: end;
        }

        .coverage-field {
          display: grid;
          gap: 7px;
          min-width: 0;
        }

        .coverage-label {
          color: rgba(226, 232, 240, 0.72);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .coverage-input,
        .coverage-select {
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

        .coverage-select option {
          color: rgb(15, 23, 42);
        }

        .coverage-input:focus,
        .coverage-select:focus {
          border-color: rgba(245, 158, 11, 0.45);
          box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.08);
        }

        .coverage-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .coverage-stat-card,
        .coverage-country-card,
        .coverage-tax-card {
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

        .coverage-stat-label {
          margin: 0;
          color: rgba(226, 232, 240, 0.68);
          font-size: 12px;
          line-height: 1.4;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .coverage-stat-value {
          margin: 10px 0 0;
          color: white;
          font-size: 30px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.06em;
        }

        .coverage-stat-hint {
          margin: 8px 0 0;
          color: rgba(148, 163, 184, 0.92);
          font-size: 12px;
          line-height: 1.6;
        }

        .coverage-country-grid {
          display: grid;
          gap: 16px;
        }

        .coverage-country-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: start;
        }

        .coverage-country-title-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
        }

        .coverage-country-emoji {
          display: inline-flex;
          height: 42px;
          width: 42px;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          border: 1px solid rgba(245, 158, 11, 0.18);
          background: rgba(245, 158, 11, 0.12);
          font-size: 22px;
        }

        .coverage-country-title {
          margin: 0;
          color: white;
          font-size: 24px;
          line-height: 1.15 !important;
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .coverage-country-meta {
          margin: 6px 0 0;
          color: rgba(226, 232, 240, 0.68);
          font-size: 13px;
          line-height: 1.5 !important;
        }

        .coverage-score-wrap {
          min-width: 150px;
          text-align: right;
        }

        .coverage-score {
          color: white;
          font-size: 36px;
          font-weight: 950;
          line-height: 1;
          letter-spacing: -0.08em;
        }

        .coverage-score-label {
          margin-top: 6px;
          color: rgba(148, 163, 184, 0.9);
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .coverage-progress {
          margin-top: 16px;
          height: 10px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
        }

        .coverage-progress-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            rgba(245, 158, 11, 0.95),
            rgba(52, 211, 153, 0.9)
          );
        }

        .coverage-tax-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 16px;
        }

        .coverage-tax-card {
          border-radius: 24px;
          padding: 15px;
          background:
            radial-gradient(
              circle at top left,
              rgba(255, 255, 255, 0.07),
              transparent 40%
            ),
            rgba(0, 0, 0, 0.16);
        }

        .coverage-tax-top {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: flex-start;
          justify-content: space-between;
        }

        .coverage-tax-title {
          margin: 0;
          color: white;
          font-size: 15px;
          line-height: 1.3 !important;
          font-weight: 900;
        }

        .coverage-tax-type {
          margin-top: 4px;
          color: rgba(148, 163, 184, 0.9);
          font-size: 11px;
          line-height: 1.4 !important;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .coverage-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11px;
          line-height: 1;
          font-weight: 900;
          white-space: nowrap;
        }

        .coverage-status-strong {
          border: 1px solid rgba(52, 211, 153, 0.28);
          background: rgba(52, 211, 153, 0.12);
          color: rgba(209, 250, 229, 0.98);
        }

        .coverage-status-partial {
          border: 1px solid rgba(245, 158, 11, 0.3);
          background: rgba(245, 158, 11, 0.12);
          color: rgba(254, 243, 199, 0.98);
        }

        .coverage-status-missing {
          border: 1px solid rgba(248, 113, 113, 0.3);
          background: rgba(248, 113, 113, 0.12);
          color: rgba(254, 226, 226, 0.98);
        }

        .coverage-tax-message {
          margin: 12px 0 0;
          color: rgba(226, 232, 240, 0.74);
          font-size: 12px;
          line-height: 1.65 !important;
        }

        .coverage-tax-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-top: 13px;
        }

        .coverage-tax-metric {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          padding: 9px;
        }

        .coverage-tax-metric-value {
          color: white;
          font-size: 16px;
          line-height: 1;
          font-weight: 950;
        }

        .coverage-tax-metric-label {
          margin-top: 5px;
          color: rgba(148, 163, 184, 0.86);
          font-size: 10px;
          line-height: 1.35 !important;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .coverage-sources {
          margin-top: 12px;
          color: rgba(148, 163, 184, 0.92);
          font-size: 11px;
          line-height: 1.55 !important;
        }

        .coverage-empty,
        .coverage-error {
          border-radius: 24px;
          padding: 16px;
          border: 1px solid rgba(245, 158, 11, 0.25);
          background: rgba(245, 158, 11, 0.1);
          color: rgba(254, 243, 199, 0.95);
          font-size: 13px;
          line-height: 1.6 !important;
          font-weight: 700;
        }

        .coverage-error {
          border-color: rgba(248, 113, 113, 0.28);
          background: rgba(248, 113, 113, 0.12);
          color: rgba(254, 226, 226, 0.96);
        }

        .coverage-note {
          margin: 0;
          color: rgba(148, 163, 184, 0.9);
          font-size: 12px;
          line-height: 1.7 !important;
        }

        @media (max-width: 1180px) {
          .coverage-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .coverage-tax-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 980px) {
          .coverage-hero-grid,
          .coverage-filters,
          .coverage-country-header,
          .coverage-stats-grid {
            grid-template-columns: 1fr;
          }

          .coverage-actions {
            justify-content: flex-start;
            padding-top: 0;
          }

          .coverage-primary-action,
          .coverage-actions .btn-ghost {
            width: 100%;
          }

          .coverage-score-wrap {
            text-align: left;
          }

          .coverage-title {
            font-size: clamp(34px, 11vw, 54px) !important;
            line-height: 1.1 !important;
            letter-spacing: -0.04em;
          }

          .coverage-description {
            font-size: 14px !important;
            line-height: 1.7 !important;
          }
        }

        @media (max-width: 560px) {
          .coverage-title {
            font-size: clamp(32px, 10vw, 44px) !important;
            line-height: 1.12 !important;
            letter-spacing: -0.035em;
          }

          .coverage-description {
            margin-top: 14px !important;
            font-size: 13px !important;
          }

          .coverage-tax-metrics {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="coverage-page">
        <section className="section-card coverage-hero">
          <div className="coverage-hero-grid">
            <div className="coverage-copy">
              <p className="coverage-eyebrow">Tax Coverage Center</p>

              <h1 className="coverage-title">
                Verified tax coverage across countries.
              </h1>

              <p className="coverage-description">
                Review how much verified tax knowledge Aureli has for India,
                USA, and UK. The Tax Agent uses this coverage before giving
                source-backed tax readiness answers.
              </p>
            </div>

            <div className="coverage-actions">
              <button
                type="button"
                onClick={loadCoverage}
                disabled={loading}
                className="coverage-primary-action"
              >
                {loading ? "Refreshing..." : "Refresh coverage"}
              </button>

              <a href="/chat?agent=tax" className="btn-ghost">
                Ask Tax Agent
              </a>
            </div>
          </div>
        </section>

        <section className="section-card">
          <div className="coverage-filters">
            <label className="coverage-field">
              <span className="coverage-label">Financial year</span>
              <input
                value={financialYear}
                onChange={(event) => setFinancialYear(event.target.value)}
                placeholder="2025-26"
                className="coverage-input"
              />
            </label>

            <label className="coverage-field">
              <span className="coverage-label">Country</span>
              <select
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value)}
                className="coverage-select"
              >
                <option value="">All countries</option>
                <option value="IN">India</option>
                <option value="US">United States</option>
                <option value="UK">United Kingdom</option>
              </select>
            </label>

            <button
              type="button"
              onClick={loadCoverage}
              disabled={loading}
              className="coverage-primary-action"
            >
              Apply filter
            </button>
          </div>
        </section>

        {error ? <div className="coverage-error">{error}</div> : null}

        <section className="coverage-stats-grid">
          <article className="coverage-stat-card">
            <p className="coverage-stat-label">Avg readiness</p>
            <p className="coverage-stat-value">{summary.averageReadiness}%</p>
            <p className="coverage-stat-hint">
              Average tax coverage score across selected countries.
            </p>
          </article>

          <article className="coverage-stat-card">
            <p className="coverage-stat-label">Verified rules</p>
            <p className="coverage-stat-value">{summary.rules}</p>
            <p className="coverage-stat-hint">
              Structured rules verified by admin tax knowledge.
            </p>
          </article>

          <article className="coverage-stat-card">
            <p className="coverage-stat-label">Source docs</p>
            <p className="coverage-stat-value">{summary.sources}</p>
            <p className="coverage-stat-hint">
              Verified official documents uploaded into Aureli.
            </p>
          </article>

          <article className="coverage-stat-card">
            <p className="coverage-stat-label">Knowledge chunks</p>
            <p className="coverage-stat-value">{summary.chunks}</p>
            <p className="coverage-stat-hint">
              Searchable chunks used by the Tax Agent.
            </p>
          </article>
        </section>

        {loading ? (
          <div className="coverage-empty">Loading tax coverage...</div>
        ) : null}

        {!loading && countries.length === 0 ? (
          <div className="coverage-empty">
            No tax coverage found for this filter.
          </div>
        ) : null}

        {!loading && countries.length > 0 ? (
          <section className="coverage-country-grid">
            {countries.map((country) => (
              <article
                key={country.countryCode}
                className="coverage-country-card"
              >
                <div className="coverage-country-header">
                  <div>
                    <div className="coverage-country-title-row">
                      <span className="coverage-country-emoji">
                        {getCountryEmoji(country.countryCode)}
                      </span>

                      <div>
                        <h2 className="coverage-country-title">
                          {country.countryName}
                        </h2>

                        <p className="coverage-country-meta">
                          {country.countryCode} · FY {country.financialYear} ·{" "}
                          {getStatusLabel(country.overallStatus)} coverage
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="coverage-score-wrap">
                    <div className="coverage-score">
                      {country.readinessScore}%
                    </div>
                    <div className="coverage-score-label">Readiness</div>
                  </div>
                </div>

                <div className="coverage-progress">
                  <div
                    className="coverage-progress-fill"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, country.readinessScore),
                      )}%`,
                    }}
                  />
                </div>

                <div className="coverage-tax-grid">
                  {country.taxTypes.map((item) => (
                    <article
                      key={`${country.countryCode}-${item.taxType}`}
                      className="coverage-tax-card"
                    >
                      <div className="coverage-tax-top">
                        <div>
                          <h3 className="coverage-tax-title">{item.label}</h3>
                          <div className="coverage-tax-type">
                            {item.taxType} · {getPriorityLabel(item.priority)}
                          </div>
                        </div>

                        <span
                          className={`coverage-pill ${getStatusClass(
                            item.status,
                          )}`}
                        >
                          {getStatusLabel(item.status)}
                        </span>
                      </div>

                      <p className="coverage-tax-message">{item.message}</p>

                      <div className="coverage-tax-metrics">
                        <div className="coverage-tax-metric">
                          <div className="coverage-tax-metric-value">
                            {item.verifiedRulesCount}
                          </div>
                          <div className="coverage-tax-metric-label">Rules</div>
                        </div>

                        <div className="coverage-tax-metric">
                          <div className="coverage-tax-metric-value">
                            {item.verifiedSourceDocumentsCount}
                          </div>
                          <div className="coverage-tax-metric-label">
                            Sources
                          </div>
                        </div>

                        <div className="coverage-tax-metric">
                          <div className="coverage-tax-metric-value">
                            {item.verifiedKnowledgeChunksCount}
                          </div>
                          <div className="coverage-tax-metric-label">Chunks</div>
                        </div>
                      </div>

                      <div className="coverage-sources">
                        <strong>Confidence:</strong> {item.confidence}
                        <br />
                        <strong>Latest verified:</strong>{" "}
                        {formatDate(item.latestVerifiedAt)}
                        <br />
                        <strong>Source names:</strong>{" "}
                        {item.sourceNames.length > 0
                          ? item.sourceNames.join(", ")
                          : "No verified sources yet"}
                      </div>
                    </article>
                  ))}
                </div>
              </article>
            ))}
          </section>
        ) : null}

        <section className="section-card">
          <p className="coverage-note">
            Tax note: Coverage status only shows how much verified source data
            Aureli has. It is not a legal or filing certification. Always verify
            official filing, notices, audits, and legal compliance with a
            qualified tax professional.
          </p>
        </section>
      </div>
    </main>
  );
}