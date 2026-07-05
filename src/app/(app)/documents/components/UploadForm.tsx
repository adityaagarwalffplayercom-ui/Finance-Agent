"use client";

import {
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type ChangeEvent,
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
      setError(
        `Files must be ${formatFileSize(MAX_FILE_SIZE_BYTES)} or smaller.`,
      );
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
      onSubmit={handleSubmit}
      className="upload-card"
      style={{
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <p className="section-title">Upload a document</p>
        <p className="section-hint">
          PDF, image, CSV, or Excel. Production guardrails are enabled:{" "}
          {getUsageLimitMessage()}.
        </p>
      </div>

      <label
        style={{
          display: "grid",
          gap: 8,
          color: "var(--color-text-secondary)",
          fontSize: 13,
          fontWeight: 750,
        }}
      >
        Category
        <select
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as DocumentCategoryValue)
          }
          disabled={isUploading}
          style={{
            border: "1px solid var(--color-border)",
            background: "rgba(255,255,255,0.04)",
            color: "var(--color-text-primary)",
            borderRadius: 14,
            padding: "12px 13px",
            outline: "none",
            fontSize: 14,
          }}
        >
          {DOCUMENT_CATEGORIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

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
            : "1px dashed var(--color-border)",
          background: isDraggingOver
            ? "rgba(245,158,11,0.10)"
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
            color: "var(--color-text-secondary)",
            fontSize: 13,
            lineHeight: 1.45,
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
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isUploading || !selectedFile}
        style={{
          border: "none",
          background: "var(--color-amber)",
          color: "var(--color-base)",
          borderRadius: 14,
          padding: "13px 16px",
          cursor: isUploading || !selectedFile ? "not-allowed" : "pointer",
          fontSize: 14,
          fontWeight: 950,
          opacity: isUploading || !selectedFile ? 0.65 : 1,
        }}
      >
        {isUploading ? "Uploading..." : "Upload document"}
      </button>
    </form>
  );
}