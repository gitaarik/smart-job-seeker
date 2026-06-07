/**
 * Pure decision logic for the auto-import reconciler — no DB or LLM imports,
 * so it's unit-testable in isolation. The orchestration lives in
 * `reconcile.ts`; everything here is a deterministic function of its inputs.
 */
import { createHash } from "node:crypto";
import type { SearchFilterValue } from "$lib/job-platforms/search-filters";

export type FilterMap = Record<string, string | string[]>;
export type Relevance = "high" | "medium" | "low";

// Canonical filter names produced by preferencesToFilters. RECOMPUTE only
// overwrites these on an existing task, preserving any other filter keys
// (e.g. sort_by / time_posted) a future flow might attach.
export const PREFERENCE_FILTER_NAMES = [
  "hours_commitment",
  "employment_type",
  "experience_level",
  "work_location",
] as const;

/** Stable string form of a filter map: sorted keys, sorted values. Two maps
 * compare equal iff they hold the same filter selections, order-independent. */
export function canonFilters(f: FilterMap): string {
  const out: Record<string, string[]> = {};
  for (const key of Object.keys(f).sort()) {
    const v = f[key];
    out[key] = (Array.isArray(v) ? [...v] : [v]).map(String).sort();
  }
  return JSON.stringify(out);
}

/** True iff two filter maps hold the same selections. */
export function filtersEqual(a: FilterMap, b: FilterMap): boolean {
  return canonFilters(a) === canonFilters(b);
}

/** Merge recomputed preference filters into an existing filter map, replacing
 * only the preference-managed keys and keeping everything else. */
export function applyPreferenceFilters(
  existing: FilterMap,
  prefFilters: Record<string, SearchFilterValue>,
): FilterMap {
  const out: FilterMap = {};
  for (const [k, v] of Object.entries(existing)) {
    if (!PREFERENCE_FILTER_NAMES.includes(k as never)) out[k] = v;
  }
  for (const [k, v] of Object.entries(prefFilters)) out[k] = v;
  return out;
}

/**
 * Pick which suggester drafts to materialize on top-up: drop low-relevance
 * ideas (the quality floor), prefer high over medium when slots are scarce,
 * and never exceed the remaining budget. Sort is stable, so equal-relevance
 * drafts keep the suggester's own ordering.
 */
export function selectTopUpCandidates<T extends { relevance: Relevance }>(
  tasks: T[],
  slots: number,
): T[] {
  if (slots <= 0) return [];
  const rank: Record<Relevance, number> = { high: 0, medium: 1, low: 2 };
  return tasks
    .filter((t) => t.relevance !== "low")
    .sort((a, b) => rank[a.relevance] - rank[b.relevance])
    .slice(0, slots);
}

/**
 * Whether the reconciler may auto-activate ("promote") an existing paused auto
 * proposal. Only an *untouched* proposal qualifies — never one the user
 * explicitly paused (`user_paused_at`) or already ran (`last_run`), so
 * promotion can't fight a deliberate choice. It must also be runnable now, the
 * plan must auto-activate, and there must be room in the active budget.
 */
export function canPromoteProposal(
  task: {
    is_active: boolean | null;
    user_paused_at: Date | null;
    last_run: Date | null;
  },
  opts: { runnable: boolean; autoActivate: boolean; hasActiveSlot: boolean },
): boolean {
  return (
    !task.is_active &&
    task.user_paused_at == null &&
    task.last_run == null &&
    opts.autoActivate &&
    opts.runnable &&
    opts.hasActiveSlot
  );
}

export interface InputHashSources {
  title: string | null;
  core_stack: string | null;
  city: string | null;
  region: string | null;
  country_code: string | null;
  job_types: string[] | null;
  experience_levels: string[] | null;
  work_location: string[] | null;
  locations: string[] | null;
  remote_only: boolean | null;
}

/**
 * Hash of every input the suggester/recompute actually depend on. An
 * unchanged hash means a reconcile would be a no-op, so the orchestrator skips
 * it (and the LLM call). Array order is normalized so reordering a preference
 * list doesn't look like a change. core_stack stands in for the tech-skill
 * summary to keep this a single cheap profile read.
 */
export function computeInputHash(src: InputHashSources): string {
  const payload = {
    title: src.title ?? "",
    core_stack: src.core_stack ?? "",
    city: src.city ?? "",
    region: src.region ?? "",
    country_code: src.country_code ?? "",
    job_types: [...(src.job_types ?? [])].sort(),
    experience_levels: [...(src.experience_levels ?? [])].sort(),
    work_location: [...(src.work_location ?? [])].sort(),
    locations: [...(src.locations ?? [])].sort(),
    remote_only: src.remote_only ?? false,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
