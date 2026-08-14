/**
 * Unified profile-context provider for AI generation.
 *
 * One entry point every generator (cover letters, application answers, STAR
 * stories, interview cheat sheets, …) calls to assemble the *evidence* a prompt
 * needs about the applicant, beyond the always-present `${data}` profile blob:
 * their most relevant projects today, and — as the corpus grows — other stories,
 * past letters, uploaded files, GitHub repo recaps, interview history.
 *
 * Callers declare INTENT — which sources, what the generation is about, how big
 * a budget — and the provider owns the MECHANISM (which ranker, budgeting,
 * rendering). So adding a data source or improving retrieval happens in ONE
 * place and every generator benefits, instead of each generator hand-wiring its
 * own `relevantProjectsText(...)` / `interviewRecordsText(...)` calls.
 *
 * Scale story: on a sparse profile the whole corpus fits in a prompt, so a
 * source just renders everything it has; on a fully-loaded profile it won't, so
 * the budgeter trims to the highest-signal subset. The same call covers both —
 * a generator never changes as a profile fills up.
 *
 * Phase 1 registers a single source, `projects`, reusing the shipped project↔job
 * retriever (documents/retrieval.ts) as-is, keyed on a generic RelevanceQuery
 * instead of a job. New embeddable unit types (stories, letters, repo recaps,
 * interview history) register in SOURCES below without touching any caller.
 * See planning/SEMANTIC-MATCHING-AND-RAG.md § Feature 5.
 */

import { type JobLike, relevantProjectsText } from '$lib/server/documents/retrieval';
import {
	relevantApplicationTextsText,
	relevantStoriesText
} from '$lib/server/documents/content-retrieval';
import { applicationActivityText } from './application-activity';
import { activityManifestText } from './activity-manifest';
import { applicationPipelineText } from './application-pipeline';
import { jobDetailsText } from './job-context';
import { formatPageScope, type PageScope } from './page-scope';
import type { ProfileResourceName } from '$lib/server/profile/resources';
import {
	fitProfileToBudget,
	formatTrimNote,
	loadProfileData,
	type ProfileData,
	renderProfileData
} from './profile-data';

/**
 * What a generation is about, ranked against the applicant's material. Freeform
 * so any caller can build one: a cheat sheet's topic, a job description, a STAR
 * competency, an interview question. `skills` are optional terms to weight
 * (e.g. a job's required skills) over the prose in `text`.
 */
export interface RelevanceQuery {
	text: string;
	skills?: string[];
}

/**
 * An evidence source the provider knows how to assemble.
 *
 * Two families:
 *  - RANKED (projects, stories, application_texts) — many candidates, scored
 *    against `query`, the best few cited.
 *  - SCOPED (profile, job, application_activity) — one known thing, rendered
 *    whole (each internally clipped). These need `entity`, not `query`.
 *
 * `profile` is the `${data}` blob every prompt already interpolates. It is a
 * source rather than a special case so the budgeter can see the single largest
 * block in the prompt instead of carefully trimming the small ones around it.
 *
 * Extending this is one new SOURCES entry, available to every caller: coming
 * next are "repo_recaps" | "interview_history".
 */
export type ContextSource =
	| 'profile'
	| 'job'
	/**
	 * Everything recorded against the application: correspondence, rounds,
	 * feedback, offers, attached documents. One source since the Activity
	 * unification — it was `application_records` + `application_documents`, which
	 * showed the model one history through two differently-worded windows with
	 * two independent budgets. See planning/APPLICATION-ACTIVITY.md.
	 */
	| 'application_activity'
	/**
	 * The applicant's OTHER applications, as a comparison table. The only source
	 * that reads beyond the entity the route authorized — see the profile_id
	 * note in application-pipeline.ts.
	 */
	| 'application_pipeline'
	/**
	 * Which page the user is on, stated rather than inferred from which of these
	 * sources happen to be present. See page-scope.ts.
	 */
	| 'page_scope'
	/**
	 * An index — not the contents — of everything recorded on every application.
	 * Cheap and unconditional, so that a source this route did not request is
	 * distinguishable from a thing that does not exist. See activity-manifest.ts.
	 */
	| 'activity_manifest'
	/**
	 * An index — not the contents — of the parts of the profile that are
	 * editable, and where each lives. Cheap and unconditional, so a capability
	 * this page does not offer is distinguishable from a thing that does not
	 * exist. See profile-edit-manifest.ts.
	 */
	| 'profile_edits'
	| 'projects'
	| 'stories'
	| 'application_texts';

