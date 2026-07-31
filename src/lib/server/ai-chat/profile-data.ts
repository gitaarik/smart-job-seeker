/**
 * Loading and field-filtering of the `collected_data` profile blob — the
 * `${data}` / `${schema}` pair every prompt interpolates.
 *
 * Lifted out of createAndGenerateAiChat so the context provider's `profile`
 * source can render the same blob from the same code. Before this, the profile
 * blob was the one piece of prompt evidence the budgeter could not see: it is
 * routinely the largest block in the prompt, yet `fitToBudget` only ever got to
 * trim the smaller retrieval blocks around it.
 */

import { db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { collected_data } from "$lib/server/db/schema";
import { exportProfile } from "$lib/server/profile/export";

export interface ProfileData {
  data: Record<string, unknown>;
  schema: Record<string, unknown>;
}

/**
 * Fetch a profile's collected_data, optionally narrowed to `fields`.
 *
 * Manually-created profiles don't have a record until something explicitly
 * calls exportProfile, so this backfills on first use — better than every AI
 * feature getting `{}` and silently hallucinating.
 *
 * `fields` filters both data and schema to the requested top-level keys. An
 * empty array means "no profile data at all"; `undefined` means "everything".
 */
export async function loadProfileData(
  profileId: number,
  fields?: string[],
): Promise<ProfileData> {
  let record = await db.query.collected_data.findFirst({
    where: eq(collected_data.profile_id, profileId),
    columns: { schema: true, data: true },
  });

  if (!record) {
    await exportProfile(profileId);
    record = await db.query.collected_data.findFirst({
      where: eq(collected_data.profile_id, profileId),
      columns: { schema: true, data: true },
    });
  }

  let schemaJson = record?.schema ? JSON.parse(record.schema) : {};
  let dataJson = record?.data ? JSON.parse(record.data) : {};

  if (fields) {
    if (fields.length === 0) {
      return { data: {}, schema: {} };
    }

    const fieldSet = new Set(fields);

    // Filter data: keep only requested top-level keys.
    const filteredData: Record<string, unknown> = {};
    for (const key of fields) {
      if (key in dataJson) filteredData[key] = dataJson[key];
    }
    dataJson = filteredData;

    // Filter schema: keep only matching fields and relations.
    if (schemaJson.fields || schemaJson.relations) {
      const filteredSchema: Record<string, unknown> = { ...schemaJson };
      if (schemaJson.fields) {
        filteredSchema.fields = Object.fromEntries(
          Object.entries(schemaJson.fields).filter(([k]) => fieldSet.has(k)),
        );
      }
      if (schemaJson.relations) {
        filteredSchema.relations = Object.fromEntries(
          Object.entries(schemaJson.relations).filter(([k]) => fieldSet.has(k)),
        );
      }
      schemaJson = filteredSchema;
    }
  }

  return { data: dataJson, schema: schemaJson };
}

/**
 * Render a profile blob for interpolation.
 *
 * Compact, not pretty-printed: indentation is ~30% of the blob (measured on dev
 * — 48,454 chars pretty vs 33,922 compact) and only a human reader benefits
 * from it. Same JSON either way, so the model sees identical structure; the
 * only real cost is that `ai_chats.full_prompt` is harder to eyeball in the
 * admin viewer.
 *
 * This is the input to EVERY AI feature, so changes here are `llm:smoke`
 * territory rather than something to fold into an unrelated commit.
 */
export function renderProfileData(data: Record<string, unknown>): string {
  return JSON.stringify(data);
}
