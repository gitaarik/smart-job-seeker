<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowDown,
		faArrowUp,
		faEquals,
		faExternalLinkAlt,
		faInfoCircle,
		faMoneyBillWave,
		faPencil
	} from '@fortawesome/free-solid-svg-icons';
	import Card from '../../../components/Card.svelte';
	import {
		formatCurrency,
		formatSalaryPeriod,
		normalizeSalaryPeriod,
		projectToHourly,
		compareSalary,
		type SalaryPeriod
	} from '$lib/salary/conversion';
	import {
		askForJob,
		modesForJobTypes,
		type AppliedAdjustment,
		type EmployedSettings,
		type FreelanceSettings,
		type JobAsk,
		type JobContext,
		type SalaryMode
	} from '$lib/salary/settings';
	import { grossPayPerYear, rateAsSalary, salaryAsRate } from '$lib/salary/take-home';
	import { canonicalJobTypes, jobContextFor, postedPayKind } from '$lib/salary/pay-fit';
	import { isSalarySingleValue } from '$lib/format';
	import { REGIONS, buildDisplayMap } from '$lib/data/job-taxonomy';

	const regionDisplayMap = buildDisplayMap(REGIONS);

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let app = $derived(data.application);
	let job = $derived(app.job);

	let editing = $state(false);
	let editAmount = $state('');
	let editCurrency = $state('EUR');
	let editPeriod = $state('month');

	const currencies = [
		{ value: 'EUR', label: 'EUR', symbol: '\u20AC' },
		{ value: 'USD', label: 'USD', symbol: '$' },
		{ value: 'GBP', label: 'GBP', symbol: '\u00A3' },
		{ value: 'CHF', label: 'CHF', symbol: 'CHF' },
		{ value: 'CAD', label: 'CAD', symbol: 'CA$' }
	];

	const periods = [
		{ value: 'hour', label: 'Hour' },
		{ value: 'day', label: 'Day' },
		{ value: 'week', label: 'Week' },
		{ value: 'month', label: 'Month' },
		{ value: 'year', label: 'Year' }
	];

	const adjustmentLabels: Record<string, string> = {
		part_time: 'Part-time',
		internship: 'Internship',
		remote: 'Remote',
		hybrid: 'Hybrid',
		onsite: 'On-site',
		startup: 'Startup',
		corporate: 'Corporate',
		agency: 'Agency or consultancy',
		consultancy: 'Consultancy'
	};

	const companyTypes = [
		{ value: 'startup', label: 'Startup' },
		{ value: 'corporate', label: 'Corporate' },
		{ value: 'agency', label: 'Agency or consultancy' }
	];

	function getPeriodLabel(period: string | null | undefined): string {
		if (!period) return '';
		const formatted = formatSalaryPeriod(period);
		return formatted || period;
	}

	function startEdit() {
		editAmount = app.salary_expectation ? String(app.salary_expectation) : '';
		editCurrency = app.salary_currency || suggestions[0]?.ask.currency || 'EUR';
		editPeriod = app.salary_period || 'month';
		editing = true;
	}

	function cancelEdit() {
		editing = false;
	}

	function handleSubmit() {
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: () => Promise<void>;
		}) => {
			await update();
			if (result.type === 'success') editing = false;
		};
	}

	/** The job's types as canonical values (`contract`, `full_time`, ...). */
	const jobTypes = $derived(canonicalJobTypes(job?.job_types));
	/** Which asks this job is priced in, most likely first. */
	const modes = $derived(modesForJobTypes(jobTypes));

	/** Postings rarely say what kind of company it is, so they say it here, for this page only. */
	let companyType = $state('');
	const hasCompanyAdjustments = $derived(
		Object.keys(data.adjustments.company_type ?? {}).length > 0
	);

	// Read the way the job list's pay check reads it (lib/salary/pay-fit.ts), so a
	// job this tab prices at your ask is not one the list hides as below it.
	const jobContext = $derived<JobContext>(
		jobContextFor(
			{
				job_types: job?.job_types,
				work_location: job?.work_location,
				region: job?.region
			},
			companyType
		)
	);

	type AskOption = { period: SalaryPeriod; label: string; amount: number };
	type Suggestion = {
		mode: SalaryMode;
		title: string;
		/** What the ask started from: the main one, or the job's region's. */
		base: string;
		ask: JobAsk;
		options: AskOption[];
	};

	function employedOptions(e: EmployedSettings, amount: number): AskOption[] {
		if (e.period === 'year') {
			// The same split Salary Prep makes when the period is switched: a yearly
			// figure includes the holiday pay a monthly one is quoted before.
			return [
				{ period: 'year', label: 'Yearly', amount },
				{
					period: 'month',
					label: e.extraPayPct > 0 ? 'Monthly, before holiday pay' : 'Monthly',
					amount: Math.round(amount / grossPayPerYear(e, 1, 'month'))
				}
			];
		}
		const yearly = Math.round(grossPayPerYear(e, amount, 'month'));
		return [
			{ period: 'month', label: 'Monthly', amount },
			{
				period: 'year',
				label: e.extraPayPct > 0 ? 'Yearly, holiday pay included' : 'Yearly',
				amount: yearly
			}
		];
	}

	function freelanceOptions(f: FreelanceSettings, amount: number): AskOption[] {
		if (f.unit === 'hour') {
			return [
				{ period: 'hour', label: 'Hourly', amount },
				{ period: 'day', label: 'Daily', amount: amount * 8 }
			];
		}
		if (f.unit === 'day') {
			return [
				{ period: 'day', label: 'Daily', amount },
				{ period: 'hour', label: 'Hourly', amount: Math.round(amount / 8) }
			];
		}
		return [{ period: 'month', label: 'Monthly fee', amount }];
	}

	const perLabel: Record<string, string> = {
		hour: 'an hour',
		day: 'a day',
		month: 'a month',
		year: 'a year'
	};

	function baseLabel(settings: EmployedSettings | FreelanceSettings, ask: JobAsk, per: string) {
		if (ask.region) {
			const region = regionDisplayMap.get(ask.region) ?? ask.region;
			const regional = settings.regions[ask.region];
			return `Your ${region} ask, ${formatCurrency(regional.amount, regional.currency)} ${per}`;
		}
		return `Your ask, ${formatCurrency(settings.amount, settings.currency)} ${per}`;
	}

	/** The ask Salary Prep works out for this job, per kind of work the job could be. */
	const suggestions = $derived.by(() => {
		const out: Suggestion[] = [];
		for (const mode of modes) {
			if (mode === 'employed' && data.employed?.amount != null) {
				const ask = askForJob('employed', data.employed, data.adjustments, jobContext);
				if (ask) {
					out.push({
						mode,
						title: 'As a salary',
						base: baseLabel(data.employed, ask, perLabel[data.employed.period]),
						ask,
						options: employedOptions(data.employed, ask.amount)
					});
				}
			}
			if (mode === 'freelance' && data.freelance?.amount != null) {
				const ask = askForJob('freelance', data.freelance, data.adjustments, jobContext);
				if (ask) {
					out.push({
						mode,
						title: 'As a freelance rate',
						base: baseLabel(data.freelance, ask, perLabel[data.freelance.unit]),
						ask,
						options: freelanceOptions(data.freelance, ask.amount)
					});
				}
			}
		}
		return out;
	});

	const describeAdjustments = (applied: AppliedAdjustment[]) =>
		applied
			.map((a) => `${adjustmentLabels[a.option] ?? a.option} ${a.pct > 0 ? '+' : ''}${a.pct}%`)
			.join(', ');

	// Apply suggested rate to the salary form
	function useSuggested(option: AskOption, currency: string) {
		editAmount = String(option.amount);
		editCurrency = currency;
		editPeriod = option.period;
		editing = true;
	}

	/**
	 * The posting's pay as the other kind of work, by their Salary Prep numbers:
	 * a contract's rate as the salary that keeps the same, or a job's salary as
	 * the rate that does. Needs both asks set up, since it uses the assumptions
	 * of each.
	 */
	const postedAsOther = $derived.by(() => {
		if (!job || !data.employed || !data.freelance) return null;
		const period = normalizeSalaryPeriod(job.salary_period);
		const currency = job.salary_currency || 'EUR';
		const values = [job.salary_min, job.salary_max].filter((v): v is number => v != null);
		if (values.length === 0) return null;
		const e = data.employed;
		const f = data.freelance;

		// A rate or a fee, a salary, or neither: see `postedPayKind`.
		const kind = postedPayKind(period, jobTypes);

		let converted: (number | null)[];
		let currencyOut: string;
		let per: string;
		if (kind === 'freelance' && (period === 'hour' || period === 'day' || period === 'month')) {
			converted = values.map((amount) =>
				rateAsSalary(e, f, { amount, unit: period, currency }, data.fxRates)
			);
			currencyOut = e.currency;
			per = `${perLabel[e.period]} as a salary`;
		} else if (kind === 'employed' && (period === 'month' || period === 'year')) {
			converted = values.map((amount) =>
				salaryAsRate(e, f, { amount, period, currency }, data.fxRates)
			);
			currencyOut = f.currency;
			per = `${perLabel[f.unit]} freelance`;
		} else {
			return null;
		}
		if (converted.some((v) => v == null)) return null;
		const amounts = [...new Set(converted.map((v) => Math.round(v as number)))];
		return {
			range: amounts.map((v) => formatCurrency(v, currencyOut)).join(' \u2013 '),
			per
		};
	});

	// Salary comparison
	let jobHasSalary = $derived(job && (job.salary_min != null || job.salary_max != null));

	let salaryComparison = $derived.by(() => {
		if (!app.salary_expectation || !job) return 'unknown' as const;
		if (job.salary_min == null && job.salary_max == null) return 'unknown' as const;
		return compareSalary(
			Number(app.salary_expectation),
			app.salary_currency || 'EUR',
			(app.salary_period || 'month') as SalaryPeriod,
			job.salary_min,
			job.salary_max,
			job.salary_currency,
			job.salary_period,
			data.fxRates,
			job.salary_duration_weeks
		);
	});
