import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMonthlyFinanceReport } from "@/lib/monthly-finance-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getSessionUserId(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  return session?.user?.id ?? null;
}

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request);

    if (!userId) {
      return NextResponse.json(
        {
          error: "Unauthorized. Please log in to view monthly reports.",
        },
        {
          status: 401,
        },
      );
    }

    const url = new URL(request.url);
    const month = url.searchParams.get("month");

    const report = await getMonthlyFinanceReport({
      userId,
      month,
    });

    return NextResponse.json({
      message: "Monthly finance report generated.",
      report,
      privacy: {
        userScoped: true,
        adminAccess: false,
        userIdUsedFromSessionOnly: true,
      },
    });
  } catch (error) {
    console.error("Monthly finance report failed:", error);

    return NextResponse.json(
      {
        error: "Monthly finance report failed.",
        detail: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
      },
    );
  }
}