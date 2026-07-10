"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type TaxCoverageStatus = "STRONG" | "PARTIAL" | "MISSING";

type TaxCoverageTypeResult = {
  taxType: string;
  label: string;
  priority: string;
  status: TaxCoverageStatus;
  verifiedRulesCount: number;
  verifiedSourceDocumentsCount: number;
  verifiedKnowledgeChunksCount: number;
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
};

const legalPrinciples = [
  {
    title: "Informational support only",
    description:
      "Aureli can explain financial and tax readiness signals, but it does not provide certified legal, tax, audit, investment, or filing advice.",
  },
  {
    title: "Verified source boundary",
    description:
      "Tax Agent responses should rely on verified tax rules, uploaded official tax knowledge, and tax coverage status before giving country-specific guidance.",
  },
  {
    title: "Professional verification required",
    description:
      "Final filing, notices, tax payable, audits, legal compliance, and statutory interpretation must be verified with a qualified professional.",
  },
  {
    title: "User data privacy",
    description:
      "User financial documents and chat history are user-scoped. Global tax knowledge is platform-level data and does not include private user documents.",
  },
];

const taxAgentRules = [
  "Check Tax Coverage before giving country-specific tax guidance.",
  "Never claim whole-country coverage unless core and important tax areas are strong.",
  "Do not calculate final tax payable unless verified coverage fully supports it.",
  "Show source-backed confidence when verified citations are available.",
  "Prefer readiness checklist, missing documents, and risk explanation over final legal conclusions.",
  "Tell the user when coverage is missing, partial, stale, or incomplete.",
];

