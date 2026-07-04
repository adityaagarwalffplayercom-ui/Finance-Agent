import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const VALID_REVIEW_STATUSES = ["NEEDS_REVIEW", "APPROVED", "REJECTED"] as const;

type ReviewStatus = (typeof VALID_REVIEW_STATUSES)[number];

function isReviewStatus(value: unknown): value is ReviewStatus {
  return (
    typeof value === "string" &&
    VALID_REVIEW_STATUSES.includes(value as ReviewStatus)
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => null);

    const reviewStatus = body?.reviewStatus;

    if (!isReviewStatus(reviewStatus)) {
      return NextResponse.json(
        { error: "Invalid review status." },
        { status: 400 },
      );
    }

    const reviewNote =
      typeof body?.reviewNote === "string" ? body.reviewNote.trim() : "";

    const document = await prisma.document.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 },
      );
    }

    if (reviewStatus === "APPROVED" && document.status !== "PROCESSED") {
      return NextResponse.json(
        { error: "Only processed documents can be approved." },
        { status: 400 },
      );
    }

    const updatedDocument = await prisma.document.update({
      where: {
        id: document.id,
      },
      data: {
        reviewStatus,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
      },
      select: {
        id: true,
        reviewStatus: true,
        reviewedAt: true,
        reviewNote: true,
      },
    });

    return NextResponse.json({
      success: true,
      document: updatedDocument,
    });
  } catch (error) {
    console.error("Document review update error:", error);

    return NextResponse.json(
      { error: "Something went wrong while updating review status." },
      { status: 500 },
    );
  }
}