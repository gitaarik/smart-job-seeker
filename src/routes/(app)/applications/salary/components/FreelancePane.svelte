<script lang="ts">
	/** The freelance ask: the rate, what freelancing costs, and what it leaves. */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faLaptop } from '@fortawesome/free-solid-svg-icons';
	import Card from '../../../components/Card.svelte';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import type { SaveStatus } from '$lib/components/auto-save.svelte';
	import { formatCurrency, type FxRates } from '$lib/salary/conversion';
	import type { FreelanceSettings, FreelanceUnit } from '$lib/salary/settings';
	import { freelanceYear, unitsPerYear } from '$lib/salary/take-home';
	import AskInput from './AskInput.svelte';
	import NumberField from './NumberField.svelte';
	import RegionAsks from './RegionAsks.svelte';
	import { unitLabel, UNITS } from './salary-ui';

	interface Props {
		settings: FreelanceSettings;
		fxRates: FxRates;
		save: SaveStatus;
		/** Offered when they set this up without matching on contract work. */
		onremove?: () => void;
	}

	let { settings = $bindable(), fxRates, save, onremove }: Props = $props();

	const year = $derived(freelanceYear(settings));
	const money = (n: number) => formatCurrency(Math.round(n), settings.currency);
	const fee = $derived(settings.unit === 'month');
	const billedDays = $derived(Math.round(settings.billableHours / 8));

	/** Same yearly revenue in the new unit, so switching never changes what they ask. */
	function setUnit(unit: FreelanceUnit) {
		if (unit === settings.unit) return;
		const from = unitsPerYear(settings, settings.unit);
		const to = unitsPerYear(settings, unit);
		if (from > 0 && to > 0) {
			const factor = from / to;
			if (settings.amount != null) settings.amount = Math.round(settings.amount * factor);
			for (const ask of Object.values(settings.regions)) {
				if (ask.amount > 0) ask.amount = Math.round(ask.amount * factor);
			}
		}
		settings.unit = unit;
	}

	/** The same rate in the neighbouring unit, for a feel of it. */
	const alsoAs = $derived.by(() => {
		if (settings.amount == null) return null;
		if (settings.unit === 'hour') return `${money(settings.amount * 8)} a day`;
		if (settings.unit === 'day') return `${money(settings.amount / 8)} an hour`;
		return null;
	});

	const summary = $derived(
		[
			fee
				? `${settings.unpaidDays} unpaid days`
				: `${settings.billableHours.toLocaleString('en-US')} billed hours`,
			`${money(settings.costsPerYear)} costs`,
			`${settings.pensionPct}% pension`,
			`${settings.taxPct}% tax`
		].join(' · ')
	);
	const regionCount = $derived(Object.keys(settings.regions).length);
</script>

