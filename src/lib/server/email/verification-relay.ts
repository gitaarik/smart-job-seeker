/**
 * Email Verification Relay Service
 *
 * Handles generating unique verification email addresses per profile,
 * processing inbound verification emails, and linking them to active scraper runs.
 */

import { randomBytes } from "crypto";
import { db } from "$lib/server/db";
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
  const existing = await db.verification_email_addresses.findUnique({
    where: { profile_id: profileId },
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

  const created = await db.verification_email_addresses.create({
    data: {
      profile_id: profileId,
      email_token: emailToken,
      full_address: fullAddress,
    },
  });

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

  await db.verification_email_addresses.upsert({
    where: { profile_id: profileId },
    create: {
      profile_id: profileId,
      email_token: emailToken,
      full_address: fullAddress,
    },
    update: {
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

  // 1. Find the verification address
  const verifyAddr = await db.verification_email_addresses.findUnique({
    where: { email_token: recipientToken },
    include: { profiles: true },
  });

  if (!verifyAddr) {
    return { success: false, message: "Unknown verification email token" };
  }

  if (!verifyAddr.is_active) {
    return { success: false, message: "Verification email address is disabled" };
  }

  const profileId = verifyAddr.profile_id;

  // Update last_used_at
  await db.verification_email_addresses.update({
    where: { id: verifyAddr.id },
    data: { last_used_at: new Date() },
  });

  // 2. Find an active blocked run for this profile
  const blockedRun = await db.search_task_runs.findFirst({
    where: {
      status: "blocked",
      search_tasks: {
        profile: profileId,
      },
    },
    orderBy: { started_at: "desc" },
  });

  // 3. Parse the email
  const parsed = await parseVerificationEmail(subject, bodyText, bodyHtml);

  // 4. Store the email record
  const emailRecord = await db.verification_emails.create({
    data: {
      verification_address_id: verifyAddr.id,
      run_id: blockedRun?.id || null,
      from_address: fromAddress,
      subject: subject?.slice(0, 500) || null,
      body_text: bodyText,
      body_html: bodyHtml,
      extracted_code: parsed?.code?.slice(0, 50) || null,
      extracted_link: parsed?.link?.slice(0, 2000) || null,
      status: blockedRun ? "matched" : "received",
    },
  });

  console.log(
    `[verification-relay] Email received for profile ${profileId}` +
    ` from ${fromAddress}: code=${parsed?.code || "none"}, link=${parsed?.link ? "yes" : "none"}` +
    ` (confidence: ${parsed?.confidence || "none"}, run: ${blockedRun?.id || "none"})`,
  );

  // 5. If we found a blocked run AND extracted verification data, inject it
  if (blockedRun && parsed && (parsed.code || parsed.link)) {
    await db.search_task_runs.update({
      where: { id: blockedRun.id },
      data: {
        verification_data: {
          code: parsed.code || null,
          link: parsed.link || null,
          emailId: emailRecord.id,
          confidence: parsed.confidence,
        },
        user_response: "continue",
      },
    });

    // Mark email as applied
    await db.verification_emails.update({
      where: { id: emailRecord.id },
      data: { status: "applied", applied_at: new Date() },
    });

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
