import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const equalIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function toDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

loadEnvFile();

const { PrismaClient } = await import("@prisma/client");

const prisma = new PrismaClient();

const verifiedBy = "seed-tax-rule-packs";

const rules = [
  // =========================
  // INDIA FY 2025-26
  // =========================
  {
    countryCode: "IN",
    countryName: "India",
    financialYear: "2025-26",
    taxType: "GST",
    ruleKey: "gst-document-checklist",
    title: "GST document checklist",
    summary:
      "Checks whether GST returns, sales invoices, purchase invoices, tax summaries, and GST-related records are uploaded and approved before GST guidance.",
    ruleText:
      "For GST review in India, Aureli should check approved documents for GST returns, sales invoices, purchase invoices, GSTIN references, tax summaries, input tax credit indicators, output tax indicators, and period coverage. Aureli must not file GST returns or calculate final GST liability unless verified rate, turnover, input credit, place-of-supply, and return-period rules are available.",
    sourceName: "CBIC GST portal",
    sourceUrl: "https://cbic-gst.gov.in/",
    sourcePublishedAt: null,
    effectiveFrom: "2025-04-01",
    effectiveTo: "2026-03-31",
    notes: "Checklist rule only. Does not calculate final GST payable.",
  },
  {
    countryCode: "IN",
    countryName: "India",
    financialYear: "2025-26",
    taxType: "GST",
    ruleKey: "gst-rate-notification-source",
    title: "GST rate notification source",
    summary:
      "Uses GST Council CGST rate notifications as the official source family for GST rate verification.",
    ruleText:
      "Aureli may refer to GST Council CGST rate notification source coverage to tell the user that GST rates must be verified against current official rate notifications. Aureli should not assume a GST rate for a product or service unless a verified rate rule exists for that item/category.",
    sourceName: "GST Council — CGST Rate Notification",
    sourceUrl: "https://gstcouncil.gov.in/cgst-rate-notification",
    sourcePublishedAt: null,
    effectiveFrom: "2025-04-01",
    effectiveTo: "2026-03-31",
    notes: "Source family rule for GST rates.",
  },
  {
    countryCode: "IN",
    countryName: "India",
    financialYear: "2025-26",
    taxType: "GST",
    ruleKey: "gst-tax-notification-watch",
    title: "GST tax notification watch",
    summary:
      "Marks GST tax notifications as a required official-source check before compliance conclusions.",
    ruleText:
      "For India GST compliance questions, Aureli should warn that GST tax notifications and amendments must be checked from official GST Council/CBIC sources. If no specific verified notification rule is present, Aureli should give only a checklist and recommend professional verification.",
    sourceName: "GST Council — CGST Tax Notification",
    sourceUrl: "https://gstcouncil.gov.in/cgst-tax-notification",
    sourcePublishedAt: null,
    effectiveFrom: "2025-04-01",
    effectiveTo: "2026-03-31",
    notes: "Used to avoid claiming latest GST amendment coverage without verification.",
  },
  {
    countryCode: "IN",
    countryName: "India",
    financialYear: "2025-26",
    taxType: "FILING",
    ruleKey: "gst-return-readiness",
    title: "GST return readiness checklist",
    summary:
      "Checks readiness for GST return preparation using approved invoice, purchase, and tax documents.",
    ruleText:
      "Before GST return guidance, Aureli should check whether approved documents cover the relevant tax period, sales invoices, purchase invoices, GST returns, credit/debit notes, tax summaries, and reconciliation support. Missing period coverage or unapproved documents should be flagged clearly.",
    sourceName: "CBIC GST portal",
    sourceUrl: "https://cbic-gst.gov.in/",
    sourcePublishedAt: null,
    effectiveFrom: "2025-04-01",
    effectiveTo: "2026-03-31",
    notes: "Preparation checklist only.",
  },
  {
    countryCode: "IN",
    countryName: "India",
    financialYear: "2025-26",
    taxType: "INCOME_TAX",
    ruleKey: "income-tax-business-profession-ay-2026-27",
    title: "Income from business/profession return guidance",
    summary:
      "Uses the Income Tax Department AY 2026-27 business/profession guidance page as source coverage.",
    ruleText:
      "For Indian businesses or professionals, Aureli should use this source family to identify that income from business/profession requires appropriate income-tax return readiness checks. Aureli should check approved financial statements, profit/loss, expense records, TDS records, and prior return references before giving filing-readiness guidance.",
    sourceName:
      "Income Tax Department, Government of India — Business/Profession AY 2026-27",
    sourceUrl:
      "https://www.incometax.gov.in/iec/foportal/help/individual-business-profession",
    sourcePublishedAt: "2026-06-04",
    effectiveFrom: "2025-04-01",
    effectiveTo: "2026-03-31",
    notes: "Business/profession source coverage. Not final tax calculation.",
  },
  {
    countryCode: "IN",
    countryName: "India",
    financialYear: "2025-26",
    taxType: "FILING",
    ruleKey: "income-tax-filing-readiness",
    title: "Income tax filing readiness checklist",
    summary:
      "Checks whether the user has documents needed for Indian income-tax filing review.",
    ruleText:
      "Aureli should check whether approved documents include profit and loss statement, balance sheet or financial statement, bank statements, sales records, purchase/expense records, payroll/TDS records if applicable, tax deduction proofs, and prior return information. Aureli must not file returns or certify tax payable.",
    sourceName: "Income Tax Department, Government of India",
    sourceUrl: "https://www.incometax.gov.in/",
    sourcePublishedAt: null,
    effectiveFrom: "2025-04-01",
    effectiveTo: "2026-03-31",
    notes: "Filing readiness checklist.",
  },
  {
    countryCode: "IN",
    countryName: "India",
    financialYear: "2025-26",
    taxType: "COMPLIANCE",
    ruleKey: "tds-document-checklist",
    title: "TDS document checklist",
    summary:
      "Checks whether TDS-related records are present before TDS guidance.",
    ruleText:
      "For Indian TDS-related questions, Aureli should check whether approved records include TDS certificates, TDS payment references, payroll records, contractor/vendor payment records, and tax deduction summaries. If not present, Aureli should recommend professional verification before filing or claiming deductions.",
    sourceName: "Income Tax Department, Government of India",
    sourceUrl: "https://www.incometax.gov.in/",
    sourcePublishedAt: null,
    effectiveFrom: "2025-04-01",
    effectiveTo: "2026-03-31",
    notes: "Checklist only.",
  },
  {
    countryCode: "IN",
    countryName: "India",
    financialYear: "2025-26",
    taxType: "DEDUCTION",
    ruleKey: "business-expense-proof-checklist",
    title: "Business expense proof checklist",
    summary:
      "Checks whether business expenses are supported by approved documents before deduction guidance.",
    ruleText:
      "For expense deduction readiness, Aureli should check whether expenses are supported by invoices, bills, receipts, bank statements, payment references, payroll records where applicable, and period matching. Aureli should not decide final allowability without verified tax-rule coverage and professional review.",
    sourceName: "Income Tax Department, Government of India",
    sourceUrl: "https://www.incometax.gov.in/",
    sourcePublishedAt: null,
    effectiveFrom: "2025-04-01",
    effectiveTo: "2026-03-31",
    notes: "Expense documentation readiness.",
  },
  {
    countryCode: "IN",
    countryName: "India",
    financialYear: "2025-26",
    taxType: "GST",
    ruleKey: "gst-invoice-reconciliation-checklist",
    title: "GST invoice reconciliation checklist",
    summary:
      "Checks sales and purchase invoice reconciliation readiness for GST review.",
    ruleText:
      "Aureli should compare approved sales invoices, purchase invoices, GST returns, credit notes, debit notes, and bank records for obvious missing periods or document gaps. Aureli should not claim final GST reconciliation accuracy without complete official-return and ledger data.",
    sourceName: "CBIC GST portal",
    sourceUrl: "https://cbic-gst.gov.in/",
    sourcePublishedAt: null,
    effectiveFrom: "2025-04-01",
    effectiveTo: "2026-03-31",
    notes: "Reconciliation readiness rule.",
  },

  // =========================
  // USA TAX YEAR 2026
  // =========================
  {
    countryCode: "US",
    countryName: "United States",
    financialYear: "2026",
    taxType: "COMPLIANCE",
    ruleKey: "federal-business-tax-types",
    title: "Federal business tax types",
    summary:
      "Uses IRS business-tax source coverage for income tax, estimated taxes, self-employment tax, employment taxes, and excise tax.",
    ruleText:
      "For United States businesses, Aureli should classify federal tax readiness into income tax, estimated taxes, self-employment tax, employment taxes, and excise tax where applicable. The business form affects which taxes apply. Aureli should not determine final federal or state tax liability without verified entity, state, and filing facts.",
    sourceName: "IRS — Business Taxes",
    sourceUrl: "https://www.irs.gov/businesses/business-taxes",
    sourcePublishedAt: "2026-04-17",
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-12-31",
    notes: "Federal source coverage.",
  },
  {
    countryCode: "US",
    countryName: "United States",
    financialYear: "2026",
    taxType: "FILING",
    ruleKey: "estimated-tax-pay-as-you-go",
    title: "Estimated tax pay-as-you-go checklist",
    summary:
      "Checks whether estimated tax planning is needed for US business/self-employed income.",
    ruleText:
      "Aureli should flag that federal income tax is generally pay-as-you-go through withholding or estimated taxes. For businesses and self-employed users, Aureli should check income timing, prior-year return data, estimated payments, and whether quarterly planning should be reviewed by a CPA.",
    sourceName: "IRS — Filing and paying your business taxes",
    sourceUrl:
      "https://www.irs.gov/businesses/small-businesses-self-employed/filing-and-paying-your-business-taxes",
    sourcePublishedAt: "2025-09-08",
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-12-31",
    notes: "Checklist only.",
  },
  {
    countryCode: "US",
    countryName: "United States",
    financialYear: "2026",
    taxType: "PAYROLL_TAX",
    ruleKey: "self-employment-tax-checklist",
    title: "Self-employment tax checklist",
    summary:
      "Checks whether self-employment tax review may be needed.",
    ruleText:
      "For US self-employed individuals, Aureli should check whether self-employment income, business expenses, estimated tax payments, and prior-year return information are available. Aureli may mention that IRS self-employment tax guidance should be verified, but should not calculate final self-employment tax without complete verified rules and CPA review.",
    sourceName: "IRS — Self-employment tax",
    sourceUrl:
      "https://www.irs.gov/businesses/small-businesses-self-employed/self-employment-tax-social-security-and-medicare-taxes",
    sourcePublishedAt: null,
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-12-31",
    notes: "Self-employment readiness rule.",
  },
  {
    countryCode: "US",
    countryName: "United States",
    financialYear: "2026",
    taxType: "PAYROLL_TAX",
    ruleKey: "employment-tax-checklist",
    title: "Employment tax checklist",
    summary:
      "Checks whether payroll/employment tax documents are present before payroll-tax guidance.",
    ruleText:
      "For US businesses with employees, Aureli should check whether payroll records, wage reports, withholding records, employer tax forms, and period coverage are available. Aureli should not submit payroll tax filings or certify employment tax liability.",
    sourceName: "IRS — Business Taxes",
    sourceUrl: "https://www.irs.gov/businesses/business-taxes",
    sourcePublishedAt: "2026-04-17",
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-12-31",
    notes: "Employment tax checklist.",
  },
  {
    countryCode: "US",
    countryName: "United States",
    financialYear: "2026",
    taxType: "OTHER",
    ruleKey: "excise-tax-warning",
    title: "Excise tax applicability warning",
    summary:
      "Flags that some US businesses may have excise tax obligations depending on activity or product type.",
    ruleText:
      "Aureli should warn that excise taxes may apply to specific industries, products, or activities. If the business sells regulated or excise-taxable goods/services, Aureli should recommend checking IRS excise tax rules and a CPA. Aureli should not assume excise tax applies without business activity details.",
    sourceName: "IRS — Business Taxes",
    sourceUrl: "https://www.irs.gov/businesses/business-taxes",
    sourcePublishedAt: "2026-04-17",
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-12-31",
    notes: "Applicability warning.",
  },
  {
    countryCode: "US",
    countryName: "United States",
    financialYear: "2026",
    taxType: "INCOME_TAX",
    ruleKey: "tax-year-2026-inflation-adjustments-source",
    title: "Tax year 2026 inflation adjustments source",
    summary:
      "Uses IRS tax-year 2026 inflation adjustment source coverage for federal individual tax thresholds and standard deduction references.",
    ruleText:
      "For US tax year 2026 individual or pass-through owner questions, Aureli may reference that IRS publishes tax-year 2026 inflation adjustments. Aureli should not apply brackets to calculate final tax unless filing status, taxable income, entity structure, deductions, credits, state rules, and verified rules are complete.",
    sourceName: "IRS — Tax year 2026 inflation adjustments",
    sourceUrl:
      "https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill",
    sourcePublishedAt: "2025-10-09",
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-12-31",
    notes: "Source coverage, not full tax calculator.",
  },
  {
    countryCode: "US",
    countryName: "United States",
    financialYear: "2026",
    taxType: "SALES_TAX",
    ruleKey: "state-sales-tax-warning",
    title: "State sales tax warning",
    summary:
      "Warns that US sales tax is state/local-specific and cannot be calculated from federal IRS data alone.",
    ruleText:
      "For US sales tax questions, Aureli should state that sales tax is generally state/local-specific and requires state tax authority rules, business nexus, product/service category, location, exemption status, and filing period. Aureli should not calculate US sales tax from IRS federal data alone.",
    sourceName: "IRS / State tax authorities",
    sourceUrl: "https://www.irs.gov/businesses/business-taxes",
    sourcePublishedAt: "2026-04-17",
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-12-31",
    notes: "State-specific limitation rule.",
  },
  {
    countryCode: "US",
    countryName: "United States",
    financialYear: "2026",
    taxType: "COMPLIANCE",
    ruleKey: "business-recordkeeping-checklist",
    title: "Business recordkeeping checklist",
    summary:
      "Checks whether core business tax records are available before US filing guidance.",
    ruleText:
      "Aureli should check approved documents for income records, expense records, payroll records if applicable, estimated tax payment records, prior returns, entity type, EIN information if available, and state/local tax records. Missing items should be listed as preparation gaps.",
    sourceName: "IRS — Filing and paying your business taxes",
    sourceUrl:
      "https://www.irs.gov/businesses/small-businesses-self-employed/filing-and-paying-your-business-taxes",
    sourcePublishedAt: "2025-09-08",
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-12-31",
    notes: "Recordkeeping checklist.",
  },

  // =========================
  // UK TAX YEAR 2026-27
  // =========================
  {
    countryCode: "GB",
    countryName: "United Kingdom",
    financialYear: "2026-27",
    taxType: "VAT",
    ruleKey: "vat-rates-source",
    title: "UK VAT rates source",
    summary:
      "Uses GOV.UK VAT rates source coverage for standard, reduced, and zero VAT rate checks.",
    ruleText:
      "For UK VAT questions, Aureli may use GOV.UK VAT rate source coverage to explain that VAT rate treatment depends on the goods/services category. Current GOV.UK VAT rate categories include standard, reduced, and zero-rated treatment, with exemptions for some items. Aureli should not assign an exact VAT treatment to a product/service without verified category-specific rules.",
    sourceName: "GOV.UK — VAT rates",
    sourceUrl: "https://www.gov.uk/vat-rates",
    sourcePublishedAt: null,
    effectiveFrom: "2026-04-06",
    effectiveTo: "2027-04-05",
    notes: "Source coverage for VAT rates.",
  },
  {
    countryCode: "GB",
    countryName: "United Kingdom",
    financialYear: "2026-27",
    taxType: "VAT",
    ruleKey: "vat-registration-threshold",
    title: "UK VAT registration threshold checklist",
    summary:
      "Checks whether UK VAT registration threshold review is needed.",
    ruleText:
      "Aureli should check whether UK taxable turnover over the relevant rolling 12-month period may exceed the VAT registration threshold. GOV.UK states that businesses must register if total taxable turnover for the last 12 months goes over £90,000. Aureli should not register the business or certify threshold status without complete turnover records and professional review.",
    sourceName: "GOV.UK — Register for VAT",
    sourceUrl: "https://www.gov.uk/register-for-vat",
    sourcePublishedAt: null,
    effectiveFrom: "2026-04-06",
    effectiveTo: "2027-04-05",
    notes: "Threshold review checklist.",
  },
  {
    countryCode: "GB",
    countryName: "United Kingdom",
    financialYear: "2026-27",
    taxType: "VAT",
    ruleKey: "vat-flat-rate-scheme-checklist",
    title: "UK VAT Flat Rate Scheme checklist",
    summary:
      "Checks whether VAT Flat Rate Scheme review may be relevant.",
    ruleText:
      "Aureli should flag VAT Flat Rate Scheme review only as a checklist item. GOV.UK says the scheme uses a fixed rate of VAT paid to HMRC and may be available if VAT turnover is within scheme limits. Aureli should recommend accountant review before deciding whether the scheme is beneficial or applicable.",
    sourceName: "GOV.UK — VAT Flat Rate Scheme",
    sourceUrl: "https://www.gov.uk/vat-flat-rate-scheme",
    sourcePublishedAt: null,
    effectiveFrom: "2026-04-06",
    effectiveTo: "2027-04-05",
    notes: "Scheme checklist only.",
  },
  {
    countryCode: "GB",
    countryName: "United Kingdom",
    financialYear: "2026-27",
    taxType: "CORPORATE_TAX",
    ruleKey: "corporation-tax-rates-source",
    title: "UK Corporation Tax rates source",
    summary:
      "Uses GOV.UK Corporation Tax rates and allowances page as source coverage for company tax review.",
    ruleText:
      "For UK limited-company tax questions, Aureli should use GOV.UK Corporation Tax rates and allowances as the source family. Aureli should check profit, accounting period, company status, reliefs, and complete accounts before giving readiness guidance. Aureli should not calculate final Corporation Tax without complete verified rules and accountant review.",
    sourceName: "GOV.UK — Corporation Tax rates and allowances",
    sourceUrl:
      "https://www.gov.uk/government/publications/rates-and-allowances-corporation-tax",
    sourcePublishedAt: "2026-04-01",
    effectiveFrom: "2026-04-01",
    effectiveTo: "2027-03-31",
    notes: "Source coverage, not final tax calculation.",
  },
  {
    countryCode: "GB",
    countryName: "United Kingdom",
    financialYear: "2026-27",
    taxType: "PAYROLL_TAX",
    ruleKey: "paye-employer-checklist",
    title: "UK PAYE employer checklist",
    summary:
      "Checks whether payroll/PAYE documents are available before UK employer tax guidance.",
    ruleText:
      "For UK employers, Aureli should check whether payroll records, employee pay, deductions, PAYE references, pension contribution data, and period coverage are available. Aureli should not submit PAYE returns or certify payroll tax amounts.",
    sourceName: "GOV.UK — PAYE for employers",
    sourceUrl: "https://www.gov.uk/paye-for-employers",
    sourcePublishedAt: null,
    effectiveFrom: "2026-04-06",
    effectiveTo: "2027-04-05",
    notes: "Payroll readiness checklist.",
  },
  {
    countryCode: "GB",
    countryName: "United Kingdom",
    financialYear: "2026-27",
    taxType: "FILING",
    ruleKey: "self-assessment-recordkeeping",
    title: "UK Self Assessment recordkeeping checklist",
    summary:
      "Checks whether self-employed or Self Assessment records are available.",
    ruleText:
      "For UK Self Assessment or self-employed questions, Aureli should check income records, expense records, invoices, bank statements, payroll if applicable, VAT records if registered, and prior submissions where available. Aureli should not submit a Self Assessment return or certify final liability.",
    sourceName: "GOV.UK — Business records if self-employed",
    sourceUrl: "https://www.gov.uk/self-employed-records",
    sourcePublishedAt: null,
    effectiveFrom: "2026-04-06",
    effectiveTo: "2027-04-05",
    notes: "Recordkeeping checklist.",
  },
  {
    countryCode: "GB",
    countryName: "United Kingdom",
    financialYear: "2026-27",
    taxType: "INCOME_TAX",
    ruleKey: "income-tax-bands-source",
    title: "UK income tax rates and allowances source",
    summary:
      "Uses GOV.UK rates and allowances source coverage for UK income-tax guidance.",
    ruleText:
      "For UK income-tax questions, Aureli may use GOV.UK tax-year rates and allowances source coverage for guidance. Aureli should not calculate final income tax unless full verified rules, personal circumstances, allowances, reliefs, residency status, and complete income data are available.",
    sourceName: "GOV.UK — Rates and allowances",
    sourceUrl:
      "https://www.gov.uk/government/publications/budget-2025-overview-of-tax-legislation-and-rates-ootlar/annex-a-rates-and-allowances",
    sourcePublishedAt: "2025-12-05",
    effectiveFrom: "2026-04-06",
    effectiveTo: "2027-04-05",
    notes: "Source coverage only.",
  },
  {
    countryCode: "GB",
    countryName: "United Kingdom",
    financialYear: "2026-27",
    taxType: "FILING",
    ruleKey: "company-accounts-tax-return-checklist",
    title: "UK company accounts and tax return checklist",
    summary:
      "Checks whether a UK company has accounts and tax-return preparation data.",
    ruleText:
      "For UK company filing readiness, Aureli should check approved accounts, profit and loss data, balance sheet data, bank statements, payroll records if applicable, VAT records if registered, and corporation-tax period coverage. Aureli should not file accounts or tax returns.",
    sourceName: "GOV.UK",
    sourceUrl: "https://www.gov.uk/file-your-company-accounts-and-tax-return",
    sourcePublishedAt: null,
    effectiveFrom: "2026-04-01",
    effectiveTo: "2027-03-31",
    notes: "Company filing readiness checklist.",
  },
];

