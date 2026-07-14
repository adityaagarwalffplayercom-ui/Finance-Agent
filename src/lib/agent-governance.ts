export type RegulatedAgentId =
  | "team"
  | "cfo"
  | "accountant"
  | "tax"
  | "analyst"
  | "cashflow"
  | "consultant"
  | "risk";

export type JurisdictionProfile = {
  code: string;
  name: string;
  supportedTaxMode: "checklist_only" | "source_required";
  officialSourceNames: string[];
  safeCapabilities: string[];
  blockedCapabilities: string[];
  professionalReviewLabel: string;
};

const JURISDICTIONS: Record<string, JurisdictionProfile> = {
  india: {
    code: "IN",
    name: "India",
    supportedTaxMode: "source_required",
    officialSourceNames: [
      "Income Tax Department, Government of India",
      "GST Council",
      "CBIC GST portal",
    ],
    safeCapabilities: [
      "Review GST/tax-related documents uploaded by the user",
      "Identify missing tax documents",
      "Highlight invoices, purchase bills, GST returns, TDS/TCS-like signals, payroll, and tax document categories",
      "Create filing-preparation checklist",
      "Explain tax-related risks in general business language",
    ],
    blockedCapabilities: [
      "Calculate final income tax payable",
      "Choose final old/new tax regime decision",
      "File GST or income tax returns",
      "Interpret legal notices as final legal advice",
      "Give audit/legal/tax certification",
    ],
    professionalReviewLabel: "qualified CA or tax professional",
  },
  usa: {
    code: "US",
    name: "United States",
    supportedTaxMode: "source_required",
    officialSourceNames: ["Internal Revenue Service"],
    safeCapabilities: [
      "Review tax document completeness",
      "Identify income, expense, payroll, invoice, and deduction-related signals",
      "Prepare tax-document checklist",
      "Highlight missing supporting records",
    ],
    blockedCapabilities: [
      "Calculate final federal/state/local tax payable",
      "File returns",
      "Give CPA/legal advice",
      "Interpret IRS notices as final advice",
    ],
    professionalReviewLabel: "qualified CPA or tax professional",
  },
  uk: {
    code: "GB",
    name: "United Kingdom",
    supportedTaxMode: "source_required",
    officialSourceNames: ["HMRC / GOV.UK"],
    safeCapabilities: [
      "Review tax document completeness",
      "Identify VAT, income, payroll, expense, and deduction-related signals",
      "Prepare filing-readiness checklist",
      "Highlight missing records",
    ],
    blockedCapabilities: [
      "Calculate final HMRC tax payable",
      "File returns",
      "Give chartered accountant/legal advice",
      "Interpret HMRC notices as final advice",
    ],
    professionalReviewLabel: "qualified accountant or tax professional",
  },
  default: {
    code: "GLOBAL",
    name: "User-selected country",
    supportedTaxMode: "checklist_only",
    officialSourceNames: [
      "official tax authority for the user's country",
      "qualified local tax professional",
    ],
    safeCapabilities: [
      "Review uploaded financial documents for tax-related signals",
      "Identify missing tax records",
      "Create generic tax preparation checklist",
      "Flag compliance uncertainty",
    ],
    blockedCapabilities: [
      "Calculate final tax payable",
      "Apply country-specific tax slabs without verified rules",
      "Give final filing/legal/audit advice",
      "Replace a qualified tax professional",
    ],
    professionalReviewLabel: "qualified local tax professional",
  },
};

function normalizeCountry(country?: string | null) {
  return (country ?? "").trim().toLowerCase();
}

export function getJurisdictionProfile(country?: string | null) {
  const normalized = normalizeCountry(country);

  if (
    normalized === "india" ||
    normalized === "in" ||
    normalized === "bharat"
  ) {
    return JURISDICTIONS.india;
  }

  if (
    normalized === "united states" ||
    normalized === "usa" ||
    normalized === "us" ||
    normalized === "america"
  ) {
    return JURISDICTIONS.usa;
  }

  if (
    normalized === "united kingdom" ||
    normalized === "uk" ||
    normalized === "gb" ||
    normalized === "great britain" ||
    normalized === "england"
  ) {
    return JURISDICTIONS.uk;
  }

  return JURISDICTIONS.default;
}

