# Financial Extraction Verification

Verification date: 13 July 2026

## Automated checks

- Whole-repository ESLint: **0 errors**.
- Existing repository warnings: **14 warnings** in unrelated pre-existing files.
- Targeted TypeScript check for the parser, sanitizer, hybrid engine, Gemini
  types and raw-line-item flow: **passed**.
- Route and document-review TS/TSX transpilation check: **passed**.
- Synthetic financial parser regression suite: **8/8 passed**.

The synthetic suite covers:

1. international statement headings;
2. multiple period and unit formats;
3. metadata rejection;
4. dynamically positioned consolidated statements;
5. quarterly versus annual column selection;
6. non-keyword financial rows with trusted source evidence;
7. source-metadata preservation through line-item merging;
8. multi-page cash-flow continuation.

## Uploaded PDF regression

File used locally: `AFRs31032026signed.pdf`

Result:

- Revenue: INR 231,546,000,000
- Expenses: INR 187,060,800,000
- Net income: INR 34,990,800,000
- Cash: INR 13,205,700,000
- Assets: INR 131,824,900,000
- Liabilities: INR 80,255,200,000
- Equity: INR 51,569,700,000
- Detailed current-period rows: 111
- Selected scope: consolidated
- Selected pages: 10, 11, 12
- Layout confidence: 0.99
- Balance-sheet equation: passed
- Extraction warnings: none

## Full build limitation in the sandbox

A full `npm run build` could not be completed in the isolated sandbox because
Prisma attempted to download its platform schema engine from
`binaries.prisma.sh` and the sandbox DNS request failed with `EAI_AGAIN` before
application compilation.

No Prisma schema or dependency version was changed by this patch. Run the
following on the development machine, where Prisma dependencies are available:

```powershell
npx prisma generate --schema=prisma/schema.prisma
npm run typecheck
npm run build
```

## Safety behavior

- Starting reprocessing immediately resets the document to `NEEDS_REVIEW`.
- Previous ledger rows are removed while reprocessing is in progress.
- A failed or low-confidence extraction cannot silently retain trusted posting
  entries.
- Detailed financial rows remain non-posting.
- Only approved headline metrics can affect dashboard totals.
