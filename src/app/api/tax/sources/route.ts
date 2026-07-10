import { NextResponse } from "next/server";
import { getVerifiedTaxSourceCitations } from "@/lib/tax-source-citations";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const country = url.searchParams.get("country");
  const financialYear = url.searchParams.get("financialYear");
  const question =
    url.searchParams.get("question") ||
    "What verified tax sources are available?";

  const result = await getVerifiedTaxSourceCitations({
    country,
    financialYear,
    question,
    limit: 20,
  });

  return NextResponse.json({
    message: "Tax source citations API working.",
    result,
    privacy: {
      userDataAccessed: false,
      scope: "Global verified tax sources only",
    },
  });
}