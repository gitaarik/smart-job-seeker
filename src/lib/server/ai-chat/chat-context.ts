/**
 * What the personal assistant knows about the page the user is on.
 *
 * The chat used to receive a `chatContext` blob that each page hand-curated into
 * `$page.data` and the client posted back: only three pages ever implemented it,
 * it was capped at 6k of JSON, it could only contain what the page had already
 * loaded, and nothing about it was trustworthy (the client could post anything).
 *
 * Now the client sends only *where the user is* — the SvelteKit route id and its
 * params — and this module resolves that to a context request the provider
 * assembles server-side, authorizing the entity against the caller's profile on
 * the way. Adding a page to the assistant's awareness is one row in ROUTE_SCOPES
 * rather than a bespoke load-function block.
 */

import { db } from "$lib/server/db";
import { and, eq } from "drizzle-orm";
import { applications, jobs } from "$lib/server/db/schema";
import type {
  ContextEntity,
  ContextSource,
  GenerationContextOption,
  RelevanceQuery,
  SourceOptions,
} from "./generation-context";
import { LIST_PIPELINE_BUDGET_CHARS } from "./application-pipeline";
import type { PageScope } from "./page-scope";
import {
  type Capability,
  type LiveCapability,
  resolveCapabilities,
} from "./capabilities";

/**
 * Char budget for the chat's evidence blocks (the profile blob is exempt — see
 * ContextRequest.budgetChars). Still below a generator's default: a chat also
 * replays up to MAX_CONTEXT_MESSAGES turns of conversation into the same
 * window, and on an application page it requests more sources at once than any
 * single generator does.
 *
 * Raised from 20000, which was under what one application actually needs. On a
 * real application with eleven attached emails, the sources measured (under the
 * pre-Activity split, when records and documents were two sources):
 *
 *   jobDetails 5258 · applicationDocuments 15738 · stories 1983 · texts 3362
 *
 * — 26.3k in total, so at 20k the documents lost the budget race to the job
 * description and the assistant reported it could not see them at all. 32k
 * clears that case with room to spare, and the totals plateau there: raising it
 * further bought nothing on the same application. For scale, the profile blob
 * alongside it is 56k and is not charged against this at all, so the extra 12k
 * is a fraction of what every turn already sends.
 *
 * The merge into `application_activity` lowered the ceiling rather than raised
 * it: the two sources had independent totals (40k each in full mode) that could
 * both arrive, where one stream is capped once. Re-measure before tightening.
 *
 * Raised again to 250000 when the application scope moved to `full` activity
 * detail. This is NOT a bigger appetite for the same blocks — it is the size
 * one application actually is. Measured on a real profile's two busiest
 * applications, the rendered blocks came to 137043 and 142031 respectively
 * (activity 129303 / 136556, job 3923 / 1658, pipeline 3817 each). The activity
 * cap above it is 200000, so the ceiling that binds first is that one and not
 * this one — which is the right way round, because it degrades with a note
 * where this one drops the block whole and silently.
 *
 * ⚠️ It has to move WITH the activity ceilings, not after them. `fitToBudget`
 * drops whole blocks that do not fit, and activity (40) packs after job (50) —
 * so a 150k block against a 32k budget is not a truncated history, it is no
 * history at all, silently. That is the exact failure recorded above at 20k.
 *
 * For scale, a worst-case turn is now ~250k of blocks plus the 56k exempt
 * profile blob: ~77k tokens, against a 1M-token writing model and a 131k-token
 * fallback. Room, but no longer negligible — see TOTALS in
 * application-activity.ts on what that costs per turn.
 */
export const CHAT_BUDGET_CHARS = 250000;

