import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { createHmac } from "crypto";
import { getEnv } from "$lib/tools/get-env";
import {
  createRateLimitResponse,
  webhookRateLimiter,
} from "$lib/server/middleware/rate-limit";
import { routeInboundEmail } from "$lib/server/email/inbound-router";

/**
 * GET /api/email/inbound — health check
 */
export const GET: RequestHandler = async () => {
  console.log("[email/inbound] GET health check");
  return json({ status: "ok", endpoint: "email/inbound" });
};

/**
 * POST /api/email/inbound
 *
 * Generic inbound email webhook. Parses the email from the provider payload,
 * then routes internally based on the recipient address.
 *
 * Supports:
 * 1. EmailConnect.eu (primary) — JSON with optional Standard Webhooks signature
 * 2. Mailgun (fallback) — multipart/form-data with HMAC signature
 */
export const POST: RequestHandler = async (event) => {
  // Clone request so we can read the body for logging and still parse it
  const clonedRequest = event.request.clone();
  const rawBodyForLog = await clonedRequest.text();
  console.log("[email/inbound] POST received", {
    contentType: event.request.headers.get("content-type"),
    userAgent: event.request.headers.get("user-agent"),
    body: rawBodyForLog.slice(0, 2000),
  });

  try {
    // Rate limiting
    if (!webhookRateLimiter.tryConsume(event.request)) {
      console.warn("[email/inbound] Rate limit exceeded");
      return createRateLimitResponse();
    }

    const contentType = event.request.headers.get("content-type") || "";
    let recipient: string;
    let fromAddress: string;
    let subject: string | null;
    let bodyText: string | null;
    let bodyHtml: string | null;

    if (contentType.includes("application/json")) {
      // --- EmailConnect.eu format (JSON + optional Standard Webhooks signature) ---
      const rawBody = await event.request.text();

      const hmacKey = getEnv("SJS_EMAILCONNECT_HMAC_KEY", "");
      if (hmacKey) {
        const webhookId = event.request.headers.get("webhook-id") || "";
        const webhookTimestamp = event.request.headers.get("webhook-timestamp") || "";
        const webhookSignature = event.request.headers.get("webhook-signature") || "";

        if (!webhookId || !webhookTimestamp || !webhookSignature) {
          return json({ success: false, error: "Missing webhook signature headers" }, { status: 401 });
        }

        const timestampAge = Math.abs(Date.now() / 1000 - Number(webhookTimestamp));
        if (timestampAge > 300) {
          console.warn(`[email/inbound] Stale webhook timestamp (${timestampAge}s old)`);
          return json({ success: false, error: "Stale request" }, { status: 403 });
        }

        const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
        const secretBytes = hmacKey.startsWith("whsec_")
          ? Buffer.from(hmacKey.slice(6), "base64")
          : Buffer.from(hmacKey, "base64");
        const expectedSignature = createHmac("sha256", secretBytes)
          .update(signedContent)
          .digest("base64");

        const signatures = webhookSignature.split(" ").map((s) => s.replace("v1,", ""));
        if (!signatures.includes(expectedSignature)) {
          console.warn("[email/inbound] Invalid webhook signature");
          return json({ success: false, error: "Invalid signature" }, { status: 403 });
        }
      }

      let body: Record<string, unknown>;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return json({ success: false, error: "Invalid JSON" }, { status: 400 });
      }

      // EmailConnect.eu payload structure
      // recipient and sender can be objects like { name: "...", email: "..." }
      const message = (body.message || {}) as Record<string, unknown>;
      const sender = (message.sender || {}) as Record<string, string>;
      const recipientObj = (message.recipient || {}) as Record<string, string>;
      const content = (message.content || body.content || {}) as Record<string, unknown>;

      recipient = String(recipientObj.email || recipientObj.name || message.recipient || "");
      fromAddress = String(sender.email || sender.name || "");
      subject = String(message.subject || "") || null;
      bodyText = String(content.text || "") || null;
      bodyHtml = String(content.html || "") || null;

      // Fallback: also support flat/generic JSON format
      if (!recipient) {
        const envelope = (body.envelope || {}) as Record<string, string>;
        const headers = (body.headers || {}) as Record<string, string>;
        recipient = String(envelope.to || body.to || body.recipient || headers.to || "");
        fromAddress = String(envelope.from || body.from || body.sender || headers.from || fromAddress || "");
        subject = subject || String(headers.subject || body.subject || "") || null;
        bodyText = bodyText || String(body.plain || body.text || body["body-plain"] || "") || null;
        bodyHtml = bodyHtml || String(body.html || body["body-html"] || "") || null;
      }
    } else if (contentType.includes("form-data") || contentType.includes("x-www-form-urlencoded")) {
      // --- Mailgun format (form-encoded) ---
      const formData = await event.request.formData();

      const signingKey = getEnv("SJS_MAILGUN_SIGNING_KEY", "");
      if (signingKey) {
        const timestamp = formData.get("timestamp") as string;
        const token = formData.get("token") as string;
        const signature = formData.get("signature") as string;

        if (!timestamp || !token || !signature) {
          return json({ success: false, error: "Missing signature fields" }, { status: 401 });
        }

        const hmac = createHmac("sha256", signingKey);
        hmac.update(timestamp + token);
        const expectedSignature = hmac.digest("hex");

        if (expectedSignature !== signature) {
          console.warn("[email/inbound] Invalid Mailgun signature");
          return json({ success: false, error: "Invalid signature" }, { status: 403 });
        }

        const timestampAge = Math.abs(Date.now() / 1000 - Number(timestamp));
        if (timestampAge > 300) {
          console.warn(`[email/inbound] Stale Mailgun timestamp (${timestampAge}s old)`);
          return json({ success: false, error: "Stale request" }, { status: 403 });
        }
      }

      recipient = (formData.get("recipient") as string) || "";
      fromAddress = (formData.get("sender") as string) || (formData.get("from") as string) || "";
      subject = (formData.get("subject") as string) || null;
      bodyText = (formData.get("body-plain") as string) || (formData.get("stripped-text") as string) || null;
      bodyHtml = (formData.get("body-html") as string) || (formData.get("stripped-html") as string) || null;
    } else {
      return json({ success: false, error: "Unsupported content type" }, { status: 415 });
    }

    if (!recipient || !fromAddress) {
      return json(
        { success: false, error: "Missing required fields: recipient, sender" },
        { status: 400 },
      );
    }

    console.log(`[email/inbound] Received email to=${recipient} from=${fromAddress} subject="${subject || ""}"`);

    // Route the email based on recipient address
    const result = await routeInboundEmail({
      recipient,
      fromAddress,
      subject,
      bodyText,
      bodyHtml,
    });

    return json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[email/inbound] Processing failed:", message);
    return json({ success: false, error: "Internal error" }, { status: 500 });
  }
};
