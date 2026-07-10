import { NextResponse } from "next/server";
import { getTaxCoverage } from "@/lib/tax-coverage-engine";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const countryCode = url.searchParams.get("countryCode");
  const financialYear = url.searchParams.get("financialYear");

  const coverage = await getTaxCoverage({
    countryCode,
    financialYear,
  });

  return NextResponse.json({
    message: "Tax coverage dashboard API working.",
    coverage,
  });
}