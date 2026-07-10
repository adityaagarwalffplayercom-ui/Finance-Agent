import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBusinessRiskScore } from "@/lib/risk-score-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const riskScore = await getBusinessRiskScore(session.user.id);

    return NextResponse.json({
      message: "Risk score generated successfully.",
      riskScore,
    });
  } catch (error) {
    console.error("Risk score generation failed:", error);

    return NextResponse.json(
      {
        error: "Could not generate risk score.",
        detail: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
      },
    );
  }
}