</script>

{#snippet companyPicker()}
	{#if hasCompanyAdjustments}
		<label class="flex items-center gap-2 text-xs text-[var(--dash-text-secondary)]">
			Company type
			<select
				bind:value={companyType}
				class="rounded-md border border-[var(--dash-border-input)] bg-[var(--dash-card)] px-2 py-1 text-xs text-[var(--dash-text)] focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
			>
				<option value="">Not set</option>
				{#each companyTypes as type (type.value)}
					<option value={type.value}>{type.label}</option>
				{/each}
			</select>
		</label>
	{/if}
{/snippet}

<div class="space-y-6">
	{#if form?.error}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{form.error}</p>
		</div>
	{/if}

	<!-- Section 1: Job's Salary Info -->
	{#if jobHasSalary}
		<div>
			<div class="mb-3 flex items-center gap-2">
				<FontAwesomeIcon icon={faInfoCircle} class="h-5 w-5 text-[var(--dash-primary)]" />
				<h2 class="text-lg font-semibold text-[var(--dash-text)]">
					{isSalarySingleValue(job?.salary_min ?? null, job?.salary_max ?? null)
						? 'Salary Indication'
						: "Job's Salary Range"}
				</h2>
			</div>

			<Card padding="lg">
				<div class="flex flex-col gap-4 sm:flex-row sm:items-center">
					<div class="flex-1">
						<div class="flex flex-wrap items-baseline gap-2">
							{#if job?.salary_min != null && job?.salary_max != null && job.salary_min === job.salary_max}
								<p class="text-2xl font-bold text-[var(--dash-text)]">
									{formatCurrency(job.salary_min, job.salary_currency || 'EUR')}
								</p>
							{:else if job?.salary_min != null && job?.salary_max != null}
								<p class="text-2xl font-bold text-[var(--dash-text)]">
									{formatCurrency(job.salary_min, job.salary_currency || 'EUR')} &ndash; {formatCurrency(
										job.salary_max,
										job.salary_currency || 'EUR'
									)}
								</p>
							{:else if job?.salary_min != null}
								<p class="text-2xl font-bold text-[var(--dash-text)]">
									From {formatCurrency(job.salary_min, job.salary_currency || 'EUR')}
								</p>
							{:else if job?.salary_max != null}
								<p class="text-2xl font-bold text-[var(--dash-text)]">
									Up to {formatCurrency(job.salary_max, job.salary_currency || 'EUR')}
								</p>
							{/if}
						</div>
						<p class="mt-1 text-sm text-[var(--dash-text-secondary)]">
							{#if job?.salary_period}
								{normalizeSalaryPeriod(job.salary_period) === 'project'
									? 'fixed price'
									: `per ${getPeriodLabel(job.salary_period)?.toLowerCase()}`}
							{/if}
							{#if job?.salary_duration_weeks}
								<span class="mx-1">&middot;</span>
								{job.salary_duration_weeks} week{job.salary_duration_weeks === 1 ? '' : 's'}
							{/if}
							{#if job?.salary_currency}
								<span class="mx-1">&middot;</span>
								{job.salary_currency}
							{/if}
						</p>
						{#if normalizeSalaryPeriod(job?.salary_period) === 'project' && job?.salary_duration_weeks && job?.salary_min}
							{@const equivHourly = projectToHourly(job.salary_min, job.salary_duration_weeks)}
							<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
								≈ {formatCurrency(Math.round(equivHourly), job.salary_currency || 'EUR')}/hr
								equivalent
							</p>
						{/if}
						{#if postedAsOther}
							<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
								By your Salary Prep numbers, about {postedAsOther.range}
								{postedAsOther.per}.
							</p>
						{/if}
					</div>

					{#if app.salary_expectation && salaryComparison !== 'unknown'}
						<div class="flex-shrink-0">
							{#if salaryComparison === 'within'}
								<div
									class="flex items-center gap-2 rounded-lg bg-[var(--dash-success-light)] px-3 py-2 text-[var(--dash-success)]"
								>
									<FontAwesomeIcon icon={faEquals} class="h-4 w-4" />
									<span class="text-sm font-medium">Your ask is within range</span>
								</div>
							{:else if salaryComparison === 'above'}
								<div
									class="flex items-center gap-2 rounded-lg bg-[var(--dash-error-light)] px-3 py-2 text-[var(--dash-error)]"
								>
									<FontAwesomeIcon icon={faArrowUp} class="h-4 w-4" />
									<span class="text-sm font-medium">Your ask is above range</span>
								</div>
							{:else if salaryComparison === 'below'}
								<div
									class="flex items-center gap-2 rounded-lg bg-[var(--dash-warning-light)] px-3 py-2 text-[var(--dash-warning)]"
								>
									<FontAwesomeIcon icon={faArrowDown} class="h-4 w-4" />
									<span class="text-sm font-medium">Your ask is below range</span>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</Card>
		</div>
	{/if}

	<!-- Section 2: Your Ask -->
	<div>
		<div class="mb-3 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<FontAwesomeIcon icon={faMoneyBillWave} class="h-5 w-5 text-[var(--dash-primary)]" />
				<h2 class="text-lg font-semibold text-[var(--dash-text)]">Your Ask</h2>
			</div>
			<a
				href={resolve('/applications/salary')}
				class="flex items-center gap-1 text-xs text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-primary)]"
			>
				Salary Prep
				<FontAwesomeIcon icon={faExternalLinkAlt} class="h-2.5 w-2.5" />
			</a>
		</div>

		<Card padding="lg">
			{#if editing}
				<!-- Edit form -->
				<form method="POST" action="?/updateSalary" use:enhance={handleSubmit}>
					<div class="space-y-4">
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
							<div>
								<label
									for="salary-amount"
									class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
								>
									Amount <span class="text-[var(--dash-error)]">*</span>
								</label>
								<input
									type="number"
									id="salary-amount"
									name="salary_expectation"
									bind:value={editAmount}
									step="0.01"
									min="0"
									required
									placeholder="0.00"
									class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
								/>
							</div>
							<div>
								<label
									for="salary-currency"
									class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
								>
									Currency <span class="text-[var(--dash-error)]">*</span>
								</label>
								<select
									id="salary-currency"
									name="salary_currency"
									bind:value={editCurrency}
									required
									class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
								>
									{#each currencies as curr (curr.value)}
										<option value={curr.value}>{curr.label} ({curr.symbol})</option>
									{/each}
								</select>
							</div>
							<div>
								<label
									for="salary-period"
									class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
								>
									Period <span class="text-[var(--dash-error)]">*</span>
								</label>
								<select
									id="salary-period"
									name="salary_period"
									bind:value={editPeriod}
									required
									class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
								>
									{#each periods as period (period.value)}
										<option value={period.value}>{period.label}</option>
									{/each}
								</select>
							</div>
						</div>

						{#if suggestions.length > 0}
							<div class="space-y-2 border-t border-[var(--dash-border)] pt-3">
								<p class="text-xs text-[var(--dash-text-muted)]">Use what Salary Prep works out:</p>
								{@render companyPicker()}
								{#each suggestions as suggestion (suggestion.mode)}
									<div class="flex flex-wrap items-center gap-2">
										<span class="w-36 text-xs text-[var(--dash-text-secondary)]"
											>{suggestion.title}</span
										>
										{#each suggestion.options as option (option.period)}
											<button
												type="button"
												onclick={() => useSuggested(option, suggestion.ask.currency)}
												class="rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-xs transition-colors hover:border-[var(--dash-primary)] hover:text-[var(--dash-primary)] {editPeriod ===
													option.period && editAmount === String(option.amount)
													? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/5 text-[var(--dash-primary)]'
													: 'text-[var(--dash-text-secondary)]'}"
											>
												{option.label}: {formatCurrency(option.amount, suggestion.ask.currency)}
											</button>
										{/each}
									</div>
								{/each}
							</div>
						{/if}

						<div class="flex justify-end gap-2">
							<button
								type="button"
								onclick={cancelEdit}
								class="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
							>
								Cancel
							</button>
							<button
								type="submit"
								class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
							>
								Save
							</button>
						</div>
					</div>
				</form>
			{:else if app.salary_expectation}
				<!-- Display current ask -->
				<div class="flex items-center justify-between">
					<div>
						<p class="text-3xl font-bold text-[var(--dash-text)]">
							{formatCurrency(Number(app.salary_expectation), app.salary_currency || 'EUR')}
						</p>
						<p class="mt-1 text-sm text-[var(--dash-text-secondary)]">
							per {getPeriodLabel(app.salary_period)?.toLowerCase() || 'month'}
							<span class="mx-1">&middot;</span>
							{app.salary_currency || 'EUR'}
						</p>
					</div>
					<button
						type="button"
						onclick={startEdit}
						class="p-2 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
						aria-label="Edit salary"
					>
						<FontAwesomeIcon icon={faPencil} class="h-4 w-4" />
					</button>
				</div>
			{:else}
				<!-- Empty state: show calculated rates to pick from, or prompt to set manually -->
				{#if suggestions.length > 0}
					<div class="space-y-4">
						<p class="text-sm text-[var(--dash-text-secondary)]">
							Choose what Salary Prep works out for this job, or <button
								type="button"
								onclick={startEdit}
								class="text-[var(--dash-primary)] hover:underline">enter your own</button
							>.
						</p>
						{@render companyPicker()}
						{#each suggestions as suggestion (suggestion.mode)}
							<div>
								<p
									class="text-xs font-medium tracking-wide text-[var(--dash-text-muted)] uppercase"
								>
									{suggestion.title}
								</p>
								<p class="mt-0.5 mb-2 text-xs text-[var(--dash-text-muted)]">
									{suggestion.base}{#if suggestion.ask.applied.length > 0}, adjusted: {describeAdjustments(
											suggestion.ask.applied
										)}{/if}.
								</p>
								<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
									{#each suggestion.options as option (option.period)}
										<button
											type="button"
											onclick={() => useSuggested(option, suggestion.ask.currency)}
											class="group rounded-lg border border-[var(--dash-border)] p-3 text-left transition-colors hover:border-[var(--dash-primary)] hover:bg-[var(--dash-primary)]/5"
										>
											<p class="mb-1 text-xs text-[var(--dash-text-muted)]">{option.label}</p>
											<p
												class="text-lg font-semibold text-[var(--dash-text)] group-hover:text-[var(--dash-primary)]"
											>
												{formatCurrency(option.amount, suggestion.ask.currency)}
											</p>
										</button>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="py-4 text-center">
						<div
							class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--dash-bg)]"
						>
							<FontAwesomeIcon
								icon={faMoneyBillWave}
								class="h-6 w-6 text-[var(--dash-text-muted)]"
							/>
						</div>
						<p class="mb-3 text-[var(--dash-text-secondary)]">
							No ask recorded yet.
							<a
								href={resolve('/applications/salary')}
								class="text-[var(--dash-primary)] hover:underline">Set up Salary Prep</a
							> to get one worked out for each job, or enter it yourself.
						</p>
						<button
							type="button"
							onclick={startEdit}
							class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
						>
							Set
						</button>
					</div>
				{/if}
			{/if}
		</Card>
	</div>
</div>
