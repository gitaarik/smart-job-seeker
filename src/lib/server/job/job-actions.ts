import { fail } from "@sveltejs/kit";
import { dbDirect as db, queryRaw, sql } from "$lib/server/db";

/**
 * Shared form action handlers for save/unsave/reject/unreject job statuses.
 * Uses the job_statuses table (separate from AI match scoring in job_matches).
 */

export async function saveJob(profileId: number, jobId: number) {
  const job = await db.query.jobs.findFirst({ where: { id: jobId } });
  if (!job) return fail(404, { error: "Job not found" });

  const now = new Date();
  await queryRaw(sql`
    INSERT INTO job_statuses (profile, job, status, date_created, date_updated)
    VALUES (${profileId}, ${jobId}, 'saved', ${now}, ${now})
    ON CONFLICT (profile, job)
    DO UPDATE SET status = 'saved', date_updated = ${now}
  `);

  return { success: true, action: "saved", jobId };
}

export async function unsaveJob(profileId: number, jobId: number) {
  await db.job_statuses.deleteMany({
    where: { profile: profileId, job: jobId },
  });

  return { success: true, action: "unsaved", jobId };
}

export async function rejectJob(profileId: number, jobId: number) {
  const job = await db.query.jobs.findFirst({ where: { id: jobId } });
  if (!job) return fail(404, { error: "Job not found" });

  const now = new Date();
  await queryRaw(sql`
    INSERT INTO job_statuses (profile, job, status, date_created, date_updated)
    VALUES (${profileId}, ${jobId}, 'rejected', ${now}, ${now})
    ON CONFLICT (profile, job)
    DO UPDATE SET status = 'rejected', date_updated = ${now}
  `);

  return { success: true, action: "rejected", jobId };
}

export async function unrejectJob(profileId: number, jobId: number) {
  await db.job_statuses.deleteMany({
    where: { profile: profileId, job: jobId },
  });

  return { success: true, action: "unrejected", jobId };
}
