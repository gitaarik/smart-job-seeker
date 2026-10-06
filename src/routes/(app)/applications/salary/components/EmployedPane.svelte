<script lang="ts">
	/** The salary ask: what it is, what comes with it, and what it leaves. */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faBuilding } from '@fortawesome/free-solid-svg-icons';
	import Card from '../../../components/Card.svelte';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import type { SaveStatus } from '$lib/components/auto-save.svelte';
	import { formatCurrency, type FxRates } from '$lib/salary/conversion';
	import type { EmployedPeriod, EmployedSettings } from '$lib/salary/settings';
	import { employedYear, grossPayPerYear } from '$lib/salary/take-home';
	import AskInput from './AskInput.svelte';
	import NumberField from './NumberField.svelte';
	import RegionAsks from './RegionAsks.svelte';
	import { periodLabel, PERIODS } from './salary-ui';

	interface Props {
		settings: EmployedSettings;
		fxRates: FxRates;
		save: SaveStatus;
		/** Offered when they set this up without matching on permanent jobs. */
		onremove?: () => void;
	}

	let { settings = $bindable(), fxRates, save, onremove }: Props = $props();

	const year = $derived(employedYear(settings));
	const money = (n: number) => formatCurrency(Math.round(n), settings.currency);
	const monthly = $derived(settings.period === 'month');

	/** Same gross pay in the new period, so switching never changes what they ask. */
	function setPeriod(period: EmployedPeriod) {
		if (period === settings.period) return;
		const factor =
			grossPayPerYear(settings, 1, settings.period) / grossPayPerYear(settings, 1, period);
		if (settings.amount != null) settings.amount = Math.round(settings.amount * factor);
		for (const ask of Object.values(settings.regions)) {
			if (ask.amount > 0) ask.amount = Math.round(ask.amount * factor);
		}
		settings.period = period;
	}

	const summary = $derived(
		[
			monthly ? `${settings.extraPayPct}% holiday pay` : null,
			`${settings.pensionPct}% pension`,
			settings.benefitsPerYear > 0 ? `${money(settings.benefitsPerYear)} benefits` : null,
			`${settings.taxPct}% tax`
		]
			.filter(Boolean)
			.join(' · ')
	);
	const regionCount = $derived(Object.keys(settings.regions).length);
</script>

<Card padding="lg" class="flex flex-col">
	<div class="flex items-start justify-between gap-3">
		<div class="flex items-center gap-2">
			<FontAwesomeIcon icon={faBuilding} class="h-4 w-4 text-[var(--dash-primary)]" />
			<h3 class="text-base font-semibold text-[var(--dash-text)]">Employed</h3>
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
		A salary. Paid leave, holiday pay and a pension come with it.
	</p>

	<AskInput
		label="Salary you ask, before tax"
		amount={settings.amount}
		currency={settings.currency}
		per={settings.period}
		perOptions={PERIODS}
		placeholder={monthly ? 'e.g. 6000' : 'e.g. 80000'}
		onamount={(amount) => (settings.amount = amount)}
		oncurrency={(currency) => (settings.currency = currency)}
		onper={setPeriod}
	/>

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
					Gross pay{monthly && settings.extraPayPct > 0 ? ', holiday pay included' : ''}
				</dt>
				<dd class="text-right text-[var(--dash-text-secondary)]">{money(year.grossPay)} a year</dd>
				<dt class="text-[var(--dash-text-muted)]">Pension, paid by the employer</dt>
				<dd class="text-right text-[var(--dash-text-secondary)]">{money(year.pension)} a year</dd>
				{#if year.benefits > 0}
					<dt class="text-[var(--dash-text-muted)]">Other benefits</dt>
					<dd class="text-right text-[var(--dash-text-secondary)]">
						{money(year.benefits)} a year
					</dd>
				{/if}
				<dt class="text-[var(--dash-text-muted)]">Tax</dt>
				<dd class="text-right text-[var(--dash-text-secondary)]">{money(year.tax)} a year</dd>
			</dl>
		</div>
	{:else}
		<p class="mt-4 text-sm text-[var(--dash-text-muted)]">
			Enter a salary to see what it leaves you.
		</p>
	{/if}

	<details class="group mt-4">
		<summary
			class="cursor-pointer text-sm text-[var(--dash-text-secondary)] select-none hover:text-[var(--dash-text)]"
		>
			What comes with it
			<span class="ml-1 text-xs text-[var(--dash-text-muted)]">{summary}</span>
		</summary>
		<div class="mt-3 space-y-3">
			{#if monthly}
				<NumberField
					label="Holiday pay and extra months"
					hint="On top of 12 salaries. 8 is Dutch holiday pay; a 13th month adds 8.3."
					value={settings.extraPayPct}
					suffix="%"
					max={100}
					step={0.1}
					onchange={(v) => (settings.extraPayPct = v)}
				/>
			{/if}
			<NumberField
				label="Pension the employer pays"
				hint="Share of gross pay"
				value={settings.pensionPct}
				suffix="%"
				max={100}
				step={0.5}
				onchange={(v) => (settings.pensionPct = v)}
			/>
			<NumberField
				label="Other benefits"
				hint="Lease car, allowances, bonus"
				value={settings.benefitsPerYear}
				suffix="a year"
				step={100}
				onchange={(v) => (settings.benefitsPerYear = v)}
			/>
			<NumberField
				label="Tax"
				hint="Income tax and employee contributions, share of gross pay"
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
			A different salary by region{#if regionCount > 0}<span
					class="ml-1 text-xs text-[var(--dash-text-muted)]">{regionCount}</span
				>{/if}
		</summary>
		<div class="mt-3">
			<RegionAsks
				regions={settings.regions}
				per={periodLabel(settings.period)}
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
