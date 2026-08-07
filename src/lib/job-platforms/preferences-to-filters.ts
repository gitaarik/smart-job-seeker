/**
 * Deterministic mapping from a profile's match_config preferences to the
 * canonical search-filter taxonomy in `search-filters.ts`.
 *
 * match_config stores user-facing labels ("Full-time", "Senior", "Remote")
 * because those drive the preference picker UI. The scraper's search-form
 * driver and the URL-preset code both work in canonical value_keys
 * ("fulltime", "senior", "remote"). This module bridges the two.
 *
 * Used by /api/jobs/import/suggest to build the per-platform filter set on
 * the server so the LLM never has to translate labels → value_keys (it was
 * doing so unreliably and leaking values like "senior" into the keyword
 * string).
 */
import {
	SEARCH_FILTER_DEFINITIONS,
	type SearchFilterName,
	type SearchFilterValue
} from './search-filters';

export interface PreferenceInput {
	job_types: string[];
	experience_levels: string[];
	work_location: string[];
	remote_only: boolean | null;
}

// Aliases the canonical taxonomy doesn't cover. "Freelance" is a separate
// preference option in the match-config UI but collapses to `contract` in
// the canonical taxonomy.
const EXTRA_LABEL_ALIASES: Partial<Record<SearchFilterName, Record<string, string>>> = {
	employment_type: {
		Freelance: 'contract'
	}
};

/**
 * Invert `SEARCH_FILTER_DEFINITIONS[name].values` (value_key → label) into a
 * label → value_key lookup, with extra aliases folded in. Lookup is
 * case-insensitive and tolerates whitespace differences.
 */
function buildLabelIndex(name: SearchFilterName): Map<string, string> {
	const index = new Map<string, string>();
	const def = SEARCH_FILTER_DEFINITIONS[name];
	for (const [valueKey, label] of Object.entries(def.values)) {
		index.set(normalizeLabel(label), valueKey);
	}
	const extras = EXTRA_LABEL_ALIASES[name];
	if (extras) {
		for (const [label, valueKey] of Object.entries(extras)) {
			index.set(normalizeLabel(label), valueKey);
		}
	}
	return index;
}

function normalizeLabel(label: string): string {
	return label.trim().toLowerCase();
}

function mapLabels(name: SearchFilterName, labels: string[]): string[] {
	const index = buildLabelIndex(name);
	const out: string[] = [];
	for (const label of labels) {
		const valueKey = index.get(normalizeLabel(label));
		if (valueKey === undefined) continue;
		if (!out.includes(valueKey)) out.push(valueKey);
	}
	return out;
}

/**
 * Build the user's full canonical filter selection from match_config.
 * Returns a flat map of `canonical filter name → canonical value_keys[]`,
 * omitting filters the user hasn't set.
 *
 * `remote_only: true` is folded into `work_location` as `["remote"]`. The
 * user's free-form `locations` list does NOT map to a canonical filter and
 * is ignored here — callers that want to surface it should fold it into
 * keywords or notes themselves.
 */
export function preferencesToFilters(p: PreferenceInput): Record<string, SearchFilterValue> {
	const out: Record<string, SearchFilterValue> = {};

	// The user's profile-level "job_types" list pre-dates the (hours_commitment,
	// employment_type) split — it mixes hours labels ("Full-time", "Part-time")
	// with employment-relationship labels ("Contract", "Internship",
	// "Freelance"). mapLabels keeps only the values that belong to each axis,
	// so we can just feed the same list through both filters.
	const hoursCommitment = mapLabels('hours_commitment', p.job_types ?? []);
	if (hoursCommitment.length > 0) out.hours_commitment = hoursCommitment;

	const employmentType = mapLabels('employment_type', p.job_types ?? []);
	if (employmentType.length > 0) out.employment_type = employmentType;

	const experience = mapLabels('experience_level', p.experience_levels ?? []);
	if (experience.length > 0) out.experience_level = experience;

	const workLocation = mapLabels('work_location', p.work_location ?? []);
	if (p.remote_only && !workLocation.includes('remote')) {
		workLocation.unshift('remote');
	}
	if (workLocation.length > 0) out.work_location = workLocation;

	return out;
}

/**
 * Drop (filter, value_key) pairs the platform has previously failed to
 * apply. Filters whose remaining values are empty are removed entirely.
 */
export function stripUnsupportedFilters(
	filters: Record<string, SearchFilterValue>,
	unsupported: Record<string, string[]>
): Record<string, SearchFilterValue> {
	const out: Record<string, SearchFilterValue> = {};
	for (const [name, value] of Object.entries(filters)) {
		const blocked = new Set(unsupported[name] ?? []);
		if (blocked.size === 0) {
			out[name] = value;
			continue;
		}
		const values = Array.isArray(value) ? value : [value];
		const kept = values.filter((v) => !blocked.has(v));
		if (kept.length === 0) continue;
		out[name] = kept;
	}
	return out;
}

/**
 * Returns the (filter, value_keys) pairs that WERE in `filters` but got
 * removed by `stripUnsupportedFilters`. Useful for explaining a relevance
 * downgrade in the suggestion note.
 */
export function unsupportedOverlap(
	filters: Record<string, SearchFilterValue>,
	unsupported: Record<string, string[]>
): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	for (const [name, value] of Object.entries(filters)) {
		const blocked = unsupported[name];
		if (!blocked || blocked.length === 0) continue;
		const values = Array.isArray(value) ? value : [value];
		const overlap = values.filter((v) => blocked.includes(v));
		if (overlap.length > 0) out[name] = overlap;
	}
	return out;
}
