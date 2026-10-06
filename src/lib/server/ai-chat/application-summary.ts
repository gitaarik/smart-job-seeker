/**
 * A standing digest of one application, plus its offer terms as fields and the
 * details it picked up along the way.
 *
 * One pass produces all three because they read the same material — every entry
 * on the application, oldest first. A second call would double the cost to
 * reread what this one already has in front of it, and could disagree with it.
 *
 * The comparison spine can afford one line per application, not their
 * histories. This is what lets that line say something — *where this stands,
 * what is outstanding* — instead of only counting entries.
 *
 * ## Why this is not retrieval
 *
 * A summary and top-k retrieval fail in opposite directions. Retrieval loses
 * completeness: ask it to compare and it returns a biased sample, and a
 * comparison over a biased sample is wrong rather than thin. A summary loses
 * specificity: it is written before the question exists, so the detail someone
 * eventually asks for may not have survived. So each does the job the other
 * cannot — the summary is the comparison, retrieval is the drill-down — and the
 * summary is also what tells the model a detail EXISTS, so it knows when to say
 * "that is on the other application's page" instead of inventing it.
 *
 * ## Why offer terms are fields and not prose
 *
 * Comparing two offers from two prose blobs means re-extracting base, bonus,
 * equity and deadline at answer time, every time, with no consistency
 * guarantee — on the single highest-stakes question in the product. Extracting
 * once, at write time, makes the comparison exact. It also surfaces
 * `respond_by`, which is urgent, actionable and invisible today.
 *
 * ## When it runs
 *
 * At WRITE time, after a record changes — not lazily on read. Reads are chat
 * turns: frequent and latency-sensitive, and a stale-on-read design would make
 * one turn trigger an LLM call per stale application. Writes are rare and
 * already doing work. Hash-gated either way, so an edit that does not change
 * what the summary depends on costs nothing.
 *
 * ## What it reads
 *
 * Short entries whole, and long ones through their digests (entry-digest.ts):
 * a line on what the entry is and the facts it holds, written once from the
 * whole entry. It used to read the raw text of everything, oldest first, cut at
 * 40,000 characters, which on a busy application meant the opening weeks and
 * nothing after them, with a prompt telling the model it had every entry. The
 * digests are what let it read all of them, and they are written here, just
 * before they are needed, so every path that already calls this after a write
 * digests the entry it wrote.
 *
 * See planning/SEMANTIC-MATCHING-AND-RAG.md and planning/APPLICATION-KEY-FACTS.md.
 */

import { createHash } from 'node:crypto';
import { db } from '$lib/server/db';
import { asc, eq } from 'drizzle-orm';
import { application_records, applications } from '$lib/server/db/schema';
import { createAndGenerateAiChat } from './utils';
import { truncateKeepingEnds } from './application-activity';
import {
	coerceDigest,
	digestEntry,
	digestReadsCurrentText,
	needsDigest,
	type AheadRound,
	type EntryDigest
} from './entry-digest';
import {
	getRecordTypeLabel,
	LONG_ENTRY_CHARS,
	summaryIsWorthWriting,
	today
} from '$lib/application-records';
import type { OfferTerms } from '$lib/application-offer';
import { coerceDetails, type ApplicationDetail } from '$lib/application-details';

/**
 * Cap on what the summariser reads. It is now a backstop rather than the thing
 * deciding what is seen: with long entries arriving as digests, the busiest
 * application on dev (40 entries, 379,000 characters of text) renders to well
 * under it. Past it, the oldest entries are shortened first, then left out, and
 * the model is told.
 */
const MAX_CHARS_SENT = 80000;

/**
 * How much of a long entry is shown when it has no digest: its digest failed,
 * or there were more stale entries than one pass digests. Head and tail, like
 * the activity context, and marked as cut.
 */
const EXCERPT_CHARS = 4000;

/**
 * How many stale entries one write-time pass digests before it summarises.
 * Normally there is one, the entry just written. More than that is a backlog
 * (a failed call, an application untouched since digests shipped), and a save
 * should not wait for all of it: the rest are read as excerpts this time, and
 * the backfill or the next write gets to them.
 */
