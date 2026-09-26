/**
 * Whether an entry the assistant proposed in a chat turn may be written without
 * the applicant clicking Apply.
 *
 * Every chat proposal is a card today (capabilities.ts, rule 1). This is the
 * gate that would let one capability, `add_activity_record`, skip the card when
 * the applicant has just said something happened. It is the whole decision, and
 * it is pure on purpose: no model call and no database, so the caller supplies
 * what the turn and the thread hold, and a stored proposal can be replayed
 * through it. That is how it was measured before anything used it
 * (planning/LOG-AS-YOU-GO.md; the replay set is in the cloud tree, because it
 * is real conversations).
 *
 * ## Why it reads the applicant's turn and not the entry
 *
 * The cards it replaces were caught doing one thing wrong: logging a reply that
 * was still being drafted as if it had been sent. The obvious test, "does the
 * entry reuse the assistant's own text?", gets that backwards. Measured on the
 * stored proposals, the entries that reuse the assistant's earlier text most
 * are real events (a drafted reply the applicant sent and then pasted back),
 * and most of the premature ones are paraphrases that reuse nothing. What
 * separates the two is the applicant saying it happened: "I sent it", "he
 * replied". So that is what the gate looks for.
 *
 * ## Why only their own words
 *
 * The same turn can carry a pasted recruiter mail, and a document is exactly
 * what must not be able to trigger a write: the click was the defence against
 * text nobody vouched for, and with it gone the applicant's own typing is the
 * one thing in the context an injected document cannot author. So pasted text
 * is removed before the turn is read: exactly, from the paste marks the chat
 * client sends, and approximately, by `framing()`, which recognises a mail by
 * its shape. The approximation is for turns that carry no marks (the stored
 * ones the replay reads) and for anything the marks missed; it does not stand
 * up to a paste written to get past it, and it does not have to while the
 * marks are there.
 *
 * What it still cannot see is whether the entry IS the event the turn
 * reports. "He replied:" followed by his mail is the case this exists for, and
 * the entry is then written by a model that has read the mail. The receipt,
 * the undo, the thread window and the burst ceiling are what stand behind that.
 */

/** How soon after an entry logged from the same thread a new one needs a click. */
export const RECENT_THREAD_LOG_MS = 30 * 60 * 1000;

/**
 * The share of an entry's five-word runs that may also appear in the reply it
 * came with before it counts as that reply's own draft. Measured on the stored
 * proposals: a draft logged verbatim scored 81%, every reported event 3% or
 * less.
 */
export const SAME_TURN_DRAFT_SHARE = 0.5;

/** The only capability this gate can wave through. */
const DIRECT_CAPABILITY = 'add_activity_record';

export type DirectWriteRule =
	'capability' | 'burst' | 'own_words' | 'recent_log' | 'same_turn_draft';

export type ChatDisposition =
	| { disposition: 'direct'; report: string }
	| { disposition: 'card'; rule: DirectWriteRule; reason: string };

export interface DispositionInput {
	capability: string;
	fields: Record<string, unknown>;
	/** The applicant's message the proposal answered. */
	turn: string;
	/**
	 * What the chat client saw pasted into that message. Absent when it sent
	 * none, which is every stored turn; `framing()` then carries it alone.
	 */
	pasted?: readonly string[];
	/** The assistant's reply the proposal came with. */
	reply: string;
	/** When an entry from this thread last landed on the same application, if ever. */
	lastThreadLogAt: Date | null;
	now: Date;
	/** Whether this profile has used up its direct writes for the window. */
	overBurst: boolean;
}

// An adverb between the subject and the verb is how people actually say it:
// "I already submitted the form". Kept to a closed list so that "I never sent
// it" does not read as a report.
const ADVERB = String.raw`(?:just |already |also |finally |now |then )?`;

/**
 * Something happened, in the applicant's words. Past tense only: "now she asks"
 * is a question arriving, and the entry that follows it is usually the answer
 * still being drafted. English only for now; a report this misses is a card,
 * never a lost entry.
 */
const REPORT = new RegExp(
	[
		String.raw`\bI(?:['’]ve| have)? ${ADVERB}(?:sent|submitted|signed|replied|emailed|mailed|called|spoke|talked|applied|accepted|declined|rejected|heard back|had (?:a|an|the|my)(?: \w+)? (?:call|interview|meeting|chat))\b`,
		String.raw`\b(?:he|she|they|(?:the |my )?(?:recruiter|hiring manager|interviewer|company|client))(?:['’]ve| have| has)? ${ADVERB}(?:replied|responded|called|wrote back|got back to me|sent|offered|invited|rejected|declined|confirmed)\b`,
		String.raw`\bI (?:got|received) (?:a|an|the|their|his|her) (?:call|email|mail|reply|offer|message|invite|invitation|rejection)\b`,
		// Asked for outright. Not when it is refused in the same breath.
		String.raw`(?<!\b(?:don['’]t|do not|not|no need to|never) )\blog (?:this|that|it)\b`
	].join('|'),
	'i'
);

