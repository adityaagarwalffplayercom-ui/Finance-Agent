# Aureli Financial Statement Extraction Engine

## Purpose

This engine processes financial-statement PDFs without relying on a filename,
fixed page number, fixed amount, or one absolute table coordinate. It is designed
to fail safely: a new extraction is always returned to **Needs review**, and old
ledger entries are removed until the user approves the new result.

## Processing pipeline

1. **PDF layout engine**
   - Reads positioned PDF text items.
   - Groups text into visual rows using font-height-aware tolerances.
   - Detects profit and loss, balance sheet, cash flow, and changes-in-equity pages.
   - Separates consolidated, standalone, and unspecified scopes.
   - Dynamically clusters numeric columns.
   - Detects annual/quarterly headers and chooses the latest annual/current period.
   - Extracts current-period rows with source page, source column, displayed value,
     normalized amount, statement type, extraction engine, and confidence.

2. **Vision fallback**
   - Used when the PDF has no usable text layer, appears scanned, contains too few
     readable rows, or the deterministic confidence is low.
   - Sends the original PDF to Gemini as an inline multimodal document.

3. **Hybrid reconciliation**
   - Compares seven headline metrics from layout and vision extraction.
   - Flags differences greater than 5% as cross-engine conflicts.
   - Preserves deterministic source evidence where available.

4. **Accounting checks**
   - Verifies `assets ≈ liabilities + equity` within tolerance.
   - Performs a profit reasonableness check.
   - Stores warnings and checks in `extractionDiagnostics`.

5. **Review and ledger safety**
   - Every reprocessing operation resets the document to `NEEDS_REVIEW`.
   - Existing ledger entries are removed as soon as reprocessing begins.
   - Only seven approved headline metrics become posting statement entries.
   - Detailed statement rows are stored as non-posting entries for audit and AI analysis.

## Supported inputs

The deterministic engine targets digitally generated financial PDFs, including:

- annual and quarterly results;
- profit and loss / income statements;
- balance sheets / statements of financial position;
- cash-flow statements;
- standalone and consolidated statements;
- portrait and landscape layouts;
- two-column and multi-column comparative tables;
- INR, USD, EUR, GBP and common reporting units.

Scanned, mixed, or visually complex PDFs use the vision fallback and remain
review-required unless source validation is sufficient.

## Important production rule

No parser can guarantee perfect extraction from every document. Aureli therefore
uses confidence, source evidence, reconciliation, and mandatory review instead of
silently trusting uncertain values.

## Verification commands

```bash
npm run lint
npm run typecheck
npm run test:financial-parser
npm run verify:financial-pdf -- /absolute/path/to/statement.pdf
npm run build
```

`verify:financial-pdf` prints the seven headline metrics, line-item count, selected
scope, statement pages, confidence, warnings, and accounting checks.

## Environment

Gemini fallback requires:

```env
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-lite
```

A billing-enabled or quota-available Gemini project is recommended for large PDFs.
