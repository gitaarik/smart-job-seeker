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
  | "job_type"
  | "experience_level";

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
  experience_level: {
    label: "Experience level",
    values: {
      any: "Any",
      entry: "Entry-level",
      mid: "Mid-level",
      senior: "Senior",
      lead: "Lead",
      executive: "Executive",
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

/**
 * Per-canonical synonyms that platforms use for the same concept. Used in
 * two places:
 *  1. The identify prompt — listed as hints so the LLM recognizes
 *     "Workplace type" / "Date posted" / etc. as work_location /
 *     time_posted respectively.
 *  2. The configure step's click-to-expand fallback — when the LLM omits a
 *     requested filter, we scan visible button names for any of these
 *     aliases to find a likely "Filter by X" / "All filters" section
 *     opener.
 *
 * Lowercase substring match. Aliases are intentionally broad — false
 * positives are caught later (after clicking & re-identifying, the LLM
 * either confirms the filter or returns nothing).
 */
export const SEARCH_FILTER_ALIASES: Record<SearchFilterName, string[]> = {
  sort_by: ["sort by", "sort", "order by", "newest", "most recent", "relevance"],
  time_posted: [
    "date posted",
    "posted",
    "time posted",
    "past 24",
    "past day",
    "last 24",
    "past week",
    "last week",
    "past month",
    "last month",
    "any time",
  ],
  work_location: [
    "workplace",
    "workplace type",
    "work type",
    "work mode",
    "work location",
    "on-site",
    "onsite",
    "in person",
    "in-person",
    "remote",
    "hybrid",
  ],
  job_type: [
    "job type",
    "employment type",
    "type of employment",
    "full-time",
    "fulltime",
    "part-time",
    "parttime",
    "contract",
    "freelance",
    "internship",
    "intern",
  ],
  experience_level: [
    "experience level",
    "experience",
    "seniority",
    "seniority level",
    "career level",
    "entry-level",
    "entry level",
    "junior",
    "mid-level",
    "mid level",
    "senior",
    "lead",
    "principal",
    "staff",
    "executive",
    "director",
  ],
};

/**
 * Subset of SEARCH_FILTER_ALIASES restricted to CATEGORY names (the labels
 * that section openers/headers use), with value-name aliases stripped.
 * Used only by the click-to-expand heuristic in configure.ts — it scans
 * page elements looking for "Filter by X" / "All filters" style section
 * openers.
 *
 * Historical context (runs 629/630): matching on value names like
 * "Full-time" or "Remote" used to produce false positives — LinkedIn's
 * "Preferences match" modal exposes a "Full-time" link that hijacked the
 * heuristic and clicked the wrong element. The split into category-only
 * aliases was the workaround.
 *
 * The architecture has since added two defenses against that scenario:
 *   (1) `findSearchBarContainer` + container scoping in
 *       `tryClickToExpandFilter` — candidates that don't resolve inside
 *       the filter-bar container get dropped (the Preferences match
 *       modal lives outside it).
 *   (2) `Escape` before each candidate scan in configure.ts — pre-empts
 *       any lingering modal so it isn't even in the AX tree when we scan.
 *
 * So the absolute prohibition this comment originally enforced is
 * overstated for the current code. Value-name aliases would now mostly
 * be filtered out before causing harm — they are still kept out by
 * default because (a) "section opener" is the semantic intent of this
 * map (a category name, not a value name), and (b) the defenses above
 * are heuristic, not airtight (page-wide fallback kicks in when the
 * container probe fails, and that path has no firewall). When LinkedIn
 * or another platform labels a section opener with what looks like a
 * value name (e.g. a "Remote" button that opens the workplace-type
 * subsection rather than directly applying), add it here — but verify
 * the run logs first that the post-click flow finds a popup and applies
 * options, rather than silently clicking the wrong thing.
 *
 * Value-name aliases live in OPTION_LABEL_ALIASES and are used separately
 * for the post-expand checkbox-match fallback.
 */
export const SEARCH_FILTER_CATEGORY_ALIASES: Record<SearchFilterName, string[]> = {
  sort_by: ["sort by", "order by"],
  time_posted: ["date posted", "time posted"],
  work_location: [
    "workplace type",
    "work type",
    "work mode",
    "work location",
  ],
  job_type: ["job type", "employment type", "type of employment"],
  experience_level: [
    "experience level",
    "seniority",
    "seniority level",
    "career level",
  ],
};

/**
 * Per-(filter, option_key) synonyms for the option labels themselves.
 * Helps when a platform labels e.g. work_location.onsite as "On site"
 * (with space) or "In office" instead of our canonical "On-site".
 */
export const OPTION_LABEL_ALIASES: Partial<
  Record<SearchFilterName, Record<string, string[]>>
> = {
  work_location: {
    remote: ["remote"],
    hybrid: ["hybrid"],
    onsite: ["on-site", "on site", "onsite", "in person", "in-person", "in office"],
  },
  job_type: {
    fulltime: ["full-time", "fulltime", "full time"],
    parttime: ["part-time", "parttime", "part time"],
    contract: ["contract", "contractor", "freelance"],
    internship: ["internship", "intern"],
  },
  time_posted: {
    "24h": ["past 24 hours", "last 24 hours", "past day"],
    week: ["past week", "last week"],
    month: ["past month", "last month"],
  },
  sort_by: {
    newest: ["newest", "most recent", "date"],
    relevance: ["relevance", "most relevant"],
  },
  experience_level: {
    entry: ["entry-level", "entry level", "junior", "associate", "internship"],
    mid: ["mid-level", "mid level", "intermediate"],
    // "Expert" covers Upwork (3-tier scale: Entry / Intermediate / Expert) —
    // listed last so platforms with a real "Senior" label match it first.
    senior: ["senior", "senior-level", "sr.", "expert"],
    // Upwork has no Lead tier; "Expert" is its top tier. Dedup in the apply
    // pass prevents toggling the same checkbox off when the user requests
    // both senior+lead.
    lead: ["lead", "principal", "staff", "expert"],
    executive: ["executive", "director", "vp", "head of"],
  },
};

/**
 * Per-platform widget cardinality overrides. Some filters render as
 * checkbox-style controls but the underlying URL state only holds a single
 * value — clicking a second option replaces the first instead of adding to
 * it (Upwork's experience_level / `contractor_tier`: clicking Intermediate
 * sets `?contractor_tier=2`, then clicking Expert sets `?contractor_tier=3`,
 * dropping Intermediate). The apply pass uses this map to trim the
 * requested list to the first value and log a warning, instead of
 * click-overwriting.
 *
 * Keyed by lowercase platform "slug" (first label of the hostname, e.g.
 * `upwork.com` → `upwork`). Default cardinality is multi (no entry).
 */
export const PLATFORM_FILTER_CARDINALITY: Record<
  string,
  Partial<Record<SearchFilterName, "single">>
> = {
  upwork: { experience_level: "single" },
};
