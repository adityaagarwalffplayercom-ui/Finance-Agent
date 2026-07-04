import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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
      description:
        "Primary date on the document, ISO 8601 format YYYY-MM-DD if determinable.",
    },

    periodStart: {
      type: "string",
      nullable: true,
      description:
        "Statement period start date, ISO 8601 format YYYY-MM-DD if determinable.",
    },

    periodEnd: {
      type: "string",
      nullable: true,
      description:
        "Statement period end date, ISO 8601 format YYYY-MM-DD if determinable.",
    },

    currency: {
      type: "string",
      nullable: true,
      description: "ISO currency code if identifiable, for example INR, USD.",
    },

    reportedUnit: {
      type: "string",
      nullable: true,
      enum: [
        "actual",
        "thousands",
        "lakhs",
        "crores",
        "millions",
        "billions",
        "unknown",
      ],
      description:
        "The unit used by the document before conversion. Example: thousands, lakhs, crores, millions.",
    },

    scaleMultiplier: {
      type: "number",
      nullable: true,
      description:
        "Multiplier applied to convert document-displayed amounts into actual full currency units. Example: thousands = 1000, lakhs = 100000, crores = 10000000, millions = 1000000.",
    },

    unitDetectionEvidence: {
      type: "string",
      nullable: true,
      description:
        "Short phrase from the document that explains the detected unit, for example 'Amounts in INR thousands'.",
    },

    vendorOrCounterparty: {
      type: "string",
      nullable: true,
      description:
        "The other party on the document — vendor, customer, utility company, bank, etc.",
    },

    totalAmount: {
      type: "number",
      nullable: true,
      description:
        "The single most important amount on the document, converted to actual full currency units.",
    },

    totalAmountLabel: {
      type: "string",
      nullable: true,
      description:
        "What totalAmount represents, for example Invoice total, Amount due, Ending balance.",
    },

    revenue: {
      type: "number",
      nullable: true,
      description:
        "Total revenue, sales, turnover, or operating income, converted to actual full currency units.",
    },

    totalRevenue: {
      type: "number",
      nullable: true,
      description:
        "Same as revenue when the document provides a total revenue figure, converted to actual full currency units.",
    },

    sales: {
      type: "number",
      nullable: true,
      description:
        "Sales value if separately identifiable, converted to actual full currency units.",
    },

    expenses: {
      type: "number",
      nullable: true,
      description:
        "Total expenses, total costs, or total expenditure, converted to actual full currency units.",
    },

    totalExpenses: {
      type: "number",
      nullable: true,
      description:
        "Same as expenses when the document provides a total expenses figure, converted to actual full currency units.",
    },

    profit: {
      type: "number",
      nullable: true,
      description:
        "Net profit if positive, converted to actual full currency units. Use null if document reports a loss.",
    },

    loss: {
      type: "number",
      nullable: true,
      description:
        "Net loss as a positive number if the document reports a loss, converted to actual full currency units.",
    },

    netIncome: {
      type: "number",
      nullable: true,
      description:
        "Net profit or loss for the period, converted to actual full currency units. Positive for profit, negative for loss.",
    },

    assets: {
      type: "number",
      nullable: true,
      description:
        "Total assets from the balance sheet, converted to actual full currency units.",
    },

    liabilities: {
      type: "number",
      nullable: true,
      description:
        "Total liabilities from the balance sheet, converted to actual full currency units.",
    },

    equity: {
      type: "number",
      nullable: true,
      description:
        "Shareholders' equity or net worth, converted to actual full currency units.",
    },

    cash: {
      type: "number",
      nullable: true,
      description:
        "Cash, bank balance, cash and cash equivalents, or closing balance, converted to actual full currency units.",
    },

    closingBalance: {
      type: "number",
      nullable: true,
      description:
        "Closing balance if available, converted to actual full currency units.",
    },

    openingBalance: {
      type: "number",
      nullable: true,
      description:
        "Opening balance if available, converted to actual full currency units.",
    },

    balance: {
      type: "number",
      nullable: true,
      description:
        "Balance amount if available, converted to actual full currency units.",
    },

    lineItems: {
      type: "array",
      description:
        "Important extracted rows or financial statement line items. All amount values must be actual full currency values after unit conversion.",
      items: {
        type: "object",
        properties: {
          description: {
            type: "string",
          },
          amount: {
            type: "number",
            description:
              "Actual full currency value after applying scaleMultiplier.",
          },
          category: {
            type: "string",
            nullable: true,
            description:
              "Best category for this line item, for example Revenue, Expense, Asset, Liability, Equity, Cash Flow, Tax, Finance Cost.",
          },
          date: {
            type: "string",
            nullable: true,
            description:
              "Date for this line item if available, ISO 8601 YYYY-MM-DD.",
          },
        },
        required: ["description", "amount"],
      },
    },

    transactions: {
      type: "array",
      description:
        "Individual transactions — mainly relevant for bank statements. Amount values must be actual full currency values.",
      items: {
        type: "object",
        properties: {
          date: {
            type: "string",
          },
          description: {
            type: "string",
          },
          amount: {
            type: "number",
          },
          direction: {
            type: "string",
            enum: ["credit", "debit"],
          },
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

  reportedUnit?:
    | "actual"
    | "thousands"
    | "lakhs"
    | "crores"
    | "millions"
    | "billions"
    | "unknown"
    | null;
  scaleMultiplier?: number | null;
  unitDetectionEvidence?: string | null;

  vendorOrCounterparty?: string | null;

  totalAmount?: number | null;
  totalAmountLabel?: string | null;

  revenue?: number | null;
  totalRevenue?: number | null;
  sales?: number | null;

  expenses?: number | null;
  totalExpenses?: number | null;

  profit?: number | null;
  loss?: number | null;
  netIncome?: number | null;

  assets?: number | null;
  liabilities?: number | null;
  equity?: number | null;

  cash?: number | null;
  closingBalance?: number | null;
  openingBalance?: number | null;
  balance?: number | null;

  lineItems?: {
    description: string;
    amount: number;
    category?: string | null;
    date?: string | null;
  }[];

  transactions?: {
    date: string;
    description: string;
    amount: number;
    direction: "credit" | "debit";
  }[];
};

const CATEGORY_GUIDANCE: Record<string, string> = {
  BANK_STATEMENT: `
This is a bank statement.
Extract every individual transaction with date, description, amount, and direction.
Use "credit" for money in and "debit" for money out.
Set totalAmount to the ending or closing balance.
Set totalAmountLabel to "Ending balance".
If opening balance and closing balance are available, extract both.
`,

  SALES_INVOICE: `
This is a sales invoice, meaning money owed TO the business.
Extract invoice date, customer name, invoice total, taxes, and line items.
Set totalAmount to the invoice total.
Set totalAmountLabel to "Invoice total".
Set revenue to the invoice total or subtotal if appropriate.
`,

  PURCHASE_INVOICE: `
This is a purchase invoice or vendor bill, meaning money the business owes.
Extract vendor name, bill date, due amount, taxes, and line items.
Set totalAmount to the amount due.
Set totalAmountLabel to "Amount due".
Set expenses to the amount due or subtotal if appropriate.
`,

  PAYROLL: `
This is a payroll or salary document.
Set totalAmount to total net pay or total payroll cost if available.
Set expenses to the total payroll cost if available.
Extract employee-level line items if present.
`,

  UTILITY_BILL: `
This is a utility bill.
Set totalAmount to the amount due.
Set totalAmountLabel to "Amount due".
Set expenses to the amount due or bill total.
`,

  FINANCIAL_STATEMENT: `
This is a financial statement, annual report, profit and loss statement, income statement, balance sheet, or cash flow statement.

Extract these fields whenever available:
- revenue
- totalRevenue
- sales
- expenses
- totalExpenses
- profit
- loss
- netIncome
- assets
- liabilities
- equity
- cash
- closingBalance
- openingBalance

For profit/loss statements:
- revenue = total revenue / sales / turnover / income from operations
- expenses = total expenses / total expenditure / total costs
- netIncome = profit after tax or net loss
- If the statement reports profit, set profit and set netIncome positive
- If the statement reports loss, set loss as a positive number and set netIncome negative

For balance sheets:
- assets = total assets
- liabilities = total liabilities
- equity = shareholders' funds / net worth / equity
- cash = cash and cash equivalents / bank balance where available

Also populate lineItems with important rows from the financial statement.
`,

  OTHER: `
Extract whatever financial information is present as best you can using the schema.
`,
};

function buildPrompt(category: string, fileName: string) {
  const guidance = CATEGORY_GUIDANCE[category] ?? CATEGORY_GUIDANCE.OTHER;

  return `
You are a financial document extraction assistant for a small business finance platform.

Read the attached document with filename:
"${fileName}"

Document category:
${category}

Category-specific guidance:
${guidance}

CRITICAL REAL-LIFE ACCOUNTING UNIT RULE:
Many financial statements do NOT show amounts in actual rupees/dollars directly.
They may say:
- "Amounts in thousands"
- "Figures in INR thousands"
- "Rs. in thousands"
- "Amount in lakhs"
- "₹ in lakhs"
- "Rs. in crores"
- "Amount in millions"
- "USD in millions"
- "All amounts are in ₹ million unless otherwise stated"

You MUST detect the reporting unit from the document text/header/notes/table caption.

Then BEFORE returning JSON, convert every financial number into the actual full currency value.

Use these scale rules:
- actual / no scale mentioned = multiplier 1
- thousands = multiplier 1000
- lakhs = multiplier 100000
- crores = multiplier 10000000
- millions = multiplier 1000000
- billions = multiplier 1000000000

Examples:
- If the document says values are in thousands, 22,700 means 22,700,000
- If the document says values are in lakhs, 22.7 means 2,270,000
- If the document says values are in crores, 22.7 means 227,000,000
- If the document says values are in millions, 22.7 means 22,700,000
- If no unit is mentioned, keep values as written

Return:
- reportedUnit: the detected unit
- scaleMultiplier: the multiplier used
- unitDetectionEvidence: the exact short phrase or reason used to detect scale

VERY IMPORTANT:
All numeric fields in the JSON must be actual full currency values AFTER conversion.
This includes:
totalAmount, revenue, totalRevenue, sales, expenses, totalExpenses, profit, loss, netIncome, assets, liabilities, equity, cash, balances, lineItems.amount, transactions.amount.

General rules:
- Only report figures actually present in the document.
- Never estimate or invent numbers.
- If a field cannot be determined, omit it or use null.
- Amounts must be plain numbers only, no currency symbols and no commas.
- Dates should be ISO 8601 format YYYY-MM-DD where possible.
- If the company reports a loss, netIncome must be negative.
- If line item dates are not available, use documentDate or periodEnd if appropriate.
- If line item categories are not explicitly available, infer sensible categories like Revenue, Expense, Asset, Liability, Equity, Tax, Finance Cost, Cash Flow, or Other.
`;
}

type ExtractionContent =
  | {
      kind: "inline";
      mimeType: string;
      base64Data: string;
    }
  | {
      kind: "text";
      text: string;
    };

function safeJsonParse(text: string): ExtractedDocumentData {
  try {
    return JSON.parse(text) as ExtractedDocumentData;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("Gemini returned invalid JSON.");
    }

    return JSON.parse(match[0]) as ExtractedDocumentData;
  }
}

export async function extractDocumentData(params: {
  fileName: string;
  category: string;
  content: ExtractionContent;
}): Promise<ExtractedDocumentData> {
  const { fileName, category, content } = params;

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const contentPart =
    content.kind === "inline"
      ? {
          inlineData: {
            mimeType: content.mimeType,
            data: content.base64Data,
          },
        }
      : {
          text: `Document contents:\n\n${content.text}`,
        };

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

  return safeJsonParse(text);
}