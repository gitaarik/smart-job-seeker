/**
 * Auto-import-task reconciler.
 *
 * Keeps a profile's set of *auto-generated* import tasks in sync with the
 * profile + match preferences. Design and rationale:
 * `planning/AUTO-IMPORT-TASKS.md` (in the sjs-ops meta-repo).
 *
 * The reconcile is three asymmetric operations, in order:
 *   1. PRUNE     — remove auto tasks that no longer make sense. Only ever
 *                  touches *proposed* (never-activated, never-run) auto tasks,
 *                  which it hard-deletes (nothing is lost). A task the user
 *                  activated is never silently removed or deactivated here.
 *   2. RECOMPUTE — overwrite the preference-derived filters on every
 *                  auto-managed task from the current match_config. This is
 *                  the cheap in-place update that makes the common change (a
 *                  filter preference) adapt without churning the row or losing
 *                  its run history — and it keeps working after activation.
 *   3. TOP-UP    — add what's missing to round the set out, up to a budget and
 *                  a relevance floor, via the existing `_runSuggester`. New
 *                  tasks are created PAUSED (is_active=false) so generation
 *                  never costs credits; only activation spends.
 *
 * An input-hash gate short-circuits the whole thing (before any LLM call) when
 * none of the suggester-relevant inputs changed since the last sync.
 *
 * Provenance: only rows with origin='auto' AND auto_managed=true are touched.
 * Editing an auto task flips auto_managed=false ("adopt"), after which the
 * reconciler leaves it alone but the suggester still sees it (dedup). User
 * (origin='user') tasks are never touched.
 */
import { and, eq, inArray } from "drizzle-orm";
import { dbDirect as db } from "$lib/server/db";
import {
  job_platforms,
  match_config,
  platform_profiles,
  profile_auto_import,
  profiles,
  search_tasks,
} from "$lib/server/db/schema";
import {
  preferencesToFilters,
  stripUnsupportedFilters,
} from "$lib/job-platforms/preferences-to-filters";
import type { SearchFilterValue } from "$lib/job-platforms/search-filters";
import { config } from "$lib/server/config";
import {
  applyPreferenceFilters,
  computeInputHash,
  filtersEqual,
  selectTopUpCandidates,
} from "./reconcile-policy";
import { _runSuggester } from "../../../routes/api/jobs/import/suggest/+server";

// Plan-based default lands later (the deferred curation knob, stored in
// profile_auto_import.max_tasks). For v1 a single conservative ceiling.
const DEFAULT_AUTO_TASK_BUDGET = 6;

export interface ReconcileResult {
  skipped: boolean;
  reason?: "disabled" | "no-profile" | "unchanged" | "no-platforms";
  created: number;
  pruned: number;
  recomputed: number;
  toppedUp: boolean;
}

function emptyResult(
  skipped: boolean,
  reason?: ReconcileResult["reason"],
): ReconcileResult {
  return {
    skipped,
    reason,
    created: 0,
    pruned: 0,
    recomputed: 0,
    toppedUp: false,
  };
}

type MatchConfigRow = {
  job_types: string[] | null;
  experience_levels: string[] | null;
  work_location: string[] | null;
  locations: string[] | null;
  remote_only: boolean | null;
};

type PlatformMeta = {
  id: number;
  status: string | null;
  search_page_url: string | null;
  unsupported_filters: Record<string, string[]>;
};

