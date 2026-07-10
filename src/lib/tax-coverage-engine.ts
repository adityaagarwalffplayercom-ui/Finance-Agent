import type { TaxRuleType } from "@prisma/client";
import { prisma } from "./prisma";

export type TaxCoverageStatus = "STRONG" | "PARTIAL" | "MISSING";

export type TaxCoverageTypeResult = {
  taxType: TaxRuleType;
  label: string;
  priority: "core" | "important" | "optional";
  status: TaxCoverageStatus;
  confidence: "High" | "Medium" | "Low";
  verifiedRulesCount: number;
  verifiedSourceDocumentsCount: number;
  verifiedKnowledgeChunksCount: number;
  sourceNames: string[];
  latestVerifiedAt: string | null;
  message: string;
};

export type TaxCoverageCountryResult = {
  countryCode: string;
  countryName: string;
  financialYear: string;
  overallStatus: TaxCoverageStatus;
  readinessScore: number;
  verifiedRulesCount: number;
  verifiedSourceDocumentsCount: number;
  verifiedKnowledgeChunksCount: number;
  taxTypes: TaxCoverageTypeResult[];
};

type TaxCoverageMatrixItem = {
  countryCode: string;
  countryName: string;
  taxTypes: {
    taxType: TaxRuleType;
    label: string;
    priority: "core" | "important" | "optional";
  }[];
};

const TAX_COVERAGE_MATRIX: TaxCoverageMatrixItem[] = [
  {
    countryCode: "IN",
    countryName: "India",
    taxTypes: [
      {
        taxType: "GST",
        label: "GST",
        priority: "core",
      },
      {
        taxType: "INCOME_TAX",
        label: "Income Tax",
        priority: "core",
      },
      {
        taxType: "COMPLIANCE",
        label: "TDS / Compliance",
        priority: "important",
      },
      {
        taxType: "FILING",
        label: "Return Filing",
        priority: "important",
      },
      {
        taxType: "DEDUCTION",
        label: "Deductions / Expense Proof",
        priority: "optional",
      },
    ],
  },
  {
    countryCode: "US",
    countryName: "United States",
    taxTypes: [
      {
        taxType: "INCOME_TAX",
        label: "Federal Business Income Tax",
        priority: "core",
      },
      {
        taxType: "CORPORATE_TAX",
        label: "Corporate Tax",
        priority: "core",
      },
      {
        taxType: "PAYROLL_TAX",
        label: "Payroll / Employment Tax",
        priority: "important",
      },
      {
        taxType: "SALES_TAX",
        label: "Sales Tax",
        priority: "important",
      },
      {
        taxType: "FILING",
        label: "Filing Readiness",
        priority: "important",
      },
      {
        taxType: "COMPLIANCE",
        label: "Recordkeeping / Compliance",
        priority: "optional",
      },
    ],
  },
  {
    countryCode: "UK",
    countryName: "United Kingdom",
    taxTypes: [
      {
        taxType: "VAT",
        label: "VAT",
        priority: "core",
      },
      {
        taxType: "CORPORATE_TAX",
        label: "Corporation Tax",
        priority: "core",
      },
      {
        taxType: "PAYROLL_TAX",
        label: "PAYE / Payroll",
        priority: "important",
      },
      {
        taxType: "INCOME_TAX",
        label: "Self Assessment / Income Tax",
        priority: "important",
      },
      {
        taxType: "FILING",
        label: "Company Filing / Returns",
        priority: "important",
      },
      {
        taxType: "COMPLIANCE",
        label: "Recordkeeping / Compliance",
        priority: "optional",
      },
    ],
  },
];

function normalizeCountryCode(value?: string | null) {
  const cleaned = value?.trim().toLowerCase() ?? "";

  if (
    cleaned === "india" ||
    cleaned === "in" ||
    cleaned === "bharat" ||
    cleaned === "ind"
  ) {
    return "IN";
  }

  if (
    cleaned === "united states" ||
    cleaned === "usa" ||
    cleaned === "us" ||
    cleaned === "america" ||
    cleaned === "united states of america"
  ) {
    return "US";
  }

  if (
    cleaned === "uk" ||
    cleaned === "gb" ||
    cleaned === "great britain" ||
    cleaned === "united kingdom" ||
    cleaned === "england"
  ) {
    return "UK";
  }

  return cleaned.toUpperCase();
}

