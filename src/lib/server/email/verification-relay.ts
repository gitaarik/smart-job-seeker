/**
 * Email Verification Relay Service
 *
 * Handles generating unique verification email addresses per profile,
 * processing inbound verification emails, and linking them to active scraper runs.
 */

import { randomBytes } from "crypto";
import { db } from "$lib/server/db";
import { eq, and, desc } from "drizzle-orm";
import { verification_email_addresses, inbound_emails, search_task_runs, search_tasks } from "$lib/server/db/schema";
import { parseVerificationEmail } from "./verification-parser";

const VERIFY_DOMAIN = "smartjobseeker.com";

/**
 * Get or create the verification email address for a profile.
 */
export async function getOrCreateVerificationAddress(profileId: number): Promise<{
  id: number;
  fullAddress: string;
  emailToken: string;
  isActive: boolean;
}> {
  // Check for existing address
  const existing = await db.query.verification_email_addresses.findFirst({
    where: eq(verification_email_addresses.profile_id, profileId),
  });

  if (existing) {
    return {
      id: existing.id,
      fullAddress: existing.full_address,
      emailToken: existing.email_token,
      isActive: existing.is_active,
    };
  }

  // Generate new token and address
  const emailToken = randomBytes(4).toString("hex"); // 8 hex chars
  const fullAddress = `verify-${emailToken}@${VERIFY_DOMAIN}`;

  const [created] = await db.insert(verification_email_addresses).values({
    profile_id: profileId,
    email_token: emailToken,
    full_address: fullAddress,
  }).returning();

  return {
    id: created.id,
    fullAddress: created.full_address,
    emailToken: created.email_token,
    isActive: created.is_active,
  };
}

/**
 * Regenerate a verification email address token (e.g., if compromised).
 */
export async function regenerateVerificationAddress(profileId: number): Promise<{
  fullAddress: string;
  emailToken: string;
}> {
  const emailToken = randomBytes(4).toString("hex"); // 8 hex chars
  const fullAddress = `verify-${emailToken}@${VERIFY_DOMAIN}`;

  await db.insert(verification_email_addresses).values({
    profile_id: profileId,
    email_token: emailToken,
    full_address: fullAddress,
  }).onConflictDoUpdate({
    target: verification_email_addresses.profile_id,
    set: {
      email_token: emailToken,
      full_address: fullAddress,
    },
  });

  return { fullAddress, emailToken };
}

/**
 * Process an inbound verification email.
 *
 * 1. Look up the profile by email token
 * 2. Find an active blocked run for that profile
 * 3. Parse the email for verification code/link
 * 4. Store the email and write verification_data to the run
 * 5. Set user_response = "continue" so the polling loop picks it up
 */
export async function processInboundEmail(params: {
  recipientToken: string;
  fromAddress: string;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
}): Promise<{
  success: boolean;
  message: string;
  profileId?: number;
  runId?: number;
  extractedCode?: string;
  extractedLink?: string;
}> {
  const { recipientToken, fromAddress, subject, bodyText, bodyHtml } = params;
  const recipientAddress = `verify-${recipientToken}@${VERIFY_DOMAIN}`;

  // 1. Find the verification address
  const verifyAddr = await db.query.verification_email_addresses.findFirst({
    where: eq(verification_email_addresses.email_token, recipientToken),
    with: { profile: true },
  });

  // Always store the email so it's visible in admin inbox
  if (!verifyAddr) {
    await db.insert(inbound_emails).values({
      recipient: recipientAddress,
      handler: "verification-relay",
      from_address: fromAddress,
      subject: subject?.slice(0, 500) || null,
      body_text: bodyText,
      body_html: bodyHtml,
      status: "dropped",
    });
    console.log(`[verification-relay] Unknown token ${recipientToken} from ${fromAddress}`);
    return { success: false, message: "Unknown verification email token" };
  }

  if (!verifyAddr.is_active) {
    await db.insert(inbound_emails).values({
      recipient: recipientAddress,
      handler: "verification-relay",
      verification_address_id: verifyAddr.id,
      from_address: fromAddress,
      subject: subject?.slice(0, 500) || null,
      body_text: bodyText,
      body_html: bodyHtml,
      status: "dropped",
    });
    console.log(`[verification-relay] Disabled address for profile ${verifyAddr.profile_id} from ${fromAddress}`);
    return { success: false, message: "Verification email address is disabled" };
  }

  const profileId = verifyAddr.profile_id;

  // Update last_used_at
  await db.update(verification_email_addresses).set({ last_used_at: new Date() })
    .where(eq(verification_email_addresses.id, verifyAddr.id));

  // 2. Find an active blocked run for this profile
  const blockedRunResults = await db
    .select({
      id: search_task_runs.id,
      started_at: search_task_runs.started_at,
    })
    .from(search_task_runs)
    .innerJoin(search_tasks, eq(search_task_runs.search_task_id, search_tasks.id))
    .where(and(
      eq(search_task_runs.status, "blocked"),
      eq(search_tasks.profile_id, profileId),
    ))
    .orderBy(desc(search_task_runs.started_at))
    .limit(1);

  const blockedRun = blockedRunResults[0] ?? null;

  // 3. Parse the email
  const parsed = await parseVerificationEmail(subject, bodyText, bodyHtml);

  // 4. Store the email record
  const [emailRecord] = await db.insert(inbound_emails).values({
    recipient: recipientAddress,
    handler: "verification-relay",
    verification_address_id: verifyAddr.id,
    run_id: blockedRun?.id || null,
    from_address: fromAddress,
    subject: subject?.slice(0, 500) || null,
    body_text: bodyText,
    body_html: bodyHtml,
    extracted_code: parsed?.code?.slice(0, 50) || null,
    extracted_link: parsed?.link?.slice(0, 2000) || null,
    status: blockedRun ? "matched" : "received",
  }).returning();

  console.log(
    `[verification-relay] Email received for profile ${profileId}` +
    ` from ${fromAddress}: code=${parsed?.code || "none"}, link=${parsed?.link ? "yes" : "none"}` +
    ` (confidence: ${parsed?.confidence || "none"}, run: ${blockedRun?.id || "none"})`,
  );

  // 5. If we found a blocked run AND extracted verification data, inject it
  if (blockedRun && parsed && (parsed.code || parsed.link)) {
    await db.update(search_task_runs).set({
      verification_data: {
        code: parsed.code || null,
        link: parsed.link || null,
        emailId: emailRecord.id,
        confidence: parsed.confidence,
      },
      user_response: "continue",
    }).where(eq(search_task_runs.id, blockedRun.id));

    // Mark email as applied
    await db.update(inbound_emails).set({ status: "applied", applied_at: new Date() })
      .where(eq(inbound_emails.id, emailRecord.id));

    return {
      success: true,
      message: "Verification data extracted and applied to active run",
      profileId,
      runId: blockedRun.id,
      extractedCode: parsed.code,
      extractedLink: parsed.link,
    };
  }

  if (!blockedRun) {
    return {
      success: true,
      message: "Email stored but no active blocked run found for this profile",
      profileId,
    };
  }

  return {
    success: true,
    message: "Email stored but no verification code or link could be extracted",
    profileId,
    runId: blockedRun.id,
  };
}

/**
 * Extract the token from a recipient address like "verify-abc123@verify.smartjobseeker.com"
 */
export function extractTokenFromRecipient(recipient: string): string | null {
  const match = recipient.match(/^verify-([a-f0-9]+)@/i);
  return match ? match[1] : null;
}
