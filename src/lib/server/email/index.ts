/**
 * Email Service using Resend
 *
 * Used for transactional emails like password reset.
 */

import { Resend } from "resend";
import { getEnv } from "$lib/tools/get-env";

// Lazy initialization - only create client when needed
let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    const apiKey = getEnv("SJS_RESEND_API_KEY", "");
    if (!apiKey) {
      throw new Error(
        "Email sending is not configured. Set SJS_RESEND_API_KEY environment variable.",
      );
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}) {
  const client = getResendClient();
  const fromEmail = getEnv("SJS_EMAIL_FROM", "noreply@example.com");

  return client.emails.send({
    from: fromEmail,
    ...options,
  });
}
