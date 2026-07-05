"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
  type FocusEvent,
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

function dropdownButtonStyle(isOpen: boolean, hasValue: boolean): CSSProperties {
  return {
    width: "100%",
    border: isOpen
      ? "1px solid rgba(245,158,11,0.55)"
      : "1px solid var(--color-border)",
    background: isOpen
      ? "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(255,255,255,0.04))"
      : "linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))",
    color: hasValue ? "var(--color-text-primary)" : "var(--color-text-muted)",
    borderRadius: 16,
    padding: "13px 14px",
    outline: "none",
    fontSize: 14,
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    textAlign: "left",
    boxShadow: isOpen
      ? "0 0 0 1px rgba(245,158,11,0.16), 0 18px 45px rgba(0,0,0,0.20)"
      : "inset 0 1px 0 rgba(255,255,255,0.04)",
  };
}

function DocumentTypeSelect({
  value,
  disabled,
  onChange,
}: {
  value: DocumentCategoryValue;
  disabled: boolean;
  onChange: (value: DocumentCategoryValue) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption =
    DOCUMENT_CATEGORIES.find((option) => option.value === value) ??
    DOCUMENT_CATEGORIES[0];

  const selectedStyle = CATEGORY_STYLES[selectedOption.value];

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const nextFocusedElement = event.relatedTarget as Node | null;

    if (
      nextFocusedElement &&
      event.currentTarget.contains(nextFocusedElement)
    ) {
      return;
    }

    setIsOpen(false);
  }

  return (
    <div
      onBlur={handleBlur}
      style={{
        position: "relative",
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        style={{
          ...dropdownButtonStyle(isOpen, Boolean(selectedOption)),
          opacity: disabled ? 0.65 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            minWidth: 0,
          }}
        >
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 13,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: selectedStyle.soft,
              border: `1px solid ${selectedStyle.border}`,
              fontSize: 17,
              flex: "0 0 auto",
            }}
          >
            {selectedStyle.icon}
          </span>

          <span
            style={{
              display: "grid",
              gap: 3,
              minWidth: 0,
            }}
          >
            <strong
              style={{
                color: "var(--color-text-primary)",
                fontSize: 14,
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selectedOption.label}
            </strong>

            <span
              style={{
                color: "var(--color-text-secondary)",
                fontSize: 12,
                lineHeight: 1.25,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selectedStyle.hint}
            </span>
          </span>
        </span>

        <span
          style={{
            color: "var(--color-amber)",
            fontSize: 13,
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "0.18s ease",
            flex: "0 0 auto",
          }}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 50,
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            border: "1px solid rgba(245,158,11,0.28)",
            background:
              "linear-gradient(180deg, rgba(18,24,33,0.98), rgba(10,15,22,0.98))",
            color: "var(--color-text-primary)",
            borderRadius: 18,
            padding: 8,
            display: "grid",
            gap: 6,
            maxHeight: 320,
            overflowY: "auto",
            boxShadow:
              "0 22px 70px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)",
            backdropFilter: "blur(16px)",
          }}
        >
          {DOCUMENT_CATEGORIES.map((option) => {
            const style = CATEGORY_STYLES[option.value];
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                style={{
                  border: isSelected
                    ? `1px solid ${style.border}`
                    : "1px solid transparent",
                  background: isSelected
                    ? `linear-gradient(135deg, ${style.soft}, rgba(255,255,255,0.035))`
                    : "rgba(255,255,255,0.025)",
                  color: isSelected ? style.accent : "var(--color-text-primary)",
                  borderRadius: 14,
                  padding: 11,
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  gap: 11,
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: style.soft,
                    border: `1px solid ${style.border}`,
                    fontSize: 16,
                    flex: "0 0 auto",
                  }}
                >
                  {style.icon}
                </span>

                <span
                  style={{
                    display: "grid",
                    gap: 3,
                    minWidth: 0,
                  }}
                >
                  <strong
                    style={{
                      color: isSelected
                        ? style.accent
                        : "var(--color-text-primary)",
                      fontSize: 13,
                      fontWeight: isSelected ? 950 : 800,
                      lineHeight: 1.25,
                    }}
                  >
                    {option.label}
                  </strong>

                  <span
                    style={{
                      color: "var(--color-text-secondary)",
                      fontSize: 12,
                      lineHeight: 1.3,
                    }}
                  >
                    {style.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
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
              border: `1px solid ${CATEGORY_STYLES[category].border}`,
              background: CATEGORY_STYLES[category].soft,
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

        <DocumentTypeSelect
          value={category}
          disabled={isUploading}
          onChange={setCategory}
        />
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