/** The thing a generation is *about*, for scoped sources. */
export type ContextEntity =
	| { type: 'application'; id: number }
	| { type: 'job'; id: number }
	/**
	 * One row of a profile section — the role on /profile/work-experience/[id],
	 * the school on /profile/education/[id], and so on.
	 *
	 * Carries which section as well as which row, because unlike jobs and
	 * applications the id alone does not say what table it is in, and seven of
	 * them share the id space.
	 */
	| { type: 'profile_section'; resource: ProfileResourceName; id: number };

/** Per-source knobs. Sources not listed take their own defaults. */
export interface SourceOptions {
	application_activity?: { detail: 'full' | 'compact' };
	/**
	 * Char ceiling on the pipeline block, which degrades internally to fit it
	 * (see fitPipelineToBudget) rather than being dropped whole by the budgeter.
	 * Defaults to DEFAULT_PIPELINE_BUDGET_CHARS.
	 */
	application_pipeline?: { budgetChars: number };
}

export interface ContextRequest {
	profileId: number;
	/** Required by any source that ranks by relevance. */
	query?: RelevanceQuery;
	/** Required by the scoped sources (job, application_*). */
	entity?: ContextEntity;
	/** Which evidence sources to assemble. Order is irrelevant. */
	sources: ContextSource[];
	/** Top-level profile keys the `profile` source renders. Omit for all of them. */
	profileFields?: string[];
	/**
	 * Already-loaded profile blob, so a caller that needed it anyway (i.e.
	 * createAndGenerateAiChat, which interpolates `${schema}` from the same row)
	 * doesn't pay for a second query.
	 */
	preloadedProfile?: ProfileData;
	/** Per-source overrides — see SourceOptions. */
	sourceOptions?: SourceOptions;
	/**
	 * Which page this generation is happening on, for the `page_scope` source.
	 * Set by the route, not inferred here — see page-scope.ts.
	 */
	scopeHint?: PageScope;
	/**
	 * Cap on the rendered profile blob, trimmed by dropping list entries (see
	 * fitProfileToBudget). Separate from `budgetChars` because the profile isn't
	 * evidence competing for space — it's the floor every prompt stands on.
	 * Defaults to DEFAULT_PROFILE_BUDGET_CHARS.
	 */
	profileBudgetChars?: number;
	/**
	 * Char budget for the assembled evidence blocks combined (chars, not tokens —
	 * matches the house convention in application-records.ts). Blocks are dropped
	 * lowest-priority-first to fit. Defaults to DEFAULT_BUDGET_CHARS.
	 *
	 * The `profile` source is NOT charged against this. Measured on dev, the blob
	 * runs 48–106k chars depending on the field list — several times any sane
	 * evidence budget — so charging it here would mean the profile alone always
	 * consumed the budget and every other source was dropped, on exactly the
	 * profiles that have the most worth retrieving. The blob is reported as
	 * `profileChars` instead; trimming it needs field-level prioritization (you
	 * cannot clip JSON mid-string), which is its own piece of work.
	 */
	budgetChars?: number;
	/** How many items each ranked source may cite. Source-specific default if unset. */
	perSourceK?: number;
	/**
	 * When the `application_texts` source is requested, skip texts belonging to
	 * this application — so generating a cover letter for it doesn't retrieve the
	 * very letter being written (or its siblings) as the applicant's "past
	 * writing". Ignored by other sources.
	 *
	 * Defaults to the `entity` when that is an application, which is what every
	 * caller wants: you are never your own prior art.
	 */
	excludeApplicationId?: number;
}

/**
 * What a call site passes as `createAndGenerateAiChat`'s `context` option —
 * the request minus the bits that function fills in itself.
 */
