/**
 * The library's resume versions: create, rename, delete and make public, with
 * the rules every caller keeps, the version pages and the MCP tools alike.
 *
 * A slug is a reference, not a label: item tags and `applications.cv_version_sent`
 * name a version by it. So a slug is unique on its profile (compared without
 * case, as tags are), never one a tag would read as something else
 * (isReservedVersionSlug), carried to both on a rename, and retired on a delete
 * without widening an item (retagVersionSlug).
 */
import { and, asc, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import {
	applications,
	profile_version_extensions,
	profile_versions,
	profiles
} from '$lib/server/db/schema';
import { isReservedVersionSlug, isTailoredSlug } from '$lib/version-overrides';
import { retagVersionSlug } from './version-tags';

/** A rule a version change broke, worded for the person who asked for it. */
export class VersionError extends Error {}

export interface LibraryVersion {
	id: number;
	slug: string;
	name: string | null;
	publicResume: boolean;
	publicCv: boolean;
}

/** A slug from a name, the way the create form has always derived one. */
export function slugFromName(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/[\s_]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** Why `slug` cannot name a version on this profile, or null when it can. */
export async function slugProblem(
	profileId: number,
	slug: string,
	exceptId?: number
): Promise<string | null> {
	const trimmed = slug.trim();
	if (!trimmed) return 'A version needs a name or a slug.';
	if (isReservedVersionSlug(trimmed)) {
		return isTailoredSlug(trimmed.toLowerCase())
			? 'Slugs starting with "app-<number>" are reserved for job-tailored versions.'
			: `"${trimmed}" is reserved: it names a base template, which item tags use to choose where they appear.`;
	}
	const clash = await db.query.profile_versions.findFirst({
		where: and(
			eq(profile_versions.profile_id, profileId),
			sql`lower(btrim(${profile_versions.slug})) = ${trimmed.toLowerCase()}`,
			...(exceptId === undefined ? [] : [ne(profile_versions.id, exceptId)])
		),
		columns: { id: true }
	});
	return clash ? `Another version already uses the slug "${trimmed}".` : null;
}

/** The profile's library versions (none made for one application), by name. */
export async function listLibraryVersions(profileId: number): Promise<LibraryVersion[]> {
	const [rows, profile] = await Promise.all([
		db.query.profile_versions.findMany({
			where: and(
				eq(profile_versions.profile_id, profileId),
				isNull(profile_versions.application_id)
			),
			columns: { id: true, slug: true, name: true },
			orderBy: asc(profile_versions.name)
		}),
		db.query.profiles.findFirst({
			where: eq(profiles.id, profileId),
			columns: { public_resume_version_id: true, public_cv_version_id: true }
		})
	]);
	return rows.map((row) => ({
		id: row.id,
		slug: (row.slug ?? '').trim(),
		name: row.name,
		publicResume: profile?.public_resume_version_id === row.id,
		publicCv: profile?.public_cv_version_id === row.id
	}));
}

async function ownedVersion(profileId: number, id: number) {
	const version = await db.query.profile_versions.findFirst({
		where: and(eq(profile_versions.id, id), eq(profile_versions.profile_id, profileId)),
		columns: { id: true, slug: true, name: true, application_id: true }
	});
	if (!version) throw new VersionError('That version does not exist on this profile.');
	return version;
}

/** Make a library version. The slug is the name's unless one is given. */
export async function createVersion(
	profileId: number,
	input: { name?: string | null; slug?: string | null }
): Promise<{ id: number; slug: string; name: string | null }> {
	const name = input.name?.trim() || null;
	const slug = input.slug?.trim() || slugFromName(name ?? '');
	const problem = await slugProblem(profileId, slug);
	if (problem) throw new VersionError(problem);

	const [created] = await db
		.insert(profile_versions)
		.values({ slug, name, profile_id: profileId, date_created: new Date() })
		.returning({ id: profile_versions.id });
	return { id: created.id, slug, name };
}

/**
 * Rename a version, its slug included when one is given.
 *
 * A changed slug is carried to what names the version by it: the record of
 * which document an application sent, and the tags on every profile item.
 * Renaming without them broke both silently.
 */
export async function renameVersion(
	profileId: number,
	id: number,
	input: { name?: string | null; slug?: string | null }
): Promise<{
	before: { name: string | null; slug: string | null };
	after: { name: string | null; slug: string | null };
}> {
	const existing = await ownedVersion(profileId, id);
	const name = input.name === undefined ? existing.name : input.name?.trim() || null;
	const slug = input.slug?.trim() || existing.slug;
	if (slug !== existing.slug) {
		const problem = await slugProblem(profileId, slug ?? '', id);
		if (problem) throw new VersionError(problem);
	}

	await db
		.update(profile_versions)
		.set({ name, slug, date_updated: new Date() })
		.where(eq(profile_versions.id, id));

	if (existing.slug && slug && slug !== existing.slug) {
		await db
			.update(applications)
			.set({ cv_version_sent: slug, date_updated: new Date() })
			.where(
				and(eq(applications.profile_id, profileId), eq(applications.cv_version_sent, existing.slug))
			);
		await retagVersionSlug(profileId, existing.slug, slug);
	}

	return {
		before: { name: existing.name, slug: existing.slug },
		after: { name, slug }
	};
}

/**
 * Delete a version.
 *
 * Items tagged for it alone go to `moveTo` (another library version's slug),
 * or with none given stay off every document; see versionDeleteImpact for the
 * list to decide on. Applications sent with it keep that record: deleting a
 * document does not un-send it.
 */
export async function deleteVersion(
	profileId: number,
	id: number,
	moveTo: string | null = null
): Promise<void> {
	const existing = await ownedVersion(profileId, id);

	let moveToSlug: string | null = null;
	if (moveTo?.trim()) {
		const target = (await listLibraryVersions(profileId)).find(
			(v) => v.id !== id && v.slug.toLowerCase() === moveTo.trim().toLowerCase()
		);
		if (!target)
			throw new VersionError(`There is no other version "${moveTo.trim()}" to move them to.`);
		moveToSlug = target.slug;
	}

	const profile = await db.query.profiles.findFirst({
		where: eq(profiles.id, profileId),
		columns: { public_resume_version_id: true, public_cv_version_id: true }
	});
	const unpublish: { public_resume_version_id?: null; public_cv_version_id?: null } = {};
	if (profile?.public_resume_version_id === id) unpublish.public_resume_version_id = null;
	if (profile?.public_cv_version_id === id) unpublish.public_cv_version_id = null;
	if (Object.keys(unpublish).length > 0) {
		await db.update(profiles).set(unpublish).where(eq(profiles.id, profileId));
	}

	await db
		.delete(profile_version_extensions)
		.where(
			or(
				eq(profile_version_extensions.extender_id, id),
				eq(profile_version_extensions.extended_id, id)
			)
		);
	await db.delete(profile_versions).where(eq(profile_versions.id, id));

	// Overrides cascade with the row; tags naming its slug do not, and a later
	// version reusing the slug would inherit them.
	if (existing.slug) await retagVersionSlug(profileId, existing.slug, null, moveToSlug);
}

/**
 * Make a library version the public resume, the public CV, or both: what the
 * profile sends when nobody names a version, and what tailoring builds on.
 * Returns what they were, for an undo.
 */
export async function setPublicVersion(
	profileId: number,
	id: number,
	which: { resume?: boolean; cv?: boolean }
): Promise<{ resume: number | null; cv: number | null }> {
	const existing = await ownedVersion(profileId, id);
	if (existing.application_id !== null) {
		throw new VersionError('A version made for one application cannot be the public one.');
	}
	const profile = await db.query.profiles.findFirst({
		where: eq(profiles.id, profileId),
		columns: { public_resume_version_id: true, public_cv_version_id: true }
	});
	const before = {
		resume: profile?.public_resume_version_id ?? null,
		cv: profile?.public_cv_version_id ?? null
	};
	const update: { public_resume_version_id?: number; public_cv_version_id?: number } = {};
	if (which.resume) update.public_resume_version_id = id;
	if (which.cv) update.public_cv_version_id = id;
	if (Object.keys(update).length > 0) {
		await db.update(profiles).set(update).where(eq(profiles.id, profileId));
	}
	return before;
}

/** Put back the public resume, the public CV or both, as recorded before a change. */
export async function restorePublicVersions(
	profileId: number,
	before: { resume?: number | null; cv?: number | null }
): Promise<void> {
	const update: { public_resume_version_id?: number | null; public_cv_version_id?: number | null } =
		{};
	if ('resume' in before) update.public_resume_version_id = before.resume ?? null;
	if ('cv' in before) update.public_cv_version_id = before.cv ?? null;
	if (Object.keys(update).length === 0) return;
	await db.update(profiles).set(update).where(eq(profiles.id, profileId));
}
