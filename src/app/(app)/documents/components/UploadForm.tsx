"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  ALLOWED_MIME_TYPES,
  DOCUMENT_CATEGORIES,
  MAX_FILE_SIZE_BYTES,
  formatFileSize,
  type DocumentCategoryValue,
} from "@/lib/document-categories";
import { getUsageLimitMessage } from "@/lib/usage-limits";

const CATEGORY_STYLES: Record<
  DocumentCategoryValue,
  {
    icon: string;
    accent: string;
    soft: string;
    border: string;
    hint: string;
  }
> = {
  BANK_STATEMENT: {
    icon: "🏦",
    accent: "#8abfff",
    soft: "rgba(88,166,255,0.10)",
    border: "rgba(88,166,255,0.28)",
    hint: "Cash, deposits, withdrawals",
  },
  SALES_INVOICE: {
    icon: "📈",
    accent: "#7bed9f",
    soft: "rgba(46,213,115,0.10)",
    border: "rgba(46,213,115,0.28)",
    hint: "Revenue and customer bills",
  },
  PURCHASE_INVOICE: {
    icon: "🧾",
    accent: "#ff8a95",
    soft: "rgba(255,71,87,0.10)",
    border: "rgba(255,71,87,0.28)",
    hint: "Vendor bills and expenses",
  },
  RECEIPT: {
    icon: "🧾",
    accent: "#7bed9f",
    soft: "rgba(46,213,115,0.10)",
    border: "rgba(46,213,115,0.28)",
    hint: "Proof of payment",
  },
  CREDIT_NOTE: {
    icon: "↩️",
    accent: "#8abfff",
    soft: "rgba(88,166,255,0.10)",
    border: "rgba(88,166,255,0.28)",
    hint: "Sales return or adjustment",
  },
  DEBIT_NOTE: {
    icon: "↪️",
    accent: "#ffd166",
    soft: "rgba(255,193,7,0.11)",
    border: "rgba(255,193,7,0.30)",
    hint: "Purchase adjustment",
  },
  PAYROLL: {
    icon: "👥",
    accent: "#caa8ff",
    soft: "rgba(170,120,255,0.12)",
    border: "rgba(170,120,255,0.30)",
    hint: "Salary and team costs",
  },
  UTILITY_BILL: {
    icon: "⚡",
    accent: "#ffd166",
    soft: "rgba(255,193,7,0.11)",
    border: "rgba(255,193,7,0.30)",
    hint: "Electricity, rent, services",
  },
  TAX_DOCUMENT: {
    icon: "🏛️",
    accent: "#ffb86b",
    soft: "rgba(255,184,107,0.11)",
    border: "rgba(255,184,107,0.30)",
    hint: "Tax challans and filings",
  },
  GST_RETURN: {
    icon: "🧮",
    accent: "#ffb86b",
    soft: "rgba(255,184,107,0.11)",
    border: "rgba(255,184,107,0.30)",
    hint: "GST sales, purchases, tax",
  },
  LOAN_STATEMENT: {
    icon: "🏦",
    accent: "#caa8ff",
    soft: "rgba(170,120,255,0.12)",
    border: "rgba(170,120,255,0.30)",
    hint: "EMI, interest, principal",
  },
  RENT_LEASE: {
    icon: "🏢",
    accent: "#ffd166",
    soft: "rgba(255,193,7,0.11)",
    border: "rgba(255,193,7,0.30)",
    hint: "Rent and lease payments",
  },
  INSURANCE_DOCUMENT: {
    icon: "🛡️",
    accent: "#8abfff",
    soft: "rgba(88,166,255,0.10)",
    border: "rgba(88,166,255,0.28)",
    hint: "Premiums and coverage",
  },
  INVENTORY_REPORT: {
    icon: "📦",
    accent: "#7bed9f",
    soft: "rgba(46,213,115,0.10)",
    border: "rgba(46,213,115,0.28)",
    hint: "Stock, COGS, movement",
  },
  PURCHASE_ORDER: {
    icon: "🛒",
    accent: "#ff8a95",
    soft: "rgba(255,71,87,0.10)",
    border: "rgba(255,71,87,0.28)",
    hint: "Planned vendor purchase",
  },
  SALES_ORDER: {
    icon: "🧾",
    accent: "#7bed9f",
    soft: "rgba(46,213,115,0.10)",
    border: "rgba(46,213,115,0.28)",
    hint: "Confirmed customer order",
  },
  FINANCIAL_STATEMENT: {
    icon: "📊",
    accent: "var(--color-amber)",
    soft: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.34)",
    hint: "Balance sheet and P&L",
  },
  OTHER: {
    icon: "📄",
    accent: "var(--color-text-secondary)",
    soft: "rgba(255,255,255,0.06)",
    border: "var(--color-border)",
    hint: "Any other finance file",
  },
};