/** Which entity a route is about, and what the assistant should draw on there. */
interface RouteScope {
  entity: "application" | "job" | null;
  /** Route param holding the entity id. Ignored when entity is null. */
  param?: string;
  sources: ContextSource[];
  /**
   * Edits the assistant may propose here — see capabilities.ts. Declaring one
   * is not granting it: each is re-resolved and re-authorized per turn, and
   * again at apply time, so listing a capability a user can't exercise just
   * means they never hear about it.
   */
  capabilities?: Capability[];
  /**
   * Per-source tuning for this route. A source's default is sized against the
   * page it was built for; a route where the same source means something
   * different (background vs. subject) says so here rather than the source
   * trying to infer it.
   */
  sourceOptions?: SourceOptions;
  /**
   * What this page is, in prose, for the model. Every route states its own —
   * including the ones sharing a scope object, because two pages can want the
   * same evidence and still mean different things by a bare question.
   */
  hint?: PageScope;
}

/** Profile-only pages: no entity, just the applicant and their material. */
const PROFILE_SCOPE: RouteScope = {
  entity: null,
  sources: ["profile", "projects", "stories"],
};

/**
 * What an unlisted route gets. Same sources as PROFILE_SCOPE, but it says so
 * rather than saying nothing.
 *
 * Without this the fallback rendered an empty scope block, so on /home the
 * assistant knew what existed and had no idea where it was standing — the
 * silent-absence pattern the scope block was built to remove, reappearing one
 * level up in the thing that removes it. "I have not been told" is a fact and
 * beats an invented one; a route that wants better says so in the table.
 */
const UNKNOWN_PAGE_SCOPE: RouteScope = {
  ...PROFILE_SCOPE,
  hint: {
    page:
      "a page of the app that has not been described to you — you can see who " +
      "they are and what they have on record, but not what is on screen",
    subject: null,
  },
};

/**
 * The applications list and its siblings: no single application in front of the
 * user, but every application is.
 *
 * These pages fell through to PROFILE_SCOPE, which meant the assistant could
 * see the applicant's projects and stories but not one of their applications —
 * so "compare my Acme and Northwind applications", asked on the page that lists
 * exactly those two, had nothing to answer from. The pipeline is the whole
 * content of these pages, so it gets the larger ceiling too (see
 * LIST_PIPELINE_BUDGET_CHARS): nothing here competes with it for room.
 */
const PIPELINE_SCOPE: RouteScope = {
  entity: null,
  sources: [
    "profile",
    "application_pipeline",
    "projects",
    "stories",
    "application_texts",
  ],
  sourceOptions: {
    application_pipeline: { budgetChars: LIST_PIPELINE_BUDGET_CHARS },
  },
};

/** Everything known about an application in progress. */
const APPLICATION_SCOPE: RouteScope = {
  entity: "application",
  param: "id",
  sources: [
    "profile",
    "job",
    "application_activity",
    // How this application compares with the rest of the pipeline. Always on
    // rather than gated on the message looking comparative: "is this one even
    // worth the effort?" is a comparison containing no comparison words, and
    // the failure mode of gating is invisible to everyone.
    "application_pipeline",
    "projects",
    "stories",
    "application_texts",
  ],
  // `full`, because on this page the history is the SUBJECT, not background.
  // The compact ceilings are sized for cover letters, which want the gist — and
  // the chat inherited them by default, so a 29k interview transcript reached
  // the assistant as 1.5k of head and tail. Asked what the interviewer had said
  // mid-call, it correctly answered that it could not see that part. This is
  // the distinction the compact/full split exists to draw; the chat was simply
  // on the wrong side of it.
  sourceOptions: { application_activity: { detail: "full" } },
  // The job capabilities reach the attached job through `application.job_id`,
  // so a manually-created job can be corrected from the application it belongs
  // to without leaving the page. They drop out for scraped jobs.
  capabilities: [
    "edit_application_details",
    "add_activity_record",
    "edit_job_details",
    "edit_job_description",
  ],
};

/**
 * Route → what the assistant can see there. Keys are route ids with SvelteKit
 * group segments stripped, matched longest-prefix-first, so a nested tab
 * (`/applications/[id]/texts`) inherits its parent's scope unless it declares
 * its own.
 */
/**
 * Orientation blocks every route gets, appended centrally rather than listed in
 * each scope.
 *
 * A scope that can forget them is a scope that will: the whole class of bug
 * these two exist to kill is a route silently not requesting something. Listing
 * them per-scope would reproduce it one level up.
 */
const ALWAYS: ContextSource[] = ["page_scope", "activity_manifest"];

const ROUTE_SCOPES: Record<string, RouteScope> = {
  // Longest prefix wins, so /applications/[id] keeps its own scope and
  // /applications/interview keeps the profile-only one it declares below. The
  // rest — the list itself, /active, /salary, /texts, /new — inherit this,
  // which is what each of them wants: every one is a view ACROSS applications.
  "/applications": {
    ...PIPELINE_SCOPE,
    hint: {
      page: "the list of their applications",
      subject: null,
    },
  },
  "/applications/[id]": {
    ...APPLICATION_SCOPE,
    hint: {
      page: "one application's own page, where its whole history is shown",
      subject: "that application",
    },
  },
  "/jobs/[id]": {
    entity: "job",
    param: "id",
    // No application exists yet, so there is nothing recorded and nothing
    // attached — but past application writing is still worth drawing on when
    // the user asks "should I apply?" or "how would I pitch this?".
    sources: [
      "profile",
      "job",
      "application_pipeline",
      "projects",
      "stories",
      "application_texts",
    ],
    capabilities: ["edit_job_details", "edit_job_description"],
    hint: {
      page: "a job posting they have not applied to yet",
      subject: "that job",
    },
  },
  /**
   * Browsing job listings. No job data on purpose — this is a decision, not the
   * fallthrough it used to be.
   *
   * The page has its own search and filters, which do the narrowing better than
   * a chat turn can, and the list runs to hundreds of rows where the
   * applications list runs to a dozen. What the assistant would add here —
   * judgement about which are worth the effort — is what the match score
   * already does, per row, without being asked.
   *
   * A specific job is a different matter: /jobs/[id] gets that job in full.
   */
  "/jobs": {
    ...PROFILE_SCOPE,
    hint: {
      page:
        "the list of jobs they are browsing, which has its own search and " +
        "filter controls for narrowing it down",
      subject: null,
    },
  },
  /**
   * The dashboard. It gets the pipeline because "how is my search going?" is
   * the question this page exists to answer, and without it the assistant could
   * see that applications existed (the manifest lists them) but nothing about
   * where any of them stood.
   */
  "/home": {
    ...PROFILE_SCOPE,
    sources: [...PROFILE_SCOPE.sources, "application_pipeline"],
    hint: {
      page: "their dashboard, the overview of how their search is going",
      subject: null,
    },
  },
  // Same scope object, deliberately different hints: both pages want the
  // applicant and their material, and a bare question means something
  // different on each.
  "/applications/interview": {
    ...PROFILE_SCOPE,
    hint: {
      page: "their interview preparation, which is not tied to one application",
      subject: null,
    },
  },
  "/profile": {
    ...PROFILE_SCOPE,
    hint: {
      page: "their own profile — the material they apply with, not any one application",
      subject: null,
    },
  },
};

/** Drop `(group)` segments so route ids match the table above. */
export function normalizeRouteId(routeId: string | null | undefined): string {
  if (!routeId) return "";
  return routeId
    .split("/")
    .filter((seg) => !(seg.startsWith("(") && seg.endsWith(")")))
    .join("/");
}

/** Longest matching prefix wins, so nested tabs inherit their parent's scope. */
export function scopeForRoute(routeId: string | null | undefined): RouteScope {
  const normalized = normalizeRouteId(routeId);
  let best: RouteScope | null = null;
  let bestLength = -1;
  for (const [prefix, scope] of Object.entries(ROUTE_SCOPES)) {
    if (
      (normalized === prefix || normalized.startsWith(prefix + "/")) &&
      prefix.length > bestLength
    ) {
      best = scope;
      bestLength = prefix.length;
    }
  }
  return best ?? UNKNOWN_PAGE_SCOPE;
}

/**
 * Resolve the entity the route points at, rejecting anything the caller's
 * profile doesn't own. Returns null when there is no entity, the id is
 * unusable, or access is denied — the chat then degrades to profile-only
 * context rather than failing the message.
 *
 * Jobs are deliberately not profile-scoped: the jobs table is a shared corpus
 * and /jobs/[id] renders any job to any signed-in user, so scoping here would
 * be stricter than the page the user is looking at.
 */
