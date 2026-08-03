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
} from "./generation-context";
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
 */
export const CHAT_BUDGET_CHARS = 32000;

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
}

/** Profile-only pages: no entity, just the applicant and their material. */
const PROFILE_SCOPE: RouteScope = {
  entity: null,
  sources: ["profile", "projects", "stories"],
};

/** Everything known about an application in progress. */
const APPLICATION_SCOPE: RouteScope = {
  entity: "application",
  param: "id",
  sources: [
    "profile",
    "job",
    "application_activity",
    "projects",
    "stories",
    "application_texts",
  ],
  // The job capabilities reach the attached job through `application.job_id`,
  // so a manually-created job can be corrected from the application it belongs
  // to without leaving the page. They drop out for scraped jobs.
  capabilities: [
    "edit_application_details",
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
const ROUTE_SCOPES: Record<string, RouteScope> = {
  "/applications/[id]": APPLICATION_SCOPE,
  "/jobs/[id]": {
    entity: "job",
    param: "id",
    // No application exists yet, so there is nothing recorded and nothing
    // attached — but past application writing is still worth drawing on when
    // the user asks "should I apply?" or "how would I pitch this?".
    sources: ["profile", "job", "projects", "stories", "application_texts"],
    capabilities: ["edit_job_details", "edit_job_description"],
  },
  "/applications/interview": PROFILE_SCOPE,
  "/profile": PROFILE_SCOPE,
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
  return best ?? PROFILE_SCOPE;
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
  const sources = entity
    ? scope.sources
    : scope.sources.filter((s) => s !== "job" && s !== "application_activity");

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
      budgetChars: CHAT_BUDGET_CHARS,
    },
    capabilities,
  };
}