export function buildUniversalAgentGuardrails(agentId: RegulatedAgentId) {
  const baseRules = [
    "Use only approved trusted financial documents and business profile data.",
    "Do not invent numbers, document details, dates, tax rules, compliance deadlines, or legal requirements.",
    "Clearly say when data is missing or uncertain.",
    "Give practical business guidance in simple language.",
    "Do not present AI output as certified accounting, audit, legal, tax, or investment advice.",
    "For official filing, audit, notice response, legal interpretation, or compliance decisions, recommend a qualified professional.",
  ];

  if (agentId === "tax") {
    return [
      ...baseRules,
      "Tax rules are jurisdiction-specific and year-specific.",
      "Do not calculate final tax payable unless the application has verified source-backed rules for that country and financial year.",
      "Do not choose a final tax regime for the user.",
      "Focus on tax-document completeness, GST/VAT/tax signals, deductions to review, filing preparation, and compliance uncertainty.",
    ];
  }

  if (agentId === "accountant") {
    return [
      ...baseRules,
      "Focus on data reliability, missing records, categorization, approval status, and bookkeeping hygiene.",
      "Do not certify books or provide audit opinion.",
    ];
  }

  if (agentId === "risk") {
    return [
      ...baseRules,
      "Be conservative when identifying risks.",
      "Separate financial risk, data trust risk, tax/compliance risk, and missing information risk.",
    ];
  }

  if (agentId === "cfo") {
    return [
      ...baseRules,
      "Focus on executive decisions, profit, runway, risk, and priorities.",
      "Do not give investment advice as certainty.",
    ];
  }

  return baseRules;
}

export function buildTaxAgentJurisdictionRules(params: {
  country?: string | null;
  financialYear?: string | null;
}) {
  const jurisdiction = getJurisdictionProfile(params.country);

  return `
Tax jurisdiction context:
- Country / jurisdiction from business profile: ${params.country || "Not set"}
- Financial year from business profile: ${params.financialYear || "Not set"}
- Jurisdiction profile used: ${jurisdiction.name}
- Tax mode: ${jurisdiction.supportedTaxMode}
- Official source families expected: ${jurisdiction.officialSourceNames.join(", ")}

Allowed Tax Agent capabilities:
${jurisdiction.safeCapabilities.map((item) => `- ${item}`).join("\n")}

Blocked Tax Agent capabilities:
${jurisdiction.blockedCapabilities.map((item) => `- ${item}`).join("\n")}

Required tax safety rule:
If the user asks for exact tax payable, final filing decision, final tax regime selection, audit/legal interpretation, or official compliance decision, explain that Actic Finance can help prepare and review signals, but the user must verify with a ${jurisdiction.professionalReviewLabel}.
`;
}

export function buildAgentLaunchSafetyBlock(params: {
  agentId: RegulatedAgentId;
  country?: string | null;
  financialYear?: string | null;
}) {
  const universalRules = buildUniversalAgentGuardrails(params.agentId);

  const taxRules =
    params.agentId === "tax" || params.agentId === "team"
      ? buildTaxAgentJurisdictionRules({
          country: params.country,
          financialYear: params.financialYear,
        })
      : "";

  return `
Production safety rules:
${universalRules.map((rule) => `- ${rule}`).join("\n")}

${taxRules}
`;
}

export function getAgentSafetyFooter(agentId: RegulatedAgentId) {
  if (agentId === "tax") {
    return "Tax note: This is informational support only. Verify official filing, notices, audits, and legal compliance with a qualified tax professional.";
  }

  if (agentId === "accountant") {
    return "Accounting note: This is AI-assisted bookkeeping support, not a certified audit or professional accounting opinion.";
  }

  if (agentId === "risk") {
    return "Risk note: This is AI-assisted risk detection, not legal, audit, tax, or regulatory certification.";
  }

  return "Note: This is AI-assisted business guidance based on approved documents, not professional legal, tax, audit, or investment advice.";
}