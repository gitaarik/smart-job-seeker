/**
 * What the applicant has told the assistant to keep to, across the whole
 * profile — the standing-preference half of profile memory
 * (planning/PROFILE-MEMORY.md).
 *
 * ## Why these are rendered whole and never ranked
 *
 * Every other thing a prompt draws on is either one known row or the best few
 * of many. A directive is neither: it is a limit someone stated, and it has to
 * reach every prompt it applies to or it is not a limit. Put in a ranked source
 * it would compete with trivia for a slot and lose it on exactly the profiles
 * full enough for it to matter. So the block holds every live directive, bounds
 * itself (one row per topic, a cap per statement, `DIRECTIVES_CEILING_CHARS`
 * over the lot) and can therefore say "this is all of them" — which no
 * retrieved source can, and which is what lets the assistant answer "what have
 * I told you?" without filling the gap from the CV.
 *
 * ## Topics, and the two that are refused
 *
 * `topic` is the supersede key: one live statement per topic, and a new one
 * replaces the old whole. The list is closed so that supersede means something —
 * an open string gets "writing-style" beside "writing_style" and two live rules
 * that contradict each other.
 *
 * `COLUMN_BACKED_TOPICS` are the preferences that already have a real home. A
 * rate is the base rate on Salary Prep and which jobs they want is their Match
 * Config, and a directive holding either would be a second, silent copy that
 * drifts from the one the product actually uses — which is how the salary
 * stores came to disagree three ways. They are offered to the model as topics
 * so it has an honest place to file one, and every write to them is refused with
 * the right place named (Rule 1 in the plan). A rule that only lived in the
 * prompt would hold until the model had a bad day.
 *
 * ## load / format / text
 *
 * The split every context source here follows (see generation-context.ts):
 * `loadDirectives` reads and throws, `formatDirectives` is pure and owns the
 * wording, `directivesText` composes the two. The one departure is what a
 * failed read becomes. Elsewhere it is "" — context is a bonus — but "" here
 * reads as "none recorded", and telling someone they have set no limits because
 * a query timed out is the one answer this block exists to rule out.
 */

import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { profile_directives } from '$lib/server/db/schema';

/** Who reads a directive. The generator says which it is; nothing infers it. */
export type DirectiveConsumer = 'chat' | 'letters' | 'answers';

export const DIRECTIVE_CONSUMERS: DirectiveConsumer[] = ['chat', 'letters', 'answers'];

/** For the page, which names where a directive is used. */
export const CONSUMER_LABELS: Record<DirectiveConsumer, string> = {
	chat: 'the assistant',
	letters: 'cover letters and interview cheat sheets',
	answers: 'application answers'
};

export interface DirectiveTopicDef {
	/** As the page and the prompt name it. */
	label: string;
	/** What belongs under it, in one clause — the model files by this. */
	what: string;
	/**
	 * Which generations read a directive on this topic.
	 *
	 * Decided by the topic rather than by the model per row: a writing rule that
	 * reached the chat but not the cover-letter generator would be a rule the
	 * assistant promised and the letter broke, and "which of three consumers"
	 * is one more thing for a model to get wrong on a card nobody reads twice.
	 * Stored on the row all the same, so it can widen per row later without a
	 * migration. The matcher is in none of them: see Rule 4 in the plan.
	 */
	appliesTo: DirectiveConsumer[];
}

export const DIRECTIVE_TOPICS = {
	domains: {
		label: 'Domains',
		what: 'industries, sectors and kinds of work they will or will not take on',
		appliesTo: ['chat']
	},
	positioning: {
		label: 'Positioning',
		what: 'how to present them: what to lead with, what to play up or down',
		appliesTo: ['chat', 'letters', 'answers']
	},
	writing_style: {
		label: 'Writing style',
		what: 'how anything written for them should read: tone, length, phrases to use or avoid',
		appliesTo: ['chat', 'letters', 'answers']
	},
	personal_details: {
		label: 'Personal details',
		what: 'personal information that may or may not appear in what you write for them',
		appliesTo: ['chat', 'letters', 'answers']
	},
	working_with_you: {
		label: 'Working with you',
		what: 'how they want you to work with them: language, level of detail, what to ask first',
		appliesTo: ['chat']
	}
} satisfies Record<string, DirectiveTopicDef>;

export type DirectiveTopic = keyof typeof DIRECTIVE_TOPICS;

export const DIRECTIVE_TOPIC_NAMES = Object.keys(DIRECTIVE_TOPICS) as DirectiveTopic[];

/**
 * Preferences with a real home, and where it is. See the header for why they
 * are topics at all.
 */