const DIGESTS_PER_PASS = 3;

/** Heading plus a gist or an opening: what an entry shrinks to when space runs out. */
const SHORTENED_CHARS = 300;

/**
 * The extraction contract's version, carried as a prefix on every hash.
 *
 * The hash answers "have the entries changed since this was written", which is
 * the right question only for as long as the summariser keeps extracting the
 * same things. Teach it to extract something new and every existing summary is
 * stale for a reason the entries know nothing about — the hash over those
 * entries still matches, so the write path skips them, forever.
 *
 * Not hypothetical. `context_details` shipped after every application on dev had
 * already been summarised, and not one of them ever had a detail extracted: the
 * write path was hash-gated and the backfill selected on `hash IS NULL`, so the
 * two independently agreed to skip precisely the rows that needed the work. The
 * feature looked built and was dead on arrival, with nothing anywhere reporting
 * a problem — the card just rendered nothing, which is also what it correctly
 * does for an application that genuinely has no details.
 *
 * Bump this when the summariser's OUTPUT changes shape — a new extracted field,
 * a materially different contract. Not for prompt wording, which would charge a
 * full re-extraction for a result nobody is waiting on.
 *
 *   v1 — summary + offer terms
 *   v2 — adds context_details
 *   v3 — adds `decision` details: the applicant's own conclusions about the
 *        application, which v2 dropped as not being facts about it
 *   v4 — reads long entries through their digests instead of stopping at the
 *        first 40,000 characters, and summarises a single long entry
 *   v5 — adds `next_step` details, read from the digests' rounds ahead, and
 *        `people`; tells the model the cap rather than letting it cut the newest
 */
export const SUMMARY_CONTRACT_VERSION = 5;

/** The prefix a current-contract hash starts with. Also the backfill's LIKE. */
export const CONTRACT_PREFIX = `v${SUMMARY_CONTRACT_VERSION}:`;

export type { OfferTerms };

/** What the summary is built from, one per entry with text. */
export interface SummarySource {
	id: number;
	record_type: string | null;
	title: string | null;
	content: string | null;
	event_date: string | null;
	/**
	 * The entry's digest, when it has one written from its current text. One
	 * written from other text is passed as null: it describes text that no
	 * longer exists. One from an older digest contract is passed as it is
	 * (`digestReadsCurrentText`).
	 */
	digest: EntryDigest | null;
}

/**
 * Fingerprint what the summariser was shown, so an unrelated edit does not pay
 * for a regeneration.
 *
 * Over the rendered input rather than the rows, because since digests the rows
 * are not what it reads: an entry that gains its digest changes what the model
 * sees without changing the entry. Anything that is not rendered (`date_updated`,
 * which this pass's own write moves) cannot make a summary stale, which is the
 * property that stops one regenerating forever.
 *
 * Version-prefixed, so "the entries changed" and "what we extract from them
 * changed" reach every reader as the same signal. See SUMMARY_CONTRACT_VERSION.
 */
export function summaryHash(rendered: string): string {
	return CONTRACT_PREFIX + createHash('sha256').update(rendered).digest('hex');
}

/**
 * Whether a stored hash was written by the summariser as it exists today.
 *
 * False for null, for the bare-hex hashes written before versioning, and for
 * any superseded version — all three mean "has not been through the current
 * extraction", which is the only distinction a caller here needs.
 */
export function isCurrentContract(hash: string | null | undefined): boolean {
	return !!hash && hash.startsWith(CONTRACT_PREFIX);
}

const asText = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Free-text offer fields, which arrive as a string OR a number depending on
 * the run — "0.15% over 4 years" one time, the bare 0.15 the next. Both are
 * usable; rejecting the number would silently drop a real term.
 */
const asLooseText = (v: unknown): string | null => {
	if (typeof v === 'number' && isFinite(v)) return String(v);
	return asText(v);
};

const asDate = (v: unknown): string | null => {
	const raw = asText(v);
	return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !isNaN(new Date(raw).getTime()) ? raw : null;
};

/**
 * Our side of the boundary. The wire schema cannot carry a `.transform()`, and
 * an offer with nothing in it is worse than no offer — it would make the spine
 * announce "OFFER RECORDED" for an expression of interest.
 */
