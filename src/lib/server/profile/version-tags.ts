/**
 * Version slugs on item tags: carrying one through a rename, retiring one with
 * the version, and what retiring one would touch.
 *
 * Split from tailor-version.ts so the capability registry and the MCP tools can
 * reach them without that module and everything it imports.
 */
import { and, eq, sql, type SQL } from 'drizzle-orm';
import { dbDirect as db, queryRaw } from '$lib/server/db';
import { profile_versions, profiles } from '$lib/server/db/schema';
import { onlyOnVersion, renameTagSlug, retireVersionTag, tagSlug } from '$lib/profile-visibility';

function asStringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * Tables carrying a `tags` array that can name a version slug, with what ties a
 * row to one profile. `app-<id>` slugs are only unique per profile, so every
 * rewrite below has to be scoped — another applicant can hold the same one.
 */
const TAGGED_TABLES: {
	table: string;
	/** What a row is called on a page, and its name, for the impact of a delete. */
	kind: string;
	label: SQL;
	scope: (profileId: number) => SQL;
}[] = [
	{
		table: 'work_experiences',
		kind: 'Role',
		label: sql`concat_ws(' at ', position, name)`,
		scope: (p) => sql`profile_id = ${p}`
	},
	{
		table: 'education',
		kind: 'Education',
		label: sql`coalesce(institution, area)`,
		scope: (p) => sql`profile_id = ${p}`
	},
	{
		table: 'side_projects',
		kind: 'Side project',
		label: sql`name`,
		scope: (p) => sql`profile_id = ${p}`
	},
	{
		table: 'certificates',
		kind: 'Certificate',
		label: sql`name`,
		scope: (p) => sql`profile_id = ${p}`
	},
	{
		table: 'tech_skill_categories',
		kind: 'Skill group',
		label: sql`name`,
		scope: (p) => sql`profile_id = ${p}`
	},
	{
		table: 'tech_skills',
		kind: 'Skill',
		label: sql`name`,
		scope: (p) => sql`category_id IN (SELECT id FROM tech_skill_categories WHERE profile_id = ${p})`
	},
	{
		table: 'work_experience_achievements',
		kind: 'Bullet',
		label: sql`left(description, 90)`,
		scope: (p) =>
			sql`work_experience_id IN (SELECT id FROM work_experiences WHERE profile_id = ${p})`
	},
	{
		table: 'work_experience_technologies',
		kind: 'Technology',
		label: sql`name`,
		scope: (p) =>
			sql`work_experience_id IN (SELECT id FROM work_experiences WHERE profile_id = ${p})`
	}
];

/**
 * Point item tags naming `from` at `to` — or drop them, when `to` is null.
 *
 * A version is addressed by slug in two places: `applications.cv_version_sent`
 * and the `tags` array on every profile item. Promoting renames the slug and
 * discarding retires it, and following only the first left the second naming a
 * version that no longer existed — so a skill somebody had added to the
 * tailored version silently stopped printing on the document they added it to,
 * with nothing to see anywhere: the tag was still there, and still looked right.
 *
 * Retiring (`to` null) never widens an item. One tagged for this version
 * alone would otherwise lose its only version tag and print on every version,
 * so it goes to `moveTo` when given, and else off every document
 * (retireVersionTag). See versionDeleteImpact for the list a person decides on.
 *
 * Returns how many rows changed. The SQL only narrows the field — renameTagSlug
 * decides, and a row it leaves alone is not written — so the predicate being
 * approximate (it strips every leading `!`, where a tag means only the first)
 * costs a wasted read at most.
 */