function getLatestDate(dates: Array<Date | null | undefined>) {
  const validDates = dates.filter(
    (date): date is Date => date instanceof Date && !Number.isNaN(date.valueOf()),
  );

  if (validDates.length === 0) {
    return null;
  }

  return new Date(
    Math.max(...validDates.map((date) => date.getTime())),
  ).toISOString();
}

function getStatus(params: {
  verifiedRulesCount: number;
  verifiedSourceDocumentsCount: number;
  verifiedKnowledgeChunksCount: number;
}) {
  const hasRules = params.verifiedRulesCount > 0;
  const hasDocuments = params.verifiedSourceDocumentsCount > 0;
  const hasChunks = params.verifiedKnowledgeChunksCount > 0;

  if (hasRules && hasDocuments && hasChunks) {
    return "STRONG" satisfies TaxCoverageStatus;
  }

  if (hasRules || hasDocuments || hasChunks) {
    return "PARTIAL" satisfies TaxCoverageStatus;
  }

  return "MISSING" satisfies TaxCoverageStatus;
}

function getConfidence(status: TaxCoverageStatus) {
  if (status === "STRONG") {
    return "High";
  }

  if (status === "PARTIAL") {
    return "Medium";
  }

  return "Low";
}

function getMessage(params: {
  status: TaxCoverageStatus;
  label: string;
  countryName: string;
}) {
  if (params.status === "STRONG") {
    return `${params.countryName} ${params.label} has verified rule coverage and verified uploaded knowledge.`;
  }

  if (params.status === "PARTIAL") {
    return `${params.countryName} ${params.label} has partial coverage. Upload more verified official sources or seed more rules.`;
  }

  return `${params.countryName} ${params.label} coverage is missing. Tax Agent should only give general checklist guidance for this area.`;
}

function getReadinessScore(taxTypes: TaxCoverageTypeResult[]) {
  if (taxTypes.length === 0) {
    return 0;
  }

  const totalWeight = taxTypes.reduce((total, item) => {
    if (item.priority === "core") return total + 3;
    if (item.priority === "important") return total + 2;
    return total + 1;
  }, 0);

  const earnedWeight = taxTypes.reduce((total, item) => {
    const baseWeight =
      item.priority === "core" ? 3 : item.priority === "important" ? 2 : 1;

    if (item.status === "STRONG") {
      return total + baseWeight;
    }

    if (item.status === "PARTIAL") {
      return total + baseWeight * 0.5;
    }

    return total;
  }, 0);

  return Math.round((earnedWeight / totalWeight) * 100);
}

function getOverallStatus(score: number): TaxCoverageStatus {
  if (score >= 75) {
    return "STRONG";
  }

  if (score > 0) {
    return "PARTIAL";
  }

  return "MISSING";
}

