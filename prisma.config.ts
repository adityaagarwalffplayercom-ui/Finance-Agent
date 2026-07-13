import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "prisma/config";

function loadEnvironmentFile(path: string) {
  if (!existsSync(path)) {
    return;
  }

  try {
    loadEnvFile(path);
  } catch (error) {
    console.warn(`Unable to load ${path}:`, error);
  }
}

// Prisma stops loading .env automatically as soon as prisma.config.ts exists.
// Load local overrides first because Node's loadEnvFile keeps existing values.
loadEnvironmentFile(".env.local");
loadEnvironmentFile(".env");

const configuredDatabaseUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  "postgresql://missing:missing@127.0.0.1:1/aureli_missing_environment";

// The schema still resolves both env() calls during validation/generation.
// A local unreachable placeholder keeps generation/formatting deterministic when
// no environment file exists; migration commands will fail safely to connect.
process.env.DATABASE_URL ??= configuredDatabaseUrl;
process.env.DIRECT_URL ??= configuredDatabaseUrl;

export default defineConfig({
  engine: "classic",
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: configuredDatabaseUrl,
  },
});
