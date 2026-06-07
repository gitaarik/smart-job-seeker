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
  search_task_runs,
  search_tasks,
} from "$lib/server/db/schema";
import {
  preferencesToFilters,
  stripUnsupportedFilters,
} from "$lib/job-platforms/preferences-to-filters";
import type { SearchFilterValue } from "$lib/job-platforms/search-filters";
import { config } from "$lib/server/config";
import { addScrapeJob } from "$lib/server/queue";
import { requireCredits } from "$lib/server/billing/require-credits";
import { getActiveSubscription } from "$lib/server/billing/subscription";
import type { PlanId } from "$lib/server/billing/plans";
import { getPreferredDevice } from "$lib/server/sjs-browser-status";
import { providerRequiresDevice } from "$lib/import-tasks/readiness";
import {
  applyPreferenceFilters,
  computeInputHash,
  filtersEqual,
  selectTopUpCandidates,
} from "./reconcile-policy";
import { _runSuggester } from "../../../routes/api/jobs/import/suggest/+server";

/**
 * Per-plan auto-import policy. Auto-activation makes a new profile feel alive
 * (the moat is "it imports the right jobs for you"), so we activate the
 * public (no-login) suggestions, give them a gentle recurring schedule, and
 * kick off one immediate run. Free is kept small + infrequent so it doesn't
 * chew through credits (and the run/scheduler credit gates brake it anyway).
 *
 * Login-gated platforms are NEVER auto-activated — without credentials a run
 * just stalls at the login wall. They stay paused proposals until the user
 * adds credentials.
 *
 * NOTE: the paid-tier numbers are deliberate-but-tunable defaults; adjust per
 * real credit allowances. `profile_auto_import.max_tasks` overrides the count.
 */
