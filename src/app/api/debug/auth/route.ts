import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = {
    nodeVersion: process.version,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasBetterAuthSecret: Boolean(process.env.BETTER_AUTH_SECRET),
    hasBetterAuthUrl: Boolean(process.env.BETTER_AUTH_URL),
    hasPublicBetterAuthUrl: Boolean(process.env.NEXT_PUBLIC_BETTER_AUTH_URL),
    betterAuthUrl: process.env.BETTER_AUTH_URL ?? null,
    publicBetterAuthUrl: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? null,
    vercelUrl: process.env.VERCEL_URL ?? null,
    databaseConnected: false,
    databaseError: null as string | null,
  };

  try {
    await prisma.user.count();
    result.databaseConnected = true;
  } catch (error) {
    result.databaseConnected = false;
    result.databaseError =
      error instanceof Error ? error.message : "Unknown database error";
  }

  return NextResponse.json(result);
}