import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");

  if (!fs.existsSync(envPath)) return;

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

loadEnvFile();

const { PrismaClient } = await import("@prisma/client");

const prisma = new PrismaClient();

function isValidNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function addItem(items, description, amount, category, date = null) {
  if (!isValidNumber(amount)) return;

  if (items.some((item) => item.description === description)) return;

  items.push({
    description,
    amount,
    category,
    date,
  });
}

function buildFallbackLineItems(data, category) {
  const items = [];
  const date = data.documentDate ?? data.periodEnd ?? null;

  if (Array.isArray(data.transactions)) {
    for (const transaction of data.transactions.slice(0, 80)) {
      if (!isValidNumber(transaction.amount)) continue;

      const signedAmount =
        transaction.direction === "debit"
          ? -Math.abs(transaction.amount)
          : Math.abs(transaction.amount);

      addItem(
        items,
        transaction.description || "Bank transaction",
        signedAmount,
        transaction.direction === "credit" ? "Cash Inflow" : "Cash Outflow",
        transaction.date ?? date,
      );
    }
  }

  addItem(
    items,
    "Revenue",
    data.revenue ?? data.totalRevenue ?? data.sales,
    "Revenue",
    date,
  );

  addItem(
    items,
    "Expenses",
    data.expenses ?? data.totalExpenses,
    "Expense",
    date,
  );

  addItem(items, "Profit", data.profit, "Net Income", date);

  addItem(
    items,
    "Loss",
    isValidNumber(data.loss) ? -Math.abs(data.loss) : null,
    "Net Loss",
    date,
  );

  addItem(items, "Net income", data.netIncome, "Net Income", date);

  addItem(items, "Assets", data.assets, "Asset", date);

  addItem(items, "Liabilities", data.liabilities, "Liability", date);

  addItem(items, "Equity", data.equity, "Equity", date);

  addItem(
    items,
    "Cash",
    data.cash ?? data.closingBalance ?? data.balance,
    "Asset",
    date,
  );

  addItem(
    items,
    data.totalAmountLabel ?? "Total amount",
    data.totalAmount,
    category === "SALES_INVOICE"
      ? "Revenue"
      : category === "BANK_STATEMENT"
        ? "Balance"
        : "Total",
    date,
  );

  return items.slice(0, 80);
}

async function main() {
  const documents = await prisma.document.findMany({
    where: {
      status: "PROCESSED",
      extractedData: {
        not: undefined,
      },
    },
    select: {
      id: true,
      fileName: true,
      category: true,
      extractedData: true,
    },
  });

  let updated = 0;
  let skipped = 0;

  for (const document of documents) {
    const data = document.extractedData;

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      skipped += 1;
      continue;
    }

    const existingLineItems = Array.isArray(data.lineItems)
      ? data.lineItems
      : [];

    if (existingLineItems.length > 0) {
      skipped += 1;
      continue;
    }

    const fallbackLineItems = buildFallbackLineItems(data, document.category);

    if (fallbackLineItems.length === 0) {
      console.log(`⚠️ No totals found to backfill: ${document.fileName}`);
      skipped += 1;
      continue;
    }

    await prisma.document.update({
      where: {
        id: document.id,
      },
      data: {
        extractedData: {
          ...data,
          lineItems: fallbackLineItems,
        },
      },
    });

    updated += 1;
    console.log(
      `✅ Backfilled ${fallbackLineItems.length} line items: ${document.fileName}`,
    );
  }

  console.log("");
  console.log(`Done. Updated: ${updated}, skipped: ${skipped}`);
}

main()
  .catch((error) => {
    console.error("Backfill failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });