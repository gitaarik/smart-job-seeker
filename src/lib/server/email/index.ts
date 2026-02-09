/**
 * Email Service using Resend
 *
 * Used for transactional emails like password reset.
 */

import { Resend } from "resend";
import { getEnv } from "$lib/tools/get-env";

const resend = new Resend(getEnv("SJS_RESEND_API_KEY"));
const fromEmail = getEnv("SJS_EMAIL_FROM", "noreply@example.com");

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}) {
  return resend.emails.send({
    from: fromEmail,
    ...options,
  });
}
