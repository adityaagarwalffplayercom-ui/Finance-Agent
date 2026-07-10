import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDocumentCompletenessReport } from "@/lib/document-completeness-engine";

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

    const report = await getDocumentCompletenessReport(session.user.id);

    return NextResponse.json({
      report,
    });
  } catch (error) {
    console.error("Document completeness route error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate document completeness report.",
      },
      {
        status: 500,
      },
    );
  }
}