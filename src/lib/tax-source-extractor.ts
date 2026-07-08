import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  return new GoogleGenAI({
    apiKey,
  });
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
}