/**
 * Email Digest — HTML template and send logic
 *
 * Generates and sends a periodic email with top job matches for a profile.
 */

import { sendEmail } from "./index";
import { getScoreGradient } from "$lib/score-colors";

export interface DigestJob {
  id: number;
  title: string;
  company: string | null;
  score: number;
  source_url: string | null;
  office_location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  work_location: string[] | null;
  job_types: string[] | null;
  experience_levels: string[] | null;
  skills_required: string[] | null;
  skills_preferred: string[] | null;
  matched_skills: string[] | null;
  job_description: string | null;
}

export interface DigestOptions {
  to: string;
  profileName: string;
  jobs: DigestJob[];
  minScore: number;
  appUrl: string;
}

function formatSalary(
  min: number | null,
  max: number | null,
  currency: string | null,
  period: string | null,
): string {
  if (!min && !max) return "";
  const curr = currency || "USD";
  // Simple formatting for email (no Intl in all runtimes)
  const fmt = (n: number) => {
    const sym = curr === "EUR" ? "€" : curr === "GBP" ? "£" : curr === "USD" ? "$" : `${curr} `;
    return `${sym}${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  };
  let result = "";
  if (min && max && min === max) {
    result = fmt(min);
  } else if (min && max) {
    result = `${fmt(min)} – ${fmt(max)}`;
  } else if (min) {
    result = `From ${fmt(min)}`;
  } else if (max) {
    result = `Up to ${fmt(max)}`;
  }
  if (result && period) {
    result += ` / ${period}`;
  }
  return result;
}

function pillHtml(text: string, bgColor: string, textColor: string): string {
  return `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; background-color: ${bgColor}; color: ${textColor}; margin: 2px 2px 2px 0;">${escapeHtml(text)}</span>`;
}

function skillPillHtml(skill: string, isMatched: boolean): string {
  if (isMatched) {
    return `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; background-color: #dcfce7; color: #16a34a; margin: 2px 2px 2px 0;">&#10003; ${escapeHtml(skill)}</span>`;
  }
  return `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; background-color: #f3f4f6; color: #374151; margin: 2px 2px 2px 0;">${escapeHtml(skill)}</span>`;
}

function buildDigestHtml(opts: DigestOptions): string {
  const jobCards = opts.jobs
    .map(
      (job) => {
        const salary = formatSalary(job.salary_min, job.salary_max, job.salary_currency, job.salary_period);
        const scoreColors = getScoreGradient(job.score);
        const pills: string[] = [];
        if (job.work_location) {
          for (const loc of job.work_location) pills.push(pillHtml(loc, "#ede9fe", "#6d28d9"));
        }
        if (job.job_types) {
          for (const t of job.job_types) pills.push(pillHtml(t, "#dbeafe", "#1d4ed8"));
        }
        if (job.experience_levels) {
          for (const e of job.experience_levels) pills.push(pillHtml(e, "#fef3c7", "#92400e"));
        }

        const matchedSet = new Set((job.matched_skills ?? []).map((s) => s.toLowerCase()));

        const requiredSkillPills = (job.skills_required ?? []).slice(0, 10)
          .map((s) => skillPillHtml(s, matchedSet.has(s.toLowerCase())))
          .join("");
        const moreRequired = (job.skills_required ?? []).length > 10
          ? `<span style="font-size: 11px; color: #9ca3af; margin-left: 2px;">+${(job.skills_required?.length ?? 0) - 10} more</span>`
          : "";

        const preferredSkillPills = (job.skills_preferred ?? []).slice(0, 10)
          .map((s) => skillPillHtml(s, matchedSet.has(s.toLowerCase())))
          .join("");
        const morePreferred = (job.skills_preferred ?? []).length > 10
          ? `<span style="font-size: 11px; color: #9ca3af; margin-left: 2px;">+${(job.skills_preferred?.length ?? 0) - 10} more</span>`
          : "";

        const description = job.job_description
          ? escapeHtml(job.job_description.slice(0, 300)) + (job.job_description.length > 300 ? "…" : "")
          : "";

        return `
      <div style="background-color: white; border-radius: 8px; margin-bottom: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        <!-- Header row -->
        <div style="padding: 16px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align: top;">
              <div style="margin-bottom: 4px;">
                <a href="${opts.appUrl}/jobs/${job.id}" style="color: #2563eb; text-decoration: none; font-weight: 600; font-size: 15px;">${escapeHtml(job.title || "Untitled")}</a>
              </div>
              <!-- Company & Location -->
              <div style="font-size: 13px; color: #6b7280; margin-bottom: 6px;">
                ${job.company ? escapeHtml(job.company) : ""}${job.company && job.office_location ? " · " : ""}${job.office_location ? escapeHtml(job.office_location) : ""}
              </div>
              <!-- Category pills -->
              ${pills.length > 0 ? `<div style="margin-bottom: 6px;">${pills.join("")}</div>` : ""}
              <!-- Salary -->
              ${salary ? `<div style="font-size: 13px; color: #16a34a; font-weight: 500;">${escapeHtml(salary)}</div>` : ""}
            </td>
            <td style="vertical-align: top; text-align: right; width: 50px; padding-left: 12px;">
              <div style="width: 48px; height: 48px; border-radius: 8px; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; background-color: ${scoreColors.bg}; color: ${scoreColors.text};${scoreColors.glow ? ` box-shadow: ${scoreColors.glow};` : ""}">
                <span style="font-weight: 700; font-size: 18px; line-height: 1;">${job.score}%</span>
              </div>
            </td>
          </tr></table>
        </div>

        ${(requiredSkillPills || preferredSkillPills || description) ? `
        <!-- Details -->
        <div style="padding: 0 16px 16px; border-top: 1px solid #f3f4f6;">
          ${requiredSkillPills ? `
          <div style="padding-top: 10px;">
            <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Required Skills</div>
            ${requiredSkillPills}${moreRequired}
          </div>` : ""}
          ${preferredSkillPills ? `
          <div style="padding-top: 10px;">
            <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Preferred Skills</div>
            ${preferredSkillPills}${morePreferred}
          </div>` : ""}
          ${description ? `
          <div style="padding-top: 10px;">
            <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Description</div>
            <div style="font-size: 12px; color: #4b5563; line-height: 1.5; white-space: pre-wrap;">${description}</div>
          </div>` : ""}
        </div>` : ""}
      </div>`;
      },
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">
    <!-- Header -->
    <div style="background-color: #1e40af; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 16px;">
      <h1 style="margin: 0; color: white; font-size: 22px; font-weight: 700;">
        Job Digest for ${escapeHtml(opts.profileName)}
      </h1>
      <p style="margin: 8px 0 0; color: #bfdbfe; font-size: 14px;">
        ${opts.jobs.length} job${opts.jobs.length === 1 ? "" : "s"} matching score ${opts.minScore}+
      </p>
    </div>

    <!-- Job cards -->
    ${jobCards}

    <!-- Footer -->
    <div style="text-align: center; margin-top: 24px; padding: 0 16px;">
      <a href="${opts.appUrl}/jobs?minScore=${opts.minScore}" style="display: inline-block; padding: 10px 24px; background-color: #1e40af; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
        View all matches
      </a>
      <p style="margin-top: 16px; color: #9ca3af; font-size: 12px;">
        You're receiving this because email digests are enabled for your "${escapeHtml(opts.profileName)}" profile.
        <br />
        <a href="${opts.appUrl}/jobs/import/notifications" style="color: #9ca3af;">Manage preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendDigestEmail(opts: DigestOptions): Promise<void> {
  const html = buildDigestHtml(opts);
  const subject = `${opts.jobs.length} new job match${opts.jobs.length === 1 ? "" : "es"} for ${opts.profileName}`;

  await sendEmail({
    to: opts.to,
    subject,
    html,
    type: "digest",
    metadata: { profileName: opts.profileName, jobCount: opts.jobs.length, minScore: opts.minScore },
  });
}
