/**
 * Everything the assistant can ever propose, and the parts of the product it
 * cannot touch at all.
 *
 * ## Why this exists
 *
 * `profile-edit-manifest.ts` answers this question for one half of one feature
 * — which parts of a profile are editable at all, so that "not from here, open
 * your Languages page" replaces a confident no. The same gap is open on every
 * other axis, and it is structural rather than accidental: the chat is
 * page-scoped by construction. `chat-context.ts` resolves capabilities from the
 * route, `tieredCapabilities` gives up what does not fit, and
 * `matchedCapabilities` admits a section only when the conversation names one of
 * its rows. A question that names no row — "what can you do?", "can you fix my
 * CV?", "can you help me with interviews?" — therefore matches nothing, and is
 * answered from whichever verbs that one page happens to grant.
 *
 * That answer is locally correct and globally wrong, and it errs in the
 * expensive direction: it under-reports, confidently, and the user believes it.
 *
 * So this block states the whole of it, on every page:
 *
 *  - every change that can ever be proposed, with where it becomes possible;
 *  - the parts of the product that are not changes at all, which the assistant
 *    cannot run and should NAME rather than deny.
 *
 * It grants nothing. Same rule as the profile manifest: what may actually be
 * proposed here is the capability block, resolved from the route and
 * re-authorized per turn. This is what makes the refusal useful.
 *
 * ## Derived where there is a registry, written where there is not
 *
 * The verbs come from `CAPABILITIES` and are grouped by `ENTITY_TARGETING` —
 * the same registry that decides how an MCP call names a job or an application,
 * because "which entity does this capability act on" has exactly one answer and
 * should have exactly one home. Adding a capability adds a line here, carrying
 * the same title the proposal card shows. That is the whole reason not to write
 * this half as prose.
 *
 * `APP_AREAS` is the half with no registry — the app's own map of itself is a
 * sidebar and a route tree, neither importable from here — so it is written
 * down. What keeps it honest is `ability-manifest.test.ts`, which resolves every
 * path against `src/routes`: an area that is renamed or removed fails a test
 * instead of sending the user to a 404. Nothing catches an area that is *added*
 * and not listed. That is the residual cost of this half not being generated,
 * and it is the reason the lines are short — a stale line is cheaper to fix than
 * a stale paragraph.
 */

import { CAPABILITIES, type Capability } from './capabilities';
import { PROFILE_CAPABILITY_NAMES, verbsFor } from './profile-capabilities';
import { PROFILE_RESOURCES, PROFILE_RESOURCE_NAMES } from '$lib/server/profile/resources';
import { targetingFor } from '$lib/server/mcp/entities';

/** One area of the app, as the navigation names it. */
export interface AppArea {
	/** As the sidebar labels it, so that naming it here and pointing at it agree. */
	name: string;
	/** Route path, normalized the way `PROFILE_RESOURCES` normalizes one: no `(group)` segments. */
	path: string;
	/** What happens there, in one clause. Long enough to be useful, short enough to stay true. */
	what: string;
}

/**
 * What the app does that the assistant does not.
 *
 * Deliberately NOT a list of every page. A page the assistant can already act on
 * is covered by its capabilities, and repeating it here would spend the budget
 * to blur the one distinction this block is for. What belongs here is the work
 * that has no capability and never will — scraping, generating documents,
 * exporting, settings — because that is what the assistant currently answers by
 * implying it does not exist.
 */
export const APP_AREAS: readonly AppArea[] = [
	{
		name: 'Job Import',
		path: '/jobs/import',
		what: "automated searches that drive each job platform's own search page and import what they find"
	},
	{
		name: 'Match Config',
		path: '/jobs/import/config',
		what: 'the preferences every imported job is scored against'
	},
	{
		name: 'Application documents',
		path: '/applications',
		what: "tailored CVs and cover letters, written by the app on an application's own tabs"
	},
	{
		name: 'Interview Prep',
		path: '/applications/interview',
		what: 'STAR stories and cheat sheets, each with its own AI editor'
	},
	{
		name: 'Salary Prep',
		path: '/applications/salary',
		what: 'what a rate or a salary would leave them, before they answer the question'
	},
	{
		name: 'Resumes & CVs',
		path: '/profile/resume',
		what: 'CV versions, templates and PDF export'
	},
	{
		name: 'Share Links',
		path: '/profile/share',
		what: 'public and private links to a CV version'
	},
	{
		name: 'Import & Export',
		path: '/data/profile-import',
		what: 'moving a whole profile in or out as a file'
	},
	{
		name: 'Profile Settings',
		path: '/data/settings',
		what: 'deleting a profile and everything on it'
	},
	{
		name: 'Recent Changes',
		path: '/data/ai-changes',
		what: 'every change you proposed, whether they applied it, and undo'
	},
	{
		name: 'Connected Apps',
		path: '/data/connected-apps',
		what: 'keys that let an outside AI assistant reach this profile'
	},
	{
		name: 'Guide',
		path: '/guide',
		what: 'how the product works, written for them'
	}
];

