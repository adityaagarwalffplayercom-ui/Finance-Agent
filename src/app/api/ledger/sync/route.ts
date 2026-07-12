import { headers } from "next/headers";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import { auth } from "@/lib/auth";
import {
  syncAllApprovedDocuments,
} from "@/lib/transaction-ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
) {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (!session?.user?.id) {
    return NextResponse.redirect(
      new URL("/sign-in", request.url),
      303,
    );
  }

  try {
    const result =
      await syncAllApprovedDocuments(
        session.user.id,
      );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Ledger synchronization failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Ledger synchronization failed.",
      },
      { status: 500 },
    );
  }
}