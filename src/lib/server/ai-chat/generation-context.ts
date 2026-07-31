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

import {
  type JobLike,
  relevantProjectsText,
} from "$lib/server/documents/retrieval";
import {
  relevantApplicationTextsText,
  relevantStoriesText,
} from "$lib/server/documents/content-retrieval";
import { interviewRecordsText } from "./application-records";
import { applicationDocumentsText } from "./application-documents";
import { jobDetailsText } from "./job-context";
import {
  loadProfileData,
  type ProfileData,
  renderProfileData,
} from "./profile-data";

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
 *  - SCOPED (profile, job, application_records, application_documents) — one
 *    known thing, rendered whole (each internally clipped). These need
 *    `entity`, not `query`.
 *
 * `profile` is the `${data}` blob every prompt already interpolates. It is a
 * source rather than a special case so the budgeter can see the single largest
 * block in the prompt instead of carefully trimming the small ones around it.
 *
 * Extending this is one new SOURCES entry, available to every caller: coming
 * next are "repo_recaps" | "interview_history".
 */
export type ContextSource =
  | "profile"
  | "job"
  | "application_records"
  | "application_documents"
  | "projects"
  | "stories"
  | "application_texts";

/** The thing a generation is *about*, for scoped sources. */
export type ContextEntity =
  | { type: "application"; id: number }
  | { type: "job"; id: number };

/** Per-source knobs. Sources not listed take their own defaults. */
export interface SourceOptions {
  application_records?: { detail: "full" | "compact" };
  application_documents?: { detail: "full" | "compact" };
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
export type GenerationContextOption = Omit<
  ContextRequest,
  "profileId" | "preloadedProfile"
>;

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
   * Size of the profile blob, which is exempt from `budgetChars`. Reported so
   * the dominant block in the prompt is at least observable — it is typically
   * 2–4× everything else combined.
   */
  profileChars: number;
}

/** Generous default: ~6k tokens of evidence. Tunable per call via budgetChars. */
export const DEFAULT_BUDGET_CHARS = 24000;

/** How the provider assembles one source. */
interface SourceDef {
  /** Prompt-variable key this source fills. */
  variable: string;
  /** Lower = sacrificed first when the combined budget is exceeded. */
  priority: number;
  /** Render this source to a self-contained prompt block ("" when nothing fits). */
  render(req: ContextRequest): Promise<string>;
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
  profile: {
    variable: "data",
    priority: 100,
    render: async (req) => {
      const profile = req.preloadedProfile ??
        await loadProfileData(req.profileId, req.profileFields);
      return renderProfileData(profile.data);
    },
  },
  job: {
    variable: "jobDetails",
    priority: 50,
    render: async (req) => {
      if (!req.entity) return "";
      return jobDetailsText(
        req.entity.type === "application"
          ? { applicationId: req.entity.id }
          : { jobId: req.entity.id },
      );
    },
  },
  application_records: {
    variable: "interviewHistory",
    priority: 40,
    render: async (req) => {
      const id = applicationId(req);
      if (id == null) return "";
      return interviewRecordsText(
        id,
        req.sourceOptions?.application_records?.detail ?? "compact",
      );
    },
  },
  application_documents: {
    variable: "applicationDocuments",
    priority: 30,
    render: async (req) => {
      const id = applicationId(req);
      if (id == null) return "";
      return applicationDocumentsText(
        id,
        req.sourceOptions?.application_documents?.detail ?? "compact",
      );
    },
  },

  // Ranked sources.
  projects: {
    variable: "relevantProjects",
    priority: 10,
    render: async (req) => {
      // No query → nothing to rank against; skip the retrieval (and its
      // embedding search) entirely rather than rank against noise.
      if (!hasQuery(req)) return "";
      return relevantProjectsText(
        req.profileId,
        queryToJobLike(req.query!),
        req.perSourceK ?? 3,
      );
    },
  },
  stories: {
    variable: "relevantStories",
    priority: 8,
    render: async (req) => {
      if (!hasQuery(req)) return "";
      return relevantStoriesText(
        req.profileId,
        req.query!,
        req.perSourceK ?? 3,
      );
    },
  },
  application_texts: {
    variable: "relevantApplicationTexts",
    priority: 6,
    render: async (req) => {
      if (!hasQuery(req)) return "";
      return relevantApplicationTextsText(
        req.profileId,
        req.query!,
        req.perSourceK ?? 3,
        excludedApplicationId(req),
      );
    },
  },
};

/** Whether the request carries a usable relevance query (text or skills). */
function hasQuery(req: ContextRequest): boolean {
  return !!(req.query?.text.trim() || req.query?.skills?.length);
}

/** The application in scope, if any — scoped application sources need one. */
function applicationId(req: ContextRequest): number | null {
  return req.entity?.type === "application" ? req.entity.id : null;
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
    skills_required: q.skills ?? null,
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
export function fitToBudget(
  blocks: RenderedBlock[],
  budgetChars: number,
): RenderedBlock[] {
  const ranked = blocks
    .filter((b) => b.text.trim())
    .sort((a, z) => z.priority - a.priority);

  const kept: RenderedBlock[] = [];
  let used = 0;
  for (const b of ranked) {
    if (kept.length > 0 && used + b.text.length > budgetChars) continue;
    kept.push(b);
    used += b.text.length;
  }
  return kept;
}

/**
 * Assemble the evidence context for a generation. Renders every requested source
 * (in parallel — each may hit the DB or an embedding search), trims to budget,
 * and returns the customVariables to hand to createAndGenerateAiChat.
 */
export async function assembleGenerationContext(
  req: ContextRequest,
): Promise<AssembledContext> {
  const budget = req.budgetChars ?? DEFAULT_BUDGET_CHARS;

  const rendered: RenderedBlock[] = await Promise.all(
    req.sources.map(async (source) => {
      const def = SOURCES[source];
      return {
        source,
        priority: def.priority,
        text: (await def.render(req)).trim(),
      };
    }),
  );

  // The profile is who the applicant IS — it goes in whole, and the budget
  // rations the evidence layered on top of it. See ContextRequest.budgetChars.
  const profileBlock = rendered.find((b) => b.source === "profile");
  const evidence = rendered.filter((b) => b.source !== "profile");

  const kept = new Map(
    fitToBudget(evidence, budget).map((b) => [b.source, b.text]),
  );
  if (profileBlock?.text) kept.set("profile", profileBlock.text);

  const variables: Record<string, string> = {};
  const usedSources: ContextSource[] = [];
  for (const source of req.sources) {
    const text = kept.get(source) ?? "";
    variables[SOURCES[source].variable] = text;
    if (text) usedSources.push(source);
  }
  return {
    variables,
    usedSources,
    profileChars: profileBlock?.text.length ?? 0,
  };
}