async function resolveEntity(
  scope: RouteScope,
  params: Record<string, string>,
  profileId: number,
): Promise<ContextEntity | null> {
  if (!scope.entity || !scope.param) return null;

  const id = Number(params[scope.param]);
  if (!Number.isInteger(id) || id <= 0) return null;

  if (scope.entity === "application") {
    const owned = await db.query.applications.findFirst({
      where: and(
        eq(applications.id, id),
        eq(applications.profile_id, profileId),
      ),
      columns: { id: true },
    });
    return owned ? { type: "application", id } : null;
  }

  const exists = await db.query.jobs.findFirst({
    where: eq(jobs.id, id),
    columns: { id: true },
  });
  return exists ? { type: "job", id } : null;
}

/**
 * The job behind the entity, as extra ranking signal. The user's message alone
 * is a thin query ("what do you think?"), so the role title and its required
 * skills are folded in — otherwise retrieval on an application page ranks
 * against a pronoun.
 */
async function entityQueryTerms(
  entity: ContextEntity | null,
): Promise<{ text: string; skills?: string[] }> {
  if (!entity) return { text: "" };

  const columns = { title: true, skills_required: true } as const;
  const job = entity.type === "job"
    ? await db.query.jobs.findFirst({ where: eq(jobs.id, entity.id), columns })
    : (await db.query.applications.findFirst({
      where: eq(applications.id, entity.id),
      columns: { id: true },
      with: { job: { columns } },
    }))?.job;

  return {
    text: job?.title ?? "",
    skills: (job?.skills_required as string[] | null) ?? undefined,
  };
}

/**
 * Build the context request for a chat turn, plus the edits the assistant may
 * propose on it. `message` is the user's newest message — it is the primary
 * ranking signal, since what they just asked is what they want evidence about.
 *
 * `isStaff` is read from the session by the caller, never from the request
 * body: the route and its params are client-supplied, and once they gate a
 * capability rather than only scoping reads, everything they touch has to be
 * re-derived server-side. That is why capabilities are resolved here, against
 * the entity this function authorized, and not trusted from the payload.
 */
export async function resolveChatContext(opts: {
  routeId: string | null | undefined;
  params: Record<string, string>;
  profileId: number;
  isStaff: boolean;
  message: string;
}): Promise<{
  context: GenerationContextOption;
  capabilities: LiveCapability[];
}> {
  const scope = scopeForRoute(opts.routeId);
  const entity = await resolveEntity(scope, opts.params, opts.profileId);
  const terms = await entityQueryTerms(entity);

  const query: RelevanceQuery = {
    text: [opts.message, terms.text].filter(Boolean).join("\n"),
    skills: terms.skills,
  };

  // An entity that failed to resolve (deleted, not owned, bad id) drops the
  // sources that need one, rather than shipping empty blocks with headings.
  const sources = [
    ...(entity
      ? scope.sources
      : scope.sources.filter((s) =>
        s !== "job" && s !== "application_activity"
      )),
    ...ALWAYS,
  ];

  // A hint claiming "they are on one application's page" while the application
  // block is missing is worse than no hint: it tells the model to read a bare
  // question as being about something it cannot see. An entity that failed to
  // resolve therefore drops the hint rather than keeping half of it.
  const scopeHint = entity || scope.entity === null ? scope.hint : undefined;

  // Jobs resolve for any signed-in user by design (see resolveEntity), so the
  // entity resolving says nothing about edit rights. resolveCapabilities asks
  // each capability's own authorize().
  const capabilities = await resolveCapabilities(
    scope.capabilities ?? [],
    entity,
    { profileId: opts.profileId, isStaff: opts.isStaff },
  );

  return {
    context: {
      query,
      entity: entity ?? undefined,
      sources,
      sourceOptions: scope.sourceOptions,
      scopeHint,
      budgetChars: CHAT_BUDGET_CHARS,
    },
    capabilities,
  };
}