export type GenerationContextOption = Omit<ContextRequest, 'profileId' | 'preloadedProfile'>;

export interface AssembledContext {
	/**
	 * customVariables to merge into the createAndGenerateAiChat call. Keyed by the
	 * prompt placeholder each source fills (e.g. `relevantProjects`). EVERY
	 * requested source gets a key — its rendered text, or "" when it found nothing
	 * or was trimmed for budget — so a template that references the placeholder
	 * never ships a literal `${…}` to the model.
	 */
	variables: Record<string, string>;
	/** Sources that contributed non-empty content (for logging / tests). */
	usedSources: ContextSource[];
	/**
	 * Sources that produced content and were then dropped to fit the budget —
	 * as opposed to the ones that simply had nothing. Their variable carries a
	 * note saying so rather than "" (see droppedNote).
	 */
	droppedSources: ContextSource[];
	/**
	 * Size of the profile blob, which is exempt from `budgetChars`. Reported so
	 * the dominant block in the prompt is at least observable — it is typically
	 * 2–4× everything else combined.
	 */
	profileChars: number;
}

/** Generous default: ~6k tokens of evidence. Tunable per call via budgetChars. */
export const DEFAULT_BUDGET_CHARS = 24000;

/**
 * Ceiling on the profile blob. Set ABOVE what real profiles produce today (dev
 * measures 34k compact on the widest field list) so this bounds the pathological
 * case without silently rewriting the prompts that work now. Tighten it
 * deliberately, behind `npm run llm:smoke` — every drop is real experience the
 * model stops seeing.
 */
export const DEFAULT_PROFILE_BUDGET_CHARS = 60000;

/**
 * How the provider assembles one source.
 *
 * ## load / format / compose
 *
 * Every source module is three functions, and the split matters:
 *
 *  - `load*` — the DB reads, the derived columns, the sort. Returns typed data
 *    and THROWS on failure.
 *  - `format*` — pure, data in, prompt block out. Owns the budgets, the
 *    trimming, the headings and the guidance.
 *  - `*Text` — composes the two and swallows errors, because context is a bonus
 *    and never a reason to fail a generation.
 *
 * The reason to keep them apart is that `format*` writes text addressed to
 * *this* assistant — "do not open every reply with a pipeline summary", "no row
 * below is marked". That is behavioural instruction, correct in this prompt and
 * wrong anywhere else, so a consumer that is not building this prompt (an MCP
 * tool, a tool result inside an agent loop) needs the data without it. Shipping
 * the framing to someone else's model means injecting orders into their agent.
 *
 * Swallowing splits the same way. Returning "" for a failed query is right when
 * the alternative is failing a cover letter; it is wrong for a data caller,
 * where it makes a broken connection indistinguishable from an empty pipeline
 * — the same empty-vs-never-looked confusion the blocks below work to keep out
 * of the model's hands, one layer down.
 *
 * `SourceDef` deliberately carries only `render`. A `load` on the registry
 * would be structure with no consumer, and the sources do not map one-to-one
 * onto tools anyway: a tool is `get_application(id)`, not "the
 * application_activity source". The module-level `load*` exports are the
 * contract; this registry is one of their callers.
 */
interface SourceDef {
	/** Prompt-variable key this source fills. */
	variable: string;
	/** Lower = sacrificed first when the combined budget is exceeded. */
	priority: number;
	/** Render this source to a self-contained prompt block ("" when nothing fits). */
	render(req: ContextRequest): Promise<string>;
	/**
	 * Whether this request actually performed a lookup, as opposed to declining
	 * to (no entity of the right type, no query to rank against).
	 *
	 * `render` returns "" for both, and the difference is exactly what the model
	 * needs: "we looked and there is none" is worth saying, "we never looked"
	 * must stay silent, and conflating them is how the assistant came to tell a
	 * user on a job page that their application had no interview records.
	 * Omitted means never — silence is the safe default.
	 */
	looked?(req: ContextRequest): boolean;
}

/**
 * The source registry — the one place a data source is taught to the whole
 * system. Add an entry here and every generator that lists it in `sources` can
 * draw on it.
 */
