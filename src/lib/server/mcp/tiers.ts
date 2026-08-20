/**
 * How much friction a write gets, and why it is graded by blast radius rather
 * than by which surface asked.
 *
 * ## The three tiers
 *
 * - **Tier 0 — reads.** Direct, always. This is most of what an external agent
 *   wants, and putting friction on it teaches people to raise the scope.
 * - **Tier 1 — additive and reversible.** Adding an entry, or filling a field
 *   that was empty. Direct write for a `write`-scoped key, logged, and the undo
 *   handle comes back in the tool result.
 * - **Tier 2 — overwrites of authored prose, hides, anything bulk.** The tool
 *   does not write. It records a request and returns a deep link; a human
 *   approves in the app.
 *
 * **Tier 1 deliberately does not go through approval.** If adding a skill needs
 * a click, people set the key to `write` to make the annoyance stop, and a
 * graded system becomes an ungraded one. Tier 1's protection is that it is
 * reversible and visible, not that it is blocked.
 *
 * ## The property this exists to preserve
 *
 * The agent can ask. It cannot approve. There is no tool that approves, and
 * there must never be one — a `confirm_change(id)` tool is a gate the agent
 * calls itself, which defends against carelessness and against nothing else.
 * Client-side tool approval, tool annotations and elicitation all have that
 * same shape from our side: they are the client's behaviour, and the client is
 * driven by the agent. Tier 2 is the only mechanism here that survives an agent
 * that has been fully talked into something, because approval happens on a
 * different surface, authenticated as the user.
 *
 * That is also why the scope on a credential can only ever *raise* friction.
 * `write` does not make a Tier 2 overwrite direct. The tier is the floor.
 */

import { CAPABILITIES, type Capability } from '$lib/server/ai-chat/capabilities';
import type { McpScope } from './keys';

export type Tier = 0 | 1 | 2;

/**
 * How many direct writes one profile's MCP keys may make in the window before
 * the rest become requests.
 *
 * This is the "anything bulk" clause, and it is the only part of it that can be
 * enforced: a single tool call is one capability on one row, so bulk is never
 * visible inside one — it is an agent in a loop. Twenty is chosen to be far
 * above a session of ordinary use and far below the number that makes a profile
 * unrecognisable before anyone looks at it.
 *
 * Exceeding it does not fail anything. The writes become Tier 2 requests, which
 * is the same answer the user gets from a `propose` key, so a runaway agent
 * fills a review queue rather than a profile.
 */
export const DIRECT_WRITE_BURST = 20;
export const DIRECT_WRITE_WINDOW_MS = 60 * 60 * 1000;

export interface TierDecision {
	tier: Tier;
	/** Shown to the agent when a write became a request, so it stops retrying. */
	reason: string;
}

/**
 * The value as it would be compared, so a column and a wire value can agree.
 *
 * Only dates need it: a `timestamp` column reads back as a Date where the tool
 * schema takes "YYYY-MM-DD", and the two spell the same day.
 */
function comparable(value: unknown): unknown {
	return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

/**
 * Whether a proposed value is the one already there.
 *
 * Deliberately strict about blanks: null and "" are NOT folded together, so
 * clearing a field still counts as a change. Erring this way costs a redundant
 * proposal at worst, where the other way silently drops a write the caller
 * meant.
 */
export function isUnchanged(before: unknown, after: unknown): boolean {
	const a = comparable(before);
	const b = comparable(after);

	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
		return a.every((value, index) => isUnchanged(value, b[index]));
	}

	return a === b;
}

/** Empty in the sense that filling it destroys nothing. */
function isBlank(value: unknown): boolean {
	if (value === null || value === undefined || value === '') return true;
	if (Array.isArray(value)) return value.length === 0;
	return false;
}

/**
 * The tier of one write, decided against what the row currently holds.
 *
 * "Fill a field that was empty" is a property of the call, not of the
 * capability — `edit_work_experience` is Tier 1 when it writes a summary onto a
 * role that has none, and Tier 2 when it replaces one the applicant wrote. So
 * this takes `current` and the proposed `fields` rather than only a name.
 */
