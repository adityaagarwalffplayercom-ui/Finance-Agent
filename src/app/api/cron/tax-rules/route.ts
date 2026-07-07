import { NextResponse } from "next/server";
import { markStaleTaxRulesForReview } from "@/lib/tax-rules-engine";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");

  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        error: "Unauthorized cron request.",
      },
      {
        status: 401,
      },
    );
  }

  const result = await markStaleTaxRulesForReview();

  return NextResponse.json({
    message: "Stale tax rules checked.",
    markedNeedsReview: result.count,
  });
}