/**
 * The profile row's own texts, as an agent reaches them: title, subtitle,
 * headline, summary and About Me.
 *
 * Every other part of a profile is a section, a list of rows declared once in
 * `PROFILE_RESOURCES` and generated into verbs. These are columns on the
 * profile row itself, which is not a section (the PATCH handler in
 * `api/profile/[id]` says why it stays out of that declaration), so until
 * `edit_profile` they were the one part of a profile no agent could change —
 * and the texts most worth rewriting when someone goes after a different kind
 * of role.
 *
 * Five columns, not the row. Name, contact details, links and location sit on
 * the same page and are deliberately left out: an agent talked into swapping
 * the email address on someone's CV is the attack that matters on this row,
 * and nobody needs one to change their phone number. The slug is a public URL.
 */

import { eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { profiles } from '$lib/server/db/schema';
import { profileUpdateSchema } from '$lib/server/validation/api-schemas';

export const BASIC_INFO_COLUMNS = [
	'title',
	'subtitle',
	'headline',
	'summary',
	'about_me_text'
] as const;

export type BasicInfoColumn = (typeof BASIC_INFO_COLUMNS)[number];

export type BasicInfo = Record<BasicInfoColumn, string | null>;

/**
 * What these columns are called as one thing: the entity their translations are
 * stored under, and the prefix their field names carry (`profile.summary`).
 */
export const PROFILE_ROW = 'profile';

/** Where a person edits them, named as the profile navigation names it. */
export const BASIC_INFO_PAGE = { name: 'Basic Info', path: '/profile/edit' };

export function isBasicInfoColumn(column: string): column is BasicInfoColumn {
	return (BASIC_INFO_COLUMNS as readonly string[]).includes(column);
}

/**
 * The rule each column is held to on the page, which is the PATCH endpoint's
 * own schema: 255 characters for the three short ones (their `varchar` length),
 * longer for the summary and the bio.
 */
const BASIC_INFO_SCHEMA = profileUpdateSchema.pick({
	title: true,
	subtitle: true,
	headline: true,
	summary: true,
	about_me_text: true
});

/** Why this value cannot go in this column, or null when it can. */
export function basicInfoError(column: BasicInfoColumn, value: unknown): string | null {
	const checked = BASIC_INFO_SCHEMA.shape[column].safeParse(value);
	return checked.success ? null : (checked.error.issues[0]?.message ?? 'is not a valid value');
}

/** The five columns as they stand, or null when the profile does not exist. */
export async function readBasicInfo(profileId: number): Promise<BasicInfo | null> {
	const row = await db.query.profiles.findFirst({
		where: eq(profiles.id, profileId),
		columns: { title: true, subtitle: true, headline: true, summary: true, about_me_text: true }
	});
	return row ?? null;
}

/**
 * The write `PATCH /api/profile/[id]` makes when these are saved on the page:
 * the values, trimmed, with an empty one stored as null, and `date_updated`,
 * which is what tells the matcher its snapshot of the profile is stale.
 */
export async function writeBasicInfo(
	profileId: number,
	values: Partial<Record<BasicInfoColumn, unknown>>
): Promise<void> {
	const patch = Object.fromEntries(
		Object.entries(values).map(([column, value]) => {
			const text = typeof value === 'string' ? value.trim() : '';
			return [column, text === '' ? null : text];
		})
	);
	if (Object.keys(patch).length === 0) return;

	await db
		.update(profiles)
		.set({ ...patch, date_updated: new Date() })
		.where(eq(profiles.id, profileId));
}
