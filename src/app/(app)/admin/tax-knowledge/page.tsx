"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type TaxRuleType =
  | "INCOME_TAX"
  | "GST"
  | "VAT"
  | "SALES_TAX"
  | "CORPORATE_TAX"
  | "PAYROLL_TAX"
  | "DEDUCTION"
  | "FILING"
  | "COMPLIANCE"
  | "OTHER";

type VerificationStatus = "DRAFT" | "VERIFIED" | "NEEDS_REVIEW" | "ARCHIVED";

type TaxKnowledgeDocument = {
  id: string;
  countryCode: string;
  countryName: string;
  financialYear: string;
  taxType: TaxRuleType;
  title: string;
  sourceName: string;
  sourceUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  verificationStatus: VerificationStatus;
  lastVerifiedAt: string | null;
  createdAt: string;
  _count: {
    chunks: number;
  };
};

type TaxKnowledgeResponse = {
  message: string;
  summary: unknown;
  documents: TaxKnowledgeDocument[];
};

const TAX_TYPES: TaxRuleType[] = [
  "INCOME_TAX",
  "GST",
  "VAT",
  "SALES_TAX",
  "CORPORATE_TAX",
  "PAYROLL_TAX",
  "DEDUCTION",
  "FILING",
  "COMPLIANCE",
  "OTHER",
];

const COUNTRY_PRESETS = [
  {
    label: "India",
    countryCode: "IN",
    countryName: "India",
    financialYear: "2025-26",
  },
  {
    label: "USA",
    countryCode: "US",
    countryName: "United States",
    financialYear: "2026",
  },
  {
    label: "UK",
    countryCode: "UK",
    countryName: "United Kingdom",
    financialYear: "2026-27",
  },
];

function formatDate(value: string | null) {
  if (!value) {
    return "Not verified";
  }

  return new Date(value).toLocaleString();
}

function getStatusStyle(status: VerificationStatus) {
  if (status === "VERIFIED") {
    return {
      color: "#7bed9f",
      background: "rgba(46,213,115,0.10)",
      border: "rgba(46,213,115,0.30)",
    };
  }

  if (status === "NEEDS_REVIEW") {
    return {
      color: "#ffd166",
      background: "rgba(255,193,7,0.10)",
      border: "rgba(255,193,7,0.30)",
    };
  }

  if (status === "ARCHIVED") {
    return {
      color: "var(--color-text-muted)",
      background: "rgba(255,255,255,0.045)",
      border: "var(--color-border)",
    };
  }

  return {
    color: "#8ec5ff",
    background: "rgba(99,179,237,0.10)",
    border: "rgba(99,179,237,0.30)",
  };
}

function fieldStyle() {
  return {
    width: "100%",
    border: "1px solid var(--color-border)",
    background: "rgba(255,255,255,0.035)",
    color: "var(--color-text-primary)",
    borderRadius: 14,
    padding: "12px 14px",
    outline: "none",
  };
}

function labelStyle() {
  return {
    display: "grid",
    gap: 8,
    color: "var(--color-text-secondary)",
    fontSize: 13,
    fontWeight: 750,
  };
}

function miniCardStyle(border = "var(--color-border)") {
  return {
    border: `1px solid ${border}`,
    background: "rgba(255,255,255,0.035)",
    borderRadius: 18,
    padding: 16,
    minHeight: 112,
    display: "grid",
    alignContent: "space-between",
  };
}

export default function TaxKnowledgeAdminPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [documents, setDocuments] = useState<TaxKnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [countryCode, setCountryCode] = useState("IN");
  const [countryName, setCountryName] = useState("India");
  const [financialYear, setFinancialYear] = useState("2025-26");
  const [taxType, setTaxType] = useState<TaxRuleType>("GST");
  const [title, setTitle] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [markVerified, setMarkVerified] = useState(true);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    const savedSecret = window.localStorage.getItem("aureli_admin_secret");

    if (savedSecret) {
      setAdminSecret(savedSecret);
    }
  }, []);

  const groupedStats = useMemo(() => {
    const stats = new Map<string, { docs: number; chunks: number }>();

    for (const document of documents) {
      const key = `${document.countryName} / ${document.taxType}`;
      const current = stats.get(key) ?? { docs: 0, chunks: 0 };

      stats.set(key, {
        docs: current.docs + 1,
        chunks: current.chunks + document._count.chunks,
      });
    }

    return Array.from(stats.entries()).map(([label, value]) => ({
      label,
      ...value,
    }));
  }, [documents]);

  const totalChunks = documents.reduce(
    (total, document) => total + document._count.chunks,
    0,
  );

  const verifiedDocuments = documents.filter(
    (document) => document.verificationStatus === "VERIFIED",
  ).length;

  function saveSecret() {
    window.localStorage.setItem("aureli_admin_secret", adminSecret.trim());
    setMessage("Admin secret saved in this browser.");
    setError("");
  }

  function applyCountryPreset(code: string) {
    const preset = COUNTRY_PRESETS.find((item) => item.countryCode === code);

    if (!preset) {
      return;
    }

    setCountryCode(preset.countryCode);
    setCountryName(preset.countryName);
    setFinancialYear(preset.financialYear);
  }

  async function loadDocuments() {
    if (!adminSecret.trim()) {
      setError("Enter ADMIN_API_SECRET first.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/tax-knowledge", {
        method: "GET",
        headers: {
          "x-admin-api-secret": adminSecret.trim(),
        },
      });

      const data = (await response.json()) as
        | TaxKnowledgeResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "Failed to load tax knowledge.",
        );
      }

      if ("documents" in data) {
        setDocuments(data.documents);
        setMessage(`Loaded ${data.documents.length} tax knowledge documents.`);
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load tax knowledge.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function uploadKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!adminSecret.trim()) {
      setError("Enter ADMIN_API_SECRET first.");
      return;
    }

    if (!title.trim() || !sourceName.trim()) {
      setError("Title and source name are required.");
      return;
    }

    if (!file && text.trim().length < 50) {
      setError("Upload a file or paste at least 50 characters of text.");
      return;
    }

    const formData = new FormData();

    formData.set("countryCode", countryCode.trim().toUpperCase());
    formData.set("countryName", countryName.trim());
    formData.set("financialYear", financialYear.trim());
    formData.set("taxType", taxType);
    formData.set("title", title.trim());
    formData.set("sourceName", sourceName.trim());
    formData.set("sourceUrl", sourceUrl.trim());
    formData.set("markVerified", markVerified ? "true" : "false");

    if (text.trim()) {
      formData.set("text", text.trim());
    }

    if (file) {
      formData.set("file", file);
    }

    setUploading(true);
    setError("");
    setMessage(
      file
        ? "Uploading file. Large PDFs can take 5–10 minutes. Do not refresh."
        : "Uploading text knowledge.",
    );

    try {
      const response = await fetch("/api/admin/tax-knowledge", {
        method: "POST",
        headers: {
          "x-admin-api-secret": adminSecret.trim(),
        },
        body: formData,
      });

      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Upload failed.");
      }

      setMessage(data.message ?? "Tax knowledge uploaded.");
      setTitle("");
      setSourceName("");
      setSourceUrl("");
      setText("");
      setFile(null);

      const input = document.getElementById(
        "tax-file-input",
      ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }

      await loadDocuments();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Tax knowledge upload failed.",
      );
    } finally {
      setUploading(false);
    }
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
        <div style={{ display: "grid", gap: 10, maxWidth: 820 }}>
          <p className="eyebrow" style={{ margin: 0 }}>
            Tax intelligence center
          </p>

          <h1 style={{ margin: 0, lineHeight: 1.08 }}>
            Tax Knowledge Base
          </h1>

          <p
            className="page-intro"
            style={{ margin: 0, lineHeight: 1.6, maxWidth: 780 }}
          >
            Upload official India, USA, and UK tax sources. Verified knowledge
            becomes available to the Tax Agent for source-backed readiness,
            compliance, and document review.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="badge-sample">{documents.length} documents</span>
          <span className="badge-sample">{totalChunks} chunks</span>
        </div>
      </header>

      <section className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <p className="stat-label">Knowledge docs</p>
          <p className="stat-value">{documents.length}</p>
          <p className="stat-delta stat-delta-neutral">
            Uploaded source documents
          </p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Verified docs</p>
          <p className="stat-value">{verifiedDocuments}</p>
          <p className="stat-delta stat-delta-positive">
            Trusted by Tax Agent
          </p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Knowledge chunks</p>
          <p className="stat-value">{totalChunks}</p>
          <p className="stat-delta stat-delta-neutral">
            Searchable tax memory
          </p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Jurisdictions</p>
          <p className="stat-value">
            {new Set(documents.map((doc) => doc.countryCode)).size}
          </p>
          <p className="stat-delta stat-delta-positive">
            India / USA / UK ready
          </p>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 0.75fr) minmax(0, 1.6fr)",
          gap: 18,
          alignItems: "start",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "grid", gap: 18 }}>
          <section className="section-card">
            <div className="section-heading">
              <div>
                <p className="section-title">Admin access</p>
                <p className="section-hint">
                  Paste your ADMIN_API_SECRET from .env.
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
              <input
                type="password"
                value={adminSecret}
                onChange={(event) => setAdminSecret(event.target.value)}
                placeholder="ADMIN_API_SECRET"
                style={fieldStyle()}
              />

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={saveSecret}
                  className="btn-ghost"
                >
                  Save secret
                </button>

                <button
                  type="button"
                  onClick={loadDocuments}
                  disabled={loading}
                  className="btn-ghost"
                >
                  {loading ? "Loading..." : "Refresh"}
                </button>
              </div>
            </div>
          </section>

          <section className="section-card">
            <div className="section-heading">
              <div>
                <p className="section-title">Coverage stats</p>
                <p className="section-hint">
                  Country and tax-type coverage currently uploaded.
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
              {groupedStats.length === 0 ? (
                <div className="documents-empty">
                  <strong>No coverage loaded</strong>
                  <p className="section-hint">
                    Enter admin secret and click Refresh.
                  </p>
                </div>
              ) : (
                groupedStats.map((stat) => (
                  <div key={stat.label} style={miniCardStyle()}>
                    <p
                      style={{
                        margin: 0,
                        color: "var(--color-text-primary)",
                        fontWeight: 850,
                      }}
                    >
                      {stat.label}
                    </p>

                    <p
                      style={{
                        margin: "10px 0 0",
                        color: "var(--color-text-muted)",
                        fontSize: 13,
                      }}
                    >
                      {stat.docs} docs · {stat.chunks} chunks
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <form onSubmit={uploadKnowledge} className="section-card">
          <div className="section-heading">
            <div>
              <p className="section-title">Upload tax source</p>
              <p className="section-hint">
                Upload official PDFs, images, or paste source text. Verified
                documents are used by the Tax Agent.
              </p>
            </div>

            <span className="badge-sample">
              {uploading ? "Processing..." : "Verified source"}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 14,
              marginTop: 20,
            }}
          >
            <label style={labelStyle()}>
              Country preset
              <select
                value={countryCode}
                onChange={(event) => applyCountryPreset(event.target.value)}
                style={fieldStyle()}
              >
                {COUNTRY_PRESETS.map((country) => (
                  <option key={country.countryCode} value={country.countryCode}>
                    {country.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={labelStyle()}>
              Country code
              <input
                value={countryCode}
                onChange={(event) =>
                  setCountryCode(event.target.value.toUpperCase())
                }
                style={fieldStyle()}
              />
            </label>

            <label style={labelStyle()}>
              Country name
              <input
                value={countryName}
                onChange={(event) => setCountryName(event.target.value)}
                style={fieldStyle()}
              />
            </label>

            <label style={labelStyle()}>
              Financial year
              <input
                value={financialYear}
                onChange={(event) => setFinancialYear(event.target.value)}
                style={fieldStyle()}
              />
            </label>

            <label style={labelStyle()}>
              Tax type
              <select
                value={taxType}
                onChange={(event) =>
                  setTaxType(event.target.value as TaxRuleType)
                }
                style={fieldStyle()}
              >
                {TAX_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label
              style={{
                border: "1px solid var(--color-border)",
                background: "rgba(255,255,255,0.035)",
                color: "var(--color-text-secondary)",
                borderRadius: 14,
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                fontWeight: 750,
              }}
            >
              <input
                type="checkbox"
                checked={markVerified}
                onChange={(event) => setMarkVerified(event.target.checked)}
              />
              Mark as verified
            </label>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 14,
              marginTop: 14,
            }}
          >
            <label style={labelStyle()}>
              Title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="India CGST Act Official Source"
                style={fieldStyle()}
              />
            </label>

            <label style={labelStyle()}>
              Source name
              <input
                value={sourceName}
                onChange={(event) => setSourceName(event.target.value)}
                placeholder="CBIC GST Portal / IRS / GOV.UK"
                style={fieldStyle()}
              />
            </label>
          </div>

          <label style={{ ...labelStyle(), marginTop: 14 }}>
            Source URL
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://..."
              style={fieldStyle()}
            />
          </label>

          <label style={{ ...labelStyle(), marginTop: 14 }}>
            Upload PDF / TXT / MD / CSV / JSON / Image
            <input
              id="tax-file-input"
              type="file"
              accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              style={fieldStyle()}
            />
          </label>

          <label style={{ ...labelStyle(), marginTop: 14 }}>
            Or paste source text
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={7}
              placeholder="Paste extracted official tax guidance text here..."
              style={{
                ...fieldStyle(),
                resize: "vertical",
                lineHeight: 1.6,
              }}
            />
          </label>

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button type="submit" disabled={uploading} className="btn-ghost">
              {uploading ? "Uploading / Extracting..." : "Upload knowledge"}
            </button>

            <button
              type="button"
              onClick={loadDocuments}
              disabled={loading}
              className="btn-ghost"
            >
              Refresh list
            </button>
          </div>
        </form>
      </section>

      {(message || error) && (
        <section
          className="section-card"
          style={{
            marginBottom: 24,
            borderColor: error
              ? "rgba(255,71,87,0.30)"
              : "rgba(46,213,115,0.30)",
            background: error
              ? "rgba(255,71,87,0.08)"
              : "rgba(46,213,115,0.08)",
          }}
        >
          <p
            style={{
              margin: 0,
              color: error ? "#ff8a95" : "#7bed9f",
              fontWeight: 800,
            }}
          >
            {error || message}
          </p>
        </section>
      )}

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="section-title">Uploaded Tax Knowledge</p>
            <p className="section-hint">
              Verified documents are available to the Tax Agent. Draft or
              stale entries should be reviewed before use.
            </p>
          </div>

          <button
            type="button"
            onClick={loadDocuments}
            disabled={loading}
            className="btn-ghost"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="documents-empty" style={{ marginTop: 18 }}>
            <strong>No tax knowledge loaded</strong>
            <p className="section-hint">
              Enter your admin secret and click Refresh, or upload your first
              official source document.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 12,
              marginTop: 18,
            }}
          >
            {documents.map((document) => {
              const statusStyle = getStatusStyle(document.verificationStatus);

              return (
                <article
                  key={document.id}
                  style={{
                    border: "1px solid var(--color-border)",
                    background: "rgba(255,255,255,0.035)",
                    borderRadius: 20,
                    padding: 16,
                    display: "grid",
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "grid", gap: 6, maxWidth: 720 }}>
                      <p
                        style={{
                          margin: 0,
                          color: "var(--color-text-primary)",
                          fontSize: 16,
                          fontWeight: 900,
                          lineHeight: 1.3,
                        }}
                      >
                        {document.title}
                      </p>

                      <p
                        style={{
                          margin: 0,
                          color: "var(--color-text-muted)",
                          fontSize: 13,
                          lineHeight: 1.45,
                        }}
                      >
                        {document.fileName ?? "Pasted text"} ·{" "}
                        {document.sourceName}
                      </p>
                    </div>

                    <span
                      style={{
                        border: `1px solid ${statusStyle.border}`,
                        background: statusStyle.background,
                        color: statusStyle.color,
                        borderRadius: 999,
                        padding: "7px 11px",
                        fontSize: 12,
                        fontWeight: 850,
                      }}
                    >
                      {document.verificationStatus}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: 10,
                    }}
                  >
                    <div style={miniCardStyle()}>
                      <p className="stat-label" style={{ margin: 0 }}>
                        Country
                      </p>
                      <p
                        style={{
                          margin: "8px 0 0",
                          color: "var(--color-text-primary)",
                          fontWeight: 850,
                        }}
                      >
                        {document.countryName}
                      </p>
                      <p className="section-hint" style={{ margin: "4px 0 0" }}>
                        {document.financialYear}
                      </p>
                    </div>

                    <div style={miniCardStyle()}>
                      <p className="stat-label" style={{ margin: 0 }}>
                        Tax type
                      </p>
                      <p
                        style={{
                          margin: "8px 0 0",
                          color: "var(--color-text-primary)",
                          fontWeight: 850,
                        }}
                      >
                        {document.taxType}
                      </p>
                      <p className="section-hint" style={{ margin: "4px 0 0" }}>
                        {document.countryCode}
                      </p>
                    </div>

                    <div style={miniCardStyle()}>
                      <p className="stat-label" style={{ margin: 0 }}>
                        Chunks
                      </p>
                      <p
                        style={{
                          margin: "8px 0 0",
                          color: "var(--color-text-primary)",
                          fontWeight: 950,
                          fontSize: 24,
                        }}
                      >
                        {document._count.chunks}
                      </p>
                      <p className="section-hint" style={{ margin: "4px 0 0" }}>
                        Searchable memory
                      </p>
                    </div>

                    <div style={miniCardStyle()}>
                      <p className="stat-label" style={{ margin: 0 }}>
                        Verified
                      </p>
                      <p
                        style={{
                          margin: "8px 0 0",
                          color: "var(--color-text-primary)",
                          fontWeight: 750,
                          fontSize: 13,
                          lineHeight: 1.4,
                        }}
                      >
                        {formatDate(document.lastVerifiedAt)}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}