const SOURCES: Record<ContextSource, SourceDef> = {
	// Scoped sources. Priorities sit above the ranked ones: concrete facts about
	// the applicant and about *this* application beat generically retrieved
	// evidence when something has to give.

	// Two orientation blocks first. Both are small and fixed-size, and both exist
	// so the model knows what it is looking at and what it is missing — so both
	// sit above every source they describe. Dropping either to make room for the
	// evidence it frames would be the wrong trade at any budget.
	page_scope: {
		variable: 'pageScope',
		priority: 95,
		looked: (req) => !!req.scopeHint,
		render: async (req) => formatPageScope(req.scopeHint)
	},
	profile_edits: {
		variable: 'profileEditManifest',
		// Below the activity manifest and above every source either of them frames.
		// Both are orientation, and dropping orientation to make room for the
		// evidence it frames is the wrong trade at any budget.
		priority: 88,
		// Always looked: every profile has an answer, even when the answer is that
		// every section is empty.
		looked: () => true,
		/**
		 * Imported here rather than at the top of the file, which is the one place
		 * a dynamic import earns its keep in this module.
		 *
		 * This block is built from `PROFILE_RESOURCES`, so a static import would
		 * put every profile table into the import graph of everything that merely
		 * mentions a context source — and `generation-context` is imported very
		 * widely. Three unrelated test files broke on it before this was made
		 * lazy, each one partially mocking the schema and now needing seven tables
		 * it has nothing to do with. Loading it when it renders costs one dynamic
		 * import on a path that is already awaiting a database round trip.
		 */
		render: async (req) =>
			(await import('./profile-edit-manifest')).profileEditManifestText(req.profileId)
	},
	activity_manifest: {
		variable: 'activityManifest',
		priority: 90,
		// Always "looked": every profile has an answer, even if the answer is that
		// nothing has been recorded anywhere yet.
		looked: () => true,
		render: async (req) => activityManifestText(req.profileId, applicationId(req) ?? undefined)
	},

	profile: {
		variable: 'data',
		priority: 100,
		render: async (req) => {
			const profile =
				req.preloadedProfile ?? (await loadProfileData(req.profileId, req.profileFields));
			const { data, dropped } = fitProfileToBudget(
				profile.data,
				req.profileBudgetChars ?? DEFAULT_PROFILE_BUDGET_CHARS
			);
			return renderProfileData(data) + formatTrimNote(dropped);
		}
	},
	job: {
		variable: 'jobDetails',
		priority: 50,
		looked: (req) => !!req.entity,
		render: async (req) => {
			if (!req.entity) return '';
			return jobDetailsText(
				req.entity.type === 'application'
					? { applicationId: req.entity.id }
					: { jobId: req.entity.id }
			);
		}
	},
	application_activity: {
		variable: 'applicationActivity',
		// Takes the higher of the two priorities it replaces (records 40,
		// documents 30). It is now the whole concrete history of this application,
		// so it should outlast anything retrieved generically.
		priority: 40,
		looked: (req) => applicationId(req) != null,
		render: async (req) => {
			const id = applicationId(req);
			if (id == null) return '';
			return applicationActivityText(
				id,
				req.sourceOptions?.application_activity?.detail ?? 'compact'
			);
		}
	},

	application_pipeline: {
		variable: 'applicationPipeline',
		// Below this application's own history (40) — when something has to give,
		// what happened HERE beats context about elsewhere — but above generically
		// retrieved evidence.
		//
		// ⚠️ This is the only block whose size grows with how long the user has
		// been job-hunting, and attaching standing summaries roughly tripled its
		// per-row cost. Measured on dev (6 live applications, 3 summarised): 3.8k,
		// of which 1.2k is the fixed header and ~430 per row — but a SUMMARISED row
		// is ~800, so an unbounded 25 would be ~20k of the 32k chat budget.
		//
		// Left unbounded it would not be the block dropped — the ranked sources
		// (10/8/6) go first, which is right for a comparison question and wrong for
		// "help me write this letter", where the pipeline is irrelevant background
		// and the retrieved projects are the whole answer. So it caps and degrades
		// itself instead (fitPipelineToBudget): applications are the last thing it
		// gives up, depth the first. Never top-k, which drops applications whole
		// and silently, and makes a comparison false rather than merely thin.
		priority: 20,
		// Always "looked": the pipeline is the profile's, so there is always an
		// answer, even if the answer is that there is only this one application.
		looked: () => true,
		render: async (req) =>
			applicationPipelineText(
				req.profileId,
				applicationId(req),
				req.sourceOptions?.application_pipeline?.budgetChars
			)
	},

	// Ranked sources.
	projects: {
		variable: 'relevantProjects',
		priority: 10,
		looked: (req) => hasQuery(req),
		render: async (req) => {
			// No query → nothing to rank against; skip the retrieval (and its
			// embedding search) entirely rather than rank against noise.
			if (!hasQuery(req)) return '';
			return relevantProjectsText(req.profileId, queryToJobLike(req.query!), req.perSourceK ?? 3);
		}
	},
	stories: {
		variable: 'relevantStories',
		priority: 8,
		looked: (req) => hasQuery(req),
		render: async (req) => {
			if (!hasQuery(req)) return '';
			return relevantStoriesText(req.profileId, req.query!, req.perSourceK ?? 3);
		}
	},
	application_texts: {
		variable: 'relevantApplicationTexts',
		priority: 6,
		looked: (req) => hasQuery(req),
		render: async (req) => {
			if (!hasQuery(req)) return '';
			return relevantApplicationTextsText(
				req.profileId,
				req.query!,
				req.perSourceK ?? 3,
				excludedApplicationId(req)
			);
		}
	}
};

