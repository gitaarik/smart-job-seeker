/**
 * The record of what a generation actually retrieved.
 *
 * Retrieval already decides which of the applicant's projects, stories and past
 * application writing a draft is built from, and until now that decision left no
 * trace: `ai_chats.full_prompt` holds the rendered blocks, so the picks were
 * *readable* only by eyeballing a 50k-char prompt, and the ranker behind them —
 * embeddings, keyword overlap, the skill graph — was not recorded anywhere at
 * all. `assembleGenerationContext` computed `usedSources` / `droppedSources` and
 * threw them away.
 *
 * So this is the small, durable half of that prompt: a few hundred bytes saying
 * what was picked, by which ranker, at what score, and what was requested and
 * did NOT make it. It is deliberately separate from the prompt columns because
 * it must outlive them — `ai-chats/retention.ts` nulls `full_prompt` and
 * `context` on old rows, and the questions this answers ("did semantic ranking
 * run or did it silently fall back", "did the budget drop the past writing",
 * "is the graph pick earning its slot") are the ones asked *after* the fact.
 *
 * Two audiences, one record, and the split matters:
 *  - STAFF get it whole: scores, ranker, budgets, what was dropped.
 *  - APPLICANTS get `mentionsFor()` — titles and links, nothing else. A cosine
 *    of 0.61 is not information to someone deciding whether the draft leaned on
 *    the right project; the project's NAME is.
 *
 * The record is written by the retrieval layer and read by the UI, so it holds
 * no prompt framing and no behavioural instruction — see the load/format/compose
 * note in generation-context.ts.
 */

/**
 * Which ranker produced a source's scores.
 *
 *  - `semantic` — embedding cosine, the normal case with SJS_EMBEDDING_ENABLED on.
 *  - `overlap` — deterministic token/skill overlap: embeddings off, the provider
 *    failed, or the cosine floor cleared nobody and the widened keywords became
 *    the whole answer.
 *  - `none` — there was nothing to rank (the profile has no units of this kind).
 */
export type RankerKind = 'semantic' | 'overlap' | 'none';

/** How one item came to be in the list. */
export type RetrievalVia =
	| 'semantic'
	| 'overlap'
	/** The skill-graph-widened ranker's reserved slot — see withGraphPick. */
	| 'graph'
	/** The caller named it; it was never ranked. */
	| 'pinned';

/** One thing retrieval put in front of the model. */
export interface RetrievalItem {
	/** The ContextSource that produced it, e.g. "projects". */
	source: string;
	/** Unit namespace within that source, e.g. "side_project", "app_answer". */
	kind: string;
	id: number;
	title: string;
	/** The qualifier the prompt shows alongside the title, e.g. "at Acme Corp". */
	context?: string;
	/**
	 * Cosine in [0, 1] when `via` is "semantic"; an unbounded count of keyword
	 * hits when it is "overlap" or "graph"; a sort key, not a measurement, when
	 * it is "pinned". The two scales are NOT comparable — see withGraphPick.
	 */
	score: number;
	via: RetrievalVia;
	/**
	 * The row this one hangs off, where its page needs two ids: the work
	 * experience for a work_experience_project, the application for a past letter
	 * or answer. Unset for anything addressed by its own id alone.
	 *
	 * Ids rather than a built URL, deliberately. This record is stored and read
	 * back months later, and a path baked into a row in August is a dead link the
	 * day a route moves — the UI resolves the route from the route table it is
	 * compiled against. See RetrievalSources.svelte.
	 */
	parentId?: number;
}

/** What one generation retrieved. Stored on `ai_chats.retrieval`. */
export interface RetrievalRecord {
	/**
	 * ContextSource names. Strings rather than the union so this module stays
	 * below `generation-context.ts` rather than importing back up into it.
	 */
	requested: string[];
	/** Rendered non-empty and reached the model. */
	used: string[];
	/** Rendered, then lost the budget race. The distinction users never see. */
	dropped: string[];
	/** Ran their lookup and found nothing — NOT the same as never looked. */
	empty: string[];
	/** Rendered size per used source, in chars. */
	chars: Record<string, number>;
	/** The profile blob's size, which is exempt from the evidence budget. */
	profileChars: number;
	/** The evidence budget the above was packed into. */
	budgetChars: number;
	/** Which ranker actually scored each ranked source, empty results included. */
	rankers: Record<string, RankerKind>;
	/** What the ranked sources were scored against (clipped). */
	query?: { text: string; skills?: string[] };
	/** Every item the ranked sources cited, best-first within each source. */
	items: RetrievalItem[];
}

/**
 * A rendered evidence block together with the record of what went into it.
 *
 * The two travel as one because they are produced by the same pass: the picks
 * are in scope exactly once, while the block is being written. Re-deriving them
 * afterwards would mean ranking (and embedding) twice for the same answer.
 */
export interface RetrievedBlock {
	/** The self-contained prompt block, "" when nothing was retrieved. */
	text: string;
	/** What it cites, best-first. */
	items: RetrievalItem[];
	/** Which ranker scored this source, empty result included. */
	ranker: RankerKind;
}

/** Keep the stored query readable without storing a whole job description. */
export const QUERY_CLIP_CHARS = 500;

/** One retrieved item, as an applicant may see it. */
export interface RetrievalMention {
	kind: string;
	id: number;
	/** See RetrievalItem.parentId — the other half of a two-id route. */
	parentId?: number;
	title: string;
	context?: string;
}

/**
 * The applicant-facing view of a record: what the draft drew on, by name.
 *
 * Everything quantitative is dropped on purpose. Scores, the ranker, the budget
 * and the dropped-source list are diagnostics for us; to the person reading the
 * draft they are noise that makes a simple, useful sentence ("this leaned on the
 * wrong project") look like a machine-learning readout.
 */
export function mentionsFor(record: RetrievalRecord | null | undefined): RetrievalMention[] {
	return (record?.items ?? []).map((i) => ({
		kind: i.kind,
		id: i.id,
		...(i.parentId === undefined ? {} : { parentId: i.parentId }),
		title: i.title,
		...(i.context ? { context: i.context } : {})
	}));
}

/**
 * Ranked sources that produced picks and then lost the budget race.
 *
 * Identified by having a ranker rather than by a hardcoded list, so a source
 * added to the registry is covered without editing this.
 */
export function crowdedOut(record: RetrievalRecord | null | undefined): string[] {
	if (!record) return [];
	return record.dropped.filter((s) => s in record.rankers);
}

/**
 * Whether a record says retrieval ran and found nothing, as opposed to never
 * having run — or having found plenty and been unable to fit it.
 *
 * The empty case is worth showing an applicant, and it is the one an "only
 * render when there are items" check would hide: "we looked through your
 * projects and stories and none of them fit this question" is the strongest
 * prompt there is to go and fill the profile in.
 *
 * The crowded-out case is excluded for the reason the prompt blocks keep
 * `emptyNote` and `droppedNote` apart, one layer up: measured on a real
 * application, a 21.6k-char job description consumed a 24k evidence budget
 * whole, and all three ranked sources were dropped after retrieving nine
 * genuine matches. Reporting that as "nothing in your profile matched" states
 * the opposite of what happened, and sends the applicant off to write material
 * they already have.
 */
export function lookedAndFoundNothing(record: RetrievalRecord | null | undefined): boolean {
	if (!record) return false;
	return (
		record.items.length === 0 &&
		Object.keys(record.rankers).length > 0 &&
		crowdedOut(record).length === 0
	);
}