/** "Hi Sam," and nothing else on the line: where a pasted mail starts. */
const GREETING =
	/^(?:hi|hello|hey|dear|hoi|beste|good (?:morning|afternoon|evening))(?:\s+[\p{L}'’.-]+){0,3}\s*[,!.:]?$/iu;

/**
 * "Best regards," and at most one word after it: where a pasted mail ends. A
 * line that merely starts with "Thanks" ("Thanks for your time.") is inside
 * the mail, and ending the block there would read the rest of it as the
 * applicant's own words.
 */
const SIGN_OFF =
	/^(?:(?:best|kind|warm|warmest|many)\s+|(?:met\s+)?(?:vriendelijke|hartelijke)\s+)?(?:regards|wishes|thanks|thank you|cheers|best|groet|groeten|groetjes)(?:[\s,]+[\p{L}'’.-]+)?[\s,.!]*$/iu;

/** The signature under a sign-off: a name, a team, nothing with punctuation in it. */
function isNameLine(line: string): boolean {
	return line.length <= 40 && line.split(/\s+/).length <= 4 && /^\p{L}[\p{L}'’.\- ]*$/u.test(line);
}

/** "Here it is:", "and she replied:": the applicant introducing what follows. */
function isIntroLine(line: string): boolean {
	return line.endsWith(':') && line.length <= 120 && !GREETING.test(line);
}

/**
 * The turn minus what looks pasted: a block from a greeting line to its
 * sign-off and signature, or everything after a short line ending in ":". Only
 * the applicant's own lines can open a block or close one with a signature, so
 * a colon line inside a pasted mail ("They offered you the role:") stays inside
 * it rather than reading as theirs.
 */
export function framing(turn: string): string {
	const kept: string[] = [];
	let state: 'own' | 'pasted' | 'signature' = 'own';

	for (const line of turn.split(/\r?\n/)) {
		const text = line.trim();

		if (state === 'signature') {
			if (text === '') continue;
			state = 'own';
			if (isNameLine(text)) continue;
		}

		if (state === 'pasted') {
			if (SIGN_OFF.test(text)) state = 'signature';
			continue;
		}

		if (GREETING.test(text)) {
			state = 'pasted';
			continue;
		}
		kept.push(line);
		if (isIntroLine(text)) state = 'pasted';
	}

	return kept.join('\n');
}

/**
 * What the applicant typed: the turn with the client's paste marks taken out
 * exactly, then `framing()` over what is left. A block they edited after
 * pasting no longer matches its mark, which is what the second pass is for.
 */
export function ownWords(turn: string, pasted?: readonly string[]): string {
	let typed = turn;
	for (const block of pasted ?? []) {
		const trimmed = block.trim();
		if (trimmed) typed = typed.split(trimmed).join('\n');
	}
	return framing(typed);
}

/** The phrase that reports something as done, or null. */
export function reportIn(words: string): string | null {
	return REPORT.exec(words)?.[0] ?? null;
}

function shingles(text: string, size: number): Set<string> {
	const words =
		text
			.toLowerCase()
			.replace(/[‘’]/g, "'")
			.match(/[\p{L}\p{N}€$']+/gu) ?? [];
	const out = new Set<string>();
	for (let i = 0; i + size <= words.length; i++) out.add(words.slice(i, i + size).join(' '));
	return out;
}

/**
 * The share of `part`'s five-word runs that also occur in `whole`. Zero for a
 * part too short to have one, so a one-line entry never reads as a copy.
 */
export function shingleShare(part: string, whole: string, size = 5): number {
	const own = shingles(part, size);
	if (own.size === 0) return 0;
	const other = shingles(whole, size);
	let shared = 0;
	for (const run of own) if (other.has(run)) shared++;
	return shared / own.size;
}

/**
 * Direct, or a card and which rule said so. Every rule has to pass for a
 * direct write; the order only decides which reason a card gives.
 */
export function chatDisposition(input: DispositionInput): ChatDisposition {
	if (input.capability !== DIRECT_CAPABILITY) {
		return {
			disposition: 'card',
			rule: 'capability',
			reason: 'Only a new timeline entry can be written without a click.'
		};
	}

	if (input.overBurst) {
		return {
			disposition: 'card',
			rule: 'burst',
			reason: 'This profile has had its direct changes for the hour.'
		};
	}

	const report = reportIn(ownWords(input.turn, input.pasted));
	if (!report) {
		return {
			disposition: 'card',
			rule: 'own_words',
			reason: 'Their own words do not say anything happened.'
		};
	}

	if (
		input.lastThreadLogAt &&
		input.now.getTime() - input.lastThreadLogAt.getTime() < RECENT_THREAD_LOG_MS
	) {
		return {
			disposition: 'card',
			rule: 'recent_log',
			reason: 'An entry from this conversation landed on this application in the last half hour.'
		};
	}

	const content = typeof input.fields.entry_content === 'string' ? input.fields.entry_content : '';
	if (shingleShare(content, input.reply) >= SAME_TURN_DRAFT_SHARE) {
		return {
			disposition: 'card',
			rule: 'same_turn_draft',
			reason: 'The entry is the draft in the reply it came with.'
		};
	}

	return { disposition: 'direct', report };
}