export function coerceOffer(raw: unknown): OfferTerms | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;

	// Accepts "92000", "92,000" and 92000 alike — the wire type is deliberately
	// loose, so the parsing is this side's job.
	const rawBase = typeof o.base === 'string' ? Number(o.base.replace(/[,\s]/g, '')) : o.base;
	const base =
		typeof rawBase === 'number' && isFinite(rawBase) && rawBase > 0 ? Math.round(rawBase) : null;

	const terms: OfferTerms = {
		base,
		bonus: asLooseText(o.bonus),
		equity: asLooseText(o.equity),
		currency: asText(o.currency)?.toUpperCase().slice(0, 8) ?? null,
		period: asText(o.period)?.toLowerCase() ?? null,
		start_date: asDate(o.start_date),
		respond_by: asDate(o.respond_by),
		notes: asLooseText(o.notes)
	};

	// An "offer" carrying nothing but a currency is a hallucination artefact,
	// not an offer. Require at least one substantive term.
	const substantive =
		terms.base !== null ||
		terms.bonus ||
		terms.equity ||
		terms.respond_by ||
		terms.start_date ||
		terms.notes;
	return substantive ? terms : null;
}

/** What the summariser is handed, and which entries it could cite. */
export interface RenderedSources {
	text: string;
	/** Entries shown in any form. A citation to any other one is invented. */
	shownIds: number[];
	/** Entries shrunk to a line, and entries left out, to fit the cap. */
	shortened: number;
	omitted: number;
}

type Form = 'full' | 'short';

const SEPARATOR = '\n\n---\n\n';

function renderFacts(digest: EntryDigest): string {
	if (digest.facts.length === 0) return 'Facts: none worth keeping.';
	return ['Facts:', ...digest.facts.map((f) => `- ${f.label} [${f.category}]: ${f.value}`)].join(
		'\n'
	);
}

/** "Intro, 2026-10-08 15:30, with Jane Doe (CTO): a call about your background". */
function renderRound(r: AheadRound): string {
	const when = [r.date, r.time].filter(Boolean).join(' ');
	const head = [r.kind, when, r.with ? `with ${r.with}` : null].filter(Boolean).join(', ');
	return head && r.about ? `${head}: ${r.about}` : head || r.about || '';
}

/**
 * The rounds the entry says are still to come, which the next step is written
 * from. Nothing when it names none: most entries do not, and "none" under every
 * one of them would be noise the model reads as a claim.
 */
function renderAhead(digest: EntryDigest): string | null {
	if (digest.ahead.length === 0) return null;
	return ['Rounds ahead:', ...digest.ahead.map((r) => `- ${renderRound(r)}`)].join('\n');
}

/**
 * The next step, when the summariser gave none and the newest entry says what
 * it is: that entry's first round ahead, cited to it.
 *
 * The summariser leaves the next step out now and then (1 run in 8 on the
 * smoke's fixture), and it is the one detail the card leads with. Only from the newest entry, because an older
 * entry's rounds may be behind the applicant by now, as a later note would
 * say; when the newest entry names a round to come, that round is next.
 */
export function nextStepFromNewest(
	sources: SummarySource[],
	shownIds: number[],
	details: ApplicationDetail[]
): ApplicationDetail | null {
	if (details.some((d) => d.category === 'next_step')) return null;
	const shown = new Set(shownIds);
	const newest = sources.filter((s) => shown.has(s.id)).at(-1);
	const round = newest?.digest?.ahead[0];
	if (!newest || !round) return null;
	return {
		category: 'next_step',
		label: 'Next round',
		value: renderRound(round),
		record_id: newest.id
	};
}

/**
 * The prompt's limit on people ("at most three"), which `peopleNamedAhead` fills
 * up to and never past.
 */
const MAX_PEOPLE = 3;

/** Words that sit inside a surname in lower case: "Maarten van den Berg". */
const NAME_PARTICLE = '(?:van|von|de|der|den|di|da|du|del|della|dos|das|la|le|ten|ter|bin|al)';

