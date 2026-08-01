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
import { PROFILE_ONLY_FLAG } from "$lib/profile-visibility";

export interface ProfileData {
  data: Record<string, unknown>;
  schema: Record<string, unknown>;
}

/**
 * Resolve the held-back-skill marker the export leaves in the blob.
 *
 * Two prompts want opposite things from the same snapshot. Anything that writes
 * for the applicant — a cover letter, a STAR story — must not claim a skill
 * they deliberately kept off their documents. Anything that *analyses* them,
 * above all `score_job_match`, has to see every skill they have, or adding one
 * from a job and re-scoring reports it back as a gap.
 *
 * So the flag is stripped either way — no prompt should be reasoning about
 * document visibility — and `documentSafe` decides whether the skill goes with
 * it.
 */
export function applySkillVisibility(
  data: Record<string, unknown>,
  documentSafe: boolean,
): Record<string, unknown> {
  const categories = data.tech_skill_categories;
  if (!Array.isArray(categories)) return data;

  return {
    ...data,
    tech_skill_categories: categories.map((category) => {
      const skills = (category as Record<string, unknown>)?.tech_skills;
      if (!Array.isArray(skills)) return category;

      const kept = documentSafe
        ? skills.filter((s) =>
          !(s as Record<string, unknown>)?.[
            PROFILE_ONLY_FLAG
          ]
        )
        : skills;

      return {
        ...(category as Record<string, unknown>),
        tech_skills: kept.map((skill) => {
          const { [PROFILE_ONLY_FLAG]: _flag, ...rest } = skill as Record<
            string,
            unknown
          >;
          return rest;
        }),
      };
    }),
  };
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
 *
 * `documentSafe` drops skills the applicant keeps off their documents. Callers
 * that generate user-facing text set it; anything analysing the applicant must
 * not, or it reasons about a profile smaller than the real one.
 */
export async function loadProfileData(
  profileId: number,
  fields?: string[],
  options?: { documentSafe?: boolean },
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
  let dataJson = applySkillVisibility(
    record?.data ? JSON.parse(record.data) : {},
    options?.documentSafe ?? false,
  );

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

/** What a trim pass removed, for the note appended to the rendered blob. */
export interface ProfileTrim {
  data: Record<string, unknown>;
  /** field → how many entries survived out of how many there were. */
  dropped: Record<string, { kept: number; total: number }>;
}

/**
 * Trim a profile blob to a char budget by dropping ENTRIES from its largest
 * list fields — you cannot clip JSON mid-string, so this is the only safe axis.
 *
 * Lists come out of exportProfile ordered `asc(sort), desc(start_date)`: manual
 * drag-order first, then most recent. So the front is what matters and trimming
 * takes from the END — the oldest job goes before the current one.
 *
 * Scalars (name, title, summary) are never touched: they are tiny and they are
 * the applicant's identity. The blow-up is always the lists — on dev,
 * work_experiences alone is 22k of a 34k blob.
 */
export function fitProfileToBudget(
  data: Record<string, unknown>,
  budgetChars: number,
): ProfileTrim {
  const trimmed: Record<string, unknown> = { ...data };
  const totals = new Map<string, number>();
  for (const [key, value] of Object.entries(trimmed)) {
    if (Array.isArray(value)) totals.set(key, value.length);
  }

  while (JSON.stringify(trimmed).length > budgetChars) {
    // The biggest list with something left to give.
    let victim: string | null = null;
    let victimSize = 0;
    for (const [key, value] of Object.entries(trimmed)) {
      if (!Array.isArray(value) || value.length <= 1) continue;
      const size = JSON.stringify(value).length;
      if (size > victimSize) {
        victim = key;
        victimSize = size;
      }
    }
    // Nothing left to drop — the scalars alone exceed the budget. Better an
    // over-budget prompt than a profile with no identity in it.
    if (!victim) break;
    trimmed[victim] = (trimmed[victim] as unknown[]).slice(0, -1);
  }

  const dropped: Record<string, { kept: number; total: number }> = {};
  for (const [key, total] of totals) {
    const kept = (trimmed[key] as unknown[]).length;
    if (kept < total) dropped[key] = { kept, total };
  }
  return { data: trimmed, dropped };
}

/**
 * Tell the model the profile it just read is partial, so it doesn't conclude
 * the applicant simply has no earlier jobs. Mirrors the "NOTE: N further
 * record(s) exist" wording in application-records.ts.
 */
export function formatTrimNote(dropped: ProfileTrim["dropped"]): string {
  const parts = Object.entries(dropped).map(
    ([field, { kept, total }]) =>
      `${field}: showing ${kept} of ${total} (most relevant first)`,
  );
  if (!parts.length) return "";
  return `\n\nNOTE: this profile was trimmed to fit — ${
    parts.join("; ")
  }. Treat it as partial rather than complete.`;
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
