/**
 * The job a generation is about, rendered as prompt context.
 *
 * This lived as a private `formatJobDetails` copy-pasted into
 * application-letter-followup.ts and application-question-followup.ts, which is
 * how the *initial* application-question path ended up interpolating a bare
 * `job_description` while its own follow-up turn got title, company and company
 * description too. One copy, one shape, every caller.
 */

import { db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { applications, jobs } from "$lib/server/db/schema";

export interface JobDetailsRow {
  title: string | null;
  job_description: string | null;
  company_description: string | null;
  job_poster: string | null;
  /** Fallback when the scraper didn't capture a poster. */
  company?: string | null;
}

/** Format job data as readable text for prompts. */
export function formatJobDetails(job: JobDetailsRow): string {
  const lines: string[] = [`**Position:** ${job.title || "Not specified"}`];

  const employer = job.job_poster || job.company;
  if (employer) {
    lines.push(
      `**Company/Organization:** ${employer} (this is who the applicant is applying to)`,
    );
  }
  if (job.company_description) {
    lines.push(`**About the company:** ${job.company_description}`);
  }
  lines.push(
    "",
    "**Job Description:**",
    job.job_description || "Not specified",
  );

  return lines.join("\n");
}

const JOB_COLUMNS = {
  title: true,
  job_description: true,
  company_description: true,
  job_poster: true,
  company: true,
} as const;

/**
 * Load the job behind an application (or a job directly) and render it.
 * Returns "" when there is no job attached — callers interpolate it blindly.
 */
export async function jobDetailsText(
  ref: { applicationId: number } | { jobId: number },
): Promise<string> {
  try {
    if ("jobId" in ref) {
      const job = await db.query.jobs.findFirst({
        where: eq(jobs.id, ref.jobId),
        columns: JOB_COLUMNS,
      });
      return job ? formatJobDetails(job) : "";
    }

    const application = await db.query.applications.findFirst({
      where: eq(applications.id, ref.applicationId),
      columns: { id: true },
      with: { job: { columns: JOB_COLUMNS } },
    });
    return application?.job ? formatJobDetails(application.job) : "";
  } catch {
    // Context is a bonus, never a reason to fail the generation.
    return "";
  }
}
