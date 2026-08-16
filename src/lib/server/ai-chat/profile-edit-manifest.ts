/**
 * An index of the parts of a profile the assistant can change, and where each
 * one lives.
 *
 * ## Why it exists
 *
 * The same reason `activity-manifest.ts` exists, applied to writes rather than
 * reads: "this page does not offer that capability" and "there is no such thing"
 * were indistinguishable to the model, and both come out of its mouth as a
 * confident no. Asked to fix a language from a job page, the honest answer is
 * "that's on your Languages page" — and the model could not give it, because
 * nothing told it languages were a thing it could ever change.
 *
 * So this is unconditional wherever there is a profile. It does not enable any
 * edit: what may actually be proposed here is the capability block, which is
 * built from the route scope and re-authorized per turn. This block is what
 * makes the *refusal* useful, turning "I can't do that" into "not from here —
 * open your Languages page".
 *
 * ## Why counts and not contents
 *
 * A count is what distinguishes "you have none yet" from "I cannot see them
 * from here", which are different answers to the same question and only one of
 * them is about the page. The contents are a different matter: the profile blob
 * already carries the applicant's work history and languages, and the capability
 * block carries the rows of whatever is editable here. Repeating either would
 * spend the budget to say what has already been said.
 */

import {
	PROFILE_RESOURCE_NAMES,
	PROFILE_RESOURCES,
	type ProfileResourceName
} from '$lib/server/profile/resources';
import { countOwnedRows } from '$lib/server/profile/write';

export interface ManifestSection {
	name: ProfileResourceName;
	rows: number;
}

/**
 * How many rows of each section this profile has.
 *
 * Counted through the write layer rather than against `profile_id` here: skills
 * do not have that column — they reach the profile through their category — and
 * a manifest that assumed it would have been the one place quietly reporting
 * every profile as having no skills.
 */
export async function profileEditCounts(profileId: number): Promise<ManifestSection[]> {
	return Promise.all(
		PROFILE_RESOURCE_NAMES.map(async (name) => ({
			name,
			rows: await countOwnedRows(name, { profileId })
		}))
	);
}

/** "8 entries", "one entry", "none yet" — the difference that matters is the last one. */
function describeCount(rows: number): string {
	if (rows === 0) return 'none yet';
	return rows === 1 ? 'one entry' : `${rows} entries`;
}

export function formatProfileEditManifest(sections: ManifestSection[]): string {
	const lines = sections.map(({ name, rows }) => {
		const { page, title } = PROFILE_RESOURCES[name];
		return `- ${title} — ${describeCount(rows)}. On their ${page.name} page.`;
	});

	return [
		'## Parts of their profile they can change',
		'',
		'What you can propose a change to *right now* is listed under "Changes you',
		'can propose", if anything is. This list is different: it is every part of',
		'their profile that is editable at all, so that a part missing from that',
		'list is one you send them to rather than one you say does not exist.',
		'',
		...lines,
		'',
		'Counts are of what they have written down, not of what is any good. A part',
		'with none yet is an empty section, not a part you cannot reach.'
	].join('\n');
}

export async function profileEditManifestText(profileId: number): Promise<string> {
	return formatProfileEditManifest(await profileEditCounts(profileId));
}
