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
	| 'sort_by'
	| 'time_posted'
	| 'work_location'
	| 'hours_commitment'
	| 'employment_type'
	| 'experience_level';

/**
 * Legacy filter names we still accept on read (jsonb data persisted by older
 * builds). Translated to the new axes via {@link normalizeFilters}.
 */
export type LegacySearchFilterName = 'job_type';

export const LEGACY_SEARCH_FILTER_NAMES: LegacySearchFilterName[] = ['job_type'];

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

export const SEARCH_FILTER_DEFINITIONS: Record<SearchFilterName, SearchFilterDefinition> = {
	sort_by: {
		label: 'Sort by',
		values: {
			relevance: 'Relevance',
			newest: 'Newest first'
		}
	},
	time_posted: {
		label: 'Posted',
		values: {
			any: 'Any time',
			'24h': 'Last 24 hours',
			week: 'Last week',
			month: 'Last month'
		}
	},
	work_location: {
		label: 'Work location',
		values: {
			any: 'Any',
			remote: 'Remote',
			hybrid: 'Hybrid',
			onsite: 'On-site'
		}
	},
	hours_commitment: {
		label: 'Hours',
		values: {
			any: 'Any',
			fulltime: 'Full-time',
			parttime: 'Part-time'
		}
	},
	employment_type: {
		label: 'Employment type',
		values: {
			any: 'Any',
			permanent: 'Permanent',
			contract: 'Contract',
			internship: 'Internship',
			temporary: 'Temporary'
		}
	},
	experience_level: {
		label: 'Experience level',
		values: {
			any: 'Any',
			entry: 'Entry-level',
			mid: 'Mid-level',
			senior: 'Senior',
			lead: 'Lead',
			executive: 'Executive'
		}
	}
};

export const SEARCH_FILTER_NAMES = Object.keys(SEARCH_FILTER_DEFINITIONS) as SearchFilterName[];

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
	sort_by: ['sort by', 'sort', 'order by', 'newest', 'most recent', 'relevance'],
	time_posted: [
		'date posted',
		'posted',
		'time posted',
		'past 24',
		'past day',
		'last 24',
		'past week',
		'last week',
		'past month',
		'last month',
		'any time'
	],
	work_location: [
		'workplace',
		'workplace type',
		'work type',
		'work mode',
		'work location',
		'on-site',
		'onsite',
		'in person',
		'in-person',
		'remote',
		'hybrid'
	],
	hours_commitment: [
		'hours',
		'weekly hours',
		'time commitment',
		'full-time',
		'fulltime',
		'part-time',
		'parttime'
	],
	employment_type: [
		'employment type',
		'type of employment',
		'job type',
		'permanent',
		'contract',
		'contractor',
		'freelance',
		'temporary',
		'temp',
		'internship',
		'intern'
	],
	experience_level: [
		'experience level',
		'experience',
		'seniority',
		'seniority level',
		'career level',
		'entry-level',
		'entry level',
		'junior',
		'mid-level',
		'mid level',
		'senior',
		'lead',
		'principal',
		'staff',
		'executive',
		'director'
	]
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
	sort_by: ['sort by', 'order by'],
	time_posted: ['date posted', 'time posted'],
	work_location: ['workplace type', 'work type', 'work mode', 'work location'],
	// LinkedIn (and several other boards) puts fulltime/parttime inside an
	// "Employment type" / "Job type" popup alongside contract/internship.
	// Listing those aliases here lets the heuristic find the right opener
	// directly — without them, hours_commitment falls through to the LLM
	// identifier which has picked "Filter by Jobs" / "Filter by Company" in
	// the past (run 805). The harvest mechanism handles the co-location.
	hours_commitment: [
		'hours',
		'weekly hours',
		'time commitment',
		'employment type',
		'type of employment',
		'job type'
	],
	employment_type: ['employment type', 'type of employment', 'job type'],
	experience_level: ['experience level', 'seniority', 'seniority level', 'career level']
};

/**
 * Per-(filter, option_key) synonyms for the option labels themselves.
 * Helps when a platform labels e.g. work_location.onsite as "On site"
 * (with space) or "In office" instead of our canonical "On-site".
 */
