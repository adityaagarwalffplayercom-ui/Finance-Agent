import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./prisma";

const vercelUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : undefined;

const baseURL =
  process.env.BETTER_AUTH_URL ?? vercelUrl ?? "http://localhost:3000";

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
    vercelUrl,
    "https://finance-agent-nine-umber.vercel.app",
    "http://localhost:3000",
  ].filter(Boolean) as string[],
  plugins: [nextCookies()],
});