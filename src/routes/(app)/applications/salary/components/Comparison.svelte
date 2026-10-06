<script lang="ts">
	/**
	 * The salary against the rate, on what each keeps you a year. This is what
	 * the old "Contract / Freelance +65%" adjustment stood in for: the premium is
	 * worked out here from both sides' assumptions instead of typed in, so it can
	 * no longer disagree with them.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faScaleBalanced, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
	import Card from '../../../components/Card.svelte';
	import { formatCurrency, type FxRates } from '$lib/salary/conversion';
	import type { EmployedSettings, FreelanceSettings } from '$lib/salary/settings';
	import { compareAsks } from '$lib/salary/take-home';
	import BreakdownBar, { type BarSegment } from './BreakdownBar.svelte';
	import { periodLabel, unitLabel } from './salary-ui';

	interface Props {
		employed: EmployedSettings;
		freelance: FreelanceSettings;
		fxRates: FxRates;
	}

	let { employed, freelance, fxRates }: Props = $props();

	const c = $derived(compareAsks(employed, freelance, fxRates));
	const salaryMoney = (n: number) => formatCurrency(Math.round(n), employed.currency);
	const rateMoney = (n: number) => formatCurrency(Math.round(n), freelance.currency);

	/** Freelance money in the salary's currency, so both bars share one scale. Null without a rate. */
	const toSalaryCurrency = $derived.by(() => {
		if (freelance.currency === employed.currency) return 1;
		const from = fxRates[freelance.currency];
		const to = fxRates[employed.currency];
		return from && to ? to / from : null;
	});

	const bars = $derived.by(() => {
		if (!c || toSalaryCurrency == null) return null;
		const e = c.employed;
		const f = c.freelance;
		const k = toSalaryCurrency;
		const employedSegments: BarSegment[] = [
			{ kind: 'takeHome', label: 'Take-home', value: e.takeHome },
			{ kind: 'pension', label: 'Pension and benefits', value: e.pension + e.benefits },
			{ kind: 'tax', label: 'Tax', value: e.tax }
		];
		const freelanceSegments: BarSegment[] = [
			{ kind: 'takeHome', label: 'Take-home', value: f.takeHome * k },
			{ kind: 'pension', label: 'Pension', value: f.pension * k },
			{ kind: 'tax', label: 'Tax', value: f.tax * k },
			{ kind: 'costs', label: 'Costs', value: f.costs * k }
		];
		const employedTotal = e.grossPay + e.pension + e.benefits;
		const freelanceTotal = f.revenue * k;
		return {
			employedSegments,
			freelanceSegments,
			employedTotal,
			freelanceTotal,
			scale: Math.max(employedTotal, freelanceTotal),
			hasCosts: f.costs > 0
		};
	});

	/** Per month, in the salary's currency: positive when freelancing keeps more. */
	const difference = $derived(
		c?.freelanceKept == null ? null : (c.freelanceKept - c.employed.kept) / 12
	);
	/** How much more the side that keeps more keeps, relative to the other side. */
	const differencePct = $derived.by(() => {
		if (c?.freelanceKept == null || c.freelanceKept <= 0 || c.employed.kept <= 0) return null;
		const ratio =
			c.freelanceKept >= c.employed.kept
				? c.freelanceKept / c.employed.kept
				: c.employed.kept / c.freelanceKept;
		return Math.round((ratio - 1) * 100);
	});
	const ratePct = $derived(c?.rateVsBreakEven == null ? null : Math.round(c.rateVsBreakEven * 100));
</script>

