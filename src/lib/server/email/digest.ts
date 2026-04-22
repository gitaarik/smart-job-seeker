/**
 * Email Digest — HTML template and send logic
 *
 * Generates and sends a periodic email with top job matches for a profile.
 */

import { sendEmail } from "./index";

export interface DigestJob {
  id: number;
  title: string;
  company: string | null;
  score: number;
  match_summary: string | null;
  source_url: string | null;
}

export interface DigestOptions {
  to: string;
  profileName: string;
  jobs: DigestJob[];
  minScore: number;
  appUrl: string;
}

function scoreColor(score: number): string {
  if (score >= 90) return "#16a34a"; // green
  if (score >= 80) return "#2563eb"; // blue
  if (score >= 70) return "#d97706"; // amber
  return "#6b7280"; // gray
}

function buildDigestHtml(opts: DigestOptions): string {
  const jobRows = opts.jobs
    .map(
      (job) => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
        <div style="margin-bottom: 4px;">
          ${job.source_url
            ? `<a href="${job.source_url}" style="color: #2563eb; text-decoration: none; font-weight: 600; font-size: 15px;">${escapeHtml(job.title || "Untitled")}</a>`
            : `<span style="font-weight: 600; font-size: 15px; color: #111827;">${escapeHtml(job.title || "Untitled")}</span>`
          }
        </div>
        ${job.company ? `<div style="color: #6b7280; font-size: 13px; margin-bottom: 4px;">${escapeHtml(job.company)}</div>` : ""}
        ${job.match_summary ? `<div style="color: #4b5563; font-size: 13px; line-height: 1.4;">${escapeHtml(job.match_summary)}</div>` : ""}
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: top; white-space: nowrap;">
        <span style="display: inline-block; padding: 4px 10px; border-radius: 9999px; font-weight: 700; font-size: 13px; color: white; background-color: ${scoreColor(job.score)};">
          ${job.score}
        </span>
      </td>
    </tr>`,
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
    <div style="background-color: #1e40af; border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 22px; font-weight: 700;">
        Job Digest for ${escapeHtml(opts.profileName)}
      </h1>
      <p style="margin: 8px 0 0; color: #bfdbfe; font-size: 14px;">
        ${opts.jobs.length} job${opts.jobs.length === 1 ? "" : "s"} matching score ${opts.minScore}+
      </p>
    </div>

    <!-- Job list -->
    <div style="background-color: white; border-radius: 0 0 12px 12px; overflow: hidden;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f9fafb;">
            <th style="padding: 10px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">
              Job
            </th>
            <th style="padding: 10px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; width: 60px;">
              Score
            </th>
          </tr>
        </thead>
        <tbody>
          ${jobRows}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 24px; padding: 0 16px;">
      <a href="${opts.appUrl}/dashboard/jobs?minScore=${opts.minScore}" style="display: inline-block; padding: 10px 24px; background-color: #1e40af; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
        View all matches
      </a>
      <p style="margin-top: 16px; color: #9ca3af; font-size: 12px;">
        You're receiving this because email digests are enabled for your "${escapeHtml(opts.profileName)}" profile.
        <br />
        <a href="${opts.appUrl}/dashboard/export/settings" style="color: #9ca3af;">Manage preferences</a>
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
