/**
 * What became of the edits a past turn proposed, written for the model that
 * proposed them.
 *
 * ## The thing a thread could not remember
 *
 * A conversation is replayed to the model as `role` and `content` and nothing
 * else. The proposals a turn carried are stored beside it and rendered as cards
 * for the user, and neither the cards nor their fate ever go back — so from the
 * model's side of the transcript, every proposal it has ever made is still a
 * draft sitting on screen. Its own prose says so: "take a look at the proposal
 * below".
 *
 * That is how one project came to be added twice. The assistant drafted it, the
 * user accepted it, and the user then pasted their own rewrite of the same
 * project a few hours later. The right move — correct the row we just made — was
 * available and named in the prompt: the capability block listed that very row,
 * first, under the edit verb, and the add verb's inventory listed it first
 * again under "do not propose a duplicate of anything already in one". The model
 * proposed the add a second time anyway, and said plainly why: it believed it
 * was still working on a draft. Nothing in its context distinguished "that name
 * in the list is the row we made together" from "an unrelated row that happens
 * to share a name".
 *
 * So this is the missing half of the transcript, and it is deliberately stated
 * as record rather than as instruction: the model is not being told what to do
 * about a duplicate, it is being told which of its drafts are already real.
 * `checkDuplicate` in profile-capabilities.ts is the enforcement; this is what
 * makes the enforcement unnecessary.
 *
 * ## Why it is not stored on the message
 *
 * Because it is not true for long. A pending proposal becomes an applied one
 * with no new turn, so text written into `agent_messages.content` at answer time
 * would be a claim about the past that quietly went stale — and a transcript
 * that says "still on screen" about something accepted an hour ago is worse
 * than one that says nothing. It is rendered from the rows on the way into the
 * prompt, every turn, and never persisted.
 *
 * That is also why the user never sees this. The cards say all of it, in their
 * own terms and with an Apply button; this is addressed to the only reader who
 * cannot see the cards.
 */

/** One proposal, as much of it as this needs. */
export interface ProposalOutcome {
	/** The capability id — what the model knows this change as. */
	capability: string;
	/** The row it was addressed to, which for an add is the list, not the entry. */
	target: { id: number; label: string };
	/** The row an accepted add created, where one did. */
	createdRow?: { id: number; label: string } | null;
	applied: boolean;
}

/**
 * The block appended to one assistant turn when it carried proposals.
 *
 * Returns "" when it carried none, so the caller can leave the turn exactly as
 * it was rather than append an empty heading — the same rule the context
 * sources follow.
 */
export function renderProposalOutcomes(proposals: ProposalOutcome[]): string {
	if (proposals.length === 0) return '';

	const lines = proposals.map((proposal) => `- ${describe(proposal)}`);

	return `\n\n[Record kept by the app, not part of what you said: what became of the ${
		proposals.length === 1 ? 'change' : 'changes'
	} offered above.
${lines.join('\n')}
Ids here are as at the time of writing. Whatever is listed in the capability blocks of the current turn is the truth about what exists now.]`;
}

/**
 * Whether this capability creates a row, from the verb its name starts with.
 *
 * The prefix, rather than the registry, so this module renders text and reads
 * no tables — `resourceForCapability` and `tieredCapabilities` already split
 * capability names on that same first underscore, and it is the convention the
 * whole set is generated from.
 */
function isAdd(capability: string): boolean {
	return capability.startsWith('add_');
}

function describe(proposal: ProposalOutcome): string {
	if (!proposal.applied) {
		return (
			`${proposal.capability} (${proposal.target.label}): NOT APPLIED. The card is still ` +
			`on screen for them to accept or dismiss. If they want it different, propose the ` +
			`corrected version — it replaces this one rather than adding to it.`
		);
	}

	// An add, branching on the verb rather than on whether an id was recorded.
	// Those are not the same question: a proposal applied before `created_row`
	// existed has no id and the entry is no less real for it, and describing that
	// one as an ordinary edit — "propose only what should change from there" —
	// would say the opposite of the one thing this has to convey.
	if (isAdd(proposal.capability)) {
		const row = proposal.createdRow;
		return (
			`${proposal.capability}: APPLIED. It created ` +
			(row ? `"${row.label}", target_id ${row.id}. ` : `the entry it described. `) +
			`That entry exists now — never propose adding it again. To change anything about ` +
			`it, propose a correction naming ` +
			(row ? `target_id ${row.id}.` : `it from the lists in the capability blocks.`)
		);
	}

	return (
		`${proposal.capability} (${proposal.target.label}): APPLIED. That change is in the ` +
		`record now, so propose only what should change from there.`
	);
}