export const COLUMN_BACKED_TOPICS = {
	salary: {
		label: 'Rate or salary',
		refusal:
			'A rate is not a directive: it is the base rate and adjustments on their Salary ' +
			'Prep page (/applications/salary), which every salary answer is worked out from. ' +
			'Tell them to set it there — stored here it would be a second copy that nothing uses.'
	},
	job_search: {
		label: 'Which jobs they want',
		refusal:
			'Which jobs they want — work types, seniority, remote or on-site, places, ' +
			'community jobs — is their Match Config: propose edit_match_config instead. ' +
			'Stored here it would sit beside that config and drift from it.'
	}
} as const;

export type ColumnBackedTopic = keyof typeof COLUMN_BACKED_TOPICS;

export function isDirectiveTopic(topic: string): topic is DirectiveTopic {
	return topic in DIRECTIVE_TOPICS;
}

export function isColumnBackedTopic(topic: string): topic is ColumnBackedTopic {
	return topic in COLUMN_BACKED_TOPICS;
}

/**
 * The longest statement a topic holds.
 *
 * A directive is a sentence or two in their words, not an essay: the whole
 * block ships on every turn, and a topic's statement is replaced whole, so a
 * long one is also a long thing to lose by accident. Five topics at this length
 * is what `DIRECTIVES_CEILING_CHARS` is sized against.
 */
export const MAX_STATEMENT_CHARS = 500;

/**
 * Ceiling on the rendered block.
 *
 * Every live directive at `MAX_STATEMENT_CHARS` fits under it with the framing,
 * so in practice nothing is ever cut — the test that holds that is the ratchet.
 * It exists anyway because a constraint block that grows without bound is the
 * predictable failure here, and when this one has to give it says so in the
 * block rather than dropping a limit silently.
 */
export const DIRECTIVES_CEILING_CHARS = 4000;

/** Which surface wrote a row. `import` and `undo` are the two with no chat or key behind them. */
export type DirectiveSourceType = 'chat' | 'mcp' | 'ui' | 'import' | 'undo';

export interface Directive {
	id: number;
	/** A topic this code knows, or one it no longer does — kept, since it is what they said. */
	topic: string;
	statement: string;
	appliesTo: string[];
	statedAt: Date;
	source: string;
}

export interface DirectiveHistoryEntry extends Directive {
	/** The row that replaced it, or null when it was stopped instead. */
	supersededBy: number | null;
	/** When it stopped applying: replaced or stopped. */
	endedAt: Date | null;
}

/** Topic order, so the block and the page list them the same way every time. */
function topicRank(topic: string): number {
	const at = DIRECTIVE_TOPIC_NAMES.indexOf(topic as DirectiveTopic);
	return at === -1 ? DIRECTIVE_TOPIC_NAMES.length : at;
}

