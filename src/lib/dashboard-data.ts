// src/lib/dashboard-data.ts
// Replaces src/lib/mock-data.ts — the dashboard page should import
// getDashboardData from here instead.

import { prisma } from "@/lib/prisma";
import type { ExtractedDocumentData } from "@/lib/gemini";
import type { DocumentCategory } from "@prisma/client";

type ProcessedDocument = {
  id: string;
  category: DocumentCategory;
  extractedAt: Date | null;
  extractedData: ExtractedDocumentData;
};

const REVENUE_CATEGORIES: DocumentCategory[] = ["SALES_INVOICE"];
const EXPENSE_CATEGORIES: DocumentCategory[] = ["PURCHASE_INVOICE", "UTILITY_BILL", "PAYROLL"];

export type DashboardData = {
  stats: {
    totalRevenue: number;
    totalExpenses: number;
    netCashFlow: number;
    latestBankBalance: number | null;
    currency: string;
  };
  cashFlowByMonth: { month: string; income: number; expenses: number }[];
  healthScore: number;
  alerts: { severity: "warning" | "info"; message: string }[];
  documentCount: number;
};

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const [rawDocuments, failedCount] = await Promise.all([
    prisma.document.findMany({
      where: { userId, status: "PROCESSED" },
      select: { id: true, category: true, extractedAt: true, extractedData: true },
      orderBy: { extractedAt: "desc" },
    }),
    prisma.document.count({ where: { userId, status: "FAILED" } }),
  ]);

  // extractedData is untyped Json in the DB. We trust it matches
  // ExtractedDocumentData because only extractDocumentData()'s enforced
  // responseSchema ever writes this field — worth a runtime check (zod) if
  // that stops being true.
  const documents: ProcessedDocument[] = rawDocuments
    .filter((d) => d.extractedData !== null)
    .map((d) => ({ ...d, extractedData: d.extractedData as unknown as ExtractedDocumentData }));

  const currency = documents.find((d) => d.extractedData.currency)?.extractedData.currency ?? "USD";

  let totalRevenue = 0;
  let totalExpenses = 0;

  for (const doc of documents) {
    const amount = doc.extractedData.totalAmount ?? 0;
    if (REVENUE_CATEGORIES.includes(doc.category)) totalRevenue += amount;
    else if (EXPENSE_CATEGORIES.includes(doc.category)) totalExpenses += amount;
  }

  // Bank statement transactions only — actual cash movement. Invoices are
  // accrual (money owed), and an invoice's amount can show up again as a
  // bank credit once paid, so mixing the two into one chart would double-count.
  const bankStatements = documents.filter((d) => d.category === "BANK_STATEMENT");
  const cashFlowByMonth = buildMonthlyCashFlow(bankStatements);
  const latestBankBalance = bankStatements[0]?.extractedData.totalAmount ?? null;

  const netCashFlow = totalRevenue - totalExpenses;

  return {
    stats: { totalRevenue, totalExpenses, netCashFlow, latestBankBalance, currency },
    cashFlowByMonth,
    healthScore: calculateHealthScore({ netCashFlow, totalRevenue }),
    alerts: buildAlerts({ failedCount, netCashFlow, totalRevenue, documentCount: documents.length }),
    documentCount: documents.length,
  };
}

function buildMonthlyCashFlow(bankStatements: ProcessedDocument[]) {
  const months = new Map<string, { income: number; expenses: number }>();

  for (const doc of bankStatements) {
    for (const txn of doc.extractedData.transactions ?? []) {
      const month = txn.date?.slice(0, 7); // "YYYY-MM"
      if (!month) continue;
      const bucket = months.get(month) ?? { income: 0, expenses: 0 };
      if (txn.direction === "credit") bucket.income += txn.amount;
      else bucket.expenses += txn.amount;
      months.set(month, bucket);
    }
  }

  return Array.from(months.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, values]) => ({ month, ...values }));
}

// Heuristic only (revenue/expense margin scaled to 0–100) — not a real
// financial model. Worth deciding deliberately what "health" should mean
// before this number ships in front of an actual business owner.
function calculateHealthScore(params: { netCashFlow: number; totalRevenue: number }): number {
  if (params.totalRevenue === 0) return 50; // no data yet — neutral, not a verdict
  const margin = params.netCashFlow / params.totalRevenue;
  return Math.max(0, Math.min(100, Math.round(50 + margin * 50)));
}

function buildAlerts(params: {
  failedCount: number;
  netCashFlow: number;
  totalRevenue: number;
  documentCount: number;
}): DashboardData["alerts"] {
  const alerts: DashboardData["alerts"] = [];

  if (params.failedCount > 0) {
    alerts.push({
      severity: "warning",
      message: `${params.failedCount} document${params.failedCount > 1 ? "s" : ""} failed to process. Check the Documents page and retry.`,
    });
  }

  if (params.totalRevenue === 0 && params.documentCount > 0) {
    alerts.push({
      severity: "info",
      message: "No Sales Invoice documents processed yet — profit will mirror expenses as a negative number until one is added.",
    });
  } else if (params.netCashFlow < 0 && params.totalRevenue > 0) {
    alerts.push({ severity: "warning", message: "Expenses exceeded revenue across processed documents." });
  }

  return alerts;
}