export async function getTaxCoverage(params?: {
  countryCode?: string | null;
  financialYear?: string | null;
}) {
  const requestedCountryCode = normalizeCountryCode(params?.countryCode);
  const financialYear = params?.financialYear?.trim() || "2025-26";

  const countries = requestedCountryCode
    ? TAX_COVERAGE_MATRIX.filter(
        (country) => country.countryCode === requestedCountryCode,
      )
    : TAX_COVERAGE_MATRIX;

  const results: TaxCoverageCountryResult[] = [];

  for (const country of countries) {
    const taxTypes: TaxCoverageTypeResult[] = [];

    for (const item of country.taxTypes) {
      const [rules, sourceDocuments, verifiedKnowledgeChunksCount] =
        await Promise.all([
          prisma.taxRule.findMany({
            where: {
              countryCode: country.countryCode,
              financialYear,
              taxType: item.taxType,
              verificationStatus: "VERIFIED",
            },
            select: {
              id: true,
              sourceName: true,
              lastVerifiedAt: true,
              updatedAt: true,
            },
          }),
          prisma.taxSourceDocument.findMany({
            where: {
              countryCode: country.countryCode,
              financialYear,
              taxType: item.taxType,
              verificationStatus: "VERIFIED",
            },
            select: {
              id: true,
              sourceName: true,
              lastVerifiedAt: true,
              updatedAt: true,
              _count: {
                select: {
                  chunks: true,
                },
              },
            },
          }),
          prisma.taxKnowledgeChunk.count({
            where: {
              countryCode: country.countryCode,
              financialYear,
              taxType: item.taxType,
              verificationStatus: "VERIFIED",
            },
          }),
        ]);

      const sourceNames = Array.from(
        new Set([
          ...rules.map((rule) => rule.sourceName),
          ...sourceDocuments.map((document) => document.sourceName),
        ]),
      ).filter(Boolean);

      const status = getStatus({
        verifiedRulesCount: rules.length,
        verifiedSourceDocumentsCount: sourceDocuments.length,
        verifiedKnowledgeChunksCount,
      });

      taxTypes.push({
        taxType: item.taxType,
        label: item.label,
        priority: item.priority,
        status,
        confidence: getConfidence(status),
        verifiedRulesCount: rules.length,
        verifiedSourceDocumentsCount: sourceDocuments.length,
        verifiedKnowledgeChunksCount,
        sourceNames,
        latestVerifiedAt: getLatestDate([
          ...rules.map((rule) => rule.lastVerifiedAt ?? rule.updatedAt),
          ...sourceDocuments.map(
            (document) => document.lastVerifiedAt ?? document.updatedAt,
          ),
        ]),
        message: getMessage({
          status,
          label: item.label,
          countryName: country.countryName,
        }),
      });
    }

    const readinessScore = getReadinessScore(taxTypes);

    results.push({
      countryCode: country.countryCode,
      countryName: country.countryName,
      financialYear,
      overallStatus: getOverallStatus(readinessScore),
      readinessScore,
      verifiedRulesCount: taxTypes.reduce(
        (total, item) => total + item.verifiedRulesCount,
        0,
      ),
      verifiedSourceDocumentsCount: taxTypes.reduce(
        (total, item) => total + item.verifiedSourceDocumentsCount,
        0,
      ),
      verifiedKnowledgeChunksCount: taxTypes.reduce(
        (total, item) => total + item.verifiedKnowledgeChunksCount,
        0,
      ),
      taxTypes,
    });
  }

  return {
    financialYear,
    countries: results,
    generatedAt: new Date().toISOString(),
    privacy: {
      userDataAccessed: false,
      scope: "Global verified tax rules and tax knowledge only",
    },
  };
}

export async function buildTaxCoveragePromptBlock(params: {
  country?: string | null;
  financialYear?: string | null;
}) {
  const countryCode = normalizeCountryCode(params.country);
  const coverage = await getTaxCoverage({
    countryCode,
    financialYear: params.financialYear,
  });

  if (coverage.countries.length === 0) {
    return `
Tax coverage dashboard:
No tax coverage matrix found for this country.

Instruction:
- Do not claim country-specific tax coverage.
- Give only general checklist guidance.
`;
  }

  return `
Tax coverage dashboard:
${coverage.countries
  .map(
    (country) => `
Country: ${country.countryName} (${country.countryCode})
Financial year: ${country.financialYear}
Overall status: ${country.overallStatus}
Readiness score: ${country.readinessScore}/100
Verified rules: ${country.verifiedRulesCount}
Verified source documents: ${country.verifiedSourceDocumentsCount}
Verified knowledge chunks: ${country.verifiedKnowledgeChunksCount}

Coverage by tax type:
${country.taxTypes
  .map(
    (item) => `- ${item.label} (${item.taxType})
  Status: ${item.status}
  Confidence: ${item.confidence}
  Verified rules: ${item.verifiedRulesCount}
  Verified source documents: ${item.verifiedSourceDocumentsCount}
  Verified chunks: ${item.verifiedKnowledgeChunksCount}
  Sources: ${item.sourceNames.length > 0 ? item.sourceNames.join(", ") : "None"}
  Message: ${item.message}`,
  )
  .join("\n")}
`,
  )
  .join("\n")}

Tax Agent instruction:
- Use this coverage dashboard to decide confidence.
- STRONG means verified rules + verified uploaded knowledge exist.
- PARTIAL means some coverage exists, but tax conclusions need caution.
- MISSING means do not give country-specific final guidance for that tax area.
- Never claim whole-country tax coverage unless all core and important categories are STRONG.
`;
}