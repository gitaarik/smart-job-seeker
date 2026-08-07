<script lang="ts">
	/**
	 * Generic picker for the canonical search-filter taxonomy
	 * (sort_by, time_posted, work_location, job_type).
	 *
	 * Treats `sort_by` and `time_posted` as single-select (dropdown — at most
	 * one value can apply), and `work_location` and `job_type` as multi-select
	 * (checkbox group — the user can want "remote OR hybrid", or
	 * "fulltime OR contract"). The "any" / "relevance" default values are
	 * elided from multi-select groups (unchecked already means "any").
	 *
	 * Bidirectional: the caller passes a `filters` object and we mutate it in
	 * place. Values stored as the canonical option keys per
	 * SEARCH_FILTER_DEFINITIONS.
	 */
	import {
		SEARCH_FILTER_DEFINITIONS,
		SEARCH_FILTER_NAMES,
		defaultValueKey,
		type SearchFilterName,
		type SearchFilterValue
	} from '$lib/job-platforms/search-filters';

	interface Props {
		filters: Record<string, SearchFilterValue>;
		/** Compact layout for inline use in the add form vs roomier layout for
		 *  the dedicated edit-page section. */
		compact?: boolean;
	}

	let { filters = $bindable({}), compact = false }: Props = $props();

	/** Multi-select intent — checkbox group instead of single dropdown. */
	const MULTI_SELECT = new Set<SearchFilterName>(['work_location', 'job_type', 'experience_level']);

	function getSingle(name: SearchFilterName): string {
		const v = filters[name];
		if (typeof v === 'string') return v;
		if (Array.isArray(v) && v.length > 0) return v[0];
		return defaultValueKey(name);
	}

	function setSingle(name: SearchFilterName, value: string) {
		// Store nothing when the value is the canonical default — keeps the
		// persisted filters object minimal.
		if (value === defaultValueKey(name)) {
			delete filters[name];
		} else {
			filters[name] = value;
		}
	}

	function isChecked(name: SearchFilterName, valueKey: string): boolean {
		const v = filters[name];
		if (typeof v === 'string') return v === valueKey;
		if (Array.isArray(v)) return v.includes(valueKey);
		return false;
	}

	function toggleChecked(name: SearchFilterName, valueKey: string, checked: boolean) {
		const existing = filters[name];
		let current: string[] = Array.isArray(existing)
			? [...existing]
			: typeof existing === 'string'
				? [existing]
				: [];
		if (checked) {
			if (!current.includes(valueKey)) current.push(valueKey);
		} else {
			current = current.filter((v) => v !== valueKey);
		}
		if (current.length === 0) {
			delete filters[name];
		} else {
			filters[name] = current;
		}
	}
</script>

<!-- Non-compact: 2-column grid on wide screens so the short single-select
     dropdowns pair up; multi-select checkbox rows span both columns since
     they can have many chips. Compact mode (inline use in the add form's
     suggestion cards) stays single-column. -->
<div class={compact ? 'space-y-3' : 'grid grid-cols-1 gap-x-6 gap-y-3 lg:grid-cols-2'}>
	{#each SEARCH_FILTER_NAMES as name (name)}
		{@const def = SEARCH_FILTER_DEFINITIONS[name]}
		{#if MULTI_SELECT.has(name)}
			<div class={compact ? '' : 'lg:col-span-2'}>
				<p class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]">
					{def.label} <span class="font-normal text-[var(--dash-text-muted)]">(any of)</span>
				</p>
				<div class="flex flex-wrap gap-{compact ? '2' : '3'}">
					{#each Object.entries(def.values) as [valueKey, label] (valueKey)}
						{#if valueKey !== 'any'}
							<label
								class="inline-flex cursor-pointer items-center gap-1.5 text-sm text-[var(--dash-text)]"
							>
								<input
									type="checkbox"
									checked={isChecked(name, valueKey)}
									onchange={(e) => toggleChecked(name, valueKey, e.currentTarget.checked)}
									class="rounded border-[var(--dash-border)]"
								/>
								{label}
							</label>
						{/if}
					{/each}
				</div>
			</div>
		{:else}
			<div>
				<label
					class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
					for="filter-{name}">{def.label}</label
				>
				<select
					id="filter-{name}"
					value={getSingle(name)}
					onchange={(e) => setSingle(name, e.currentTarget.value)}
					class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1.5 text-sm text-[var(--dash-text)]"
				>
					{#each Object.entries(def.values) as [valueKey, label] (valueKey)}
						<option value={valueKey}>{label}</option>
					{/each}
				</select>
			</div>
		{/if}
	{/each}
</div>
