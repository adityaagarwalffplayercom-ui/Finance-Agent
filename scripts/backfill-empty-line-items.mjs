import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function cleanString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeDate(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value.trim();
  }

  return parsed.toISOString().slice(0, 10);
}

function getFallbackDate(data) {
  return (
    normalizeDate(data.documentDate) ||
    normalizeDate(data.periodEnd) ||
    normalizeDate(data.periodStart) ||
    null
  );
}

function add(items, description, amountValue, category, date) {
  const amount = toNumber(amountValue);

  if (amount === null) {
    return;
  }

  items.push({
    description,
    amount,
    category,
    date,
  });
}

function fromTransactions(data) {
  if (!Array.isArray(data.transactions)) {
    return [];
  }

  return data.transactions
    .map((transaction) => {
      if (!isRecord(transaction)) {
        return null;
      }

      const amount = toNumber(transaction.amount);

      if (amount === null) {
        return null;
      }

      const direction = cleanString(transaction.direction).toLowerCase();

      return {
        description: cleanString(transaction.description, "Bank transaction"),
        amount: Math.abs(amount),
        category:
          direction === "credit"
            ? "Bank Credit / Revenue"
            : direction === "debit"
              ? "Bank Debit / Expense"
              : "Bank Transaction",
        date: normalizeDate(transaction.date),
      };
    })
    .filter(Boolean);
}

function fromTotals(data) {
  const date = getFallbackDate(data);
  const items = [];

  add(items, "Revenue", data.revenue, "Revenue", date);
  add(items, "Total revenue", data.totalRevenue, "Revenue", date);
  add(items, "Sales", data.sales, "Revenue", date);
  add(items, "Expenses", data.expenses, "Expense", date);
  add(items, "Total expenses", data.totalExpenses, "Expense", date);
  add(items, "Profit", data.profit, "Profit / Loss", date);
  add(items, "Loss", data.loss, "Profit / Loss", date);
  add(items, "Net income", data.netIncome, "Profit / Loss", date);
  add(items, "Total assets", data.assets, "Asset", date);
  add(items, "Total liabilities", data.liabilities, "Liability", date);
  add(items, "Equity", data.equity, "Equity", date);
  add(items, "Cash", data.cash, "Cash", date);
  add(items, "Opening balance", data.openingBalance, "Cash / Balance", date);
  add(items, "Closing balance", data.closingBalance, "Cash / Balance", date);
  add(
    items,
    cleanString(data.totalAmountLabel, "Total amount"),
    data.totalAmount,
    "Total",
    date,
  );

  return items;
}

function dedupe(items) {
  const seen = new Set();

  return items.filter((item) => {
    const key = [
      item.description.trim().toLowerCase(),
      item.category?.trim().toLowerCase() ?? "",
      item.amount,
      item.date ?? "",
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
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
      extractedData: true,
    },
  });

  let updated = 0;
  let skipped = 0;

  for (const document of documents) {
    const data = document.extractedData;

    if (!isRecord(data)) {
      skipped += 1;
      continue;
    }

    const existing = Array.isArray(data.lineItems) ? data.lineItems : [];

    if (existing.length > 0) {
      skipped += 1;
      continue;
    }

    const lineItems = dedupe([...fromTransactions(data), ...fromTotals(data)]);

    if (lineItems.length === 0) {
      skipped += 1;
      console.log(`No fallback items: ${document.fileName}`);
      continue;
    }

    await prisma.document.update({
      where: {
        id: document.id,
      },
      data: {
        extractedData: {
          ...data,
          lineItems,
        },
      },
    });

    updated += 1;
    console.log(`Updated ${document.fileName}: ${lineItems.length} items`);
  }

  console.log("");
  console.log(`Done. Updated: ${updated}, skipped: ${skipped}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });