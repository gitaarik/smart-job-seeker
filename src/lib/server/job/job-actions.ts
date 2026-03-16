import { fail } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";

/**
 * Shared form action handlers for save/unsave/reject/unreject job matches.
 * Used by both /dashboard and /dashboard/jobs pages.
 */

export async function saveJob(profileId: number, jobId: number) {
  const job = await db.jobs.findUnique({ where: { id: jobId } });
  if (!job) return fail(404, { error: "Job not found" });

  const existingMatch = await db.job_matches.findFirst({
    where: { profile: profileId, job: jobId },
  });

  if (existingMatch) {
    await db.job_matches.update({
      where: { id: existingMatch.id },
      data: { status: "saved", date_updated: new Date() },
    });
  } else {
    await db.job_matches.create({
      data: {
        profile: profileId,
        job: jobId,
        status: "saved",
        score: 0,
        date_created: new Date(),
        date_updated: new Date(),
      },
    });
  }

  return { success: true, action: "saved", jobId };
}

export async function unsaveJob(profileId: number, jobId: number) {
  const match = await db.job_matches.findFirst({
    where: { profile: profileId, job: jobId },
  });

  if (match) {
    if (match.score === 0 && !match.reasoning) {
      await db.job_matches.delete({ where: { id: match.id } });
    } else {
      await db.job_matches.update({
        where: { id: match.id },
        data: { status: "new", date_updated: new Date() },
      });
    }
  }

  return { success: true, action: "unsaved", jobId };
}

export async function rejectJob(profileId: number, jobId: number) {
  const job = await db.jobs.findUnique({ where: { id: jobId } });
  if (!job) return fail(404, { error: "Job not found" });

  const existingMatch = await db.job_matches.findFirst({
    where: { profile: profileId, job: jobId },
  });

  if (existingMatch) {
    await db.job_matches.update({
      where: { id: existingMatch.id },
      data: { status: "rejected", date_updated: new Date() },
    });
  } else {
    await db.job_matches.create({
      data: {
        profile: profileId,
        job: jobId,
        status: "rejected",
        score: 0,
        date_created: new Date(),
        date_updated: new Date(),
      },
    });
  }

  return { success: true, action: "rejected", jobId };
}

export async function unrejectJob(profileId: number, jobId: number) {
  const match = await db.job_matches.findFirst({
    where: { profile: profileId, job: jobId },
  });

  if (match) {
    if (match.score === 0 && !match.reasoning) {
      await db.job_matches.delete({ where: { id: match.id } });
    } else {
      await db.job_matches.update({
        where: { id: match.id },
        data: { status: "new", date_updated: new Date() },
      });
    }
  }

  return { success: true, action: "unrejected", jobId };
}
