/**
 * `edit_directives` — the applicant's standing directives, as a proposal they
 * approve. See directives.ts for what a directive is and why it is rendered
 * whole.
 *
 * ## One field per topic, not an add and a hide
 *
 * The plan sketched `add_directive` and `hide_directive`. This is one singleton
 * with a field per topic instead, because the registry already does everything
 * those two would have had to build:
 *
 *  - **Supersede shows on the card.** A topic's field is its live statement, so
 *    the generic diff renders the old text beside the new — a replacement that
 *    did not show what it replaces would be an overwrite wearing an add's
 *    clothes, which is the thing the plan asked the card to rule out.
 *  - **Stopping one is null**, the same "explicit null clears" every capability
 *    here already means, and it is reviewed as the removal it is.
 *  - **Batching comes free.** "No defence work, and never mention my age" is two
 *    topics in one proposal and one card, where an add verb would be two
 *    proposals over one target that the chat's dedupe keeps one of.
 *  - **Undo is the before-image written back**, as for any field.
 *
 * ## Live on every page
 *
 * Every other capability is offered where its row is. A standing preference has
 * no row and is stated wherever the applicant happens to be, and the failure
 * this exists for — "I'll keep that in mind", and nothing kept — happened on
 * four pages out of four in the Phase 0 eval, including two that grant nothing.
 * So chat-context admits it on every route, ahead of anything matched.
 */

import type { CapabilityDef, CapabilityTarget } from './capabilities';
import {
	COLUMN_BACKED_TOPICS,
	DIRECTIVE_TOPIC_NAMES,
	DIRECTIVE_TOPICS,
	type DirectivePatch,
	type DirectiveSourceType,
	isColumnBackedTopic,
	isDirectiveTopic,
	loadDirectives,
	MAX_STATEMENT_CHARS,
	writeDirectives
} from './directives';

export type DirectiveCapability = 'edit_directives';

export const DIRECTIVE_CAPABILITY_NAMES: DirectiveCapability[] = ['edit_directives'];

export const DIRECTIVES_PAGE = { name: 'Directives', path: '/data/directives' };

/** What the card and the prompt call the whole set. */
const LABEL = 'your directives';

const PREFIX = 'directive.';

export function directiveField(topic: string): string {
	return `${PREFIX}${topic}`;
}

function topicOf(field: string): string {
	return field.startsWith(PREFIX) ? field.slice(PREFIX.length) : field;
}

/**
 * Wire names back to topics, the refused ones dropped.
 *
 * `validate` has already turned a refused topic away by the time this runs on
 * the way to a write; dropping it here as well keeps an undo, which does not
 * validate, from reaching one.
 */
function patchFrom(fields: Record<string, unknown>): DirectivePatch {
	const patch: DirectivePatch = {};
	for (const [field, value] of Object.entries(fields)) {
		const topic = topicOf(field);
		if (!isDirectiveTopic(topic)) continue;
		patch[topic] = typeof value === 'string' && value.trim() ? value : null;
	}
	return patch;
}

const topicLines = DIRECTIVE_TOPIC_NAMES.map(
	(topic) => `- "${directiveField(topic)}" — ${DIRECTIVE_TOPICS[topic].what}.`
).join('\n');

