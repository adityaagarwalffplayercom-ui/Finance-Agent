"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DocumentCategory } from "@prisma/client";
import {
  DOCUMENT_CATEGORIES,
  getDocumentCategoryConfig,
} from "@/lib/document-categories";

type UploadState = {
  type: "idle" | "success" | "error";
  message: string;
};

type Tone = "sage" | "amber" | "gold" | "danger" | "neutral";

function getToneStyle(tone: Tone) {
  return {
    sage: {
      color: "var(--color-sage)",
      border: "rgba(46,213,115,0.28)",
      background: "rgba(46,213,115,0.085)",
    },
    amber: {
      color: "var(--color-amber)",
      border: "rgba(245,158,11,0.30)",
      background: "rgba(245,158,11,0.095)",
    },
    gold: {
      color: "var(--color-gold)",
      border: "rgba(255,209,102,0.30)",
      background: "rgba(255,209,102,0.085)",
    },
    danger: {
      color: "var(--color-danger)",
      border: "rgba(255,138,149,0.30)",
      background: "rgba(255,138,149,0.085)",
    },
    neutral: {
      color: "var(--color-text-secondary)",
      border: "var(--color-border)",
      background: "rgba(255,255,255,0.045)",
    },
  }[tone];
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function DocumentTypeSelect({
  value,
  onChange,
  disabled,
}: {
  value: DocumentCategory;
  onChange: (value: DocumentCategory) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = getDocumentCategoryConfig(value);
  const selectedTone = getToneStyle(selected.tone);

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        minWidth: 0,
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        style={{
          width: "100%",
          border: `1px solid ${selectedTone.border}`,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.060), rgba(255,255,255,0.025))",
          color: "var(--color-text-primary)",
          borderRadius: 18,
          padding: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.65 : 1,
          textAlign: "left",
          minWidth: 0,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <span
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            minWidth: 0,
          }}
        >
          <span
            style={{
              width: 42,
              height: 42,
              borderRadius: 15,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${selectedTone.border}`,
              background: selectedTone.background,
              fontSize: 18,
              flex: "0 0 auto",
            }}
          >
            {selected.icon}
          </span>

          <span
            style={{
              display: "grid",
              gap: 4,
              minWidth: 0,
            }}
          >
            <strong
              style={{
                color: "var(--color-text-primary)",
                fontSize: 14,
                lineHeight: 1.25,
                overflowWrap: "anywhere",
              }}
            >
              {selected.label}
            </strong>

            <span
              style={{
                color: "var(--color-text-secondary)",
                fontSize: 12,
                lineHeight: 1.35,
                overflowWrap: "anywhere",
              }}
            >
              {selected.description}
            </span>
          </span>
        </span>

        <span
          style={{
            color: "var(--color-gold)",
            fontSize: 16,
            lineHeight: 1,
            flex: "0 0 auto",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 160ms ease",
          }}
        >
          ▾
        </span>
      </button>

      {open ? (
        <div
          style={{
            border: "1px solid rgba(245,158,11,0.22)",
            background:
              "linear-gradient(135deg, rgba(10,15,22,0.98), rgba(14,20,30,0.98))",
            borderRadius: 20,
            padding: 8,
            display: "grid",
            gap: 6,
            maxHeight: 420,
            overflowY: "auto",
            overflowX: "hidden",
            overscrollBehavior: "contain",
            scrollbarWidth: "thin",
            boxShadow:
              "0 18px 52px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {DOCUMENT_CATEGORIES.map((category) => {
            const tone = getToneStyle(category.tone);
            const active = category.value === value;

            return (
              <button
                key={category.value}
                type="button"
                onClick={() => {
                  onChange(category.value);
                  setOpen(false);
                }}
                style={{
                  border: active
                    ? `1px solid ${tone.border}`
                    : "1px solid rgba(255,255,255,0.045)",
                  background: active ? tone.background : "rgba(255,255,255,0.024)",
                  color: "var(--color-text-primary)",
                  borderRadius: 15,
                  padding: 11,
                  display: "flex",
                  gap: 11,
                  alignItems: "center",
                  textAlign: "left",
                  cursor: "pointer",
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
                    border: `1px solid ${tone.border}`,
                    background: tone.background,
                    fontSize: 16,
                    flex: "0 0 auto",
                  }}
                >
                  {category.icon}
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
                      color: active ? tone.color : "var(--color-text-primary)",
                      fontSize: 13,
                      lineHeight: 1.2,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {category.label}
                  </strong>

                  <span
                    style={{
                      color: "var(--color-text-secondary)",
                      fontSize: 11,
                      lineHeight: 1.35,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {category.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function UploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [category, setCategory] =
    useState<DocumentCategory>("FINANCIAL_STATEMENT");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>({
    type: "idle",
    message: "",
  });
  const [isPending, startTransition] = useTransition();

  const selectedCategory = useMemo(
    () => getDocumentCategoryConfig(category),
    [category],
  );

  const selectedTone = getToneStyle(selectedCategory.tone);
  const disabled = isPending;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setState({
        type: "error",
        message: "Please choose a document before uploading.",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);

    setState({
      type: "idle",
      message: "",
    });

    startTransition(async () => {
      try {
        const response = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });

        const data = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;

        if (!response.ok) {
          throw new Error(data?.error ?? "Document upload failed.");
        }

        setFile(null);

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        setState({
          type: "success",
          message:
            data?.message ??
            "Document uploaded successfully. You can process it with AI from the review queue.",
        });

        router.refresh();
      } catch (error) {
        setState({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Document upload failed. Please try again.",
        });
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: "1px solid rgba(245,158,11,0.16)",
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.024))",
        borderRadius: 24,
        padding: 20,
        display: "grid",
        gap: 18,
        minWidth: 0,
        overflow: "visible",
        boxShadow:
          "0 18px 60px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.052)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "flex-start",
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 6,
            minWidth: 0,
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
            PDF, image, CSV, or Excel. Select the correct category before
            uploading.
          </p>
        </div>

        <span
          style={{
            border: `1px solid ${selectedTone.border}`,
            background: selectedTone.background,
            color: selectedTone.color,
            borderRadius: 999,
            padding: "8px 11px",
            fontSize: 11,
            fontWeight: 950,
            whiteSpace: "nowrap",
          }}
        >
          Selected: {selectedCategory.label}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          minWidth: 0,
        }}
      >
        <label
          htmlFor="document-category"
          style={{
            color: "var(--color-text-primary)",
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          Choose document type
        </label>

        <input
          id="document-category"
          type="hidden"
          name="category"
          value={category}
        />

        <DocumentTypeSelect
          value={category}
          onChange={setCategory}
          disabled={disabled}
        />
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          minWidth: 0,
        }}
      >
        <label
          htmlFor="document-file"
          style={{
            color: "var(--color-text-primary)",
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          Choose file
        </label>

        <label
          htmlFor="document-file"
          style={{
            border: "1px dashed rgba(245,158,11,0.26)",
            background: "rgba(245,158,11,0.045)",
            borderRadius: 20,
            padding: 18,
            display: "grid",
            gap: 8,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.65 : 1,
            minWidth: 0,
          }}
        >
          <strong
            style={{
              color: "var(--color-text-primary)",
              fontSize: 14,
              lineHeight: 1.35,
              overflowWrap: "anywhere",
            }}
          >
            {file ? file.name : "Click to choose a document"}
          </strong>

          <span
            style={{
              color: "var(--color-text-secondary)",
              fontSize: 12,
              lineHeight: 1.45,
              overflowWrap: "anywhere",
            }}
          >
            {file
              ? `${formatBytes(file.size)} · Ready to upload as ${selectedCategory.label}`
              : "Supported: PDF, image, CSV, Excel"}
          </span>
        </label>

        <input
          ref={fileInputRef}
          id="document-file"
          name="file"
          type="file"
          disabled={disabled}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xls,.xlsx,application/pdf,image/*,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => {
            const selectedFile = event.target.files?.[0] ?? null;
            setFile(selectedFile);
            setState({
              type: "idle",
              message: "",
            });
          }}
          style={{
            display: "none",
          }}
        />
      </div>

      {state.type !== "idle" && (
        <div
          style={{
            border:
              state.type === "success"
                ? "1px solid rgba(46,213,115,0.28)"
                : "1px solid rgba(255,138,149,0.30)",
            background:
              state.type === "success"
                ? "rgba(46,213,115,0.085)"
                : "rgba(255,138,149,0.085)",
            color:
              state.type === "success"
                ? "var(--color-sage)"
                : "var(--color-danger)",
            borderRadius: 16,
            padding: 13,
            fontSize: 13,
            lineHeight: 1.5,
            fontWeight: 750,
            overflowWrap: "anywhere",
          }}
        >
          {state.message}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          type="submit"
          disabled={disabled}
          className="btn-ghost"
          style={{
            border: `1px solid ${selectedTone.border}`,
            background: selectedTone.background,
            color: selectedTone.color,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.7 : 1,
          }}
        >
          {disabled ? "Uploading..." : "Upload document"}
        </button>

        <span
          style={{
            color: "var(--color-text-secondary)",
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          After upload, process it with AI and approve the extraction before it
          affects dashboard results.
        </span>
      </div>
    </form>
  );
}