/** Whether the request carries a usable relevance query (text or skills). */
function hasQuery(req: ContextRequest): boolean {
	return !!(req.query?.text.trim() || req.query?.skills?.length);
}

/** The application in scope, if any — scoped application sources need one. */
function applicationId(req: ContextRequest): number | null {
	return req.entity?.type === 'application' ? req.entity.id : null;
}

/** Explicit exclusion wins; otherwise you are never your own prior art. */
function excludedApplicationId(req: ContextRequest): number | undefined {
	return req.excludeApplicationId ?? applicationId(req) ?? undefined;
}

/**
 * Adapt a generic relevance query to the shipped project↔job retriever's
 * `JobLike` shape, so Phase 1 reuses that retriever with zero changes. The
 * retriever ranks on title + description + required skills, so a topic /
 * competency maps cleanly onto a synthetic "job": the text is both the title
 * (clipped) and the description; explicit skills pass straight through.
 */
export function queryToJobLike(q: RelevanceQuery): JobLike {
	return {
		title: q.text.slice(0, 200),
		job_description: q.text,
		skills_required: q.skills ?? null
	};
}

/** A rendered source block, before budget packing. */
interface RenderedBlock {
	source: ContextSource;
	priority: number;
	text: string;
}

/**
 * Pack rendered blocks into a char budget, dropping lowest-priority-first. Pure
 * — the budget behaviour is directly unit-testable, no DB.
 *
 * Empty blocks are filtered out. Highest-priority blocks are added while they
 * fit; the single highest-priority block is always kept even if it alone
 * exceeds the budget (dropping everything is worse, and each source is already
 * internally clipped), so an over-budget request degrades to "the most important
 * source only" rather than to nothing.
 */
export function fitToBudget(blocks: RenderedBlock[], budgetChars: number): RenderedBlock[] {
	const ranked = blocks.filter((b) => b.text.trim()).sort((a, z) => z.priority - a.priority);

	const kept: RenderedBlock[] = [];
	let used = 0;
	for (const b of ranked) {
		if (kept.length > 0 && used + b.text.length > budgetChars) continue;
		kept.push(b);
		used += b.text.length;
	}
	return kept;
}