/** The capabilities that are not generated from a profile section. */
function entityCapabilities(): Capability[] {
	const generated = new Set<string>(PROFILE_CAPABILITY_NAMES);
	return (Object.keys(CAPABILITIES) as Capability[]).filter((c) => !generated.has(c));
}

/**
 * The hand-written verbs, grouped by the thing they act on.
 *
 * Anything `ENTITY_TARGETING` does not know about is kept rather than dropped —
 * see the `other` bucket in `formatAbilityManifest`. A capability that exists and
 * is missing from this block is the exact failure the block was written to stop,
 * so a new one appears here unlabelled rather than not at all.
 */
function byEntity(): { job: string[]; application: string[]; other: string[] } {
	const groups = { job: [] as string[], application: [] as string[], other: [] as string[] };
	for (const capability of entityCapabilities()) {
		const entity = targetingFor(capability)?.entity;
		groups[entity ?? 'other'].push(CAPABILITIES[capability].title);
	}
	return groups;
}

/** Sections where `hide` is a real write rather than one that changes nothing. */
function hideableSections(): string[] {
	return PROFILE_RESOURCE_NAMES.filter((name) =>
		verbsFor(name).some((verb) => verb.startsWith('hide_'))
	).map((name) => PROFILE_RESOURCES[name].title);
}

/** Human list: "a, b and c". */
function join(parts: string[]): string {
	if (parts.length <= 1) return parts[0] ?? '';
	return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export function formatAbilityManifest(areas: readonly AppArea[] = APP_AREAS): string {
	const groups = byEntity();
	const hideable = hideableSections();

	const lines = [
		groups.job.length
			? `- On a job's own page: ${groups.job.join(' · ')}. Only for a job they ` +
				`entered by hand — a scraped posting is a capture of someone else's page, so ` +
				`it is read-only and no capability for it appears.`
			: '',
		groups.application.length
			? `- On an application's own page: ${groups.application.join(' · ')}.`
			: '',
		`- On each profile page listed above: correct an entry, or add one. Hiding an ` +
			`entry is offered on ${join(hideable)} only.`,
		groups.other.length ? `- Elsewhere: ${groups.other.join(' · ')}.` : ''
	].filter(Boolean);

	return [
		'## Everything you can do, and where',
		'',
		'What you can propose on THIS page is the section headed',
		'"Changes you can propose" — absent entirely when this page allows nothing.',
		'The list below is what you can propose *anywhere*. Something on it that is',
		'not on that one is a page to send them to, never a thing to tell them is',
		'impossible.',
		'',
		...lines,
		'',
		// Measured, on the exact question this block exists to answer. Asked "what
		// can you do?" from a page granting nothing, the model wrote a two-column
		// summary and filed "move an application to Interviewing" under the second
		// heading — a capability it holds, described as something the user does
		// alone. Asked the same thing *directly* ("can you move one of my
		// applications?") it answers correctly, so the failure is in sorting a
		// summary rather than in knowing the answer, and it needs saying here.
		'Asked what you can do, the two lists in this block are not one list. Every',
		'entry above is something you CAN do, named with the page it needs. Putting',
		'one of them below is wrong: "not from here — open that application and ask',
		'me again" is the answer, never "that one is yours to do".',
		'',
		'## What the app does that you do not',
		'',
		'You cannot run any of these and none of them is a change you can propose.',
		`Name the page and let them do it — that is a real answer, and "I can't do`,
		'that" is not.',
		'',
		...areas.map((area) => `- ${area.name} (${area.path}) — ${area.what}.`)
	].join('\n');
}

/**
 * Fixed text, so no profile is read and nothing can fail. Async only to match
 * every other source's shape — see the `render` contract in
 * generation-context.ts.
 */
export async function abilityManifestText(): Promise<string> {
	return formatAbilityManifest();
}
