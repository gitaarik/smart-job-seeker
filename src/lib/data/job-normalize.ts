/**
 * Taxonomy normalization for job fields.
 *
 * Maps raw LLM-extracted strings (work arrangement, job type, experience level)
 * onto the canonical taxonomy values used for storage and matching. Shared by
 * the scraper's `upsertJob` and the manual application-create path so both
 * produce identically-normalized `work_location` / `job_types` /
 * `experience_levels` fields.
 */

import {
  buildNormalizeMap,
  EXPERIENCE_LEVELS,
  getPatterns,
  JOB_TYPES,
  type TaxonomyCategory,
  WORK_LOCATIONS,
} from "./job-taxonomy.js";

/**
 * Build a normalizer for a taxonomy category.
 * Handles alias matching, pattern matching, and comma-separated composites.
 */
function buildNormalizer(category: TaxonomyCategory) {
  const normMap = buildNormalizeMap(category);
  const patterns = getPatterns(category);

  /**
   * Normalize a single raw value to its canonical form.
   * Returns null if no match found.
   */
  function normalizeOne(raw: string): string | null {
    const lower = raw.toLowerCase().trim();
    if (!lower) return null;
    const canonical = normMap.get(lower);
    if (canonical) return canonical;
    for (const p of patterns) {
      if (p.mode === "includes" && lower.includes(p.pattern)) return p.canonical;
      if (p.mode === "startsWith" && lower.startsWith(p.pattern)) return p.canonical;
    }
    return null;
  }

  /**
   * Normalize a raw value, splitting comma-separated composites.
   * Returns deduplicated canonical values, or null if none matched.
   */
  return function normalize(raw: string | null): string[] | null {
    if (!raw) return null;
    // Split comma-separated values (e.g. "On-site, Hybrid, Remote")
    const parts = raw.includes(",") ? raw.split(",") : [raw];
    const results = new Set<string>();
    for (const part of parts) {
      const canonical = normalizeOne(part.trim());
      if (canonical) results.add(canonical);
    }
    return results.size > 0 ? [...results] : null;
  };
}

export const normalizeWorkLocation = buildNormalizer(WORK_LOCATIONS);
export const normalizeJobType = buildNormalizer(JOB_TYPES);
const _normalizeExpLevel = buildNormalizer(EXPERIENCE_LEVELS);

/**
 * Normalize an array of experience level values.
 * Each element is normalized individually; unknowns are dropped.
 */
export function normalizeExperienceLevels(
  levels: string[] | null,
): string[] | null {
  if (!levels?.length) return null;
  const results = new Set<string>();
  for (const level of levels) {
    const normalized = _normalizeExpLevel(level);
    if (normalized) normalized.forEach((v) => results.add(v));
  }
  return results.size > 0 ? [...results] : null;
}
