import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  buildUserDataExportPdf,
  exportOwnUserData,
} from "@/lib/user-privacy-controls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getSessionUserId(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  return session?.user?.id ?? null;
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 80);
}

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request);

    if (!userId) {
      return NextResponse.json(
        {
          error: "Unauthorized. Please log in to export your data.",
        },
        {
          status: 401,
        },
      );
    }

    const url = new URL(request.url);
    const format = url.searchParams.get("format")?.toLowerCase();

    if (format === "json") {
      const exportData = await exportOwnUserData(userId);

      return NextResponse.json({
        message: "User data export generated as JSON.",
        privacy: {
          adminAccess: false,
          userScoped: true,
          userIdUsedFromSessionOnly: true,
        },
        exportData,
      });
    }

    const pdfBuffer = await buildUserDataExportPdf(userId);
    const fileName = `aureli-user-data-export-${sanitizeFileName(userId)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF export failed:", error);

    return NextResponse.json(
      {
        error: "PDF export failed.",
        detail: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
      },
    );
  }
}