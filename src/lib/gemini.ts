import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Free tier as of mid-2026 (Gemini 2.5 / 3 Flash family). Swap the model
// string if Google changes free-tier eligibility later.
const MODEL = "gemini-2.5-flash";

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "One or two plain-English sentences describing what this document is and its overall financial takeaway.",
    },
    documentDate: {
      type: "string",
      nullable: true,
      description: "Primary date on the document, ISO 8601 (YYYY-MM-DD) if determinable.",
    },
    periodStart: { type: "string", nullable: true, description: "Statement period start, if any." },
    periodEnd: { type: "string", nullable: true, description: "Statement period end, if any." },
    currency: {
      type: "string",
      nullable: true,
      description: "ISO currency code if identifiable, e.g. USD, INR.",
    },
    vendorOrCounterparty: {
      type: "string",
      nullable: true,
      description: "The other party on the document — vendor, customer, utility company, bank, etc.",
    },
    totalAmount: {
      type: "number",
      nullable: true,
      description:
        "The single most important amount on the document: invoice total, bill amount due, net pay, or ending balance.",
    },
    totalAmountLabel: {
      type: "string",
      nullable: true,
      description: "What totalAmount represents, e.g. 'Amount due', 'Ending balance', 'Net pay'.",
    },
    revenue: {
      type: "number",
      nullable: true,
      description: "Total revenue or turnover from the financial statement.",
    },
    expenses: {
      type: "number",
      nullable: true,
      description: "Total expenses from the financial statement.",
    },
    netIncome: {
      type: "number",
      nullable: true,
      description: "Net profit or loss for the period. Negative for losses.",
    },
    assets: {
      type: "number",
      nullable: true,
      description: "Total assets from the balance sheet.",
    },
    liabilities: {
      type: "number",
      nullable: true,
      description: "Total liabilities from the balance sheet.",
    },
    equity: {
      type: "number",
      nullable: true,
      description: "Shareholders' equity or net worth.",
    },
    lineItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          amount: { type: "number" },
        },
        required: ["description", "amount"],
      },
    },
    transactions: {
      type: "array",
      description: "Individual transactions — only relevant for bank statements.",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          description: { type: "string" },
          amount: { type: "number" },
          direction: { type: "string", enum: ["credit", "debit"] },
        },
        required: ["date", "description", "amount", "direction"],
      },
    },
  },
  required: ["summary"],
};

export type ExtractedDocumentData = {
  summary: string;

  documentDate?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;

  currency?: string | null;
  vendorOrCounterparty?: string | null;

  totalAmount?: number | null;
  totalAmountLabel?: string | null;

  revenue?: number | null;
  expenses?: number | null;
  netIncome?: number | null;
  assets?: number | null;
  liabilities?: number | null;
  equity?: number | null;

  lineItems?: {
    description: string;
    amount: number;
  }[];

  transactions?: {
    date: string;
    description: string;
    amount: number;
    direction: "credit" | "debit";
  }[];
};

const CATEGORY_GUIDANCE: Record<string, string> = {
  BANK_STATEMENT:
    "This is a bank statement. Extract every individual transaction with its date, description, amount, and whether it's a credit (money in) or debit (money out). Set totalAmount to the ending/closing balance and totalAmountLabel to 'Ending balance'.",
  SALES_INVOICE:
    "This is a sales invoice (money owed TO the business). Extract line items and set totalAmount to the invoice total, totalAmountLabel to 'Invoice total'.",
  PURCHASE_INVOICE:
    "This is a purchase invoice / bill FROM a vendor (money the business owes). Extract line items and set totalAmount to the amount due, totalAmountLabel to 'Amount due'.",
  PAYROLL:
    "This is a payroll or salary sheet. Set totalAmount to the total net pay (or total payroll cost if it covers multiple employees), and set totalAmountLabel accordingly.",
  UTILITY_BILL:
    "This is a utility bill. Set totalAmount to the amount due, totalAmountLabel to 'Amount due'.",
  FINANCIAL_STATEMENT:
    `This is a financial statement, annual report, profit & loss statement, income statement, or balance sheet.

Extract these fields whenever available:

- revenue
- expenses
- netIncome
- assets
- liabilities
- equity

For profit/loss statements:
- revenue = total revenue / turnover
- expenses = total expenses
- netIncome = profit after tax or net loss

For balance sheets:
- assets = total assets
- liabilities = total liabilities
- equity = shareholders equity / net worth

Also populate lineItems with any major figures found.

If the company reports a loss, netIncome must be negative.`,
  OTHER: "Extract whatever financial information is present as best you can using the schema.",
};

function buildPrompt(category: string, fileName: string) {
  const guidance = CATEGORY_GUIDANCE[category] ?? CATEGORY_GUIDANCE.OTHER;
  return `You are a financial document extraction assistant for a small business finance platform. Read the attached document (filename: "${fileName}") and extract its data into the given JSON schema.

${guidance}

Rules:
- Only report figures actually present in the document. Never estimate or invent numbers.
- If a field cannot be determined, omit it or use null — do not guess.
- Amounts must be plain numbers (no currency symbols or thousands separators).
- Dates should be ISO 8601 (YYYY-MM-DD) where possible.`;
}

type ExtractionContent =
  | { kind: "inline"; mimeType: string; base64Data: string }
  | { kind: "text"; text: string };

export async function extractDocumentData(params: {
  fileName: string;
  category: string;
  content: ExtractionContent;
}): Promise<ExtractedDocumentData> {
  const { fileName, category, content } = params;

  const contentPart =
    content.kind === "inline"
      ? { inlineData: { mimeType: content.mimeType, data: content.base64Data } }
      : { text: `Document contents:\n\n${content.text}` };

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: buildPrompt(category, fileName) }, contentPart],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: EXTRACTION_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return JSON.parse(text) as ExtractedDocumentData;
}
