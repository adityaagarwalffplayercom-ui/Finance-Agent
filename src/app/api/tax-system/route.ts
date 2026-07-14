import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const documents = await prisma.taxSourceDocument.findMany({
      where: {
        verificationStatus: "VERIFIED",
      },
      orderBy: [
        {
          countryName: "asc",
        },
        {
          taxType: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: 100,
      select: {
        id: true,
        countryCode: true,
        countryName: true,
        financialYear: true,
        taxType: true,
        title: true,
        sourceName: true,
        sourceUrl: true,
        fileName: true,
        verificationStatus: true,
        lastVerifiedAt: true,
        createdAt: true,
        _count: {
          select: {
            chunks: true,
          },
        },
      },
    });

    const countries = Array.from(
      new Set(documents.map((document) => document.countryCode)),
    );

    const taxTypes = Array.from(
      new Set(documents.map((document) => document.taxType)),
    );

    const totalChunks = documents.reduce(
      (total, document) => total + document._count.chunks,
      0,
    );

    return NextResponse.json({
      message: "Tax system information loaded.",
      summary: {
        verifiedDocuments: documents.length,
        countries,
        taxTypes,
        totalChunks,
      },
      documents,
      disclaimer:
        "Actic Finance uses verified uploaded tax knowledge and tax rules for readiness and checklist guidance only. It does not replace a CA, CPA, accountant, auditor, lawyer, tax professional, or government authority.",
    });
  } catch (error) {
    console.error("Tax system public API failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load tax system information.",
      },
      {
        status: 500,
      },
    );
  }
}