async function upsertRule(rule) {
  return prisma.taxRule.upsert({
    where: {
      countryCode_financialYear_taxType_ruleKey: {
        countryCode: rule.countryCode,
        financialYear: rule.financialYear,
        taxType: rule.taxType,
        ruleKey: rule.ruleKey,
      },
    },
    create: {
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
      sourcePublishedAt: toDate(rule.sourcePublishedAt),
      effectiveFrom: toDate(rule.effectiveFrom),
      effectiveTo: toDate(rule.effectiveTo),
      verificationStatus: "VERIFIED",
      lastVerifiedAt: new Date(),
      verifiedBy,
      notes: rule.notes ?? null,
    },
    update: {
      countryName: rule.countryName,
      title: rule.title,
      summary: rule.summary,
      ruleText: rule.ruleText,
      sourceName: rule.sourceName,
      sourceUrl: rule.sourceUrl,
      sourcePublishedAt: toDate(rule.sourcePublishedAt),
      effectiveFrom: toDate(rule.effectiveFrom),
      effectiveTo: toDate(rule.effectiveTo),
      verificationStatus: "VERIFIED",
      lastVerifiedAt: new Date(),
      verifiedBy,
      notes: rule.notes ?? null,
    },
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Check your .env file.");
  }

  console.log(`Seeding ${rules.length} verified tax rules...`);

  const results = [];

  for (const rule of rules) {
    const saved = await upsertRule(rule);
    results.push(saved);
    console.log(
      `✅ ${saved.countryCode} | ${saved.financialYear} | ${saved.taxType} | ${saved.ruleKey}`,
    );
  }

  const grouped = results.reduce((acc, rule) => {
    acc[rule.countryCode] = (acc[rule.countryCode] ?? 0) + 1;
    return acc;
  }, {});

  console.log("");
  console.log("Done. Seeded/updated rules by country:");
  console.table(grouped);
}

main()
  .catch((error) => {
    console.error("Seed failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });