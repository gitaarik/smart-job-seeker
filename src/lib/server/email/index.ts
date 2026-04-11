/**
 * Email Service using SMTP2GO API
 *
 * Used for transactional emails like password reset.
 * https://developers.smtp2go.com/docs/send-an-email
 */

import { getEnv } from "$lib/tools/get-env";

const SMTP2GO_API_URL = "https://api.smtp2go.com/v3/email/send";

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = getEnv("SJS_SMTP2GO_API_KEY", "");
  if (!apiKey) {
    throw new Error(
      "Email sending is not configured. Set SJS_SMTP2GO_API_KEY environment variable.",
    );
  }

  const fromEmail = getEnv("SJS_EMAIL_FROM", "noreply@example.com") as string;

  console.log(`[email] Sending "${options.subject}" to ${options.to}`);

  const response = await fetch(SMTP2GO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Smtp2go-Api-Key": apiKey,
    },
    body: JSON.stringify({
      sender: fromEmail,
      to: [options.to],
      subject: options.subject,
      html_body: options.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[email] SMTP2GO HTTP error (${response.status}):`, body);
    throw new Error(`SMTP2GO API error (${response.status}): ${body}`);
  }

  const result = await response.json();

  if (result.data?.failed > 0) {
    console.error(`[email] SMTP2GO delivery failed:`, result.data.failures);
    throw new Error(`SMTP2GO delivery failed: ${result.data.failures.join(", ")}`);
  }

  console.log(`[email] Sent successfully (id: ${result.data?.email_id || "n/a"})`);
  return result;
}