export function topicLabel(topic: string): string {
	if (isDirectiveTopic(topic)) return DIRECTIVE_TOPICS[topic].label;
	return topic.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function toDirective(row: typeof profile_directives.$inferSelect): Directive {
	return {
		id: row.id,
		topic: row.topic,
		statement: row.statement,
		appliesTo: row.applies_to,
		statedAt: row.stated_at,
		source: row.source?.type ?? 'chat'
	};
}

/** Every live directive on a profile, in topic order. Throws on a failed read. */
export async function loadDirectives(profileId: number): Promise<Directive[]> {
	const rows = await db
		.select()
		.from(profile_directives)
		.where(
			and(
				eq(profile_directives.profile_id, profileId),
				isNull(profile_directives.superseded_by),
				isNull(profile_directives.retired_at)
			)
		)
		.orderBy(asc(profile_directives.id));
	return rows.map(toDirective).sort((a, b) => topicRank(a.topic) - topicRank(b.topic));
}

/** Everything no longer live, newest first — the trail every change leaves. */
export async function loadDirectiveHistory(profileId: number): Promise<DirectiveHistoryEntry[]> {
	const rows = await db
		.select()
		.from(profile_directives)
		.where(eq(profile_directives.profile_id, profileId))
		.orderBy(desc(profile_directives.id));

	const byId = new Map(rows.map((row) => [row.id, row]));
	return rows
		.filter((row) => row.superseded_by !== null || row.retired_at !== null)
		.map((row) => ({
			...toDirective(row),
			supersededBy: row.superseded_by,
			// A replaced row ended when its successor was stated.
			endedAt:
				row.retired_at ??
				(row.superseded_by !== null ? (byId.get(row.superseded_by)?.stated_at ?? null) : null)
		}));
}

/**
 * "2026-09-22". ISO rather than a locale's spelling: this is read by a model,
 * which parses it without ambiguity, and ICU's short months are not stable
 * across versions ("Sep" in one, "Sept" in the next).
 */
function dateOf(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/**
 * Cut every statement to an equal share when the block would pass its ceiling.
 *
 * Equal rather than oldest-first, because dropping a directive whole is the
 * failure the ceiling exists to avoid: a shortened limit still reads as a limit,
 * and the note below says the full text is elsewhere.
 */
function fitStatements(
	directives: Directive[],
	frameChars: number,
	ceiling: number
): { directives: Directive[]; cut: boolean } {
	const total = frameChars + directives.reduce((n, d) => n + d.statement.length, 0);
	if (total <= ceiling || directives.length === 0) return { directives, cut: false };

	const share = Math.max(80, Math.floor((ceiling - frameChars) / directives.length));
	return {
		directives: directives.map((d) =>
			d.statement.length > share ? { ...d, statement: `${d.statement.slice(0, share - 1)}…` } : d
		),
		cut: true
	};
}

const CHAT_HEADING = '## What they have told you to keep to';

/**
 * Said in the empty state and the full one, because it is the failure the whole
 * feature exists for: agreeing to remember something and storing nothing.
 */
const KEPT_ONLY_HERE =
	'A new standing preference is kept only once it is listed here, and it gets here ' +
	'through a proposal they apply. Never tell them you will remember something you ' +
	'have not proposed.';

const CUT_NOTE =
	'Some statements above were shortened to fit. The full text is on their Directives ' +
	'page (/data/directives); if one matters to what they are asking, say it was cut.';

function formatForChat(directives: Directive[], ceiling: number): string {
	if (directives.length === 0) {
		return [
			CHAT_HEADING,
			'',
			'Nothing: they have not recorded a standing directive on any topic yet. Asked what ' +
				'they have told you, that is the answer. What you can read in their profile is your ' +
				'inference, not something they said — keep the two apart.',
			'',
			KEPT_ONLY_HERE
		].join('\n');
	}

	const held = new Set(directives.map((d) => d.topic));
	const silent = DIRECTIVE_TOPIC_NAMES.filter((topic) => !held.has(topic)).map((topic) =>
		DIRECTIVE_TOPICS[topic].label.toLowerCase()
	);

	const frame = (lines: string[], cut: boolean) =>
		[
			CHAT_HEADING,
			'',
			'Every standing directive they have recorded, one per topic. Nothing was left out ' +
				'for space, so this is the whole list:',
			'',
			...lines,
			...(silent.length > 0 ? ['', `Nothing recorded on: ${silent.join(', ')}.`] : []),
			'',
			'Follow these in everything you write and propose for them without being reminded, ' +
				'and say so when a request would break one. They limit what you produce, not what ' +
				'you may discuss: a domain they avoid is still a job you can talk about when they ' +
				'bring one up.',
			'',
			'Asked what they have told you, this list is the whole answer. Anything you add from ' +
				'their profile is your reading of it, not something they said — say which is which.',
			'',
			KEPT_ONLY_HERE,
			...(cut ? ['', CUT_NOTE] : [])
		].join('\n');

	const line = (d: Directive) =>
		`- ${topicLabel(d.topic)} (stated ${dateOf(d.statedAt)}): ${d.statement}`;
	const frameChars = frame([], true).length + directives.length * 40;
	const fitted = fitStatements(directives, frameChars, ceiling);
	return frame(fitted.directives.map(line), fitted.cut);
}

/**
 * The block for a writer that is not the chat: only what applies to it, and
 * nothing at all when that is nothing.
 *
 * No empty state here, unlike the chat's. A cover letter has no use for being
 * told there is nothing to keep to, and "what have I told you?" is not a
 * question a letter is ever asked.
 */
function formatForWriter(directives: Directive[], ceiling: number): string {
	if (directives.length === 0) return '';

	const frame = (lines: string[], cut: boolean) =>
		[
			"## The applicant's standing directives",
			'',
			'They asked for these in everything written for them. Follow them: they override the ' +
				'style guidance above, never the output format you were asked for.',
			'',
			...lines,
			...(cut ? ['', CUT_NOTE] : [])
		].join('\n');

	const line = (d: Directive) => `- ${topicLabel(d.topic)}: ${d.statement}`;
	const frameChars = frame([], true).length + directives.length * 20;
	const fitted = fitStatements(directives, frameChars, ceiling);
	return frame(fitted.directives.map(line), fitted.cut);
}

/**
 * The block for one consumer. Pure: data in, prompt text out.
 *
 * Filters on the rows' own `applies_to`, not on the topic's default, because
 * the row is what was stated and approved.
 */
export function formatDirectives(
	directives: Directive[],
	consumer: DirectiveConsumer,
	ceiling = DIRECTIVES_CEILING_CHARS
): string {
	const applicable = directives.filter((d) => d.appliesTo.includes(consumer));
	return consumer === 'chat'
		? formatForChat(applicable, ceiling)
		: formatForWriter(applicable, ceiling);
}

/**
 * What the chat is told when the read failed. Deliberately not the empty state:
 * see the header on why "" would be the wrong thing to fail to.
 */
export const DIRECTIVES_UNREADABLE =
	`${CHAT_HEADING}\n\n` +
	'Their standing directives could not be read this turn. They may have some: never tell ' +
	'them they have none, and follow anything they state in this conversation.';

export async function directivesText(
	profileId: number,
	consumer: DirectiveConsumer
): Promise<string> {
	try {
		return formatDirectives(await loadDirectives(profileId), consumer);
	} catch (e) {
		console.error('[directives] could not read the standing directives', e);
		// A writer goes without, like every other source: it has no one to tell.
		return consumer === 'chat' ? DIRECTIVES_UNREADABLE : '';
	}
}

/** One write per topic: a statement replaces the live one, null stops it, absent leaves it. */
export type DirectivePatch = Partial<Record<string, string | null>>;

/**
 * Apply a patch: the only way a directive is written.
 *
 * Each topic in the patch supersedes its live row with a new one, or retires it
 * when the value is null. A statement identical to the live one writes nothing,
 * so re-stating a rule does not bury its history under copies of itself.
 *
 * The order inside the transaction is dictated by the partial unique index that
 * holds one live row per topic: the old row stops being live (retired, for a
 * moment) before the new one exists, and only then points at it.
 *
 * Topics outside `DIRECTIVE_TOPICS` are refused here as well as in the
 * capability's `validate`: the page and the importer write through this too,
 * and neither goes through a validate.
 */
/** A transaction on the direct pool, for a caller already inside one. */
type DirectTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function writeDirectives(
	profileId: number,
	patch: DirectivePatch,
	source: DirectiveSourceType,
	/**
	 * `statedAt` for an import, which keeps the date they said it rather than the
	 * date it was copied. `tx` for a caller that is already in a transaction — the
	 * settings import, which should land whole or not at all.
	 */
	opts: { statedAt?: Date; tx?: DirectTransaction } = {}
): Promise<{ written: string[] }> {
	const entries = Object.entries(patch).filter(
		(entry): entry is [string, string | null] => entry[1] !== undefined
	);
	for (const [topic, value] of entries) {
		if (!isDirectiveTopic(topic)) throw new Error(`Unknown directive topic: ${topic}`);
		if (value !== null && !value.trim()) throw new Error(`Empty directive for ${topic}`);
	}

	const written: string[] = [];
	const run = async (tx: DirectTransaction) => {
		for (const [topic, value] of entries) {
			const [live] = await tx
				.select()
				.from(profile_directives)
				.where(
					and(
						eq(profile_directives.profile_id, profileId),
						eq(profile_directives.topic, topic),
						isNull(profile_directives.superseded_by),
						isNull(profile_directives.retired_at)
					)
				)
				.for('update');

			const now = new Date();

			if (value === null) {
				if (!live) continue;
				await tx
					.update(profile_directives)
					.set({ retired_at: now, date_updated: now })
					.where(eq(profile_directives.id, live.id));
				written.push(topic);
				continue;
			}

			const statement = value.trim();
			if (live?.statement === statement) continue;

			if (live) {
				await tx
					.update(profile_directives)
					.set({ retired_at: now })
					.where(eq(profile_directives.id, live.id));
			}

			const [created] = await tx
				.insert(profile_directives)
				.values({
					profile_id: profileId,
					topic,
					statement,
					applies_to: [...DIRECTIVE_TOPICS[topic as DirectiveTopic].appliesTo],
					stated_at: opts.statedAt ?? now,
					source: { type: source },
					date_created: now
				})
				.returning({ id: profile_directives.id });

			if (live) {
				await tx
					.update(profile_directives)
					.set({ superseded_by: created.id, retired_at: null, date_updated: now })
					.where(eq(profile_directives.id, live.id));
			}
			written.push(topic);
		}
	};

	if (opts.tx) await run(opts.tx);
	else await db.transaction(run);

	return { written };
}