<Card padding="lg" class="flex flex-col">
	<div class="flex items-start justify-between gap-3">
		<div class="flex items-center gap-2">
			<FontAwesomeIcon icon={faLaptop} class="h-4 w-4 text-[var(--dash-primary)]" />
			<h3 class="text-base font-semibold text-[var(--dash-text)]">Freelance</h3>
		</div>
		{#if onremove}
			<button
				type="button"
				onclick={onremove}
				class="text-xs text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-error)]"
				>Remove</button
			>
		{/if}
	</div>
	<p class="mt-1 mb-4 text-sm text-[var(--dash-text-secondary)]">
		A rate you invoice. Leave, pension and costs are your own.
	</p>

	<AskInput
		label="Rate you ask"
		amount={settings.amount}
		currency={settings.currency}
		per={settings.unit}
		perOptions={UNITS}
		placeholder={fee ? 'e.g. 11000' : settings.unit === 'day' ? 'e.g. 650' : 'e.g. 85'}
		onamount={(amount) => (settings.amount = amount)}
		oncurrency={(currency) => (settings.currency = currency)}
		onper={setUnit}
	/>
	{#if fee}
		<p class="mt-1.5 text-xs text-[var(--dash-text-muted)]">
			A fixed monthly fee, as on a B2B contract.
		</p>
	{:else if alsoAs}
		<p class="mt-1.5 text-xs text-[var(--dash-text-muted)]">That is {alsoAs}.</p>
	{/if}

	{#if year}
		<div class="mt-4 rounded-lg bg-[var(--dash-bg-inset)] px-4 py-3">
			<div class="flex items-baseline justify-between gap-2">
				<span class="text-sm text-[var(--dash-text-secondary)]">Take-home</span>
				<span>
					<span class="text-xl font-semibold text-[var(--dash-text)]"
						>{money(year.takeHome / 12)}</span
					>
					<span class="text-xs text-[var(--dash-text-muted)]">a month</span>
				</span>
			</div>
			<dl class="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
				<dt class="text-[var(--dash-text-muted)]">
					Invoiced{fee
						? `, ${settings.unpaidDays} unpaid days off`
						: settings.unit === 'day'
							? ` over ${billedDays} billed days`
							: ` over ${settings.billableHours.toLocaleString('en-US')} billed hours`}
				</dt>
				<dd class="text-right text-[var(--dash-text-secondary)]">{money(year.revenue)} a year</dd>
				<dt class="text-[var(--dash-text-muted)]">Costs and insurance</dt>
				<dd class="text-right text-[var(--dash-text-secondary)]">{money(year.costs)} a year</dd>
				<dt class="text-[var(--dash-text-muted)]">Pension you put aside</dt>
				<dd class="text-right text-[var(--dash-text-secondary)]">{money(year.pension)} a year</dd>
				<dt class="text-[var(--dash-text-muted)]">Tax</dt>
				<dd class="text-right text-[var(--dash-text-secondary)]">{money(year.tax)} a year</dd>
			</dl>
		</div>
	{:else}
		<p class="mt-4 text-sm text-[var(--dash-text-muted)]">
			Enter a rate to see what it leaves you.
		</p>
	{/if}

	<details class="mt-4">
		<summary
			class="cursor-pointer text-sm text-[var(--dash-text-secondary)] select-none hover:text-[var(--dash-text)]"
		>
			What it costs you
			<span class="ml-1 text-xs text-[var(--dash-text-muted)]">{summary}</span>
		</summary>
		<div class="mt-3 space-y-3">
			{#if fee}
				<NumberField
					label="Unpaid days off"
					hint="Working days a year the fee does not pay for: leave beyond what the contract pays"
					value={settings.unpaidDays}
					suffix="days"
					max={261}
					onchange={(v) => (settings.unpaidDays = v)}
				/>
			{:else}
				<NumberField
					label="Billable hours"
					hint="Hours you invoice in a year. Leave, holidays, sick days and finding work come off; 1,680 is 210 days."
					value={settings.billableHours}
					suffix="a year"
					max={8760}
					step={10}
					onchange={(v) => (settings.billableHours = v)}
				/>
			{/if}
			<NumberField
				label="Costs and insurance"
				hint="Disability cover, an accountant, equipment"
				value={settings.costsPerYear}
				suffix="a year"
				step={100}
				onchange={(v) => (settings.costsPerYear = v)}
			/>
			<NumberField
				label="Pension you put aside"
				hint="Share of profit, before tax"
				value={settings.pensionPct}
				suffix="%"
				max={100}
				step={0.5}
				onchange={(v) => (settings.pensionPct = v)}
			/>
			<NumberField
				label="Tax"
				hint="Income tax and contributions, share of profit"
				value={settings.taxPct}
				suffix="%"
				max={100}
				step={0.5}
				onchange={(v) => (settings.taxPct = v)}
			/>
		</div>
	</details>

	<details class="mt-3" open={regionCount > 0}>
		<summary
			class="cursor-pointer text-sm text-[var(--dash-text-secondary)] select-none hover:text-[var(--dash-text)]"
		>
			A different rate by region{#if regionCount > 0}<span
					class="ml-1 text-xs text-[var(--dash-text-muted)]">{regionCount}</span
				>{/if}
		</summary>
		<div class="mt-3">
			<RegionAsks
				regions={settings.regions}
				per={unitLabel(settings.unit)}
				currency={settings.currency}
				{fxRates}
				onchange={(regions) => (settings.regions = regions)}
			/>
		</div>
	</details>

	<div class="mt-auto flex justify-end pt-4">
		<AutoSaveIndicator field={save} />
	</div>
</Card>