<Card padding="lg">
	<div class="flex items-center gap-2">
		<FontAwesomeIcon icon={faScaleBalanced} class="h-4 w-4 text-[var(--dash-primary)]" />
		<h3 class="text-base font-semibold text-[var(--dash-text)]">Side by side</h3>
	</div>
	<p class="mt-1 mb-4 text-sm text-[var(--dash-text-secondary)]">
		Compared on what each keeps you in a year: take-home pay plus pension, and whatever else a job
		pays for.
	</p>

	{#if !c || employed.amount == null || freelance.amount == null}
		<p class="text-sm text-[var(--dash-text-muted)]">Enter a salary and a rate to compare them.</p>
	{:else if toSalaryCurrency == null}
		<p class="text-sm text-[var(--dash-text-muted)]">
			There is no exchange rate between {employed.currency} and {freelance.currency} yet, so the two can't
			be compared.
		</p>
	{:else}
		{#if difference != null && differencePct != null}
			<p class="mb-4 text-base text-[var(--dash-text)]">
				{#if differencePct < 1}
					They come out about the same.
				{:else if difference > 0}
					Freelancing keeps you <strong>{salaryMoney(difference)}</strong> a month more (+{differencePct}%).
				{:else}
					Employment keeps you <strong>{salaryMoney(-difference)}</strong> a month more (+{differencePct}%).
				{/if}
			</p>
		{/if}

		{#if bars}
			<div class="space-y-3">
				<BreakdownBar
					label="Employed"
					segments={bars.employedSegments}
					scale={bars.scale}
					currency={employed.currency}
					caption="Keeps {salaryMoney(c.employed.kept)} of {salaryMoney(bars.employedTotal)} a year"
				/>
				<BreakdownBar
					label="Freelance"
					segments={bars.freelanceSegments}
					scale={bars.scale}
					currency={employed.currency}
					caption="Keeps {salaryMoney(c.freelanceKept ?? 0)} of {salaryMoney(
						bars.freelanceTotal
					)} a year"
				/>
			</div>
			<ul
				class="salary-breakdown mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--dash-text-secondary)]"
			>
				<li class="flex items-center gap-1.5">
					<span class="salary-seg-takeHome inline-block h-2.5 w-2.5 rounded-sm"></span>Take-home
				</li>
				<li class="flex items-center gap-1.5">
					<span class="salary-seg-pension inline-block h-2.5 w-2.5 rounded-sm"></span>Pension and
					benefits
				</li>
				<li class="flex items-center gap-1.5">
					<span class="salary-seg-tax inline-block h-2.5 w-2.5 rounded-sm"></span>Tax
				</li>
				{#if bars.hasCosts}
					<li class="flex items-center gap-1.5">
						<span class="salary-seg-costs inline-block h-2.5 w-2.5 rounded-sm"></span>Costs
					</li>
				{/if}
			</ul>
		{/if}

		<ul class="mt-5 space-y-2 text-sm text-[var(--dash-text)]">
			{#if c.breakEvenRate != null}
				<li>
					{salaryMoney(employed.amount)}
					{periodLabel(employed.period)} employed is worth
					<strong>{rateMoney(c.breakEvenRate)} {unitLabel(freelance.unit)}</strong> freelance.
				</li>
			{/if}
			{#if c.equivalentSalary != null}
				<li>
					{rateMoney(freelance.amount)}
					{unitLabel(freelance.unit)} freelance is worth
					<strong>{salaryMoney(c.equivalentSalary)} {periodLabel(employed.period)}</strong> employed.
				</li>
			{/if}
		</ul>

		{#if ratePct != null && c.breakEvenRate != null}
			{#if ratePct < 0}
				<p
					class="mt-4 flex items-start gap-2 rounded-lg bg-[var(--dash-warning-light)] px-3 py-2 text-sm text-[var(--dash-warning)]"
				>
					<FontAwesomeIcon icon={faTriangleExclamation} class="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
					<span>
						Your rate is {-ratePct}% below the {rateMoney(c.breakEvenRate)} that matches your salary,
						so freelancing at it would leave you with less.
					</span>
				</p>
			{:else}
				<p class="mt-4 text-sm text-[var(--dash-text-secondary)]">
					Your rate is {ratePct}% above the {rateMoney(c.breakEvenRate)} that matches your salary.
				</p>
			{/if}
		{/if}
	{/if}

	<p class="mt-4 text-xs text-[var(--dash-text-muted)]">
		Flat estimates from the numbers above, not tax advice.
	</p>
</Card>
