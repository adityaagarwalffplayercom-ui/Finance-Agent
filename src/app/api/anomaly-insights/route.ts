import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAnomalyInsightsReport } from "@/lib/anomaly-insights-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const report = await getAnomalyInsightsReport(session.user.id);

    return NextResponse.json({
      report,
    });
  } catch (error) {
    console.error("Anomaly insights route error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate anomaly insights.",
      },
      {
        status: 500,
      },
    );
  }
}