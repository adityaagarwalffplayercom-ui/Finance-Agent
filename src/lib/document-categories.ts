import { USAGE_LIMITS } from "./usage-limits";

export const DOCUMENT_CATEGORIES = [
  { value: "BANK_STATEMENT", label: "Bank statement" },
  { value: "SALES_INVOICE", label: "Sales invoice" },
  { value: "PURCHASE_INVOICE", label: "Purchase invoice" },
  { value: "RECEIPT", label: "Receipt" },
  { value: "CREDIT_NOTE", label: "Credit note" },
  { value: "DEBIT_NOTE", label: "Debit note" },
  { value: "PAYROLL", label: "Payroll / salary sheet" },
  { value: "UTILITY_BILL", label: "Utility bill" },
  { value: "TAX_DOCUMENT", label: "Tax document" },
  { value: "GST_RETURN", label: "GST return" },
  { value: "LOAN_STATEMENT", label: "Loan statement" },
  { value: "RENT_LEASE", label: "Rent / lease document" },
  { value: "INSURANCE_DOCUMENT", label: "Insurance document" },
  { value: "INVENTORY_REPORT", label: "Inventory report" },
  { value: "PURCHASE_ORDER", label: "Purchase order" },
  { value: "SALES_ORDER", label: "Sales order" },
  { value: "FINANCIAL_STATEMENT", label: "Previous financial statement" },
  { value: "OTHER", label: "Other" },
] as const;

export type DocumentCategoryValue = (typeof DOCUMENT_CATEGORIES)[number]["value"];

const CATEGORY_LABELS = new Map(
  DOCUMENT_CATEGORIES.map((category) => [category.value, category.label]),
);

export function categoryLabel(value: string): string {
  return CATEGORY_LABELS.get(value as DocumentCategoryValue) ?? value;
}

export function isValidCategory(value: string): value is DocumentCategoryValue {
  return CATEGORY_LABELS.has(value as DocumentCategoryValue);
}

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export const MAX_FILE_SIZE_BYTES = USAGE_LIMITS.MAX_UPLOAD_FILE_SIZE_BYTES;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}