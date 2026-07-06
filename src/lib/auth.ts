import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./prisma";

const localUrl = "http://localhost:3000";

const vercelUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : undefined;

const productionUrl = "https://finance-agent-nine-umber.vercel.app";

const baseURL =
  process.env.BETTER_AUTH_URL || vercelUrl || localUrl;

const extraTrustedOrigins =
  process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  trustedOrigins: [
    baseURL,
    localUrl,
    "http://127.0.0.1:3000",
    "http://172.30.221.92:3000",
    vercelUrl,
    productionUrl,
    ...extraTrustedOrigins,
  ].filter(Boolean) as string[],
  plugins: [nextCookies()],
});