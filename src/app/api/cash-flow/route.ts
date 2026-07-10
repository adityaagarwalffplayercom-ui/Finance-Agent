import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCashFlowReport } from "@/lib/cash-flow-engine";

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

    const report = await getCashFlowReport(session.user.id);

    return NextResponse.json({
      report,
    });
  } catch (error) {
    console.error("Cash flow route error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate cash flow report.",
      },
      {
        status: 500,
      },
    );
  }
}