/**
 * Better Auth Configuration
 *
 * Sets up email/password authentication with Prisma adapter.
 */

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "$lib/server/db";
import { getEnv } from "$lib/tools/get-env";
import { sendEmail } from "$lib/server/email";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  secret: getEnv("SJS_AUTH_SECRET"),
  baseURL: getEnv("SJS_APP_URL_HOST", "http://localhost:5173"),

  user: { modelName: "users" },
  account: { modelName: "accounts" },
  verification: { modelName: "verifications" },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        html: `
          <h2>Reset your password</h2>
          <p>Click the link below to reset your password:</p>
          <p><a href="${url}">Reset Password</a></p>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <p>This link will expire in 1 hour.</p>
        `,
      });
    },
  },

  session: {
    modelName: "sessions",
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session age daily
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
