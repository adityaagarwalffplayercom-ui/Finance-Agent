import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const input = process.argv[2];
if (!input) {
  console.error("Usage: npm run verify:financial-pdf -- <path-to-pdf>");
  process.exit(1);
}

const absolutePath = path.resolve(input);
if (!fs.existsSync(absolutePath)) {
  console.error(`PDF not found: ${absolutePath}`);
  process.exit(1);
}

const parserUrl = pathToFileURL(
  path.resolve("src/lib/financial-statement-table-parser.ts"),
).href;
const { extractFinancialStatementFromPdf } = await import(parserUrl);
const result = await extractFinancialStatementFromPdf(
  fs.readFileSync(absolutePath),
  path.basename(absolutePath),
);

console.log(
  JSON.stringify(
    {
      revenue: result.data.revenue,
      expenses: result.data.expenses,
      netIncome: result.data.netIncome,
      cash: result.data.cash,
      assets: result.data.assets,
      liabilities: result.data.liabilities,
      equity: result.data.equity,
      lineItems: result.rawLineItems.length,
      diagnostics: result.diagnostics,
    },
    null,
    2,
  ),
);

if (!result.usable) process.exitCode = 2;