/** What the user would call each source, for the dropped-for-budget note. */
const SOURCE_LABELS: Record<ContextSource, string> = {
	profile: "the applicant's profile",
	job: 'the job posting',
	// Neither should ever reach this note — both are small and rank above
	// everything they describe — but a label is cheaper than reasoning about
	// whether that stays true.
	page_scope: 'which page the user is on',
	activity_manifest: 'the index of everything on record',
	profile_edits: 'the index of what they can change and where',
	application_activity: 'the history recorded on this application',
	application_pipeline: "the applicant's other applications",
	projects: "the applicant's projects",
	stories: "the applicant's prepared stories",
	application_texts: "the applicant's past application writing"
};

/**
 * Stand-in for a source that rendered but didn't fit.
 *
 * Deliberately states that the material exists and is reachable, because the
 * failure this replaces was the model concluding from an empty section that it
 * had no access at all and telling the user so.
 */
function droppedNote(source: ContextSource): string {
	return (
		`[${SOURCE_LABELS[source]} could not be included in this reply — ` +
		`there is more of it than fits alongside the rest of the context. It ` +
		`exists and you can see it; say so plainly and ask the user to narrow ` +
		`what they need from it, rather than saying you have no access to it.]`
	);
}

/**
 * Stand-in for a source that was requested and found nothing.
 *
 * The third state, and the one that cost a user three round trips: a page where
 * documents ARE readable but none are attached rendered "", exactly like a page
 * where documents aren't in scope at all. The model couldn't tell the two apart
 * and reported the capability missing — "I can't access your uploaded
 * documents" — when the accurate answer was "this application has none", which
 * would have pointed straight at the real problem (the documents were on a
 * different application).
 */
function emptyNote(source: ContextSource): string {
	return (
		`[${SOURCE_LABELS[source]}: nothing here. You CAN read this, and ` +
		`there is simply none of it on what the user is currently looking at — ` +
		`never say you lack access. Only bring this up if they ask about it.]`
	);
}

/**
 * Assemble the evidence context for a generation. Renders every requested source
 * (in parallel — each may hit the DB or an embedding search), trims to budget,
 * and returns the customVariables to hand to createAndGenerateAiChat.
 */
export async function assembleGenerationContext(req: ContextRequest): Promise<AssembledContext> {
	const budget = req.budgetChars ?? DEFAULT_BUDGET_CHARS;

	const rendered: RenderedBlock[] = await Promise.all(
		req.sources.map(async (source) => {
			const def = SOURCES[source];
			return {
				source,
				priority: def.priority,
				text: (await def.render(req)).trim()
			};
		})
	);

	// The profile is who the applicant IS — it goes in whole, and the budget
	// rations the evidence layered on top of it. See ContextRequest.budgetChars.
	const profileBlock = rendered.find((b) => b.source === 'profile');
	const evidence = rendered.filter((b) => b.source !== 'profile');

	const kept = new Map(fitToBudget(evidence, budget).map((b) => [b.source, b.text]));
	if (profileBlock?.text) kept.set('profile', profileBlock.text);

	const variables: Record<string, string> = {};
	const usedSources: ContextSource[] = [];
	const droppedSources: ContextSource[] = [];
	for (const source of req.sources) {
		const text = kept.get(source) ?? '';
		if (text) {
			variables[SOURCES[source].variable] = text;
			usedSources.push(source);
			continue;
		}

		// Empty and dropped are different facts, and conflating them is what let
		// the assistant tell a user it "can't access your uploaded documents" on an
		// application that had eleven attached: they rendered, then lost the budget
		// race to the job description, and arrived as "" — indistinguishable from
		// having none. A source that produced text and didn't fit says so, so the
		// model reports a limit instead of denying the data exists.
		const rendered = evidence.find((b) => b.source === source);
		if (rendered?.text) {
			droppedSources.push(source);
			variables[SOURCES[source].variable] = droppedNote(source);
		} else {
			// Requested and empty is NOT the same as never looked, and the model
			// has to be told which one it is holding. Only a source that ran its
			// lookup gets to say "there is none"; anything else stays silent.
			variables[SOURCES[source].variable] = SOURCES[source].looked?.(req) ? emptyNote(source) : '';
		}
	}
	return {
		variables,
		usedSources,
		droppedSources,
		profileChars: profileBlock?.text.length ?? 0
	};
}
