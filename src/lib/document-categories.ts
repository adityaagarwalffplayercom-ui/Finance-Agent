export const DOCUMENT_CATEGORIES = [
  { value: "BANK_STATEMENT", label: "Bank statement" },
  { value: "SALES_INVOICE", label: "Sales invoice" },
  { value: "PURCHASE_INVOICE", label: "Purchase invoice" },
  { value: "PAYROLL", label: "Payroll / salary sheet" },
  { value: "UTILITY_BILL", label: "Utility bill" },
  { value: "FINANCIAL_STATEMENT", label: "Previous financial statement" },
  { value: "OTHER", label: "Other" },
] as const;

export type DocumentCategoryValue = (typeof DOCUMENT_CATEGORIES)[number]["value"];

const CATEGORY_LABELS = new Map(DOCUMENT_CATEGORIES.map((c) => [c.value, c.label]));

export function categoryLabel(value: string): string {
  return CATEGORY_LABELS.get(value as DocumentCategoryValue) ?? value;
}

export function isValidCategory(value: string): value is DocumentCategoryValue {
  return CATEGORY_LABELS.has(value as DocumentCategoryValue);
}

// PDFs and images cover the vast majority of real bank statements, invoices,
// and bills. CSV/XLSX are included for exported financial statements.
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