export const OPTION_LABEL_ALIASES: Partial<Record<SearchFilterName, Record<string, string[]>>> = {
	work_location: {
		remote: ['remote'],
		hybrid: ['hybrid'],
		onsite: ['on-site', 'on site', 'onsite', 'in person', 'in-person', 'in office']
	},
	hours_commitment: {
		fulltime: ['full-time', 'fulltime', 'full time'],
		parttime: ['part-time', 'parttime', 'part time']
	},
	employment_type: {
		// Most boards label W2/payroll roles as "Full-time"; the LLM/heuristic
		// resolves this contextually (a "Full-time" checkbox in a job-type
		// dropdown usually means permanent FTE). On Upwork there's no permanent
		// role concept at all — handled via `unsupported_filters`.
		permanent: ['permanent', 'full-time', 'fte', 'w2'],
		contract: ['contract', 'contractor', 'freelance'],
		internship: ['internship', 'intern'],
		temporary: ['temporary', 'temp', 'fixed-term', 'fixed term']
	},
	time_posted: {
		'24h': ['past 24 hours', 'last 24 hours', 'past day'],
		week: ['past week', 'last week'],
		month: ['past month', 'last month']
	},
	sort_by: {
		newest: ['newest', 'most recent', 'date'],
		relevance: ['relevance', 'most relevant']
	},
	experience_level: {
		entry: ['entry-level', 'entry level', 'junior', 'associate', 'internship'],
		// "Mid-Senior level" / "Mid-Senior" covers platforms whose tier
		// collapses mid + senior into one band. Inventory-side dedup is by
		// accessible name, so if `senior` lands on the same node first this
		// alias won't toggle it back off.
		mid: ['mid-level', 'mid level', 'intermediate', 'mid-senior', 'mid-senior level'],
		// "Expert" covers Upwork (3-tier scale: Entry / Intermediate / Expert) —
		// listed last so platforms with a real "Senior" label match it first.
		senior: ['senior', 'senior-level', 'sr.', 'expert'],
		// Upwork has no Lead tier; "Expert" is its top tier. Dedup in the apply
		// pass prevents toggling the same checkbox off when the user requests
		// both senior+lead.
		lead: ['lead', 'principal', 'staff', 'expert'],
		executive: ['executive', 'director', 'vp', 'head of']
	}
};

/**
 * The experience-level "buckets" the search-form filter exposes — the
 * value_keys of `SEARCH_FILTER_DEFINITIONS.experience_level` minus "any". The
 * job taxonomy (job-taxonomy.ts EXPERIENCE_LEVELS) is finer-grained (junior,
 * mid_senior, principal, staff, director, internship), so BOTH source-side
 * filtering and local eligibility collapse onto these five buckets to stay
 * consistent with each other.
 */
export const EXPERIENCE_LEVEL_BUCKETS = ['entry', 'mid', 'senior', 'lead', 'executive'] as const;

// Case- and separator-insensitive key, matching the normalization the
// eligibility SQL applies: regexp_replace(lower(elem), '[-_ ]', '', 'g').
const normalizeExpTerm = (v: string): string => v.toLowerCase().replace(/[-_\s]/g, '');

/**
 * normalized term → bucket value_keys it belongs to. Built from the bucket
 * value_keys, their user-facing labels, and OPTION_LABEL_ALIASES — the SAME
 * synonyms the scraper uses to tick a platform's experience checkboxes — so the
 * taxonomy's finer levels (junior→entry, mid_senior→mid, principal/staff→lead,
 * director→executive, internship→entry) map identically at source and locally.
 */
const EXPERIENCE_TERM_TO_BUCKETS: Map<string, string[]> = (() => {
	const map = new Map<string, string[]>();
	const add = (term: string, bucket: string) => {
		const key = normalizeExpTerm(term);
		const arr = map.get(key) ?? [];
		if (!arr.includes(bucket)) arr.push(bucket);
		map.set(key, arr);
	};
	for (const bucket of EXPERIENCE_LEVEL_BUCKETS) {
		add(bucket, bucket);
		add(SEARCH_FILTER_DEFINITIONS.experience_level.values[bucket], bucket);
		for (const alias of OPTION_LABEL_ALIASES.experience_level?.[bucket] ?? []) {
			add(alias, bucket);
		}
	}
	return map;
})();

/**
 * Map one raw experience-level term — a taxonomy canonical ("mid_senior"), a
 * search-filter value_key ("senior"), or a stored match_config label
 * ("Senior") — to the buckets it falls under. Unknown terms → [].
 */
export function experienceLevelBuckets(value: string): string[] {
	return EXPERIENCE_TERM_TO_BUCKETS.get(normalizeExpTerm(value)) ?? [];
}

/** Collapse a list of experience-level terms to the unique set of buckets. */
export function toExperienceBuckets(values: string[]): string[] {
	const out: string[] = [];
	for (const v of values) {
		for (const b of experienceLevelBuckets(v)) {
			if (!out.includes(b)) out.push(b);
		}
	}
	return out;
}