interface AutoImportPolicy {
  maxTasks: number;
  autoActivate: boolean;
  scheduleIntervalHours: number | null;
}
const AUTO_IMPORT_POLICY: Record<PlanId, AutoImportPolicy> = {
  explorer: { maxTasks: 2, autoActivate: true, scheduleIntervalHours: 168 },
  seeker: { maxTasks: 4, autoActivate: true, scheduleIntervalHours: 72 },
  hunter: { maxTasks: 6, autoActivate: true, scheduleIntervalHours: 24 },
  contractor: { maxTasks: 8, autoActivate: true, scheduleIntervalHours: 24 },
};
const DEFAULT_POLICY: AutoImportPolicy = AUTO_IMPORT_POLICY.explorer;
const DEFAULT_PREFERRED_HOUR = 9;

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
  login_page_url: string | null;
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
        user_id: true,
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
      login_page_url: job_platforms.login_page_url,
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
      login_mode: search_tasks.login_mode,
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

  // 2. RECOMPUTE — refresh preference-derived filters AND the platform-derived
  // login mode in place.
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
    const desiredFilters = applyPreferenceFilters(
      task.search_filters ?? {},
      stripped,
    );

    const update: {
      search_filters?: typeof desiredFilters;
      login_mode?: string;
    } = {};
    if (!filtersEqual(desiredFilters, task.search_filters ?? {})) {
      update.search_filters = desiredFilters;
    }
    // Keep login_mode aligned with the platform's *current* login requirement
    // so a platform that flips public↔gated after the task was created
    // self-heals: a once-public task left on "none" would otherwise silently
    // stall at a newly-added login wall, and a now-public one would needlessly
    // demand credentials. Only ever toggles between the reconciler's own two
    // modes — a user-set "manual" means the task was adopted (auto_managed=
    // false) and wouldn't be in this set anyway.
    const desiredLoginMode = plat?.login_page_url ? "auto" : "none";
    if (
      (task.login_mode === "auto" || task.login_mode === "none") &&
      task.login_mode !== desiredLoginMode
    ) {
      update.login_mode = desiredLoginMode;
    }

    if (
      update.search_filters !== undefined || update.login_mode !== undefined
    ) {
      await db
        .update(search_tasks)
        .set({ ...update, date_updated: new Date() })
        .where(eq(search_tasks.id, task.id));
      recomputed++;
    }
  }

  // 3. TOP-UP — fill toward budget with distinct, sufficiently-relevant
  // suggestions. The suggester already dedups against ALL existing tasks.
  // Sizing + activation behaviour come from the user's plan policy.
  const userId = profile.user_id;
  const policy = userId
    ? (AUTO_IMPORT_POLICY[(await getActiveSubscription(userId)).plan] ??
      DEFAULT_POLICY)
    : DEFAULT_POLICY;
  const budget = state.max_tasks ?? policy.maxTasks;
  const slots = budget - survivors.length;
  let created = 0;
  let toppedUp = false;
  let suggesterOk = true;
  if (slots > 0) {
    const result = await _runSuggester(profileId);
    if (result.ok) {
      toppedUp = true;
      // Auto-assign the user's available browser device (own or shared, and
      // currently connected) so the tasks run on it — the same auto-pick the
      // run path uses at runtime. Falls back to the server default provider
      // when nothing is connected. Resolved once and shared across the set.
      const device = userId ? await getPreferredDevice(userId) : null;
      const browserProvider = device ? "tunnel" : config.defaultBrowserProvider;
      const deviceApiKeyId = device?.apiKeyId ?? null;
      // When the resolved provider needs a browser device (self-hosted tunnel)
      // and none is connected, a run can't start — so don't auto-activate or
      // enqueue: the task stays a paused proposal until the user connects one.
      const deviceOk = !providerRequiresDevice(
        browserProvider,
        config.browserProvider,
      ) || !!device;
      const candidates = selectTopUpCandidates(result.tasks, slots);
      for (const draft of candidates) {
        const platform = platformById.get(draft.platform_id);
        // Public (no-login) platforms run without credentials; gated ones need
        // a login set first, so configure the matching login mode up front.
        const isPublic = !platform?.login_page_url;
        // Activate only when the task could actually run: public platform AND a
        // usable browser. Gated or device-less suggestions stay paused.
        const activate = policy.autoActivate && isPublic && deviceOk;
        const taskId = await insertAutoTask(profileId, draft, {
          activate,
          scheduleIntervalHours: activate ? policy.scheduleIntervalHours : null,
          browserProvider,
          deviceApiKeyId,
          loginMode: isPublic ? "none" : "auto",
        });
        created++;
        // Kick off one immediate run so the user sees jobs flow in. Credit-
        // gated and best-effort: a failure here never breaks reconcile.
        if (activate && platform?.search_page_url && userId) {
          await enqueueInitialRun({
            searchTaskId: taskId,
            userId,
            platformId: draft.platform_id,
            searchUrl: platform.search_page_url,
            searchTerm: draft.keywords,
            browserProvider,
          }).catch((err) => {
            console.warn(
              `[auto-import] initial run enqueue failed for task ${taskId}:`,
              err,
            );
          });
        }
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

/** Insert one suggester draft as an auto-managed task. Mirrors the canonical
 * insert in scripts/suggest-task.ts, wiring credentials if any. Activated tasks
 * get a recurring schedule; paused ones (gated platforms) do not. Returns the
 * new task id. */
async function insertAutoTask(
  profileId: number,
  draft: {
    platform_id: number;
    keywords: string | null;
    note: string;
    filters: Record<string, SearchFilterValue>;
  },
  opts: {
    activate: boolean;
    scheduleIntervalHours: number | null;
    browserProvider: string;
    deviceApiKeyId: number | null;
    /** "none" for public platforms, "auto" for login-gated ones. */
    loginMode: string;
  },
): Promise<number> {
  const existingCred = await db.query.platform_profiles.findFirst({
    where: and(
      eq(platform_profiles.profile_id, profileId),
      eq(platform_profiles.platform_id, draft.platform_id),
    ),
    columns: { id: true },
  });
  const schedule = opts.activate ? opts.scheduleIntervalHours : null;
  const [row] = await db.insert(search_tasks).values({
    profile_id: profileId,
    platform_id: draft.platform_id,
    platform_profile_id: existingCred?.id ?? null,
    search_term: draft.keywords,
    search_location: null,
    search_filters: draft.filters,
    note: draft.note,
    status: "idle",
    is_active: opts.activate,
    origin: "auto",
    auto_managed: true,
    login_mode: opts.loginMode,
    skip_existing: false,
    keep_minimized: true,
    browser_provider: opts.browserProvider,
    sjsbrowser_api_key: opts.deviceApiKeyId,
    schedule_interval_hours: schedule,
    schedule_preferred_hour: DEFAULT_PREFERRED_HOUR,
    // First scheduled run is one interval out; the immediate run is enqueued
    // separately so the recurring cadence doesn't double-fire on creation.
    next_scheduled_run: schedule
      ? new Date(Date.now() + schedule * 3600_000)
      : null,
    date_created: new Date(),
  }).returning({ id: search_tasks.id });
  return row.id;
}

/**
 * Enqueue one immediate scrape run for a freshly auto-activated task, mirroring
 * POST /api/import-tasks/[id]/run. Credit-gated: if the user lacks credits we
 * skip silently — the task stays active and the scheduler retries later.
 */
async function enqueueInitialRun(opts: {
  searchTaskId: number;
  userId: string;
  platformId: number;
  searchUrl: string;
  searchTerm: string | null;
  browserProvider: string;
}): Promise<void> {
  // Mirrors the run endpoint's ~15-credit pre-check. The OSS stub is a no-op;
  // the cloud overlay throws when the balance is too low, which we treat as
  // "skip the immediate run" rather than an error.
  try {
    await requireCredits(opts.userId, 15);
  } catch {
    return;
  }

  const [run] = await db.insert(search_task_runs).values({
    search_task_id: opts.searchTaskId,
    status: "queued",
    triggered_by: "scheduler",
    settings: { browser_provider: opts.browserProvider },
  }).returning({ id: search_task_runs.id });

  await db.update(search_tasks).set({
    status: "queued",
    status_message: "Waiting in queue",
    date_updated: new Date(),
  }).where(eq(search_tasks.id, opts.searchTaskId));

  // Route to the hosted queue when the server defaults to a cloud browser and
  // no device-backed provider was chosen.
  let effectiveProvider: string | null = opts.browserProvider;
  if (!effectiveProvider) {
    const serverDefault = process.env.SJS_BROWSER_PROVIDER || "local";
    if (serverDefault === "goLogin") effectiveProvider = "hosted";
  }

  const job = await addScrapeJob({
    searchTaskId: opts.searchTaskId,
    runId: run.id,
    searchUrl: opts.searchUrl,
    platformId: String(opts.platformId),
    triggeredBy: "scheduler",
    browserProvider: effectiveProvider,
    ...(opts.searchTerm ? { searchTerm: opts.searchTerm } : {}),
  });

  await db.update(search_task_runs).set({ bullmq_job_id: job.id })
    .where(eq(search_task_runs.id, run.id));
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
