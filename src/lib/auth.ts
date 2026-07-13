import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./prisma";
import { sendTransactionalEmail } from "./email";
import { assertProductionConfiguration, productionConfig } from "./production-config";
import { logger } from "./logger";

const configurationProblems = assertProductionConfiguration();
if (configurationProblems.length > 0) {
  logger.warn("production.configuration_incomplete", { problems: configurationProblems });
}

const localUrl = "http://localhost:3000";
const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
const baseURL = process.env.BETTER_AUTH_URL || vercelUrl || localUrl;
const extraTrustedOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean) ?? [];
const trustedOrigins = [
  baseURL,
  ...(productionConfig.isProduction ? [] : [localUrl, "http://127.0.0.1:3000"]),
  ...extraTrustedOrigins,
].filter(Boolean) as string[];

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  rateLimit: {
    enabled: true,
    storage:
      process.env.AUTH_RATE_LIMIT_STORAGE === "memory"
        ? "memory"
        : "database",
    window: 60,
    max: 120,
    customRules: {
      "/sign-in/email": { window: 60, max: 8 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 300, max: 3 },
      "/reset-password": { window: 300, max: 5 },
      "/send-verification-email": { window: 300, max: 3 },
    },
  },
  emailVerification: {
    sendOnSignUp: productionConfig.emailVerificationRequired,
    sendOnSignIn: productionConfig.emailVerificationRequired,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      void sendTransactionalEmail({
        to: user.email,
        subject: "Verify your Aureli account",
        text: `Verify your Aureli account: ${url}`,
        html: `<p>Verify your Aureli account by opening this secure link:</p><p><a href="${url}">Verify email</a></p>`,
      }).catch((error) => logger.error("auth.verification_email_failed", error, { userId: user.id }));
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: productionConfig.emailVerificationRequired,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      void sendTransactionalEmail({
        to: user.email,
        subject: "Reset your Aureli password",
        text: `Reset your Aureli password: ${url}`,
        html: `<p>A password reset was requested for your Aureli account.</p><p><a href="${url}">Reset password</a></p><p>If this was not you, ignore this email.</p>`,
      }).catch((error) => logger.error("auth.reset_email_failed", error, { userId: user.id }));
    },
  },
  trustedOrigins,
  advanced: {
    useSecureCookies: productionConfig.isProduction,
    ipAddress: {
      ipAddressHeaders: [
        "cf-connecting-ip",
        "x-real-ip",
        "x-forwarded-for",
      ],
    },
  },
  plugins: [nextCookies()],
});
