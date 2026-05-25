/**
 * Aggregate record of which canonical (filter, value_key) pairs the scraper
 * has tried to apply on each platform but failed to find on the search form.
 * Persisted on `job_platforms.unsupported_filters` and merged (union) on
 * every run — entries accumulate over time and aren't auto-cleared.
 *
 * Consumed by the suggest endpoint as a soft signal: when a user's
 * preference maps to a (filter, value_key) we know this platform has
 * historically failed to apply, the LLM is asked to deprioritize that
 * platform in its ranking.
 */

import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { job_platforms } from "$lib/server/db/schema";
import {
  SEARCH_FILTER_DEFINITIONS,
  type SearchFilterName,
} from "$lib/job-platforms/search-filters";

export type UnsupportedFilters = Partial<Record<SearchFilterName, string[]>>;

/**
 * Diff the (filter, value_key) pairs the task asked for against what the
 * form actually exposes. Anything requested but not present in `observed`
 * is recorded as unsupported. Drops non-canonical names/keys defensively.
 *
 * `observed` mirrors `SearchFormMap.filters` from the scraper:
 *   { work_location: { options: { remote: ..., hybrid: ... } } }
 */
export function diffRequestedAgainstObserved(
  requested: Record<string, string[] | string | undefined>,
  observed: Record<string, { options: Record<string, unknown> } | undefined>,
): UnsupportedFilters {
  const out: UnsupportedFilters = {};
  for (const [name, rawValues] of Object.entries(requested)) {
    if (!(name in SEARCH_FILTER_DEFINITIONS)) continue;
    const canonicalName = name as SearchFilterName;
    const def = SEARCH_FILTER_DEFINITIONS[canonicalName];
    const values = Array.isArray(rawValues)
      ? rawValues
      : rawValues
      ? [rawValues]
      : [];
    const validValues = values.filter((v) => v in def.values);
    if (validValues.length === 0) continue;

    const widget = observed[name];
    if (!widget) {
      // Whole filter widget missing — every requested value is unsupported.
      out[canonicalName] = validValues;
      continue;
    }
    // If the widget was identified, don't record per-value misses. The LLM
    // only emits keys it explicitly mapped — values applied via the
    // heuristic-label-match fallback in configure.ts (e.g. Upwork's mid →
    // "Intermediate", senior → "Expert" via OPTION_LABEL_ALIASES) won't
    // appear in `widget.options` even though they succeed. Diffing per-key
    // here would falsely flag those as unsupported, and the next run would
    // skip them at apply time — silently dropping filters that worked
    // before (run 769 hit this with experience_level=[mid,senior]). Granular
    // per-value unsupported entries should come from explicit seed
    // migrations, not from this auto-recorder.
  }
  return out;
}

/**
 * Merge newly-observed-as-missing entries into the platform's existing
 * `unsupported_filters` row. Union semantics: a value_key once recorded as
 * unsupported stays recorded until manually cleared. No-op when the diff
 * is empty so we don't touch the timestamp on filter-less runs.
 */
export async function recordUnsupportedFilters(
  platformId: number,
  newlyMissing: UnsupportedFilters,
): Promise<void> {
  if (Object.keys(newlyMissing).length === 0) return;

  const row = await db.query.job_platforms.findFirst({
    where: eq(job_platforms.id, platformId),
    columns: { unsupported_filters: true },
  });
  const existing = (row?.unsupported_filters ?? {}) as UnsupportedFilters;
  const merged = mergeUnsupported(existing, newlyMissing);

  await db
    .update(job_platforms)
    .set({
      unsupported_filters: merged,
      unsupported_filters_at: new Date(),
    })
    .where(eq(job_platforms.id, platformId));
}

/** Union of two unsupported-filter maps. */
export function mergeUnsupported(
  a: UnsupportedFilters,
  b: UnsupportedFilters,
): UnsupportedFilters {
  const out: UnsupportedFilters = { ...a };
  for (
    const [name, keys] of Object.entries(b) as Array<
      [SearchFilterName, string[]]
    >
  ) {
    const existing = out[name] ?? [];
    out[name] = Array.from(new Set([...existing, ...keys]));
  }
  return out;
}