export async function retagVersionSlug(
	profileId: number,
	from: string,
	to: string | null,
	moveTo: string | null = null
): Promise<number> {
	const slug = tagSlug(from);
	if (!slug) return 0;
	let touched = 0;

	for (const { table, scope } of TAGGED_TABLES) {
		const rows = await queryRaw<{ id: number; tags: unknown }>(
			sql`SELECT id, tags FROM ${sql.raw(table)}
			     WHERE ${scope(profileId)}
			       -- Some rows store a JSON null rather than a SQL NULL, and
			       -- jsonb_array_elements_text errors on anything but an array.
			       AND jsonb_typeof(tags::jsonb) = 'array'
			       AND EXISTS (
			             SELECT 1 FROM jsonb_array_elements_text(tags::jsonb) AS t(tag)
			              WHERE lower(btrim(ltrim(btrim(t.tag), '!'))) = ${slug}
			           )`
		);
		for (const row of rows) {
			const before = asStringArray(row.tags);
			const next =
				to === null ? retireVersionTag(before, slug, moveTo) : renameTagSlug(before, slug, to);
			if (next.length === before.length && next.every((tag, i) => tag === before[i])) continue;

			await queryRaw(
				sql`UPDATE ${sql.raw(table)}
				       SET tags = ${next.length > 0 ? JSON.stringify(next) : null}::json
				     WHERE id = ${row.id}`
			);
			touched += 1;
		}
	}

	return touched;
}

/** What deleting a version would touch, for the person deciding. */
export interface VersionDeleteImpact {
	/**
	 * Items whitelisted for this version alone. Deleting it moves them to
	 * another version or keeps them off every document; without that choice they
	 * would print on every version (retireVersionTag).
	 */
	onlyHere: { kind: string; label: string }[];
	/** Versions built on it: tailored resumes, or library versions extending it. */
	builtOnIt: number;
	/** Applications recorded as sent with it, which keep that record. */
	sentWith: number;
	publicResume: boolean;
	publicCv: boolean;
}

/** The impact of deleting a version, or null when the profile has no such version. */
export async function versionDeleteImpact(
	profileId: number,
	versionId: number
): Promise<VersionDeleteImpact | null> {
	const version = await db.query.profile_versions.findFirst({
		where: and(eq(profile_versions.id, versionId), eq(profile_versions.profile_id, profileId)),
		columns: { slug: true }
	});
	if (!version) return null;
	const slug = tagSlug(version.slug ?? '');

	const onlyHere: VersionDeleteImpact['onlyHere'] = [];
	let sentWith = 0;
	if (slug) {
		for (const { table, kind, label, scope } of TAGGED_TABLES) {
			const rows = await queryRaw<{ label: string | null; tags: unknown }>(
				sql`SELECT ${label} AS label, tags FROM ${sql.raw(table)}
				     WHERE ${scope(profileId)}
				       AND jsonb_typeof(tags::jsonb) = 'array'
				       AND EXISTS (
				             SELECT 1 FROM jsonb_array_elements_text(tags::jsonb) AS t(tag)
				              WHERE lower(btrim(t.tag)) = ${slug}
				           )`
			);
			for (const row of rows) {
				if (onlyOnVersion(asStringArray(row.tags), slug)) {
					onlyHere.push({ kind, label: (row.label ?? '').trim() });
				}
			}
		}
		const [sent] = await queryRaw<{ n: number }>(
			sql`SELECT count(*)::int AS n FROM applications
			     WHERE profile_id = ${profileId} AND lower(btrim(cv_version_sent)) = ${slug}`
		);
		sentWith = sent?.n ?? 0;
	}
	const [built] = await queryRaw<{ n: number }>(
		sql`SELECT count(*)::int AS n FROM profile_version_extensions WHERE extended_id = ${versionId}`
	);
	const profile = await db.query.profiles.findFirst({
		where: eq(profiles.id, profileId),
		columns: { public_resume_version_id: true, public_cv_version_id: true }
	});
	return {
		onlyHere,
		builtOnIt: built?.n ?? 0,
		sentWith,
		publicResume: profile?.public_resume_version_id === versionId,
		publicCv: profile?.public_cv_version_id === versionId
	};
}
