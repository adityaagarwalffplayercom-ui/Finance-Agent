import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCfoDecisionPlan } from "@/lib/cfo-decision-engine";

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

    const plan = await getCfoDecisionPlan(session.user.id);

    return NextResponse.json({
      plan,
    });
  } catch (error) {
    console.error("CFO decision route error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate CFO decision plan.",
      },
      {
        status: 500,
      },
    );
  }
}