/**
 * Inverse of {@link toExperienceBuckets}: every normalized term that falls into
 * any of the given buckets. Used to build the SQL membership list checked
 * against a job's stored `experience_levels`.
 */
export function expandExperienceBuckets(buckets: string[]): string[] {
	const wanted = new Set(buckets);
	const out: string[] = [];
	for (const [term, termBuckets] of EXPERIENCE_TERM_TO_BUCKETS) {
		if (termBuckets.some((b) => wanted.has(b))) out.push(term);
	}
	return out;
}

/**
 * Map legacy `job_type` value_keys onto the new (hours_commitment,
 * employment_type) axes. Used by {@link normalizeFilters} when reading
 * jsonb data persisted before the split. A single legacy value can
 * populate one or both new axes — `fulltime`/`parttime` are pure hours
 * commitments, `contract`/`internship` are pure employment types.
 */
const LEGACY_JOB_TYPE_TO_NEW_AXES: Record<
	string,
	{ hours_commitment?: string; employment_type?: string }
> = {
	fulltime: { hours_commitment: 'fulltime' },
	parttime: { hours_commitment: 'parttime' },
	contract: { employment_type: 'contract' },
	internship: { employment_type: 'internship' }
};

/**
 * Normalize a raw `search_filters` object (as stored on `search_tasks` or
 * a profile preference blob) into the canonical new-axes form. Strips
 * unknown filter names, collapses values to arrays, and translates the
 * legacy `job_type` axis into `hours_commitment` + `employment_type`.
 *
 * Defensive — never throws. Unknown keys are dropped silently.
 */
export function normalizeFilters(
	raw: Record<string, unknown> | null | undefined
): Partial<Record<SearchFilterName, string[]>> {
	const out: Partial<Record<SearchFilterName, string[]>> = {};
	if (!raw || typeof raw !== 'object') return out;

	const push = (name: SearchFilterName, value: string) => {
		const valid = SEARCH_FILTER_DEFINITIONS[name].values;
		if (!(value in valid)) return;
		const existing = out[name] ?? [];
		if (!existing.includes(value)) existing.push(value);
		out[name] = existing;
	};

	for (const [name, rawValue] of Object.entries(raw)) {
		const values = Array.isArray(rawValue)
			? rawValue.filter((v): v is string => typeof v === 'string')
			: typeof rawValue === 'string'
				? [rawValue]
				: [];
		if (values.length === 0) continue;

		if (name === 'job_type') {
			for (const v of values) {
				const mapped = LEGACY_JOB_TYPE_TO_NEW_AXES[v];
				if (!mapped) continue;
				if (mapped.hours_commitment) push('hours_commitment', mapped.hours_commitment);
				if (mapped.employment_type) push('employment_type', mapped.employment_type);
			}
			continue;
		}

		if (!(name in SEARCH_FILTER_DEFINITIONS)) continue;
		for (const v of values) push(name as SearchFilterName, v);
	}

	return out;
}

/**
 * Filters we configure in the job board's search FORM at scrape time.
 * Everything NOT listed here is applied LOCALLY instead (server-side
 * eligibility + match scoring), because driving it into the form is slow
 * (multi-step popups + retry passes) while adding little:
 *
 * Kept at source:
 *  - work_location — geography dominates the result set. A remote-only seeker
 *    against a location-anchored search would otherwise have the few remote
 *    hits buried past the pagination cap; also often a cheap direct-apply chip.
 *  - time_posted / sort_by — cheap (usually URL params / one click), have no
 *    local equivalent, and protect relevance density under the page cap.
 *
 * Applied locally instead:
 *  - hours_commitment / employment_type — redundant with checkEligibility's
 *    job_types gate, and low impact on which jobs land within the page cap.
 *  - experience_level — covered by the experience-level eligibility gate; the
 *    form widget is an expensive popup.
 */
export const SOURCE_APPLIED_FILTER_NAMES: SearchFilterName[] = [
	'sort_by',
	'time_posted',
	'work_location'
];

/**
 * Keep only the filters we apply at the source (search form); see
 * {@link SOURCE_APPLIED_FILTER_NAMES}. A task still RECORDS its full filter
 * selection (user intent), but the scraper drives only this subset into the
 * form — the rest are enforced locally.
 */
export function sourceApplicableFilters<T>(filters: Record<string, T>): Record<string, T> {
	const allow = new Set<string>(SOURCE_APPLIED_FILTER_NAMES);
	const out: Record<string, T> = {};
	for (const [name, value] of Object.entries(filters)) {
		if (allow.has(name)) out[name] = value;
	}
	return out;
}
