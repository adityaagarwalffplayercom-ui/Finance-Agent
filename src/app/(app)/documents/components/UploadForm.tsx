"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  DOCUMENT_CATEGORIES,
  MAX_FILE_SIZE_BYTES,
  type DocumentCategoryValue,
} from "@/lib/document-categories";

export function UploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<DocumentCategoryValue>(DOCUMENT_CATEGORIES[0].value);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDraggingOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) setSelectedFile(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedFile) {
      setError("Choose a file first.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setError("Files must be 50MB or smaller.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("category", category);

    setIsUploading(true);
    const response = await fetch("/api/documents", {
      method: "POST",
      body: formData,
    });
    setIsUploading(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Upload failed. Try again.");
      return;
    }

    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  return (
    <form className="upload-card" onSubmit={handleSubmit}>
      <div>
        <p className="section-title">Upload a document</p>
        <span className="section-hint">PDF, image, CSV, or Excel — up to 50MB</span>
      </div>

      <label className="field upload-category-field">
        <span>Category</span>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as DocumentCategoryValue)}
        >
          {DOCUMENT_CATEGORIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label
        className={isDraggingOver ? "dropzone dropzone-active" : "dropzone"}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.xls,.xlsx"
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
        />
        <span className="dropzone-label">
          {selectedFile ? selectedFile.name : "Choose a file, or drag it here"}
        </span>
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary" disabled={isUploading}>
        {isUploading ? "Uploading…" : "Upload document"}
      </button>
    </form>
  );
}
