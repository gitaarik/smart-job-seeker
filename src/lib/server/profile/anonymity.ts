/**
 * What an anonymous document leaves out. See $lib/resume-anonymity.ts for what
 * one is for and where the decision is stored.
 *
 * Done to the tree before a page is serialised (pageProfile), not in the
 * renderers: a page that only stopped printing the name would still carry it in
 * its source, and a share link's source is as readable as its text.
 *
 * The fields are the easy part. Most of what named the applicant on the first
 * anonymous CV made here was prose sitting in ordinary places: an employer
 * called "Rik Wanders Software", testimonials that begin with the applicant's
 * first name, project links under their GitHub handle. The rules below take what can be
 * decided without reading prose (the applicant's own business, links that lead
 * to them, referees) and the leak check reads the PDF for the rest
 * (anonymity-check.ts).
 */

import { and, eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { applications, profile_versions, profiles } from '$lib/server/db/schema';
import { isAnonymous } from '$lib/resume-anonymity';
import { templateLabel } from '$lib/resume-template-labels';
import type { ResumeTemplate } from '$lib/resume-templates';
import { versionChain } from '$lib/server/profile/skill-words';

interface ChainVersion {
	id: number;
	toggles?: unknown;
	extension_links?: ReadonlyArray<{ extended_id: number | null }> | null;
}

/** Whether the document for `versionId` is anonymous: it, or a version it builds on, says so. */
export function isAnonymousChain(
	versions: ReadonlyArray<ChainVersion>,
	versionId: number | null | undefined
): boolean {
	if (!versionId) return false;
	const byId = new Map(versions.map((version) => [version.id, version]));
	return versionChain(versions, versionId).some((id) => isAnonymous(byId.get(id)?.toggles));
}

/** The same, for a caller that has a version's slug and no tree (the PDF render). */
export async function isAnonymousVersion(profileId: number, slug: string): Promise<boolean> {
	const versions = await db.query.profile_versions.findMany({
		where: eq(profile_versions.profile_id, profileId),
		columns: { id: true, slug: true, toggles: true },
		with: { extension_links: { columns: { extended_id: true } } }
	});
	const root = versions.find((version) => version.slug === slug);
	return root ? isAnonymousChain(versions, root.id) : false;
}

/**
 * The version this one is anonymous through without saying so itself: one it
 * builds on, by name. Null when it says so itself or is not anonymous at all.
 */
export async function anonymousThrough(
	profileId: number,
	versionId: number
): Promise<string | null> {
	const versions = await db.query.profile_versions.findMany({
		where: eq(profile_versions.profile_id, profileId),
		columns: { id: true, slug: true, name: true, toggles: true },
		with: { extension_links: { columns: { extended_id: true } } }
	});
	const byId = new Map(versions.map((version) => [version.id, version]));
	const ancestor = versionChain(versions, versionId)
		.slice(1)
		.map((id) => byId.get(id))
		.find((version) => isAnonymous(version?.toggles));
	return ancestor ? ancestor.name || ancestor.slug : null;
}

/**
 * The version and every version built on it, by slug: the documents whose
 * anonymity a change to this one decides.
 */
export async function anonymityReach(profileId: number, versionId: number): Promise<string[]> {
	const versions = await db.query.profile_versions.findMany({
		where: eq(profile_versions.profile_id, profileId),
		columns: { id: true, slug: true },
		with: { extension_links: { columns: { extended_id: true } } }
	});
	return versions
		.filter((version) => versionChain(versions, version.id).includes(versionId))
		.flatMap((version) => (version.slug ? [version.slug] : []));
}

/** What names the applicant, read off the profile row before a page drops any of it. */
export interface Identity {
	name: string | null;
	companyName: string | null;
	/**
	 * What a link that leads to the applicant contains: their handle on each
	 * site they list (GitHub, LinkedIn, Stack Overflow, npm, PyPI) and their own
	 * website's host. Lowercase.
	 */
	linkMarks: string[];
}

const text = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() ? value.trim() : null;

/** The handle in a profile URL: its last path segment that is not a number. */
function handleOf(url: string | null): string | null {
	if (!url) return null;
	try {
		const segments = new URL(url).pathname
			.split('/')
			.map((s) => s.replace(/^~/, '').trim().toLowerCase())
			.filter((s) => s && !/^\d+$/.test(s) && s !== 'in' && s !== 'user' && s !== 'users');
		return segments.at(-1) ?? null;
	} catch {
		return null;
	}
}

function hostOf(url: string | null): string | null {
	if (!url) return null;
	try {
		return new URL(url).hostname.toLowerCase().replace(/^www\./, '') || null;
	} catch {
		return null;
	}
}

export function identityOf(profile: object): Identity {
	const row = profile as Record<string, unknown>;
	const handles = [
		row.github_profile,
		row.linkedin_profile,
		row.stackoverflow_profile,
		row.npm_profile,
		row.pypi_profile
	].map((url) => handleOf(text(url)));
	const marks = [...handles, hostOf(text(row.personal_website))].filter(
		// Short marks match too much of an unrelated URL to stand for a person.
		(mark): mark is string => !!mark && mark.length >= 4
	);
	return {
		name: text(row.name),
		companyName: text(row.company_name),
		linkMarks: [...new Set(marks)]
	};
}

/** Lowercase, accents off, one space between words: how two spellings of a name are compared. */
export function foldText(value: string): string {
	return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Whether an employer is the applicant's own business: the company name on
 * their profile, or a name that contains their full name ("Rik Wanders
 * Software"). Not their first or last name alone, which an unrelated company
 * can contain; the leak check reports those instead of this guessing.
 */
export function isOwnBusiness(employer: unknown, identity: Identity): boolean {
	const name = text(employer);
	if (!name) return false;
	const folded = foldText(name);
	if (identity.companyName && folded === foldText(identity.companyName)) return true;
	const fullName = identity.name ? foldText(identity.name) : '';
	if (!fullName.includes(' ')) return false;
	return ` ${folded.replace(/[^\p{L}\p{N}]+/gu, ' ')} `.includes(
		` ${fullName.replace(/[^\p{L}\p{N}]+/gu, ' ')} `
	);
}

/** Whether a link leads to the applicant: it carries one of their handles or their own host. */
export function leadsToApplicant(url: unknown, identity: Identity): boolean {
	const link = text(url)?.toLowerCase();
	return !!link && identity.linkMarks.some((mark) => link.includes(mark));
}

/**
 * The profile row's fields that say who the applicant is or where they live.
 * An anonymous page carries none of them; the private columns are already gone
 * by the time this runs (page-profile.ts).
 */
const IDENTITY_COLUMNS = [
	'name',
	// The applicant's name as a URL. Nothing on the page reads it, and a share
	// link's own address still carries it, which is why the card says to send
	// an anonymous document as a file.
	'slug',
	'email_address',
	'phone_number',
	'personal_website',
	'linkedin_profile',
	'github_profile',
	'stackoverflow_profile',
	'npm_profile',
	'pypi_profile',
	'nationality',
	'location',
	'location_url',
	'location_timezone',
	'country_code',
	'profile_photo_path',
	'meta_image_url',
	'about_me_text'
] as const;

type Row = Record<string, unknown>;
const rows = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : []);

/** A row with the links that lead to the applicant taken off. */
function withoutOwnLinks(row: Row, identity: Identity, keys: string[]): Row {
	const changed = keys.filter((key) => leadsToApplicant(row[key], identity));
	if (changed.length === 0) return row;
	return { ...row, ...Object.fromEntries(changed.map((key) => [key, null])) };
}

/**
 * Take who the applicant is out of a page tree.
 *
 * Replaces what it changes rather than editing it, so the tree the route
 * loaded (and the shared rows inside it) is left as it was.
 */
export function anonymiseTree(page: Row, identity: Identity, locale: string | null): void {
	for (const column of IDENTITY_COLUMNS) {
		if (column in page) page[column] = null;
	}

	// A referee is a named person who knows the applicant, and the testimonial
	// usually names them too. Highlights print on no document, and are prose.
	page.references = [];
	page.highlights = [];

	const ownBusiness = templateLabel('ownBusiness', locale);
	page.work_experiences = rows(page.work_experiences).map((role) => {
		const projects = rows(role.work_experience_projects).map((project) =>
			withoutOwnLinks(project, identity, ['url', 'repo_url'])
		);
		if (!isOwnBusiness(role.name, identity)) {
			return {
				...withoutOwnLinks(role, identity, ['website']),
				work_experience_projects: projects
			};
		}
		// Its location is where the applicant lives, more often than not, and its
		// site and logo carry the name it no longer prints.
		return {
			...role,
			name: ownBusiness,
			location: null,
			website: null,
			logo_path: null,
			banner_path: null,
			work_experience_projects: projects
		};
	});

	page.side_projects = rows(page.side_projects).map((project) =>
		withoutOwnLinks(project, identity, ['url', 'repo_url'])
	);

	// A certificate's link and credential id open a page in the applicant's name.
	page.certificates = rows(page.certificates).map((certificate) => ({
		...certificate,
		url: null,
		credential_id: null
	}));
}

/**
 * The profile blob a writer reads (collected_data) without who the applicant
 * is, for a letter or an answer to an application read without names.
 *
 * The same rules as a page (anonymiseTree), over the blob's own shape, which
 * has no columns a page lacks to begin with: the writer is never told the name,
 * so it cannot sign with it.
 */
export function anonymiseProfileData(
	data: Record<string, unknown>,
	identity: Identity
): Record<string, unknown> {
	const out: Row = { ...data };
	for (const key of IDENTITY_COLUMNS) delete out[key];
	delete out.references;
	out.work_experiences = rows(out.work_experiences).map((role) => {
		const projects = rows(role.work_experience_projects).map((project) =>
			withoutOwnLinks(project, identity, ['url', 'repo_url'])
		);
		if (!isOwnBusiness(role.name, identity)) {
			return {
				...withoutOwnLinks(role, identity, ['website']),
				work_experience_projects: projects
			};
		}
		return {
			...role,
			name: templateLabel('ownBusiness', null),
			location: null,
			website: null,
			work_experience_projects: projects
		};
	});
	out.side_projects = rows(out.side_projects).map((project) =>
		withoutOwnLinks(project, identity, ['url', 'repo_url'])
	);
	out.certificates = rows(out.certificates).map((certificate) => ({
		...certificate,
		url: null,
		credential_id: null
	}));
	return out;
}

/**
 * The prompts whose text goes to the employer: a cover letter and an answer to
 * one of their questions, and the advice and reviews on both. Not a cheat
 * sheet, which is the applicant's own, and not a follow-up, which is written
 * once the employer has met them. A new prompt that writes to the employer
 * belongs here.
 */
const EMPLOYER_FACING_PROMPTS = new Set([
	'write_cover_letter',
	'write_or_advise_cover_letter',
	'advise_cover_letter',
	'review_cover_letter',
	'answer_application_question',
	'write_or_advise_application_question',
	'advise_application_question',
	'review_application_question',
	'revise_application_question',
	'followup_application_question'
]);

/** The assistant, which drafts those texts as well and is told the same. */
const CHAT_PROMPTS = new Set(['personal_agent_chat', 'personal_agent_chat_capable']);

/**
 * Whether a generation is for an application read without names, and how.
 *
 * Null when it is not. Otherwise who the applicant is, and whether to take it
 * out of the profile the model reads (`strip`): yes for what goes to the
 * employer, no for the chat, which is talking to the applicant and still has
 * to know their name, but is given the note so a letter it drafts is
 * anonymous too.
 */
export async function writingAnonymity(
	profileId: number,
	promptKey: string,
	entity: { type: string; id: number } | null | undefined
): Promise<{ identity: Identity; strip: boolean } | null> {
	if (entity?.type !== 'application') return null;
	const strip = EMPLOYER_FACING_PROMPTS.has(promptKey);
	if (!strip && !CHAT_PROMPTS.has(promptKey)) return null;
	const application = await db.query.applications.findFirst({
		where: and(eq(applications.id, entity.id), eq(applications.profile_id, profileId)),
		columns: { anonymous: true }
	});
	if (!application?.anonymous) return null;
	const row = await db.query.profiles.findFirst({ where: eq(profiles.id, profileId) });
	return { identity: identityOf(row ?? {}), strip };
}

/**
 * What a writer is told about an application read without names, after the
 * profile it writes from. Said rather than left to the missing fields: a
 * letter with no name to sign grows a "[Your name]" otherwise.
 */
export const ANONYMOUS_WRITING_NOTE =
	'This application is anonymous: the employer reads it without the applicant\'s name, so that the people choosing are not swayed by a name, an age, a nationality or an address. Anything written for it must not give the applicant\'s name, contact details, nationality, age or where they live. End a letter with a greeting and no name, and no placeholder for one. Call their own business "my own business".';

/**
 * The template an anonymous document is dressed in: the same, without the
 * brand's contact points. They replace the applicant's own (a consultancy's
 * address for its consultant) and still name them: "rik@citrus-it.nl".
 */
export function anonymousTemplate<T extends ResumeTemplate | null>(template: T): T {
	if (!template) return template;
	return { ...template, config: { ...template.config, contact: {} } } as T;
}
