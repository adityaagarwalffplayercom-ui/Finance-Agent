console.log("SECRET CHECK:", process.env.BETTER_AUTH_SECRET);
console.log("URL CHECK:", process.env.BETTER_AUTH_URL);
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./prisma";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    // TODO: turn this on once a transactional email provider is wired up.
    requireEmailVerification: false,
  },

  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],

  // Lets Better Auth set cookies from Server Actions/Route Handlers in the
  // App Router. Must stay last in the plugins array per Better Auth's docs.
  plugins: [nextCookies()],
});
