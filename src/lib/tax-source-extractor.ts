import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  return new GoogleGenAI({
    apiKey,
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorToText(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isRetryableGeminiError(error: unknown) {
  const text = errorToText(error).toLowerCase();

  return (
    text.includes("503") ||
    text.includes("500") ||
    text.includes("502") ||
    text.includes("504") ||
    text.includes("unavailable") ||
    text.includes("high demand") ||
    text.includes("overloaded") ||
    text.includes("quota") ||
    text.includes("rate limit") ||
    text.includes("resource_exhausted")
  );
}

function cleanExtractedText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function getPrompt(params: {
  fileName: string;
  countryCode: string;
  countryName: string;
  financialYear: string;
  taxType: string;
  sourceName: string;
}) {
  return `
You are extracting text from an official tax source document for a finance AI platform.

File name:
${params.fileName}

Country:
${params.countryName} (${params.countryCode})

Financial year / tax year:
${params.financialYear}

Tax type:
${params.taxType}

Source name:
${params.sourceName}

Task:
Extract the useful tax/compliance content from this file into clean plain text.

Important extraction rules:
- Preserve important headings.
- Preserve section names.
- Preserve tax rates, thresholds, due dates, forms, conditions, exemptions, penalties, and compliance steps.
- Preserve country-specific wording.
- Preserve tables as readable text.
- Do not summarize too aggressively.
- Do not invent missing rules.
- Do not add your own legal/tax interpretation.
- If a page is irrelevant, skip it.
- If there are disclaimers or effective dates, keep them.
- If the document has examples, include them only if they help explain the rule.
- Output clean plain text only.
`;
}

export async function extractTaxSourceTextFromFile(params: {
  fileName: string;
  mimeType: string;
  base64Data: string;
  countryCode: string;
  countryName: string;
  financialYear: string;
  taxType: string;
  sourceName: string;
}) {
  const ai = getAiClient();
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: getPrompt({
                  fileName: params.fileName,
                  countryCode: params.countryCode,
                  countryName: params.countryName,
                  financialYear: params.financialYear,
                  taxType: params.taxType,
                  sourceName: params.sourceName,
                }),
              },
              {
                inlineData: {
                  mimeType: params.mimeType,
                  data: params.base64Data,
                },
              },
            ],
          },
        ],
      });

      const text = response.text;

      if (!text || !text.trim()) {
        throw new Error("Gemini returned empty tax source text.");
      }

      const cleaned = cleanExtractedText(text);

      if (cleaned.length < 50) {
        throw new Error("Extracted tax source text is too short.");
      }

      return cleaned;
    } catch (error) {
      console.error(
        `Tax source Gemini extraction failed attempt ${attempt}/${maxAttempts}:`,
        error,
      );

      const canRetry = isRetryableGeminiError(error);
      const isLastAttempt = attempt === maxAttempts;

      if (!canRetry || isLastAttempt) {
        throw new Error(
          [
            "Gemini could not extract this file right now.",
            "Reason: Gemini is temporarily overloaded or unavailable.",
            "",
            "Fix:",
            "1. If this is a UK GOV.UK source, upload the .txt version instead of PDF.",
            "2. Or paste the GOV.UK page text into the text box.",
            "3. Or try the same PDF again after 2–5 minutes.",
            "",
            `Original error: ${errorToText(error)}`,
          ].join("\n"),
        );
      }

      await sleep(3000 * attempt);
    }
  }

  throw new Error("Tax source extraction failed after retries.");
}