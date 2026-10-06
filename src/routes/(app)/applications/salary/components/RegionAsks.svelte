<script lang="ts">
	/**
	 * Asks for jobs in one region, in that region's currency. Each replaces the
	 * main ask for a job there, before the adjustments; a row left blank does not
	 * price anything.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
	import { REGIONS } from '$lib/data/job-taxonomy';
	import {
		convertCurrency,
		formatCurrency,
		REGION_CURRENCIES,
		type FxRates
	} from '$lib/salary/conversion';
	import type { RegionAsks } from '$lib/salary/settings';
	import { currencyOptions, INPUT_CLASS, numberOrNull } from './salary-ui';

	interface Props {
		regions: RegionAsks;
		/** What the amounts are per, as the main ask says it: "a month", "an hour". */
		per: string;
		/** The main ask's currency, for the converted figure beside a foreign one. */
		currency: string;
		fxRates: FxRates;
		onchange: (regions: RegionAsks) => void;
	}

	let { regions, per, currency, fxRates, onchange }: Props = $props();

	const regionLabels = new Map(REGIONS.values.map((r) => [r.canonical, r.label]));
	let adding = $state('');

	const available = $derived(REGIONS.values.filter((r) => !(r.canonical in regions)));

	function update(region: string, change: Partial<RegionAsks[string]>) {
		onchange({ ...regions, [region]: { ...regions[region], ...change } });
	}

	function remove(region: string) {
		const { [region]: _removed, ...rest } = regions;
		onchange(rest);
	}

	function add() {
		if (!adding) return;
		onchange({
			...regions,
			[adding]: { amount: 0, currency: REGION_CURRENCIES[adding] ?? currency }
		});
		adding = '';
	}
</script>

<div class="space-y-2">
	{#each Object.entries(regions) as [region, ask] (region)}
		{@const converted =
			ask.amount > 0 && ask.currency !== currency
				? convertCurrency(ask.amount, ask.currency, currency, fxRates)
				: null}
		<div class="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--dash-bg-inset)] px-3 py-2">
			<span class="w-36 text-sm text-[var(--dash-text)]">{regionLabels.get(region) ?? region}</span>
			<input
				type="number"
				min="0"
				step="1"
				value={ask.amount || ''}
				placeholder="0"
				aria-label="Ask in {regionLabels.get(region) ?? region}"
				oninput={(e) => update(region, { amount: numberOrNull(e.currentTarget.value) ?? 0 })}
				class="{INPUT_CLASS} w-28"
			/>
			<select
				value={ask.currency}
				onchange={(e) => update(region, { currency: e.currentTarget.value })}
				aria-label="Currency in {regionLabels.get(region) ?? region}"
				class={INPUT_CLASS}
			>
				{#each currencyOptions(ask.currency) as code (code)}
					<option value={code}>{code}</option>
				{/each}
			</select>
			<span class="text-xs text-[var(--dash-text-muted)]">
				{per}{#if converted != null}&nbsp;· about {formatCurrency(converted, currency)}{/if}
			</span>
			<button
				type="button"
				onclick={() => remove(region)}
				class="ml-auto p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-error)]"
				aria-label="Remove {regionLabels.get(region) ?? region}"
			>
				<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
			</button>
		</div>
	{/each}

	{#if available.length > 0}
		<div class="flex items-center gap-2">
			<select
				bind:value={adding}
				aria-label="Region to add"
				class="{INPUT_CLASS} max-w-[220px] flex-1 text-[var(--dash-text-secondary)]"
			>
				<option value="">Add a region…</option>
				{#each available as region (region.canonical)}
					<option value={region.canonical}>{region.label}</option>
				{/each}
			</select>
			<button
				type="button"
				onclick={add}
				disabled={!adding}
				class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-primary)]/5 disabled:cursor-not-allowed disabled:opacity-50"
			>
				<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
				Add
			</button>
		</div>
	{/if}
</div>
