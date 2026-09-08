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

import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { collected_data } from '$lib/server/db/schema';
import { exportProfile } from '$lib/server/profile/export';
import { PROFILE_ONLY_FLAG } from '$lib/profile-visibility';

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
	documentSafe: boolean
): Record<string, unknown> {
	const categories = data.tech_skill_categories;
	if (!Array.isArray(categories)) return data;

	return {
		...data,
		tech_skill_categories: categories.map((category) => {
			const skills = (category as Record<string, unknown>)?.tech_skills;
			if (!Array.isArray(skills)) return category;

			const kept = documentSafe
				? skills.filter((s) => !(s as Record<string, unknown>)?.[PROFILE_ONLY_FLAG])
				: skills;

			return {
				...(category as Record<string, unknown>),
				tech_skills: kept.map((skill) => {
					const { [PROFILE_ONLY_FLAG]: _flag, ...rest } = skill as Record<string, unknown>;
					return rest;
				})
			};
		})
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
 *
 * `exclude` is the same filter from the other end: keep everything EXCEPT these
 * keys. It exists because `fields` fails unsafely for a caller that wants most
 * of the blob — a key added to the export later is silently absent from an
 * allow-list, and the prompt quietly stops seeing evidence it used to have.
 * Applied after `fields`, so passing both means "these, minus those".
 */
export async function loadProfileData(
	profileId: number,
	fields?: string[],
	options?: { documentSafe?: boolean; exclude?: string[] }
): Promise<ProfileData> {
	let record = await db.query.collected_data.findFirst({
		where: eq(collected_data.profile_id, profileId),
		columns: { schema: true, data: true }
	});

	if (!record) {
		await exportProfile(profileId);
		record = await db.query.collected_data.findFirst({
			where: eq(collected_data.profile_id, profileId),
			columns: { schema: true, data: true }
		});
	}

	let schemaJson = record?.schema ? JSON.parse(record.schema) : {};
	let dataJson = applySkillVisibility(
		record?.data ? JSON.parse(record.data) : {},
		options?.documentSafe ?? false
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
					Object.entries(schemaJson.fields).filter(([k]) => fieldSet.has(k))
				);
			}
			if (schemaJson.relations) {
				filteredSchema.relations = Object.fromEntries(
					Object.entries(schemaJson.relations).filter(([k]) => fieldSet.has(k))
				);
			}
			schemaJson = filteredSchema;
		}
	}

	if (options?.exclude?.length) {
		const drop = new Set(options.exclude);
		dataJson = Object.fromEntries(Object.entries(dataJson).filter(([k]) => !drop.has(k)));
		if (schemaJson.fields || schemaJson.relations) {
			const filteredSchema: Record<string, unknown> = { ...schemaJson };
			if (schemaJson.fields) {
				filteredSchema.fields = Object.fromEntries(
					Object.entries(schemaJson.fields).filter(([k]) => !drop.has(k))
				);
			}
			if (schemaJson.relations) {
				filteredSchema.relations = Object.fromEntries(
					Object.entries(schemaJson.relations).filter(([k]) => !drop.has(k))
				);
			}
			schemaJson = filteredSchema;
		}
	}

	return { data: dataJson, schema: schemaJson };
}

/**
 * Blob keys that can never answer "does the candidate have this skill", removed
 * from `extract_matched_skills` so that prompt stops paying for them once per
 * job. Salary rows are excluded from match scoring by design, references are
 * somebody else's prose about the applicant, and the rest is contact PII this
 * question has no use for.
 *
 * A DROP list rather than a keep list, and that is the whole design: recall is
 * the sensitive direction here, so a field added to the export later must
 * arrive in this prompt by default and be removed deliberately, not go missing
 * because nobody remembered to add it to an allow-list.
 *
 * ## Why it stops here
 *
 * The obvious bigger cut is `cheat_sheets` + `project_stories`, 33% of the
 * compact blob between them. Measured instead of assumed (12 replayed pairs,
 * `temperature: 0`, against the pre-change prompt as baseline):
 *
 *   compact_full     lost 14  gained 15   21.1% smaller   <- noise floor
 *   drop_never       lost 12  gained  9   31.6% smaller   <- this list
 *   drop_cheatsheets lost 18  gained  8   46.5% smaller
 *   drop_stories     lost 16  gained  9   42.4% smaller
 *   drop_both        lost 24  gained 10   57.4% smaller
 *
 * `compact_full` changes no content at all, only whitespace and the position of
 * the job-skill list, and it still disagrees with the baseline 14 times: that is
 * this prompt's sensitivity to formatting, not a regression, and it is the bar
 * everything else has to clear. This list sits under it. Dropping cheat sheets
 * or stories does not, which fits what those fields hold — a skill named only in
 * an interview note or a STAR story is exactly the recall the LLM pass exists to
 * find, since `getProfileSkills` reads `tech_skills` and `languages` alone.
 */
/**
 * Blob keys `score_job_match` must not see, because a match score is supposed
 * to mean role fit and these cannot contribute to one.
 *
 * `salary_expectations` is the reason this exists. Salary is deliberately
 * excluded from match scoring -- the blend in matcher.ts leaves it out, and
 * eligibility filtering leaves it out, so that a high score means fit and
 * because most postings omit salary anyway. But the exclusion was only ever
 * implemented in the arithmetic. The applicant's 50 salary-prep rows were still
 * handed to the LLM inside the profile blob, so the half of the blend that is a
 * language model could weight them freely, and measurably did: dropping them
 * moved the score on 12 replayed scorings well past the temperature-0 noise
 * floor and flipped half the recommendation buckets.
 *
 * The rest is identity. A name and a nationality have no bearing on whether
 * someone fits a role and are exactly the inputs a scoring model should never
 * have; the contact fields carry no fit signal at all. `location` and
 * `location_timezone` STAY, because where someone is really does bear on a
 * commute or an overlapping working day.
 *
 * Dropping the identity FIELDS is not the same as scrubbing identity, and this
 * does not claim to. A name still reaches the model wherever the applicant's
 * own prose carries it -- the dev profile has an eponymous employer, "Rik
 * Wanders Software", sitting in work_experiences where it belongs. This removes
 * the fields that exist only to identify, not the ones that happen to.
 *
 * Expect existing scores to move when this lands. That is the point: they were
 * computed from inputs the design says do not belong in them.
 */
export const NON_FIT_FIELDS = [
	'email_address',
	'location_url',
	'name',
	'nationality',
	'phone_number',
	'salary_expectations'
];

export const NON_SKILL_FIELDS = [
	'email_address',
	'github_profile',
	'linkedin_profile',
	'location',
	'location_timezone',
	'location_url',
	'name',
	'nationality',
	'personal_website',
	'phone_number',
	'references',
	'salary_expectations',
	'stackoverflow_profile'
];

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
	budgetChars: number
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
export function formatTrimNote(dropped: ProfileTrim['dropped']): string {
	const parts = Object.entries(dropped).map(
		([field, { kept, total }]) => `${field}: showing ${kept} of ${total} (most relevant first)`
	);
	if (!parts.length) return '';
	return `\n\nNOTE: this profile was trimmed to fit — ${parts.join(
		'; '
	)}. Treat it as partial rather than complete.`;
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