/**
 * A person's name as a digest writes one: two or more capitalised words, with
 * the particles above between them. Not "Project manager", "Hiring manager at
 * Acme" or "CPTO of Acme", which a digest also puts in `with` and which a
 * first-letter test let through on a real application. A first name alone
 * ("Yana") is not taken either: too often a role is written the same way.
 */
const PERSON_NAME = new RegExp(
	`^\\p{Lu}\\p{Ll}[\\p{L}'’-]*(?:\\s+(?:${NAME_PARTICLE}\\s+)*\\p{Lu}[\\p{L}'’-]*)+$`,
	'u'
);

/**
 * Everyone a digest names to run a round ahead whom the details never mention,
 * as `people` details citing that entry, newest entry first.
 *
 * The other thing about the next step the summariser is not trusted with (the
 * first is `nextStepFromNewest`). It writes the next step from the newest entry
 * that speaks of it, and a call that
 * moves a round usually gives only a title ("the CTO"), so the name an earlier
 * call gave is dropped as replaced. Measured on one intro call naming who would
 * run the first round and one moving that round: the name was gone in all 25
 * runs across five ways of asking to keep it (a rule, a worked example, the
 * rounds side by side, a list to fill, more reasoning). A `people` detail kept
 * it 4 of 4 in one wording and 0 of 5 in the next, and a required list of
 * people 0 of 5. Who someone is does not go stale the way a date does, so this
 * keeps them without asking the model to judge it.
 *
 * A `with` that is a description rather than a name ("the CTO", "Project
 * manager") is left to the next step, which already carries it. A round dated
 * before `on` is behind the applicant, and its people with it. Only up to the
 * prompt's three people, so it never crowds out what the model chose: on a
 * 40-entry application it added the people of rounds months behind. Each says
 * when it was said, since an undated round may be behind them too.
 */