const supportedCountries = [
  {
    code: "IN",
    name: "India",
    emoji: "🇮🇳",
    authorities:
      "Income Tax Department, GST Council, CBIC, and qualified Chartered Accountant verification.",
  },
  {
    code: "US",
    name: "United States",
    emoji: "🇺🇸",
    authorities:
      "IRS, state tax agencies, and qualified CPA / tax professional verification.",
  },
  {
    code: "UK",
    name: "United Kingdom",
    emoji: "🇬🇧",
    authorities:
      "HMRC, GOV.UK guidance, Companies House where relevant, and qualified accountant verification.",
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function cleanString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeStatus(value: unknown): TaxCoverageStatus {
  if (value === "STRONG" || value === "PARTIAL" || value === "MISSING") {
    return value;
  }

  return "MISSING";
}

function getPayload(data: unknown) {
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

function normalizeCoverageResponse(data: unknown): TaxCoverageResponse {
  const payload = getPayload(data);

  if (!isRecord(payload)) {
    return {
      financialYear: "2025-26",
      countries: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const payloadFinancialYear = cleanString(payload.financialYear, "2025-26");

  const rawCountries = Array.isArray(payload.countries)
    ? payload.countries
    : [];

  const countries: TaxCoverageCountryResult[] = rawCountries
    .filter(isRecord)
    .map((country): TaxCoverageCountryResult => {
      const rawTaxTypes = Array.isArray(country.taxTypes)
        ? country.taxTypes
        : [];

      const taxTypes: TaxCoverageTypeResult[] = rawTaxTypes
        .filter(isRecord)
        .map((item): TaxCoverageTypeResult => {
          return {
            taxType: cleanString(item.taxType, "OTHER"),
            label: cleanString(item.label, "Tax area"),
            priority: cleanString(item.priority, "optional"),
            status: normalizeStatus(item.status),
            verifiedRulesCount: cleanNumber(item.verifiedRulesCount),
            verifiedSourceDocumentsCount: cleanNumber(
              item.verifiedSourceDocumentsCount,
            ),
            verifiedKnowledgeChunksCount: cleanNumber(
              item.verifiedKnowledgeChunksCount,
            ),
          };
        });

      return {
        countryCode: cleanString(country.countryCode, "NA"),
        countryName: cleanString(country.countryName, "Unknown country"),
        financialYear: cleanString(country.financialYear, payloadFinancialYear),
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

  return {
    financialYear: payloadFinancialYear,
    countries,
    generatedAt: cleanString(payload.generatedAt, new Date().toISOString()),
  };
}

function getCoverageSummary(countries: TaxCoverageCountryResult[]) {
  const summary = countries.reduce(
    (acc, country) => {
      acc.rules += country.verifiedRulesCount;
      acc.sources += country.verifiedSourceDocumentsCount;
      acc.chunks += country.verifiedKnowledgeChunksCount;

      for (const item of country.taxTypes) {
        acc.taxAreas += 1;

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
      taxAreas: 0,
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
    ...summary,
    averageReadiness,
  };
}

function getStatusClass(status: TaxCoverageStatus) {
  if (status === "STRONG") {
    return "legal-status-strong";
  }

  if (status === "PARTIAL") {
    return "legal-status-partial";
  }

  return "legal-status-missing";
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

export default function LegalPage() {
  const [coverage, setCoverage] = useState<TaxCoverageResponse>({
    financialYear: "2025-26",
    countries: [],
    generatedAt: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const countries = coverage.countries;
  const summary = useMemo(() => getCoverageSummary(countries), [countries]);

  async function loadCoverage() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/tax/coverage?financialYear=2025-26", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not load tax coverage summary.");
        setCoverage(normalizeCoverageResponse(data));
        return;
      }

      setCoverage(normalizeCoverageResponse(data));
    } catch {
      setError("Could not load tax coverage summary.");
      setCoverage(normalizeCoverageResponse(null));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCoverage();
  }, []);

  return (
    <main>
      <style jsx>{`
        .legal-page {
          display: grid;
          gap: 18px;
          width: 100%;
          min-width: 0;
        }

        .legal-hero {
          overflow: hidden;
        }

        .legal-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 24px;
          align-items: start;
        }

        .legal-copy {
          min-width: 0;
          max-width: 880px;
        }

        .legal-eyebrow {
          display: block;
          margin: 0 0 14px;
          font-size: 12px;
          line-height: 1.4 !important;
          font-weight: 800;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(245, 158, 11, 0.92);
        }

        .legal-title {
          display: block;
          margin: 0;
          max-width: 880px;
          font-size: clamp(36px, 5.8vw, 72px) !important;
          line-height: 1.08 !important;
          letter-spacing: -0.045em;
          color: rgb(255, 255, 255);
          overflow-wrap: anywhere;
        }

        .legal-description {
          display: block;
          margin: 18px 0 0 !important;
          max-width: 760px;
          color: rgba(226, 232, 240, 0.74);
          font-size: 15px !important;
          line-height: 1.75 !important;
        }

        .legal-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
          align-items: center;
          padding-top: 32px;
        }

        .legal-primary-action {
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

        .legal-primary-action:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .legal-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .legal-stat-card,
        .legal-card,
        .legal-country-card,
        .legal-warning-card {
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

        .legal-warning-card {
          border-color: rgba(245, 158, 11, 0.18);
          background:
            radial-gradient(
              circle at top left,
              rgba(245, 158, 11, 0.16),
              transparent 38%
            ),
            rgba(255, 255, 255, 0.045);
        }

        .legal-stat-label {
          margin: 0;
          color: rgba(226, 232, 240, 0.68);
          font-size: 12px;
          line-height: 1.4;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .legal-stat-value {
          margin: 10px 0 0;
          color: white;
          font-size: 30px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.06em;
        }

        .legal-stat-hint {
          margin: 8px 0 0;
          color: rgba(148, 163, 184, 0.92);
          font-size: 12px;
          line-height: 1.6;
        }

        .legal-grid-2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .legal-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .legal-card-icon {
          display: flex;
          width: 42px;
          height: 42px;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.18);
          font-size: 20px;
        }

        .legal-card-title {
          margin: 14px 0 0;
          font-size: 18px;
          line-height: 1.25 !important;
          font-weight: 900;
          color: white;
        }

        .legal-card-text {
          margin: 8px 0 0;
          color: rgba(226, 232, 240, 0.72);
          font-size: 13px;
          line-height: 1.65 !important;
        }

        .legal-country-header {
          display: flex;
          gap: 10px;
          align-items: center;
          justify-content: space-between;
        }

        .legal-country-main {
          display: flex;
          min-width: 0;
          gap: 10px;
          align-items: center;
        }

        .legal-country-emoji {
          display: inline-flex;
          height: 42px;
          width: 42px;
          flex: 0 0 auto;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          border: 1px solid rgba(245, 158, 11, 0.18);
          background: rgba(245, 158, 11, 0.12);
          font-size: 22px;
        }

        .legal-country-title {
          margin: 0;
          color: white;
          font-size: 16px;
          line-height: 1.25 !important;
          font-weight: 900;
        }

        .legal-country-meta {
          margin: 4px 0 0;
          color: rgba(148, 163, 184, 0.9);
          font-size: 11px;
          line-height: 1.4 !important;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .legal-pill {
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

        .legal-status-strong {
          border: 1px solid rgba(52, 211, 153, 0.28);
          background: rgba(52, 211, 153, 0.12);
          color: rgba(209, 250, 229, 0.98);
        }

        .legal-status-partial {
          border: 1px solid rgba(245, 158, 11, 0.3);
          background: rgba(245, 158, 11, 0.12);
          color: rgba(254, 243, 199, 0.98);
        }

        .legal-status-missing {
          border: 1px solid rgba(248, 113, 113, 0.3);
          background: rgba(248, 113, 113, 0.12);
          color: rgba(254, 226, 226, 0.98);
        }

        .legal-progress {
          margin-top: 14px;
          height: 10px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
        }

        .legal-progress-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            rgba(245, 158, 11, 0.95),
            rgba(52, 211, 153, 0.9)
          );
        }

        .legal-country-details {
          margin-top: 12px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .legal-country-metric {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          padding: 9px;
        }

        .legal-country-metric-value {
          color: white;
          font-size: 16px;
          line-height: 1;
          font-weight: 950;
        }

        .legal-country-metric-label {
          margin-top: 5px;
          color: rgba(148, 163, 184, 0.86);
          font-size: 10px;
          line-height: 1.35 !important;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .legal-list {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }

        .legal-list-item {
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.18);
          padding: 12px 13px;
          color: rgba(226, 232, 240, 0.8);
          font-size: 13px;
          line-height: 1.55 !important;
        }

        .legal-list-item span {
          color: rgba(52, 211, 153, 0.96);
          font-weight: 900;
          margin-right: 8px;
        }

        .legal-authority-text {
          margin-top: 12px;
          color: rgba(226, 232, 240, 0.72);
          font-size: 12px;
          line-height: 1.65 !important;
        }

        .legal-error {
          border-radius: 24px;
          padding: 16px;
          border: 1px solid rgba(248, 113, 113, 0.28);
          background: rgba(248, 113, 113, 0.12);
          color: rgba(254, 226, 226, 0.96);
          font-size: 13px;
          line-height: 1.6 !important;
          font-weight: 700;
        }

        .legal-note {
          margin: 0;
          color: rgba(254, 243, 199, 0.95);
          font-size: 13px;
          line-height: 1.7 !important;
          font-weight: 700;
        }

        @media (max-width: 1180px) {
          .legal-stats-grid,
          .legal-grid-3 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .legal-grid-2 {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 980px) {
          .legal-hero-grid,
          .legal-stats-grid,
          .legal-grid-3 {
            grid-template-columns: 1fr;
          }

          .legal-actions {
            justify-content: flex-start;
            padding-top: 0;
          }

          .legal-primary-action,
          .legal-actions .btn-ghost {
            width: 100%;
          }

          .legal-title {
            font-size: clamp(34px, 11vw, 54px) !important;
            line-height: 1.1 !important;
            letter-spacing: -0.04em;
          }

          .legal-description {
            font-size: 14px !important;
            line-height: 1.7 !important;
          }
        }

        @media (max-width: 560px) {
          .legal-title {
            font-size: clamp(32px, 10vw, 44px) !important;
            line-height: 1.12 !important;
            letter-spacing: -0.035em;
          }

          .legal-description {
            margin-top: 14px !important;
            font-size: 13px !important;
          }

          .legal-country-details {
            grid-template-columns: 1fr;
          }

          .legal-country-header {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>

      <div className="legal-page">
        <section className="section-card legal-hero">
          <div className="legal-hero-grid">
            <div className="legal-copy">
              <p className="legal-eyebrow">Legal & Tax Info</p>

              <h1 className="legal-title">
                Tax guidance with verified coverage boundaries.
              </h1>

              <p className="legal-description">
                Aureli gives finance and tax readiness support using uploaded
                business documents, verified tax coverage, and source-backed tax
                knowledge. It does not replace a qualified legal, tax, audit, or
                filing professional.
              </p>
            </div>

            <div className="legal-actions">
              <Link href="/tax-coverage" className="legal-primary-action">
                View Tax Coverage
              </Link>

              <Link href="/chat?agent=tax" className="btn-ghost">
                Ask Tax Agent
              </Link>
            </div>
          </div>
        </section>

        {error ? <div className="legal-error">{error}</div> : null}

        <section className="legal-stats-grid">
          <article className="legal-stat-card">
            <p className="legal-stat-label">Avg readiness</p>
            <p className="legal-stat-value">
              {loading ? "..." : `${summary.averageReadiness}%`}
            </p>
            <p className="legal-stat-hint">
              Average tax coverage across selected countries.
            </p>
          </article>

          <article className="legal-stat-card">
            <p className="legal-stat-label">Verified rules</p>
            <p className="legal-stat-value">
              {loading ? "..." : summary.rules}
            </p>
            <p className="legal-stat-hint">
              Structured rules used by the Tax Agent.
            </p>
          </article>

          <article className="legal-stat-card">
            <p className="legal-stat-label">Source docs</p>
            <p className="legal-stat-value">
              {loading ? "..." : summary.sources}
            </p>
            <p className="legal-stat-hint">
              Official uploaded source documents.
            </p>
          </article>

          <article className="legal-stat-card">
            <p className="legal-stat-label">Knowledge chunks</p>
            <p className="legal-stat-value">
              {loading ? "..." : summary.chunks}
            </p>
            <p className="legal-stat-hint">
              Searchable verified tax knowledge chunks.
            </p>
          </article>
        </section>

        <section className="legal-grid-2">
          <article className="section-card">
            <p className="legal-eyebrow">Important disclaimer</p>

            <h2 className="legal-card-title">
              Aureli is not a legal or tax professional.
            </h2>

            <p className="legal-card-text">
              Aureli can help organize financial information, detect missing
              documents, explain tax-readiness risks, and surface source-backed
              guidance. Final decisions must be reviewed by a qualified
              professional.
            </p>

            <div className="legal-list">
              <div className="legal-list-item">
                <span>!</span>
                Do not treat Aureli responses as certified legal, tax, audit,
                investment, or filing advice.
              </div>

              <div className="legal-list-item">
                <span>!</span>
                For official filings, notices, audits, penalties, and statutory
                interpretation, consult a qualified expert.
              </div>

              <div className="legal-list-item">
                <span>!</span>
                Tax laws, forms, thresholds, deadlines, and procedures can
                change. Always verify with official sources.
              </div>
            </div>
          </article>

          <article className="section-card">
            <p className="legal-eyebrow">Tax Agent policy</p>

            <h2 className="legal-card-title">
              How the Tax Agent should answer.
            </h2>

            <div className="legal-list">
              {taxAgentRules.map((rule) => (
                <div key={rule} className="legal-list-item">
                  <span>✓</span>
                  {rule}
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="section-card">
          <div className="legal-hero-grid">
            <div>
              <p className="legal-eyebrow">Coverage-linked countries</p>

              <h2 className="legal-card-title">
                Supported tax knowledge regions
              </h2>

              <p className="legal-card-text">
                Aureli is strongest only where verified tax rules, verified
                source documents, and knowledge chunks exist. Coverage can be
                strong, partial, or missing depending on uploaded official data.
              </p>
            </div>

            <div className="legal-actions">
              <button
                type="button"
                onClick={loadCoverage}
                disabled={loading}
                className="legal-primary-action"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="legal-grid-3" style={{ marginTop: 16 }}>
            {countries.length > 0
              ? countries.map((country) => (
                  <article
                    key={country.countryCode}
                    className="legal-country-card"
                  >
                    <div className="legal-country-header">
                      <div className="legal-country-main">
                        <span className="legal-country-emoji">
                          {getCountryEmoji(country.countryCode)}
                        </span>

                        <div>
                          <h3 className="legal-country-title">
                            {country.countryName}
                          </h3>

                          <p className="legal-country-meta">
                            {country.countryCode} · FY {country.financialYear}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`legal-pill ${getStatusClass(
                          country.overallStatus,
                        )}`}
                      >
                        {getStatusLabel(country.overallStatus)}
                      </span>
                    </div>

                    <div className="legal-progress">
                      <div
                        className="legal-progress-fill"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, country.readinessScore),
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="legal-country-details">
                      <div className="legal-country-metric">
                        <div className="legal-country-metric-value">
                          {country.verifiedRulesCount}
                        </div>
                        <div className="legal-country-metric-label">Rules</div>
                      </div>

                      <div className="legal-country-metric">
                        <div className="legal-country-metric-value">
                          {country.verifiedSourceDocumentsCount}
                        </div>
                        <div className="legal-country-metric-label">
                          Sources
                        </div>
                      </div>

                      <div className="legal-country-metric">
                        <div className="legal-country-metric-value">
                          {country.verifiedKnowledgeChunksCount}
                        </div>
                        <div className="legal-country-metric-label">Chunks</div>
                      </div>
                    </div>
                  </article>
                ))
              : supportedCountries.map((country) => (
                  <article key={country.code} className="legal-country-card">
                    <div className="legal-country-header">
                      <div className="legal-country-main">
                        <span className="legal-country-emoji">
                          {country.emoji}
                        </span>

                        <div>
                          <h3 className="legal-country-title">
                            {country.name}
                          </h3>

                          <p className="legal-country-meta">
                            {country.code} · Coverage pending
                          </p>
                        </div>
                      </div>

                      <span className="legal-pill legal-status-missing">
                        Missing
                      </span>
                    </div>

                    <p className="legal-authority-text">
                      Official verification should use: {country.authorities}
                    </p>
                  </article>
                ))}
          </div>
        </section>

        <section className="legal-grid-2">
          {legalPrinciples.map((principle) => (
            <article key={principle.title} className="legal-card">
              <div className="legal-card-icon">⚖️</div>

              <h2 className="legal-card-title">{principle.title}</h2>

              <p className="legal-card-text">{principle.description}</p>
            </article>
          ))}
        </section>

        <section className="legal-warning-card">
          <p className="legal-note">
            Tax note: Tax Coverage shows how much verified source data Aureli
            has. It is not a legal, tax, audit, or filing certification. Always
            verify official filing, notices, deadlines, audits, and legal
            compliance with a qualified professional.
          </p>
        </section>
      </div>
    </main>
  );
}