/** Load the per-profile sync-state row, creating it on first use. */
async function loadOrCreateState(profileId: number) {
  const existing = await db.query.profile_auto_import.findFirst({
    where: eq(profile_auto_import.profile_id, profileId),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(profile_auto_import)
    .values({ profile_id: profileId })
    .onConflictDoNothing()
    .returning();
  // onConflictDoNothing returns nothing on a race; re-read to be safe.
  return (
    created ??
      (await db.query.profile_auto_import.findFirst({
        where: eq(profile_auto_import.profile_id, profileId),
      }))!
  );
}

/**
 * Reconcile the auto-generated import tasks for one profile. Idempotent: a
 * second call with unchanged inputs is a no-op (hash gate). Pass force=true to
 * bypass the gate (e.g. an explicit "re-suggest" action).
 */
export async function reconcileAutoImportTasks(
  profileId: number,
  opts: { force?: boolean } = {},
): Promise<ReconcileResult> {
  const state = await loadOrCreateState(profileId);
  if (!state.enabled) return emptyResult(true, "disabled");

  const [profile, mc] = await Promise.all([
    db.query.profiles.findFirst({
      where: eq(profiles.id, profileId),
      columns: {
        id: true,
        title: true,
        core_stack: true,
        city: true,
        region: true,
        country_code: true,
      },
    }),
    db.query.match_config.findFirst({
      where: eq(match_config.profile_id, profileId),
      columns: {
        job_types: true,
        experience_levels: true,
        work_location: true,
        locations: true,
        remote_only: true,
      },
    }) as Promise<MatchConfigRow | undefined>,
  ]);
  if (!profile) return emptyResult(true, "no-profile");

  const inputHash = computeInputHash({
    title: profile.title,
    core_stack: profile.core_stack,
    city: profile.city,
    region: profile.region,
    country_code: profile.country_code,
    job_types: mc?.job_types ?? null,
    experience_levels: mc?.experience_levels ?? null,
    work_location: mc?.work_location ?? null,
    locations: mc?.locations ?? null,
    remote_only: mc?.remote_only ?? null,
  });
  if (!opts.force && state.last_input_hash === inputHash) {
    return emptyResult(true, "unchanged");
  }

  // Platform metadata for prune validity + per-platform filter stripping.
  const platformRows = await db
    .select({
      id: job_platforms.id,
      status: job_platforms.status,
      search_page_url: job_platforms.search_page_url,
      unsupported_filters: job_platforms.unsupported_filters,
    })
    .from(job_platforms);
  const platformById = new Map<number, PlatformMeta>(
    platformRows.map((p) => [p.id, p as PlatformMeta]),
  );

  const managed = await db
    .select({
      id: search_tasks.id,
      platform_id: search_tasks.platform_id,
      search_filters: search_tasks.search_filters,
      is_active: search_tasks.is_active,
      last_run: search_tasks.last_run,
    })
    .from(search_tasks)
    .where(
      and(
        eq(search_tasks.profile_id, profileId),
        eq(search_tasks.origin, "auto"),
        eq(search_tasks.auto_managed, true),
      ),
    );

  // 1. PRUNE — only proposed (paused + never run) tasks whose platform is no
  // longer suggestable. Hard-delete; nothing is lost.
  const isSuggestable = (platformId: number | null): boolean => {
    if (platformId === null) return false;
    const p = platformById.get(platformId);
    return !!p && p.status === "published" && !!p.search_page_url;
  };
  const pruneIds = managed
    .filter((t) =>
      !t.is_active && t.last_run === null && !isSuggestable(t.platform_id)
    )
    .map((t) => t.id);
  if (pruneIds.length > 0) {
    await db.delete(search_tasks).where(inArray(search_tasks.id, pruneIds));
  }
  const survivors = managed.filter((t) => !pruneIds.includes(t.id));

  // 2. RECOMPUTE — refresh preference-derived filters in place.
  const userFilters = mc
    ? preferencesToFilters({
      job_types: mc.job_types ?? [],
      experience_levels: mc.experience_levels ?? [],
      work_location: mc.work_location ?? [],
      remote_only: mc.remote_only ?? null,
    })
    : {};
  let recomputed = 0;
  for (const task of survivors) {
    const plat = task.platform_id !== null
      ? platformById.get(task.platform_id)
      : undefined;
    const stripped = stripUnsupportedFilters(
      userFilters,
      plat?.unsupported_filters ?? {},
    );
    const desired = applyPreferenceFilters(task.search_filters ?? {}, stripped);
    if (!filtersEqual(desired, task.search_filters ?? {})) {
      await db
        .update(search_tasks)
        .set({ search_filters: desired, date_updated: new Date() })
        .where(eq(search_tasks.id, task.id));
      recomputed++;
    }
  }

  // 3. TOP-UP — fill toward budget with distinct, sufficiently-relevant
  // suggestions. The suggester already dedups against ALL existing tasks.
  const budget = state.max_tasks ?? DEFAULT_AUTO_TASK_BUDGET;
  const slots = budget - survivors.length;
  let created = 0;
  let toppedUp = false;
  let suggesterOk = true;
  if (slots > 0) {
    const result = await _runSuggester(profileId);
    if (result.ok) {
      toppedUp = true;
      const candidates = selectTopUpCandidates(result.tasks, slots);
      for (const draft of candidates) {
        await insertAutoTask(profileId, draft);
        created++;
      }
    } else {
      suggesterOk = false;
    }
  }

  // Persist sync state. Only advance the hash on a clean run — if the
  // suggester errored we leave the old hash so the next trigger retries
  // top-up instead of being gated out.
  await db
    .update(profile_auto_import)
    .set({
      last_synced_at: new Date(),
      date_updated: new Date(),
      ...(suggesterOk ? { last_input_hash: inputHash } : {}),
    })
    .where(eq(profile_auto_import.profile_id, profileId));

  return {
    skipped: false,
    created,
    pruned: pruneIds.length,
    recomputed,
    toppedUp,
  };
}

/** Insert one suggester draft as a PAUSED auto-managed task. Mirrors the
 * canonical insert in scripts/suggest-task.ts, wiring credentials if any. */
async function insertAutoTask(
  profileId: number,
  draft: {
    platform_id: number;
    keywords: string | null;
    note: string;
    filters: Record<string, SearchFilterValue>;
  },
): Promise<void> {
  const existingCred = await db.query.platform_profiles.findFirst({
    where: and(
      eq(platform_profiles.profile_id, profileId),
      eq(platform_profiles.platform_id, draft.platform_id),
    ),
    columns: { id: true },
  });
  await db.insert(search_tasks).values({
    profile_id: profileId,
    platform_id: draft.platform_id,
    platform_profile_id: existingCred?.id ?? null,
    search_term: draft.keywords,
    search_location: null,
    search_filters: draft.filters,
    note: draft.note,
    status: "idle",
    is_active: false,
    origin: "auto",
    auto_managed: true,
    login_mode: "auto",
    skip_existing: false,
    keep_minimized: true,
    browser_provider: config.defaultBrowserProvider,
    date_created: new Date(),
  });
}

/**
 * Fire-and-forget reconcile for request handlers. Never blocks the response
 * and never throws into the caller — the input-hash gate makes redundant calls
 * cheap, so it's safe to call from any profile/preference mutation site.
 */
export function triggerAutoImportReconcile(profileId: number): void {
  void reconcileAutoImportTasks(profileId).catch((err) => {
    console.error(
      `[auto-import] reconcile failed for profile ${profileId}:`,
      err,
    );
  });
}

/**
 * Mark an auto task as adopted by the user (called when a user edits one):
 * the reconciler stops managing it, but it still counts toward coverage and
 * is fed to the suggester as existing context. No-op for non-auto tasks.
 */
export async function adoptAutoTaskIfManaged(taskId: number): Promise<void> {
  await db
    .update(search_tasks)
    .set({ auto_managed: false })
    .where(and(eq(search_tasks.id, taskId), eq(search_tasks.origin, "auto")));
}