export function peopleNamedAhead(
	sources: SummarySource[],
	shownIds: number[],
	details: ApplicationDetail[],
	on: string = today()
): ApplicationDetail[] {
	const room = MAX_PEOPLE - details.filter((d) => d.category === 'people').length;
	if (room <= 0) return [];
	const shown = new Set(shownIds);
	const mentioned = details.map((d) => `${d.label} ${d.value}`.toLowerCase());
	const added: ApplicationDetail[] = [];
	const seen = new Set<string>();

	for (const source of [...sources].reverse()) {
		if (!shown.has(source.id)) continue;
		for (const round of source.digest?.ahead ?? []) {
			if (round.date && round.date < on) continue;
			const who = round.with?.trim() ?? '';
			const name = who.split(/[,;(]/)[0].trim();
			const key = name.toLowerCase();
			if (name.length > 60 || !PERSON_NAME.test(name)) continue;
			if (seen.has(key) || mentioned.some((m) => m.includes(key))) continue;
			seen.add(key);

			const role = who.slice(name.length).replace(/^[\s,;(]+|[\s)]+$/g, '');
			const what = renderRound({ ...round, with: null });
			const named = `Named${source.event_date ? ` on ${source.event_date}` : ''} to run`;
			added.push({
				category: 'people',
				label: name,
				value: [
					role ? `${role.charAt(0).toUpperCase()}${role.slice(1)}.` : null,
					what ? `${named}: ${what}` : `${named} a round.`
				]
					.filter(Boolean)
					.join(' '),
				record_id: source.id
			});
		}
	}
	return coerceDetails(added, shownIds, room);
}

/**
 * One entry, in one of the three ways the summariser meets it: whole when it
 * is short, as its digest when it is long, and cut to both ends, and marked
 * as cut, when it is long and has no digest. `short` is the last resort
 * before leaving it out.
 */
function renderEntry(r: SummarySource, form: Form): string {
	const text = (r.content ?? '').trim();
	const head = [
		`### [entry ${r.id}] ${getRecordTypeLabel(r.record_type)}: ${r.title?.trim() || 'Untitled'}`,
		r.event_date ? `Date: ${r.event_date}` : null
	].filter((l) => l !== null);

	if (form === 'short') {
		const line = r.digest?.gist ?? truncateKeepingEnds(text, SHORTENED_CHARS);
		return [...head, `Shortened to fit: the entry is ${text.length} characters.`, '', line].join(
			'\n'
		);
	}
	if (text.length <= LONG_ENTRY_CHARS) return [...head, '', text].join('\n');
	if (r.digest) {
		return [
			...head,
			`Shown as its digest: the entry is ${text.length} characters.`,
			'',
			`What it is: ${r.digest.gist}`,
			renderFacts(r.digest),
			renderAhead(r.digest)
		]
			.filter((l) => l !== null)
			.join('\n');
	}
	const excerpt = truncateKeepingEnds(text, EXCERPT_CHARS);
	return [
		...head,
		`Shown: ${excerpt.length} of ${text.length} characters. The middle is cut.`,
		'',
		excerpt
	].join('\n');
}

/**
 * The chronology the summariser reads, oldest first.
 *
 * The id is in each heading so an extracted detail can cite the entry it came
 * from. Without it the model has nothing to name, and a detail nobody can trace
 * back is one nobody can check: `coerceDetails` drops a citation to an entry
 * that was never shown, which is what `shownIds` is for.
 *
 * Over the cap, the oldest entries shrink to a line first and are left out
 * after that, and a note says how many of each, because a history cut without
 * a word reads as a complete one. That silence is what let the old 40,000-
 * character slice pass off an application's first weeks as all of it. Notes
 * go last in both steps: they are short, and they are where the applicant's
 * own decisions live, which nothing else records.
 */
export function renderSourceEntries(
	records: SummarySource[],
	maxChars: number = MAX_CHARS_SENT
): RenderedSources {
	const forms: Array<Form | null> = records.map(() => 'full');
	const blocks = records.map((r) => renderEntry(r, 'full'));
	const size = () =>
		blocks.reduce((sum, b, i) => (forms[i] === null ? sum : sum + b.length + SEPARATOR.length), 0);

	const order = records
		.map((r, i) => ({ i, note: r.record_type === 'note' ? 1 : 0 }))
		.sort((a, b) => a.note - b.note || a.i - b.i)
		.map((o) => o.i);

	for (const i of order) {
		if (size() <= maxChars) break;
		forms[i] = 'short';
		blocks[i] = renderEntry(records[i], 'short');
	}
	for (const i of order) {
		if (size() <= maxChars) break;
		// Never the last one: a shortened entry beats an empty history.
		if (forms.filter((f) => f !== null).length === 1) break;
		forms[i] = null;
	}

	const shortened = forms.filter((f) => f === 'short').length;
	const omitted = forms.filter((f) => f === null).length;
	const are = (n: number) => (n === 1 ? 'entry is' : 'entries are');
	const notice =
		shortened + omitted > 0
			? 'NOTE: this history is longer than can be shown in full. ' +
				(omitted > 0 ? `The ${omitted} oldest ${are(omitted)} left out. ` : '') +
				(shortened > 0 ? `${shortened} older ${are(shortened)} shortened to a line. ` : '') +
				'What is shown in full is the most recent.\n\n'
			: '';

	return {
		text: notice + blocks.filter((_, i) => forms[i] !== null).join(SEPARATOR),
		shownIds: records.filter((_, i) => forms[i] !== null).map((r) => r.id),
		shortened,
		omitted
	};
}

/**
 * Digest the entries that need it, a few at a time. Returns the digests it
 * wrote, by entry id; an entry whose call failed is simply absent and is read
 * as an excerpt.
 */
async function digestStale(
	stale: Array<{ id: number }>,
	profileId: number
): Promise<Map<number, EntryDigest>> {
	const written = new Map<number, EntryDigest>();
	const CONCURRENCY = 3;
	for (let at = 0; at < stale.length; at += CONCURRENCY) {
		const batch = stale.slice(at, at + CONCURRENCY);
		const results = await Promise.all(batch.map((r) => digestEntry(r.id, profileId)));
		results.forEach((d, k) => {
			if (d) written.set(batch[k].id, d);
		});
	}
	return written;
}

/**
 * Regenerate one application's summary, offer terms and key facts, if anything
 * they depend on has changed. Returns true when it wrote something.
 *
 * Digests stale long entries first (newest first, `maxDigests` of them), so the
 * write that called this is read through its digest. The backfill passes a
 * higher limit to work through a backlog.
 *
 * Best-effort throughout: the spine degrades to counts without a summary, which
 * is what it did before this existed, so nothing here is worth failing a save.
 */
export async function summarizeApplication(
	applicationId: number,
	profileId: number,
	opts: { maxDigests?: number } = {}
): Promise<boolean> {
	try {
		const [app, records] = await Promise.all([
			db.query.applications.findFirst({
				where: eq(applications.id, applicationId),
				columns: { id: true, context_summary_hash: true }
			}),
			db.query.application_records.findMany({
				where: eq(application_records.application_id, applicationId),
				columns: {
					id: true,
					record_type: true,
					title: true,
					content: true,
					event_date: true,
					digest: true,
					digest_hash: true
				},
				orderBy: [asc(application_records.event_date), asc(application_records.date_created)]
			})
		]);
		if (!app) return false;

		const usable = records.filter((r) => r.content?.trim());
		if (!summaryIsWorthWriting(usable.map((r) => r.content!.trim().length))) {
			// Not enough to condense. Clear any stale summary rather than leave one
			// describing entries that have since been deleted.
			if (app.context_summary_hash) {
				await db
					.update(applications)
					.set({
						context_summary: null,
						context_summary_hash: null,
						context_summary_at: new Date(),
						offer_terms: null,
						context_details: []
					})
					.where(eq(applications.id, applicationId));
			}
			return false;
		}

		// Newest first: when the backlog is longer than one pass takes, the
		// entries that describe where things stand now are the ones worth reading.
		const stale = usable
			.filter(needsDigest)
			.reverse()
			.slice(0, opts.maxDigests ?? DIGESTS_PER_PASS);
		const written = await digestStale(stale, profileId);

		const sources: SummarySource[] = usable.map((r) => ({
			id: r.id,
			record_type: r.record_type,
			title: r.title,
			content: r.content,
			event_date: r.event_date,
			digest: written.get(r.id) ?? (digestReadsCurrentText(r) ? coerceDigest(r.digest) : null)
		}));

		const rendered = renderSourceEntries(sources);
		const hash = summaryHash(rendered.text);
		if (hash === app.context_summary_hash) return false;

		const result = await createAndGenerateAiChat(
			profileId,
			'summarize_application',
			{ activity: rendered.text },
			undefined,
			{ traceSession: `application:${applicationId}` }
		);
		if (!result.success || !result.aiChat?.response) return false;

		const parsed = JSON.parse(result.aiChat.response) as {
			summary?: unknown;
			offer?: unknown;
			details?: unknown;
		};
		const summary = asText(parsed.summary);
		if (!summary) return false;

		// Only entries this pass actually showed the model can be cited. The
		// detail list is replaced wholesale rather than merged, which is what
		// keeps it a projection of the current entries instead of a log that
		// accumulates every superseded figure.
		const fromModel = coerceDetails(parsed.details, rendered.shownIds);
		const next = nextStepFromNewest(sources, rendered.shownIds, fromModel);
		// Through coerceDetails again so the added step leads and the cap holds.
		const details = next ? coerceDetails([next, ...fromModel], rendered.shownIds) : fromModel;

		await db
			.update(applications)
			.set({
				context_summary: summary,
				context_summary_hash: hash,
				context_summary_at: new Date(),
				offer_terms: coerceOffer(parsed.offer),
				context_details: [...details, ...peopleNamedAhead(sources, rendered.shownIds, details)]
			})
			.where(eq(applications.id, applicationId));

		return true;
	} catch (error) {
		// The spine still counts entries and reads offer records by type; losing
		// the digest degrades the answer rather than breaking it — so this is
		// best-effort, and stays best-effort.
		//
		// It does not stay silent. Swallowing without a word is how a summariser
		// that had stopped producing anything looked exactly like one with nothing
		// to say: the card renders nothing for an application with no details, and
		// an empty catch renders nothing for an application whose extraction threw.
		console.warn(
			`[summary] application ${applicationId} not summarised:`,
			error instanceof Error ? error.message : error
		);
		return false;
	}
}
