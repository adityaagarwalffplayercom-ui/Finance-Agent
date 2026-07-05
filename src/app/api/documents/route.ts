import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  formatFileSize,
  isValidCategory,
} from "@/lib/document-categories";
import { checkAndRecordUploadUsage } from "@/lib/usage-events";

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const userId = session.user.id;

    const uploadUsage = await checkAndRecordUploadUsage(userId);

    if (!uploadUsage.allowed) {
      return NextResponse.json(
        {
          error:
            uploadUsage.message ??
            "Daily upload limit reached. Try again later.",
        },
        { status: 429 },
      );
    }

    const formData = await request.formData();

    const file = formData.get("file");
    const category = formData.get("category");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file was provided." },
        { status: 400 },
      );
    }

    if (typeof category !== "string" || !isValidCategory(category)) {
      return NextResponse.json(
        { error: "Pick a document category." },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "That file is empty." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `Files must be ${formatFileSize(
            MAX_FILE_SIZE_BYTES,
          )} or smaller. This protects AI quota and prevents large annual reports from exhausting Gemini.`,
        },
        { status: 413 },
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Use a PDF, image (JPG/PNG/WebP), CSV, or Excel file.",
        },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const content = Buffer.from(arrayBuffer);

    const document = await prisma.document.create({
      data: {
        fileName: file.name.slice(0, 255),
        mimeType: file.type,
        fileSize: file.size,
        category,
        content,
        userId,
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        category: true,
        status: true,
        uploadedAt: true,
      },
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error("Document upload failed:", error);

    return NextResponse.json(
      {
        error: "Upload failed. Please try again.",
      },
      { status: 500 },
    );
  }
}