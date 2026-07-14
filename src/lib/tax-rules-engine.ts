import { prisma } from "./prisma";

export type TaxRuleInput = {
  countryCode: string;
  countryName: string;
  financialYear: string;
  taxType:
    | "INCOME_TAX"
    | "GST"
    | "VAT"
    | "SALES_TAX"
    | "CORPORATE_TAX"
    | "PAYROLL_TAX"
    | "DEDUCTION"
    | "FILING"
    | "COMPLIANCE"
    | "OTHER";
  ruleKey: string;
  title: string;
  summary: string;
  ruleText: string;
  sourceName: string;
  sourceUrl: string;
  sourcePublishedAt?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  verifiedBy?: string | null;
  notes?: string | null;
};

export type TaxRuleForPrompt = {
  countryCode: string;
  countryName: string;
  financialYear: string;
  taxType: string;
  ruleKey: string;
  title: string;
  summary: string;
  ruleText: string;
  sourceName: string;
  sourceUrl: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  lastVerifiedAt: string | null;
};

const STALE_RULE_DAYS = 45;

export function normalizeTaxCountry(country?: string | null) {
  const value = (country ?? "").trim().toLowerCase();

  if (["india", "in", "bharat"].includes(value)) {
    return {
      countryCode: "IN",
      countryName: "India",
      professionalLabel: "qualified CA or tax professional",
      officialSources: [
        "Income Tax Department, Government of India",
        "GST Council",
        "CBIC GST portal",
      ],
    };
  }

  if (["usa", "us", "united states", "america"].includes(value)) {
    return {
      countryCode: "US",
      countryName: "United States",
      professionalLabel: "qualified CPA or tax professional",
      officialSources: ["Internal Revenue Service"],
    };
  }

  if (
    ["uk", "gb", "united kingdom", "great britain", "england"].includes(value)
  ) {
    return {
      countryCode: "GB",
      countryName: "United Kingdom",
      professionalLabel: "qualified accountant or tax professional",
      officialSources: ["HMRC", "GOV.UK"],
    };
  }

  return {
    countryCode: "GLOBAL",
    countryName: country?.trim() || "User-selected country",
    professionalLabel: "qualified local tax professional",
    officialSources: ["official tax authority for the user's country"],
  };
}

function parseOptionalDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function getRuleFreshnessCutoff() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_RULE_DAYS);
  return cutoff;
}

export async function upsertVerifiedTaxRule(input: TaxRuleInput) {
  const sourcePublishedAt = parseOptionalDate(input.sourcePublishedAt);
  const effectiveFrom = parseOptionalDate(input.effectiveFrom);
  const effectiveTo = parseOptionalDate(input.effectiveTo);

  return prisma.taxRule.upsert({
    where: {
      countryCode_financialYear_taxType_ruleKey: {
        countryCode: input.countryCode,
        financialYear: input.financialYear,
        taxType: input.taxType,
        ruleKey: input.ruleKey,
      },
    },
    create: {
      countryCode: input.countryCode,
      countryName: input.countryName,
      financialYear: input.financialYear,
      taxType: input.taxType,
      ruleKey: input.ruleKey,
      title: input.title,
      summary: input.summary,
      ruleText: input.ruleText,
      sourceName: input.sourceName,
      sourceUrl: input.sourceUrl,
      sourcePublishedAt,
      effectiveFrom,
      effectiveTo,
      verificationStatus: "VERIFIED",
      lastVerifiedAt: new Date(),
      verifiedBy: input.verifiedBy ?? null,
      notes: input.notes ?? null,
    },
    update: {
      countryName: input.countryName,
      title: input.title,
      summary: input.summary,
      ruleText: input.ruleText,
      sourceName: input.sourceName,
      sourceUrl: input.sourceUrl,
      sourcePublishedAt,
      effectiveFrom,
      effectiveTo,
      verificationStatus: "VERIFIED",
      lastVerifiedAt: new Date(),
      verifiedBy: input.verifiedBy ?? null,
      notes: input.notes ?? null,
    },
  });
}

export async function getVerifiedTaxRules(params: {
  country?: string | null;
  financialYear?: string | null;
}) {
  const country = normalizeTaxCountry(params.country);
  const financialYear = params.financialYear?.trim();

  if (!financialYear || financialYear === "Not set") {
    return [];
  }

  const cutoff = getRuleFreshnessCutoff();

  const rules = await prisma.taxRule.findMany({
    where: {
      countryCode: country.countryCode,
      financialYear,
      verificationStatus: "VERIFIED",
      lastVerifiedAt: {
        gte: cutoff,
      },
    },
    orderBy: [
      {
        taxType: "asc",
      },
      {
        title: "asc",
      },
    ],
  });

  return rules.map<TaxRuleForPrompt>((rule) => ({
    countryCode: rule.countryCode,
    countryName: rule.countryName,
    financialYear: rule.financialYear,
    taxType: rule.taxType,
    ruleKey: rule.ruleKey,
    title: rule.title,
    summary: rule.summary,
    ruleText: rule.ruleText,
    sourceName: rule.sourceName,
    sourceUrl: rule.sourceUrl,
    effectiveFrom: rule.effectiveFrom?.toISOString() ?? null,
    effectiveTo: rule.effectiveTo?.toISOString() ?? null,
    lastVerifiedAt: rule.lastVerifiedAt?.toISOString() ?? null,
  }));
}

export async function markStaleTaxRulesForReview() {
  const cutoff = getRuleFreshnessCutoff();

  return prisma.taxRule.updateMany({
    where: {
      verificationStatus: "VERIFIED",
      OR: [
        {
          lastVerifiedAt: null,
        },
        {
          lastVerifiedAt: {
            lt: cutoff,
          },
        },
      ],
    },
    data: {
      verificationStatus: "NEEDS_REVIEW",
      notes:
        "Automatically marked NEEDS_REVIEW because the rule has not been verified recently.",
    },
  });
}

export async function buildTaxRulesPromptBlock(params: {
  country?: string | null;
  financialYear?: string | null;
}) {
  const country = normalizeTaxCountry(params.country);
  const rules = await getVerifiedTaxRules({
    country: params.country,
    financialYear: params.financialYear,
  });

  if (rules.length === 0) {
    return `
Verified tax rules available in Actic Finance database: NO

Tax Agent operating mode:
- Checklist and document-review only.
- Do not calculate final tax payable.
- Do not choose final tax regime.
- Do not claim latest country-specific tax law.
- Tell the user that verified ${country.countryName} tax rules for financial year ${
      params.financialYear || "Not set"
    } are not available in Actic Finance's tax rules database yet.
- Recommend verification with a ${country.professionalLabel}.

Expected official source families for this jurisdiction:
${country.officialSources.map((source) => `- ${source}`).join("\n")}
`;
  }

  return `
Verified tax rules available in Actic Finance database: YES

Use these source-backed rules only:
${rules
  .map(
    (rule) => `
- ${rule.title}
  Type: ${rule.taxType}
  Country: ${rule.countryName}
  Financial year: ${rule.financialYear}
  Summary: ${rule.summary}
  Rule: ${rule.ruleText}
  Source: ${rule.sourceName}
  Last verified: ${rule.lastVerifiedAt ?? "Not available"}
`,
  )
  .join("\n")}

Tax Agent rule:
- You may use these VERIFIED rules for checklist and estimated indicators.
- Do not go beyond these rules.
- If the user asks something not covered by these verified rules, say that Actic Finance needs updated verified rules or professional review.
`;
}