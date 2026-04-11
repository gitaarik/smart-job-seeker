/**
 * Inbound Email Router
 *
 * Routes incoming emails to the appropriate handler based on the recipient address.
 * This allows a single catch-all webhook to handle all inbound email for the domain.
 * All emails are stored in the inbound_emails table for debugging/admin review.
 */

import { db } from "$lib/server/db";
import {
  extractTokenFromRecipient,
  processInboundEmail,
} from "./verification-relay";

export interface InboundEmail {
  recipient: string;
  fromAddress: string;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
}

export interface RouteResult {
  success: boolean;
  handler: string;
  message: string;
  [key: string]: unknown;
}

/**
 * Route an inbound email to the appropriate handler based on recipient address.
 *
 * Current routes:
 *   verify-{token}@  → verification relay (login code forwarding)
 *   noreply@          → stored and dropped
 *   *                 → stored and dropped (unknown recipient)
 */
export async function routeInboundEmail(email: InboundEmail): Promise<RouteResult> {
  const localPart = email.recipient.split("@")[0]?.toLowerCase() || "";

  // --- verify-{token}@ → verification relay ---
  // (stores its own record in inbound_emails)
  const verifyToken = extractTokenFromRecipient(email.recipient);
  if (verifyToken) {
    const result = await processInboundEmail({
      recipientToken: verifyToken,
      fromAddress: email.fromAddress,
      subject: email.subject,
      bodyText: email.bodyText,
      bodyHtml: email.bodyHtml,
    });

    return {
      success: result.success,
      handler: "verification-relay",
      message: result.message,
      profileId: result.profileId,
      runId: result.runId,
      extractedCode: result.extractedCode ? "***" : undefined,
      hasLink: !!result.extractedLink,
    };
  }

  // --- noreply@ → store and drop ---
  if (localPart === "noreply" || localPart === "no-reply") {
    await storeEmail(email, "noreply", "dropped");
    console.log(`[email/router] Dropping email to noreply: from=${email.fromAddress}`);
    return {
      success: true,
      handler: "noreply",
      message: "Email dropped (noreply address)",
    };
  }

  // --- Unknown recipient → store and drop ---
  await storeEmail(email, "unhandled", "received");
  console.log(`[email/router] Unhandled recipient: ${email.recipient} from=${email.fromAddress} subject="${email.subject || ""}"`);
  return {
    success: true,
    handler: "unhandled",
    message: `No handler for recipient: ${localPart}@...`,
  };
}

/**
 * Store an inbound email in the database for admin review.
 */
async function storeEmail(email: InboundEmail, handler: string, status: string) {
  await db.inbound_emails.create({
    data: {
      recipient: email.recipient,
      handler,
      from_address: email.fromAddress,
      subject: email.subject?.slice(0, 500) || null,
      body_text: email.bodyText,
      body_html: email.bodyHtml,
      status,
    },
  });
}