const editDirectives: CapabilityDef = {
	title: 'Update your directives',
	singleton: true,

	/** The profile's own set, whatever the page. Nothing to look up: the actor is the answer. */
	resolve: async (_entity, actor): Promise<CapabilityTarget> => ({
		id: actor.profileId,
		label: LABEL
	}),

	/**
	 * The target IS the profile, so owning it is being it. Re-asked at apply time
	 * and at undo, like every capability's: a card can be applied long after the
	 * page, and from a session on another profile.
	 */
	authorize: async (target, actor) => target.id === actor.profileId,

	current: async (_target, actor) => {
		const live = new Map(
			(await loadDirectives(actor.profileId)).map((d) => [d.topic, d.statement])
		);
		return Object.fromEntries(
			DIRECTIVE_TOPIC_NAMES.map((topic) => [directiveField(topic), live.get(topic) ?? null])
		);
	},

	fields: {
		...Object.fromEntries(DIRECTIVE_TOPIC_NAMES.map((topic) => [directiveField(topic), 'string'])),
		// Offered so the model has an honest place to file one, and always refused.
		// See COLUMN_BACKED_TOPICS.
		...Object.fromEntries(
			Object.keys(COLUMN_BACKED_TOPICS).map((topic) => [directiveField(topic), 'string'])
		)
	},

	contract: `Standing directives: what the applicant wants kept to from now on, across
every job and application — by you, and by the app's cover letters and
application answers. One statement per topic:

${topicLines}

Propose one when they state a preference meant to outlast this conversation
("from now on", "never", "always", "remember that"), not for a one-off request
about the thing in front of them. Until they apply the card nothing is stored,
so never say you have noted it or will remember it: say you have proposed it.

Write what THEY said, in their words and at their scope. No advice, examples or
reasons of your own: a directive that says more than they did is a rule they
never made, and it binds every letter after it.

A topic holds ONE statement, and a new one replaces it whole: to add to one,
send its current text with the new part folded in; null stops it. Change or
stop one only when they ask. When a request runs into one, say so and let them
decide — never propose loosening a limit they set.

"${directiveField('salary')}" and "${directiveField('job_search')}" are always refused. A
rate belongs on Salary Prep (/applications/salary), and which jobs they want is
Match Config (edit_match_config). Say so instead of recording it.`,

	/**
	 * By reference: the live statements are already in the prompt, in the block
	 * the directives source renders on every chat turn. Printing them twice would
	 * put up to 2,500 characters into a capability block that ships on every
	 * page, to say what the model read a few thousand characters earlier.
	 */
	renderState: () =>
		'Their current directives are the ones listed under "What they have told you to keep ' +
		'to" above, and a topic not listed there has none.',

	/**
	 * Always for the applicant to approve, over MCP too. A directive changes
	 * everything written for them from now on, and nothing about that is additive
	 * in the sense the generic grading means — the first statement on a topic
	 * replaces nothing and still reshapes every letter after it.
	 */
	tierFor: () => ({
		tier: 2,
		reason: 'A directive changes everything written for them from now on.'
	}),

	validate: (fields) => {
		// The refusals first: a proposal holding only a rate should hear where rates
		// go, not that it held no topic.
		for (const [field, value] of Object.entries(fields)) {
			const topic = topicOf(field);
			if (isColumnBackedTopic(topic) && value !== null) {
				return { ok: false, error: COLUMN_BACKED_TOPICS[topic].refusal };
			}
		}
		// A proposal of nothing but refused topics set to null writes nothing, and
		// would still put an entry in their history saying it had.
		if (!Object.keys(fields).some((field) => isDirectiveTopic(topicOf(field)))) {
			return { ok: false, error: 'There is no directive topic in this change.' };
		}
		for (const [field, value] of Object.entries(fields)) {
			const topic = topicOf(field);
			if (isColumnBackedTopic(topic)) continue;
			if (!isDirectiveTopic(topic)) {
				return { ok: false, error: `${field} is not a directive topic.` };
			}
			if (typeof value === 'string' && value.trim().length > MAX_STATEMENT_CHARS) {
				return {
					ok: false,
					error:
						`${field} is ${value.trim().length} characters. A directive is a sentence or ` +
						`two in their words — at most ${MAX_STATEMENT_CHARS}.`
				};
			}
		}
		return { ok: true };
	},

	apply: async (_target, fields, _current, actor, context) => {
		const source: DirectiveSourceType = context?.source ?? 'chat';
		await writeDirectives(actor.profileId, patchFrom(fields), source);
	},

	/**
	 * Write the before-image back. A topic that was empty is stopped again, and a
	 * replaced statement returns as a new row rather than resurrecting the old
	 * one, so the trail on the Directives page records the undo as well.
	 */
	revert: async (_target, previous, actor) => {
		const patch = patchFrom(previous);
		if (Object.keys(patch).length === 0) {
			throw new Error('edit_directives recorded no topics this can put back');
		}
		await writeDirectives(actor.profileId, patch, 'undo');
	}
};

export const DIRECTIVE_CAPABILITIES: Record<DirectiveCapability, CapabilityDef> = {
	edit_directives: editDirectives
};
