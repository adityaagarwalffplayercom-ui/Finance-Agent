import { NextResponse } from "next/server";
import { productionConfig } from "@/lib/production-config";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!productionConfig.debugRoutesEnabled || productionConfig.isProduction) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({
    nodeVersion: process.version,
    environment: process.env.NODE_ENV ?? "development",
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    authConfigured: Boolean(process.env.BETTER_AUTH_SECRET),
    storageMode: process.env.OBJECT_STORAGE_ENDPOINT ? "s3" : "database",
    processingMode: productionConfig.processingMode,
  });
}
