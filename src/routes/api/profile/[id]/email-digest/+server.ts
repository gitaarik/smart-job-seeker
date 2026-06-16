import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq, gte, and, desc } from "drizzle-orm";
import { profiles, users, job_matches, jobs, job_platforms } from "$lib/server/db/schema";
import { requireAuth, parseIntParam, requireProfileAccess } from "$lib/server/utils/api-helpers";
import { sendDigestEmail, type DigestJob } from "$lib/server/email/digest";

const ALLOWED_FREQUENCIES = [1, 2, 3, 5, 7, 14];
const ALLOWED_MIN_SCORES = [50, 60, 70, 80, 90];
const ALLOWED_SEND_TO = ["profile", "account", "both"];

/**
 * GET /api/profile/[id]/email-digest
 *
 * Get email digest preferences for a profile.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  const user = requireAuth(locals);
  const profileId = parseIntParam(params.id, "profile");
  await requireProfileAccess(profileId, user.id);

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, profileId),
    columns: {
      email_digest_enabled: true,
      email_digest_frequency_days: true,
      email_digest_min_score: true,
      email_digest_last_sent_at: true,
      email_digest_preferred_hour: true,
      email_digest_send_to: true,
      email_address: true,
      location_timezone: true,
      browser_timezone: true,
    },
  });

  if (!profile) {
    throw error(404, "Profile not found");
  }

  // Get user timezone
  const userRecord = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { timezone: true },
  });

  return json({
    enabled: profile.email_digest_enabled ?? false,
    frequency_days: profile.email_digest_frequency_days ?? 7,
    min_score: profile.email_digest_min_score ?? 70,
    preferred_hour: profile.email_digest_preferred_hour ?? 9,
    send_to: profile.email_digest_send_to ?? "profile",
    last_sent_at: profile.email_digest_last_sent_at?.toISOString() ?? null,
    email_address: profile.email_address ?? null,
    timezone: userRecord?.timezone ?? profile.location_timezone ?? profile.browser_timezone ?? null,
    account_email: user.email,
  });
};

/**
 * PATCH /api/profile/[id]/email-digest
 *
 * Update email digest preferences for a profile.
 * Also accepts `timezone` which is saved on the user (shared across profiles).
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);
  const profileId = parseIntParam(params.id, "profile");
  await requireProfileAccess(profileId, user.id);

  const body = await request.json();
  const profileUpdate: Record<string, unknown> = {};

  if (typeof body.enabled === "boolean") {
    // If enabling, verify the profile or account has an email address
    if (body.enabled) {
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.id, profileId),
        columns: { email_address: true },
      });
      const sendTo = body.send_to ?? "profile";
      if (sendTo !== "account" && !profile?.email_address) {
        throw error(400, "Profile must have an email address to enable email digests (or use account email)");
      }
    }
    profileUpdate.email_digest_enabled = body.enabled;
  }

  if (body.frequency_days !== undefined) {
    if (!ALLOWED_FREQUENCIES.includes(body.frequency_days)) {
      throw error(400, `frequency_days must be one of: ${ALLOWED_FREQUENCIES.join(", ")}`);
    }
    profileUpdate.email_digest_frequency_days = body.frequency_days;
  }

  if (body.min_score !== undefined) {
    if (!ALLOWED_MIN_SCORES.includes(body.min_score)) {
      throw error(400, `min_score must be one of: ${ALLOWED_MIN_SCORES.join(", ")}`);
    }
    profileUpdate.email_digest_min_score = body.min_score;
  }

  if (body.preferred_hour !== undefined) {
    const hour = body.preferred_hour;
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      throw error(400, "preferred_hour must be an integer between 0 and 23");
    }
    profileUpdate.email_digest_preferred_hour = hour;
  }

  if (body.send_to !== undefined) {
    if (!ALLOWED_SEND_TO.includes(body.send_to)) {
      throw error(400, `send_to must be one of: ${ALLOWED_SEND_TO.join(", ")}`);
    }
    profileUpdate.email_digest_send_to = body.send_to;
  }

  // Reset last_sent_at to re-include the previous period's jobs
  if (body.reset_last_sent === true) {
    const freq = body.frequency_days ?? profileUpdate.email_digest_frequency_days;
    // Look up current frequency if not in this request
    let frequencyDays = 7;
    if (typeof freq === "number") {
      frequencyDays = freq;
    } else {
      const current = await db.query.profiles.findFirst({
        where: eq(profiles.id, profileId),
        columns: { email_digest_frequency_days: true },
      });
      frequencyDays = current?.email_digest_frequency_days ?? 7;
    }
    profileUpdate.email_digest_last_sent_at = new Date(Date.now() - frequencyDays * 86400_000);
  }

  // Timezone is saved on the user, not the profile
  if (typeof body.timezone === "string") {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: body.timezone });
    } catch {
      throw error(400, "Invalid timezone");
    }
    await db.update(users).set({ timezone: body.timezone }).where(eq(users.id, user.id));
  }

  if (Object.keys(profileUpdate).length > 0) {
    await db.update(profiles).set(profileUpdate).where(eq(profiles.id, profileId));
  }

  return json({ ok: true });
};

const DIGEST_MAX_JOBS = 20;

/**
 * POST /api/profile/[id]/email-digest
 *
 * Send the digest email immediately (for testing). Uses the profile's
 * configured min_score and send_to settings, and includes matches since
 * last_sent_at (or the last frequency_days if never sent).
 */