export function tierForWrite(opts: {
	capability: Capability;
	current: Record<string, unknown>;
	fields: Record<string, unknown>;
	/** Direct MCP writes already made for this profile inside the window. */
	recentDirectWrites: number;
}): TierDecision {
	const { capability, current, fields, recentDirectWrites } = opts;

	// A hide takes an entry off every CV and every export. Nothing about that is
	// additive, whatever the row currently holds.
	if (capability.startsWith('hide_')) {
		return { tier: 2, reason: 'Hiding an entry takes it off every document.' };
	}

	if (recentDirectWrites >= DIRECT_WRITE_BURST) {
		return {
			tier: 2,
			reason:
				`This profile has already had ${DIRECT_WRITE_BURST} direct changes from an ` +
				`agent in the last hour, so further changes need approval.`
		};
	}

	if (capability.startsWith('add_')) {
		return { tier: 1, reason: 'Adding an entry does not replace anything.' };
	}

	// Writing over a value someone wrote is the case this whole thing is about.
	// Note that clearing a populated field counts: the proposed value being blank
	// does not make the write additive.
	const overwritten = Object.keys(fields).filter((name) => !isBlank(current[name]));
	if (overwritten.length > 0) {
		return {
			tier: 2,
			reason: `This would replace existing content in ${overwritten.join(', ')}.`
		};
	}

	return { tier: 1, reason: 'Every field this fills is currently empty.' };
}

/** What actually happens to a call at this tier with this scope. */
export type Disposition =
	/** Do it now, and return the diff. */
	| 'direct'
	/** Record it, notify, and return a link for a human to decide. */
	| 'request'
	/** The credential may not even ask. */
	| 'refused';

/**
 * Combine the tier's floor with the credential's ceiling.
 *
 * Neither alone is the answer. The tier says how dangerous the write is; the
 * scope says how much the user trusted this particular agent when they minted
 * its key. The stricter of the two wins, always — which is why there is no cell
 * in this table where `write` turns a Tier 2 into a direct write.
 */
export function dispositionFor(tier: Tier, scope: McpScope): Disposition {
	if (tier === 0) return 'direct';
	if (scope === 'read') return 'refused';
	if (tier === 1) return scope === 'write' ? 'direct' : 'request';
	return 'request';
}

/**
 * MCP tool annotations.
 *
 * Worth setting and worth not relying on. The spec is explicit that clients
 * must treat annotations from an untrusted server as hints, so these help a
 * well-behaved client prompt harder and are not a boundary. The boundary is
 * `dispositionFor` above, which runs on our side.
 *
 * `destructiveHint` is keyed on the capability rather than on the resolved
 * tier, because annotations are rendered by `tools/list` — long before anyone
 * has said which row they mean, and therefore before the current values that
 * decide the tier can be read. An `edit_*` is annotated destructive because it
 * *may* be, which is the honest answer to a question asked that early.
 */
export interface ToolAnnotations {
	title: string;
	readOnlyHint: boolean;
	destructiveHint: boolean;
	idempotentHint: boolean;
	openWorldHint: boolean;
}

export function annotationsFor(capability: Capability): ToolAnnotations {
	const isAdd = capability.startsWith('add_');
	return {
		title: CAPABILITIES[capability].title,
		readOnlyHint: false,
		// An add creates a new row and destroys nothing; an edit or a hide
		// overwrites something that may have been authored by hand.
		destructiveHint: !isAdd,
		// Repeating an edit with the same fields lands the same values. Repeating
		// an add makes a second entry, which is the duplicate the contract warns
		// about.
		idempotentHint: !isAdd,
		// Everything here writes to this application's own database.
		openWorldHint: false
	};
}

export function readToolAnnotations(title: string): ToolAnnotations {
	return {
		title,
		readOnlyHint: true,
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: false
	};
}
