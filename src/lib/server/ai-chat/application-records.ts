/**
 * Render an application's interview records as prompt context.
 *
 * The point of storing recaps, feedback and transcripts as text is that the
 * next round can be prepared with knowledge of the previous ones — a cheat
 * sheet for round 3 should know what round 2 pushed on.
 */

import { db } from "$lib/server/db";
import { asc, eq } from "drizzle-orm";
import { application_records } from "$lib/server/db/schema";
import { getRecordTypeLabel } from "$lib/application-records";

/** Keep the injected block bounded — transcripts can be very long. */
const MAX_CHARS_PER_RECORD = 4000;
const MAX_RECORDS = 12;

export async function interviewRecordsText(
  applicationId: number,
): Promise<string> {
  let records;
  try {
    records = await db.query.application_records.findMany({
      where: eq(application_records.application_id, applicationId),
      // Oldest first: the model reads the rounds in the order they happened.
      orderBy: [
        asc(application_records.event_date),
        asc(application_records.date_created),
      ],
      limit: MAX_RECORDS,
    });
  } catch {
    // Context is a bonus, never a reason to fail the generation.
    return "";
  }

  const withContent = records.filter((r) => r.content?.trim());
  if (withContent.length === 0) return "";

  const blocks = withContent.map((r) => {
    const heading = [
      `### ${getRecordTypeLabel(r.record_type)}: ${r.title}`,
      r.step ? `Stage: ${r.step}` : null,
      r.event_date ? `Date: ${r.event_date}` : null,
    ].filter(Boolean).join("\n");

    const content = r.content!.trim();
    const truncated = content.length > MAX_CHARS_PER_RECORD
      ? `${content.slice(0, MAX_CHARS_PER_RECORD)}\n\n[…truncated]`
      : content;

    return `${heading}\n\n${truncated}`;
  });

  return [
    "## What has already happened in this application",
    "",
    "These are the applicant's own records of earlier rounds, feedback and",
    "correspondence. Use them: build on what was already discussed, address",
    "concerns that were raised, and do not re-prepare ground already covered.",
    "",
    blocks.join("\n\n---\n\n"),
  ].join("\n");
}