export const POST: RequestHandler = async ({ params, locals, url }) => {
  const user = requireAuth(locals);
  const profileId = parseIntParam(params.id, "profile");
  await requireProfileAccess(profileId, user.id);

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, profileId),
    columns: {
      name: true,
      email_address: true,
      user_id: true,
      email_digest_frequency_days: true,
      email_digest_min_score: true,
      email_digest_last_sent_at: true,
      email_digest_send_to: true,
    },
  });

  if (!profile) throw error(404, "Profile not found");

  const minScore = profile.email_digest_min_score ?? 70;
  const frequencyDays = profile.email_digest_frequency_days ?? 7;
  const sendTo = profile.email_digest_send_to ?? "profile";

  // Determine recipients
  const recipients: string[] = [];
  if ((sendTo === "profile" || sendTo === "both") && profile.email_address) {
    recipients.push(profile.email_address);
  }
  if (sendTo === "account" || sendTo === "both") {
    recipients.push(user.email);
  }
  // Deduplicate
  const uniqueRecipients = [...new Set(recipients)];
  if (uniqueRecipients.length === 0) {
    throw error(400, "No email address configured for digest");
  }

  // Cutoff: either last_sent_at or frequency_days ago
  const since = profile.email_digest_last_sent_at
    ?? new Date(Date.now() - frequencyDays * 86400_000);

  const matches = await db
    .select({
      job_id: job_matches.job_id,
      score: job_matches.score,
      matched_skills: job_matches.matched_skills,
      title: jobs.title,
      company: jobs.company,
      source_url: jobs.source_url,
      office_location: jobs.office_location,
      salary_min: jobs.salary_min,
      salary_max: jobs.salary_max,
      salary_currency: jobs.salary_currency,
      salary_period: jobs.salary_period,
      work_location: jobs.work_location,
      job_types: jobs.job_types,
      experience_levels: jobs.experience_levels,
      skills_required: jobs.skills_required,
      skills_preferred: jobs.skills_preferred,
      job_description: jobs.job_description,
      job_platform_name: job_platforms.name,
    })
    .from(job_matches)
    .innerJoin(jobs, eq(job_matches.job_id, jobs.id))
    .leftJoin(job_platforms, eq(jobs.job_platform_id, job_platforms.id))
    .where(
      and(
        eq(job_matches.profile_id, profileId),
        gte(job_matches.score, minScore),
        gte(job_matches.date_created, since),
      ),
    )
    .orderBy(desc(job_matches.score))
    .limit(DIGEST_MAX_JOBS);

  const digestJobs: DigestJob[] = matches.map((m) => ({
    id: m.job_id,
    title: m.title ?? "Untitled",
    company: m.company,
    score: m.score,
    source_url: m.source_url,
    office_location: m.office_location,
    salary_min: m.salary_min,
    salary_max: m.salary_max,
    salary_currency: m.salary_currency,
    salary_period: m.salary_period,
    work_location: m.work_location as string[] | null,
    job_types: m.job_types as string[] | null,
    experience_levels: m.experience_levels as string[] | null,
    skills_required: m.skills_required as string[] | null,
    skills_preferred: m.skills_preferred as string[] | null,
    matched_skills: m.matched_skills as string[] | null,
    job_description: m.job_description,
    job_platform_name: m.job_platform_name,
  }));

  const appUrl = url.origin;
  const profileName = profile.name ?? "Your profile";

  for (const to of uniqueRecipients) {
    await sendDigestEmail({
      to,
      profileName,
      jobs: digestJobs,
      minScore,
      appUrl,
    });
  }

  // Update last_sent_at
  await db.update(profiles)
    .set({ email_digest_last_sent_at: new Date() })
    .where(eq(profiles.id, profileId));

  return json({
    ok: true,
    sent_to: uniqueRecipients,
    job_count: digestJobs.length,
  });
};
