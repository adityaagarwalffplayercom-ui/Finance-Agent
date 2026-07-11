import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getForecastReport } from "@/lib/forecast-engine";

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

    const report = await getForecastReport(session.user.id);

    return NextResponse.json({
      report,
    });
  } catch (error) {
    console.error("Forecast route error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate forecast report.",
      },
      {
        status: 500,
      },
    );
  }
}