function getFriendlyUploadError(error: unknown) {
  if (error instanceof Error) {
    if (error.message.toLowerCase().includes("failed to fetch")) {
      return "Upload request failed. Check if the dev server is running, then try again.";
    }

    return error.message;
  }

  return "Upload failed. Try again.";
}

async function readUploadError(response: Response) {
  try {
    const data = await response.json();

    if (typeof data?.error === "string") {
      return data.error;
    }

    return "Upload failed. Try again.";
  } catch {
    return "Upload failed. Try again.";
  }
}

export function UploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [category, setCategory] = useState<DocumentCategoryValue>(
    DOCUMENT_CATEGORIES[0].value,
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  function validateAndSetFile(file: File | null) {
    setError(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setSelectedFile(null);
      setError("Use a PDF, image (JPG/PNG/WebP), CSV, or Excel file.");
      return;
    }

    if (file.size === 0) {
      setSelectedFile(null);
      setError("That file is empty.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setSelectedFile(null);
      setError(
        `Files must be ${formatFileSize(
          MAX_FILE_SIZE_BYTES,
        )} or smaller. Use smaller demo documents to protect Gemini quota.`,
      );
      return;
    }

    setSelectedFile(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    validateAndSetFile(event.target.files?.[0] ?? null);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDraggingOver(false);

    const file = event.dataTransfer.files?.[0] ?? null;
    validateAndSetFile(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedFile) {
      setError("Choose a file first.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setError(`Files must be ${formatFileSize(MAX_FILE_SIZE_BYTES)} or smaller.`);
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("category", category);

    setIsUploading(true);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const message = await readUploadError(response);
        setError(message);
        return;
      }

      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      router.refresh();
    } catch (uploadError) {
      setError(getFriendlyUploadError(uploadError));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form
      className="upload-card"
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gap: 18,
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 8,
        }}
      >
        <p
          className="section-title"
          style={{
            margin: 0,
          }}
        >
          Upload a document
        </p>

        <p
          className="section-hint"
          style={{
            margin: 0,
            lineHeight: 1.55,
          }}
        >
          PDF, image, CSV, or Excel. Production guardrails are enabled:{" "}
          {getUsageLimitMessage()}.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              color: "var(--color-text-secondary)",
              fontSize: 13,
              fontWeight: 850,
            }}
          >
            Choose document type
          </label>

          <span
            style={{
              border: "1px solid var(--color-border)",
              background: "rgba(255,255,255,0.04)",
              color: CATEGORY_STYLES[category].accent,
              borderRadius: 999,
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            Selected:{" "}
            {DOCUMENT_CATEGORIES.find((item) => item.value === category)?.label}
          </span>
        </div>

        <div
          role="radiogroup"
          aria-label="Document category"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 12,
          }}
        >
          {DOCUMENT_CATEGORIES.map((option) => {
            const style = CATEGORY_STYLES[option.value];
            const isSelected = category === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={isUploading}
                onClick={() => setCategory(option.value)}
                style={{
                  border: isSelected
                    ? `1px solid ${style.accent}`
                    : `1px solid ${style.border}`,
                  background: isSelected
                    ? `linear-gradient(135deg, ${style.soft}, rgba(255,255,255,0.045))`
                    : "rgba(255,255,255,0.035)",
                  borderRadius: 18,
                  padding: 14,
                  display: "grid",
                  gap: 10,
                  textAlign: "left",
                  cursor: isUploading ? "not-allowed" : "pointer",
                  opacity: isUploading ? 0.7 : 1,
                  boxShadow: isSelected
                    ? `0 0 0 1px ${style.border}, 0 18px 50px rgba(0,0,0,0.18)`
                    : "none",
                  transition: "0.18s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 14,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: style.soft,
                      border: `1px solid ${style.border}`,
                      fontSize: 18,
                    }}
                  >
                    {style.icon}
                  </span>

                  {isSelected && (
                    <span
                      style={{
                        color: style.accent,
                        fontSize: 12,
                        fontWeight: 950,
                      }}
                    >
                      Selected
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 5,
                  }}
                >
                  <strong
                    style={{
                      color: "var(--color-text-primary)",
                      fontSize: 14,
                      lineHeight: 1.25,
                    }}
                  >
                    {option.label}
                  </strong>

                  <span
                    style={{
                      color: "var(--color-text-secondary)",
                      fontSize: 12,
                      lineHeight: 1.35,
                    }}
                  >
                    {style.hint}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <label
        onDragOver={(event) => {
          event.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        style={{
          border: isDraggingOver
            ? "1px solid rgba(245,158,11,0.65)"
            : selectedFile
              ? "1px solid rgba(46,213,115,0.34)"
              : "1px dashed var(--color-border)",
          background: isDraggingOver
            ? "rgba(245,158,11,0.10)"
            : selectedFile
              ? "rgba(46,213,115,0.08)"
              : "rgba(255,255,255,0.03)",
          borderRadius: 18,
          padding: 20,
          display: "grid",
          gap: 10,
          cursor: isUploading ? "not-allowed" : "pointer",
          transition: "0.18s ease",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_MIME_TYPES.join(",")}
          onChange={handleFileChange}
          disabled={isUploading}
          style={{
            display: "none",
          }}
        />

        <span
          style={{
            color: "var(--color-text-primary)",
            fontSize: 14,
            fontWeight: 900,
          }}
        >
          {selectedFile ? selectedFile.name : "Choose a file, or drag it here"}
        </span>

        <span
          style={{
            color: selectedFile ? "#7bed9f" : "var(--color-text-secondary)",
            fontSize: 13,
            lineHeight: 1.45,
            fontWeight: selectedFile ? 750 : 500,
          }}
        >
          {selectedFile
            ? `${formatFileSize(selectedFile.size)} selected`
            : `Maximum file size: ${formatFileSize(MAX_FILE_SIZE_BYTES)}`}
        </span>
      </label>

      {error && (
        <div
          style={{
            border: "1px solid rgba(255,71,87,0.28)",
            background: "rgba(255,71,87,0.08)",
            color: "#ff8a95",
            borderRadius: 14,
            padding: 12,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!selectedFile || isUploading}
        style={{
          border: "none",
          background: selectedFile
            ? "linear-gradient(135deg, var(--color-amber), #ffd166)"
            : "rgba(245,158,11,0.55)",
          color: "var(--color-base)",
          borderRadius: 14,
          padding: "13px 16px",
          cursor: !selectedFile || isUploading ? "not-allowed" : "pointer",
          fontSize: 14,
          fontWeight: 950,
          opacity: !selectedFile || isUploading ? 0.65 : 1,
          boxShadow: selectedFile ? "0 16px 40px rgba(245,158,11,0.18)" : "none",
        }}
      >
        {isUploading ? "Uploading..." : "Upload document"}
      </button>
    </form>
  );
}