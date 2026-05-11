/**
 * Canonical taxonomy for search-URL filters.
 *
 * Each entry defines one filter the picker can offer (sort_by, time_posted,
 * etc.) and the user-facing labels for each value. The first key in `values`
 * is the "default" — picking it means "no filter applied", so we don't store
 * a URL fragment for it on the preset.
 *
 * Per-platform support lives on `job_platform_search_presets.params`:
 *
 *   { sort_by: { newest: "sortBy=DD" }, time_posted: { "24h": "f_TPR=r86400" } }
 *
 * A filter only appears in the picker UI if the selected preset has an entry
 * for it; within that, only the value_keys present in the preset's mapping
 * (plus the default) get rendered.
 */

export type SearchFilterName =
  | "sort_by"
  | "time_posted"
  | "work_location"
  | "job_type";

/** Per-filter configuration carried on `job_platform_search_presets.params`. */
export type PresetFilterConfig =
  | { multi: false; options: Record<string, string> }
  | {
    multi: true;
    /** Query-param name (e.g. "f_WT" for LinkedIn work location). */
    param: string;
    /** Separator joining the chosen values (e.g. "," for LinkedIn). */
    sep: string;
    /** value_key → raw value emitted into the joined URL fragment. */
    options: Record<string, string>;
  };

/** User selections stored on `search_tasks.search_filters`. */
export type SearchFilterValue = string | string[];

export interface SearchFilterDefinition {
  label: string;
  /** Insertion order matters: the FIRST entry is the default (no fragment). */
  values: Record<string, string>;
}

export const SEARCH_FILTER_DEFINITIONS: Record<
  SearchFilterName,
  SearchFilterDefinition
> = {
  sort_by: {
    label: "Sort by",
    values: {
      relevance: "Relevance",
      newest: "Newest first",
    },
  },
  time_posted: {
    label: "Posted",
    values: {
      any: "Any time",
      "24h": "Last 24 hours",
      week: "Last week",
      month: "Last month",
    },
  },
  work_location: {
    label: "Work location",
    values: {
      any: "Any",
      remote: "Remote",
      hybrid: "Hybrid",
      onsite: "On-site",
    },
  },
  job_type: {
    label: "Job type",
    values: {
      any: "Any",
      fulltime: "Full-time",
      parttime: "Part-time",
      contract: "Contract",
      internship: "Internship",
    },
  },
};

export const SEARCH_FILTER_NAMES = Object.keys(
  SEARCH_FILTER_DEFINITIONS,
) as SearchFilterName[];

/** Default value_key for a filter (first entry in its values map). */
export function defaultValueKey(name: SearchFilterName): string {
  return Object.keys(SEARCH_FILTER_DEFINITIONS[name].values)[0];
}
