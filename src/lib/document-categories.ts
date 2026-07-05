import type { DocumentCategory } from "@prisma/client";

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPE_VALUES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const ALLOWED_MIME_TYPES = Object.assign(
  [...ALLOWED_MIME_TYPE_VALUES],
  {
    has(value: string) {
      return ALLOWED_MIME_TYPE_VALUES.includes(
        value as (typeof ALLOWED_MIME_TYPE_VALUES)[number],
      );
    },
    size: ALLOWED_MIME_TYPE_VALUES.length,
  },
) as readonly string[] & {
  has: (value: string) => boolean;
  size: number;
};

export type DocumentCategoryTone =
  | "sage"
  | "amber"
  | "gold"
  | "danger"
  | "neutral";

export type DocumentCategoryConfig = {
  value: DocumentCategory;
  label: string;
  description: string;
  icon: string;
  tone: DocumentCategoryTone;
};

export const DOCUMENT_CATEGORIES: DocumentCategoryConfig[] = [
  {
    value: "BANK_STATEMENT",
    label: "Bank statement",
    description: "Cash, deposits, withdrawals, balance movements",
    icon: "🏦",
    tone: "sage",
  },
  {
    value: "FINANCIAL_STATEMENT",
    label: "Financial statement",
    description: "Balance sheet, profit & loss, annual report, audit report",
    icon: "📊",
    tone: "amber",
  },
  {
    value: "SALES_INVOICE",
    label: "Sales invoice",
    description: "Revenue, customer billing, income documents",
    icon: "📈",
    tone: "sage",
  },
  {
    value: "PURCHASE_INVOICE",
    label: "Purchase invoice",
    description: "Supplier bills, purchases, vendor expenses",
    icon: "🧾",
    tone: "gold",
  },
  {
    value: "RECEIPT",
    label: "Receipt",
    description: "Small payments, proof of expense, reimbursements",
    icon: "🧾",
    tone: "gold",
  },
  {
    value: "CREDIT_NOTE",
    label: "Credit note",
    description: "Sales return, discount adjustment, negative invoice",
    icon: "↩️",
    tone: "neutral",
  },
  {
    value: "DEBIT_NOTE",
    label: "Debit note",
    description: "Additional charges, debit adjustment, supplier correction",
    icon: "↪️",
    tone: "neutral",
  },
  {
    value: "PAYROLL",
    label: "Payroll",
    description: "Salary, wages, employee cost, payroll register",
    icon: "👥",
    tone: "amber",
  },
  {
    value: "UTILITY_BILL",
    label: "Utility bill",
    description: "Electricity, internet, phone, water, recurring bills",
    icon: "💡",
    tone: "gold",
  },
  {
    value: "TAX_DOCUMENT",
    label: "Tax document",
    description: "Income tax, tax filing, tax computation, notices",
    icon: "🏛️",
    tone: "amber",
  },
  {
    value: "GST_RETURN",
    label: "GST return",
    description: "GST filing, GSTR data, tax return summary",
    icon: "🧮",
    tone: "amber",
  },
  {
    value: "LOAN_STATEMENT",
    label: "Loan statement",
    description: "Loan balance, EMI, interest, repayment schedule",
    icon: "🏦",
    tone: "danger",
  },
  {
    value: "RENT_LEASE",
    label: "Rent / lease",
    description: "Rent agreement, lease document, property cost",
    icon: "🏢",
    tone: "gold",
  },
  {
    value: "INSURANCE_DOCUMENT",
    label: "Insurance document",
    description: "Premium, policy, claim, risk coverage",
    icon: "🛡️",
    tone: "neutral",
  },
  {
    value: "INVENTORY_REPORT",
    label: "Inventory report",
    description: "Stock, closing inventory, movement, valuation",
    icon: "📦",
    tone: "sage",
  },
  {
    value: "PURCHASE_ORDER",
    label: "Purchase order",
    description: "Supplier order, purchase commitment, planned cost",
    icon: "📋",
    tone: "neutral",
  },
  {
    value: "SALES_ORDER",
    label: "Sales order",
    description: "Customer order, pending revenue, order pipeline",
    icon: "🧾",
    tone: "sage",
  },
  {
    value: "OTHER",
    label: "Other document",
    description: "Any finance document that does not fit another category",
    icon: "📄",
    tone: "neutral",
  },
];

export const DOCUMENT_CATEGORY_VALUES = DOCUMENT_CATEGORIES.map(
  (category) => category.value,
);

export function isValidCategory(value: unknown): value is DocumentCategory {
  return (
    typeof value === "string" &&
    DOCUMENT_CATEGORY_VALUES.includes(value as DocumentCategory)
  );
}

export function getDocumentCategoryConfig(
  category: DocumentCategory | string,
): DocumentCategoryConfig {
  const matched = DOCUMENT_CATEGORIES.find((item) => item.value === category);

  if (matched) {
    return matched;
  }

  return {
    value: "OTHER",
    label: formatDocumentCategory(category),
    description: "Any finance document that does not fit another category",
    icon: "📄",
    tone: "neutral",
  };
}

export function categoryLabel(category: DocumentCategory | string) {
  return getDocumentCategoryConfig(category).label;
}

export function formatDocumentCategory(category: DocumentCategory | string) {
  const matched = DOCUMENT_CATEGORIES.find((item) => item.value === category);

  if (matched) {
    return matched.label;
  }

  return category
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}