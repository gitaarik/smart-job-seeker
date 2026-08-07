<script lang="ts">
	import type { PageData } from './$types';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faChevronDown,
		faChevronUp,
		faGlobe,
		faMoneyBillWave,
		faPlus,
		faTrash
	} from '@fortawesome/free-solid-svg-icons';
	import Card from '../../components/Card.svelte';
	import SectionHeader from '../../profile/components/SectionHeader.svelte';
	import { autoSaveField, diffPayload, recordsEqual } from '$lib/components/auto-save.svelte';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import {
		DEFAULT_INCOME_ASSUMPTIONS,
		estimateIncome,
		formatCurrency,
		getEffectiveRate,
		hourlyToRate,
		type IncomeAssumptions,
		REGION_CURRENCIES,
		type SalaryAdjustments,
		type SalaryRegionOverrides
	} from '$lib/salary/conversion';
	import { REGIONS } from '$lib/data/job-taxonomy';

	let { data }: { data: PageData } = $props();

	let settings = $derived(data.salarySettings);

	// Editable state — initialize from server data
	let baseRate = $state(settings.baseRate?.toString() ?? '');
	let currency = $state(settings.currency ?? 'EUR');
	let adjustments = $state<SalaryAdjustments>(
		settings.adjustments && Object.keys(settings.adjustments).length > 0
			? (settings.adjustments as SalaryAdjustments)
			: { employment_type: {}, work_arrangement: {}, company_type: {} }
	);
	let regionOverrides = $state<SalaryRegionOverrides>(
		settings.regionOverrides && Object.keys(settings.regionOverrides).length > 0
			? (settings.regionOverrides as SalaryRegionOverrides)
			: {}
	);

	let incomeAssumptions = $state<IncomeAssumptions>({
		...DEFAULT_INCOME_ASSUMPTIONS,
		...(settings.incomeAssumptions ?? {})
	});

	let showAssumptions = $state(false);

	async function postAction(action: string, fields: Record<string, string>) {
		const formData = new FormData();
		for (const [k, v] of Object.entries(fields)) formData.set(k, v);
		const response = await fetch(`?/${action}`, {
			method: 'POST',
			body: formData
		});
		if (!response.ok) throw new Error(`Save failed (${response.status})`);
	}

	// These sections persist nested objects. Carrying the serialized JSON as the
	// field value does double duty: stringifying inside the $effect deep-tracks
	// every nested property (so in-place mutations still trigger a save), and it
	// reduces "did this change?" to a string compare.
	const regionRatesField = autoSaveField<Record<string, string>>({
		initial: {
			baseRate,
			currency,
			regionOverrides: JSON.stringify(regionOverrides)
		},
		save: (v, prev) => {
			const changed = diffPayload(
				{
					base_rate: v.baseRate,
					currency: v.currency,
					region_overrides: v.regionOverrides
				},
				{
					base_rate: prev.baseRate,
					currency: prev.currency,
					region_overrides: prev.regionOverrides
				}
			);
			if (Object.keys(changed).length === 0) return Promise.resolve();
			return postAction('saveRegionRates', changed);
		},
		onSaved: (v) => {
			baseRate = v.baseRate;
			currency = v.currency;
			regionOverrides = JSON.parse(v.regionOverrides);
		},
		equal: recordsEqual,
		debounceMs: 700
	});
	const baseRateValid = $derived(!!baseRate && parseInt(baseRate) > 0);
	$effect(() => {
		// Mirrors the old Save button's disabled rule — a zero or blank base rate
		// was never persistable, so don't persist it now either.
		if (!baseRateValid) return;
		regionRatesField.set({
			baseRate,
			currency,
			regionOverrides: JSON.stringify(regionOverrides)
		});
	});

	const adjustmentsField = autoSaveField<string>({
		initial: JSON.stringify(adjustments),
		save: (v) => postAction('saveAdjustments', { adjustments: v }),
		onSaved: (v) => (adjustments = JSON.parse(v)),
		debounceMs: 700
	});
	$effect(() => adjustmentsField.set(JSON.stringify(adjustments)));

	const incomeField = autoSaveField<string>({
		initial: JSON.stringify(incomeAssumptions),
		save: (v) => postAction('saveIncomeAssumptions', { income_assumptions: v }),
		onSaved: (v) => (incomeAssumptions = JSON.parse(v)),
		debounceMs: 700
	});
	$effect(() => incomeField.set(JSON.stringify(incomeAssumptions)));

	const currencies = [
		{ value: 'EUR', label: 'EUR', symbol: '\u20AC' },
		{ value: 'USD', label: 'USD', symbol: '$' },
		{ value: 'GBP', label: 'GBP', symbol: '\u00A3' }
	];

	const predefinedRegions = REGIONS.values.map((v) => ({
		value: v.canonical,
		label: v.label
	}));

	// Common adjustments shown by default
	const commonAdjustments: {
		key: keyof SalaryAdjustments;
		value: string;
		label: string;
	}[] = [
		{
			key: 'employment_type',
			value: 'contract',
			label: 'Contract / Freelance'
		},
		{ key: 'work_arrangement', value: 'onsite', label: 'On-site' },
		{ key: 'work_arrangement', value: 'hybrid', label: 'Hybrid' }
	];

	// Advanced adjustments behind toggle
	const advancedAdjustments: {
		key: keyof SalaryAdjustments;
		value: string;
		label: string;
	}[] = [
		{ key: 'employment_type', value: 'part_time', label: 'Part-time' },
		{ key: 'employment_type', value: 'temporary', label: 'Temporary' },
		{ key: 'employment_type', value: 'internship', label: 'Internship' },
		{ key: 'company_type', value: 'startup', label: 'Startup' },
		{ key: 'company_type', value: 'corporate', label: 'Corporate' },
		{ key: 'company_type', value: 'agency', label: 'Agency / Consultancy' }
	];

	let showAdvanced = $state(false);

	// Auto-expand if any advanced adjustment has a value
	$effect(() => {
		const hasAdvancedValues = advancedAdjustments.some(
			(a) => adjustments[a.key]?.[a.value] != null
		);
		if (hasAdvancedValues) showAdvanced = true;
	});

	let newRegionKey = $state('');

	function addRegionOverride() {
		if (!newRegionKey) return;
		const defaultCurrency = REGION_CURRENCIES[newRegionKey] || 'EUR';
		regionOverrides = {
			...regionOverrides,
			[newRegionKey]: { rate: 0, currency: defaultCurrency }
		};
		newRegionKey = '';
	}

	function removeRegionOverride(region: string) {
		const { [region]: _, ...rest } = regionOverrides;
		regionOverrides = rest;
	}

	function updateRegionRate(region: string, value: string) {
		const rate = parseInt(value) || 0;
		regionOverrides = {
			...regionOverrides,
			[region]: { ...regionOverrides[region], rate }
		};
	}

	function updateRegionCurrency(region: string, curr: string) {
		regionOverrides = {
			...regionOverrides,
			[region]: { ...regionOverrides[region], currency: curr }
		};
	}

	// Linked options: setting one sets the others too
	const linkedOptions: Record<string, { key: keyof SalaryAdjustments; values: string[] }> = {
		'employment_type:contract': {
			key: 'employment_type',
			values: ['contract', 'freelance']
		}
	};

	function setAdjustment(category: keyof SalaryAdjustments, option: string, value: string) {
		const numVal = parseInt(value);
		const cat = { ...(adjustments[category] ?? {}) };

		// Check for linked options
		const linked = linkedOptions[`${category}:${option}`];
		const targets = linked ? linked.values : [option];

		for (const target of targets) {
			if (value === '' || isNaN(numVal)) {
				delete cat[target];
			} else {
				cat[target] = numVal;
			}
		}
		adjustments = { ...adjustments, [category]: cat };
	}

	// Also link agency ↔ consultancy
	function setAgencyAdjustment(value: string) {
		const numVal = parseInt(value);
		const cat = { ...(adjustments.company_type ?? {}) };
		if (value === '' || isNaN(numVal)) {
			delete cat['agency'];
			delete cat['consultancy'];
		} else {
			cat['agency'] = numVal;
			cat['consultancy'] = numVal;
		}
		adjustments = { ...adjustments, company_type: cat };
	}

	function getAdjustmentValue(category: keyof SalaryAdjustments, option: string): string {
		const val = adjustments[category]?.[option];
		return val != null ? String(val) : '';
	}

	// Preview calculation
	let baseRateNum = $derived(parseInt(baseRate) || 0);

	// Income estimate from the single base rate (freelance vs employment lenses)
	let income = $derived(
		baseRateNum > 0 ? estimateIncome(baseRateNum, currency, incomeAssumptions) : null
	);

	// Available regions not yet added
	let availableRegions = $derived(predefinedRegions.filter((r) => !(r.value in regionOverrides)));

	// Example scenarios for preview
	let exampleScenarios = $derived.by(() => {
		if (baseRateNum <= 0) return [];
		const scenarios: {
			label: string;
			rate: number;
			currency: string;
			detail: string;
		}[] = [];

		// Global default
		scenarios.push({
			label: 'Global (default)',
			rate: baseRateNum,
			currency,
			detail: 'Base rate'
		});

		// Region overrides
		for (const [region, override] of Object.entries(regionOverrides)) {
			if (override.rate > 0) {
				const regionLabel = predefinedRegions.find((r) => r.value === region)?.label ?? region;
				scenarios.push({
					label: regionLabel,
					rate: override.rate,
					currency: override.currency,
					detail: `${formatCurrency(override.rate, override.currency)}/hr`
				});
			}
		}

		// Contract/Freelance if adjustment exists
		const contractAdj = adjustments.employment_type?.contract;
		if (contractAdj != null) {
			const effective = getEffectiveRate(baseRateNum, currency, adjustments, regionOverrides, {
				employment_type: 'contract'
			});
			scenarios.push({
				label: 'Contract / Freelance',
				rate: effective.rate,
				currency: effective.currency,
				detail: `${contractAdj >= 0 ? '+' : ''}${contractAdj}% adjustment`
			});
		}

		// Onsite if adjustment exists
		const onsiteAdj = adjustments.work_arrangement?.onsite;
		if (onsiteAdj != null) {
			const effective = getEffectiveRate(baseRateNum, currency, adjustments, regionOverrides, {
				work_arrangement: 'onsite'
			});
			scenarios.push({
				label: 'On-site',
				rate: effective.rate,
				currency: effective.currency,
				detail: `${onsiteAdj >= 0 ? '+' : ''}${onsiteAdj}% adjustment`
			});
		}

		return scenarios;
	});
</script>

<svelte:head>
	<title>Salary Prep - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<SectionHeader title="Salary Prep" icon={faMoneyBillWave} />

	<!-- Section 1: Region Rates -->
	<Card padding="lg">
		<h3 class="mb-1 text-base font-semibold text-[var(--dash-text)]">Region Rates</h3>
		<p class="mb-4 text-sm text-[var(--dash-text-secondary)]">
			Set your hourly rate per region. The global rate is the default for jobs that don't match a
			specific region. Percentage adjustments (below) apply on top.
		</p>

		<div class="space-y-3">
			<!-- Global (default) row -->
			<div
				class="space-y-2 rounded-lg border border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/5 px-4 py-3"
			>
				<div class="flex items-center gap-2">
					<FontAwesomeIcon icon={faGlobe} class="h-4 w-4 text-[var(--dash-primary)]" />
					<span class="text-sm font-medium text-[var(--dash-text)]">Global</span>
					<span class="text-xs text-[var(--dash-text-muted)]">(default)</span>
				</div>
				<div class="flex items-center gap-2">
					<input
						type="number"
						bind:value={baseRate}
						min="0"
						required
						placeholder="e.g. 85"
						class="w-24 rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
					<span class="text-sm text-[var(--dash-text-secondary)]">/hr</span>
					<div
						class="ml-2 inline-flex overflow-hidden rounded-md border border-[var(--dash-border)]"
					>
						{#each currencies as opt, i}
							<button
								type="button"
								onclick={() => (currency = opt.value)}
								class="
                  px-2 py-1 text-xs transition-colors {currency === opt.value
									? 'bg-[var(--dash-primary)]/10 font-medium text-[var(--dash-primary)]'
									: 'text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)]'} {i > 0
									? 'border-l border-[var(--dash-border)]'
									: ''}
                "
							>
								{opt.symbol}
							</button>
						{/each}
					</div>
				</div>
				{#if baseRateNum > 0}
					<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--dash-text-muted)]">
						<span>{formatCurrency(hourlyToRate(baseRateNum, 'day'), currency)}/day</span>
						<span>{formatCurrency(hourlyToRate(baseRateNum, 'month'), currency)}/mo</span>
						<span>{formatCurrency(hourlyToRate(baseRateNum, 'year'), currency)}/yr</span>
					</div>
				{/if}
			</div>

			<!-- Region override rows -->
			{#each Object.entries(regionOverrides) as [region, override]}
				{@const regionLabel = predefinedRegions.find((r) => r.value === region)?.label ?? region}
				<div class="space-y-2 rounded-lg bg-[var(--dash-bg)] px-4 py-3">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-[var(--dash-text)]">{regionLabel}</span>
						<button
							type="button"
							onclick={() => removeRegionOverride(region)}
							class="p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-error)]"
							aria-label="Remove"
						>
							<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
						</button>
					</div>
					<div class="flex items-center gap-2">
						<input
							type="number"
							value={override.rate || ''}
							oninput={(e) => updateRegionRate(region, (e.target as HTMLInputElement).value)}
							min="0"
							placeholder="0"
							class="w-24 rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
						<span class="text-sm text-[var(--dash-text-secondary)]">/hr</span>
						<div
							class="ml-2 inline-flex overflow-hidden rounded-md border border-[var(--dash-border)]"
						>
							{#each currencies as opt, i}
								<button
									type="button"
									onclick={() => updateRegionCurrency(region, opt.value)}
									class="
                    px-2 py-1 text-xs transition-colors {override.currency === opt.value
										? 'bg-[var(--dash-primary)]/10 font-medium text-[var(--dash-primary)]'
										: 'text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)]'} {i > 0
										? 'border-l border-[var(--dash-border)]'
										: ''}
                  "
								>
									{opt.symbol}
								</button>
							{/each}
						</div>
					</div>
					{#if override.rate > 0}
						<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--dash-text-muted)]">
							<span
								>{formatCurrency(hourlyToRate(override.rate, 'day'), override.currency)}/day</span
							>
							<span
								>{formatCurrency(hourlyToRate(override.rate, 'month'), override.currency)}/mo</span
							>
							<span
								>{formatCurrency(hourlyToRate(override.rate, 'year'), override.currency)}/yr</span
							>
						</div>
					{/if}
				</div>
			{/each}

			<!-- Add region -->
			{#if availableRegions.length > 0}
				<div class="flex items-center gap-2 pt-1">
					<select
						bind:value={newRegionKey}
						class="max-w-[200px] flex-1 rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text-secondary)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					>
						<option value="">Add region...</option>
						{#each availableRegions as region}
							<option value={region.value}>{region.label}</option>
						{/each}
					</select>
					<button
						type="button"
						onclick={addRegionOverride}
						disabled={!newRegionKey}
						class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-primary)]/5 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
						Add
					</button>
				</div>
			{/if}
		</div>

		<div class="mt-4 flex justify-end">
			{#if !baseRateValid}
				<span class="text-xs text-[var(--dash-error)]">
					Set a base rate above 0 — nothing is saved until then.
				</span>
			{:else}
				<AutoSaveIndicator field={regionRatesField} />
			{/if}
		</div>
	</Card>

	<!-- Section 2: Adjustments -->
	<Card padding="lg">
		<h3 class="mb-1 text-base font-semibold text-[var(--dash-text)]">Rate Adjustments</h3>
		<p class="mb-4 text-sm text-[var(--dash-text-secondary)]">
			Adjust your rate for different job types. Adjustments stack when multiple apply.
		</p>

		<div class="space-y-2">
			{#each commonAdjustments as adj}
				{@const isAgency = adj.key === 'company_type' && adj.value === 'agency'}
				{@const val = getAdjustmentValue(adj.key, adj.value)}
				{@const numVal = val !== '' ? parseInt(val) : null}
				<div class="flex items-center gap-3 rounded-lg bg-[var(--dash-bg)] px-3 py-2">
					<span class="w-36 flex-shrink-0 text-sm text-[var(--dash-text)]">{adj.label}</span>
					<div class="relative w-20 flex-shrink-0">
						<input
							type="number"
							value={val}
							oninput={(e) =>
								isAgency
									? setAgencyAdjustment((e.target as HTMLInputElement).value)
									: setAdjustment(adj.key, adj.value, (e.target as HTMLInputElement).value)}
							placeholder="0"
							class="
                w-full rounded-md border border-[var(--dash-border)] px-2 py-1.5 pr-6 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none {numVal !=
								null && numVal > 0
								? 'text-[var(--dash-success)]'
								: numVal != null && numVal < 0
									? 'text-[var(--dash-error)]'
									: ''}
              "
						/>
						<span
							class="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-[var(--dash-text-muted)]"
							>%</span
						>
					</div>
					{#if numVal != null && baseRateNum > 0}
						{@const adjustedRate = Math.round(baseRateNum * (1 + numVal / 100))}
						<div
							class="hidden flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--dash-text-muted)] sm:flex"
						>
							<span class="text-[var(--dash-text-secondary)]"
								>= {formatCurrency(adjustedRate, currency)}/hr</span
							>
							<span>{formatCurrency(hourlyToRate(adjustedRate, 'day'), currency)}/day</span>
							<span>{formatCurrency(hourlyToRate(adjustedRate, 'month'), currency)}/mo</span>
							<span>{formatCurrency(hourlyToRate(adjustedRate, 'year'), currency)}/yr</span>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Advanced toggle -->
		<button
			type="button"
			onclick={() => (showAdvanced = !showAdvanced)}
			class="mt-3 flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text-secondary)]"
		>
			<FontAwesomeIcon icon={showAdvanced ? faChevronUp : faChevronDown} class="h-3 w-3" />
			{showAdvanced ? 'Hide' : 'More'} adjustments
		</button>

		{#if showAdvanced}
			<div class="mt-2 space-y-2">
				{#each advancedAdjustments as adj}
					{@const isAgency = adj.key === 'company_type' && adj.value === 'agency'}
					{@const val = getAdjustmentValue(adj.key, adj.value)}
					{@const numVal = val !== '' ? parseInt(val) : null}
					<div class="flex items-center gap-3 rounded-lg bg-[var(--dash-bg)] px-3 py-2">
						<span class="w-36 flex-shrink-0 text-sm text-[var(--dash-text)]">{adj.label}</span>
						<div class="relative w-20 flex-shrink-0">
							<input
								type="number"
								value={val}
								oninput={(e) =>
									isAgency
										? setAgencyAdjustment((e.target as HTMLInputElement).value)
										: setAdjustment(adj.key, adj.value, (e.target as HTMLInputElement).value)}
								placeholder="0"
								class="
                  w-full rounded-md border border-[var(--dash-border)] px-2 py-1.5 pr-6 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none {numVal !=
									null && numVal > 0
									? 'text-[var(--dash-success)]'
									: numVal != null && numVal < 0
										? 'text-[var(--dash-error)]'
										: ''}
                "
							/>
							<span
								class="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-[var(--dash-text-muted)]"
								>%</span
							>
						</div>
						{#if numVal != null && baseRateNum > 0}
							{@const adjustedRate = Math.round(baseRateNum * (1 + numVal / 100))}
							<div
								class="hidden flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--dash-text-muted)] sm:flex"
							>
								<span class="text-[var(--dash-text-secondary)]"
									>= {formatCurrency(adjustedRate, currency)}/hr</span
								>
								<span>{formatCurrency(hourlyToRate(adjustedRate, 'day'), currency)}/day</span>
								<span>{formatCurrency(hourlyToRate(adjustedRate, 'month'), currency)}/mo</span>
								<span>{formatCurrency(hourlyToRate(adjustedRate, 'year'), currency)}/yr</span>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<div class="mt-4 flex justify-end">
			<AutoSaveIndicator field={adjustmentsField} />
		</div>
	</Card>

	<!-- Section 3: Preview -->
	{#if exampleScenarios.length > 0}
		<Card padding="lg">
			<h3 class="mb-1 text-base font-semibold text-[var(--dash-text)]">Rate Preview</h3>
			<p class="mb-4 text-sm text-[var(--dash-text-secondary)]">
				How your hourly rate converts to income, and how contract and employment compare on
				take-home.
			</p>

			<!-- Income estimate: two lenses from one base rate -->
			{#if income}
				<div class="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
					<!-- Contract / Freelance lens -->
					<div
						class="rounded-lg border border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/5 px-4 py-3"
					>
						<div class="mb-2 text-sm font-semibold text-[var(--dash-text)]">
							Contract / Freelance
						</div>
						<div class="space-y-1.5">
							<div class="flex items-baseline justify-between gap-2">
								<span class="text-xs text-[var(--dash-text-secondary)]">Gross</span>
								<span class="text-sm text-[var(--dash-text)]">
									<span class="font-medium"
										>{formatCurrency(income.freelance.grossMonth, income.currency)}</span
									><span class="text-xs text-[var(--dash-text-muted)]">/mo</span>
									<span class="ml-1 text-xs text-[var(--dash-text-muted)]"
										>· {formatCurrency(income.freelance.grossYear, income.currency)}/yr</span
									>
								</span>
							</div>
							<div class="flex items-baseline justify-between gap-2">
								<span class="text-xs text-[var(--dash-text-secondary)]">Take-home (est.)</span>
								<span class="text-sm text-[var(--dash-text)]">
									<span class="font-medium text-[var(--dash-success)]"
										>{formatCurrency(income.freelance.netMonth, income.currency)}</span
									><span class="text-xs text-[var(--dash-text-muted)]">/mo</span>
									<span class="ml-1 text-xs text-[var(--dash-text-muted)]"
										>· {formatCurrency(income.freelance.netYear, income.currency)}/yr</span
									>
								</span>
							</div>
						</div>
					</div>

					<!-- Employment-equivalent lens -->
					<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-4 py-3">
						<div class="mb-2 text-sm font-semibold text-[var(--dash-text)]">
							Employment (equivalent)
						</div>
						<div class="space-y-1.5">
							<div class="flex items-baseline justify-between gap-2">
								<span class="text-xs text-[var(--dash-text-secondary)]">Gross salary</span>
								<span class="text-sm text-[var(--dash-text)]">
									<span class="font-medium"
										>{formatCurrency(income.employment.grossMonth, income.currency)}</span
									><span class="text-xs text-[var(--dash-text-muted)]">/mo</span>
									<span class="ml-1 text-xs text-[var(--dash-text-muted)]"
										>· {formatCurrency(income.employment.grossYear, income.currency)}/yr</span
									>
								</span>
							</div>
							<div class="flex items-baseline justify-between gap-2">
								<span class="text-xs text-[var(--dash-text-secondary)]">Take-home (est.)</span>
								<span class="text-sm text-[var(--dash-text)]">
									<span class="font-medium text-[var(--dash-success)]"
										>{formatCurrency(income.employment.netMonth, income.currency)}</span
									><span class="text-xs text-[var(--dash-text-muted)]">/mo</span>
									<span class="ml-1 text-xs text-[var(--dash-text-muted)]"
										>· {formatCurrency(income.employment.netYear, income.currency)}/yr</span
									>
								</span>
							</div>
						</div>
					</div>
				</div>

				<p class="mb-2 text-xs text-[var(--dash-text-muted)]">
					The employment figure is the gross salary you'd need to take home the same as freelancing
					after payroll tax — matched on take-home, since the same hourly number means very
					different things. Flat-rate estimates, not tax advice.
				</p>

				<!-- Assumptions editor -->
				<button
					type="button"
					onclick={() => (showAssumptions = !showAssumptions)}
					class="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text-secondary)]"
				>
					<FontAwesomeIcon icon={showAssumptions ? faChevronUp : faChevronDown} class="h-3 w-3" />
					{showAssumptions ? 'Hide' : 'Adjust'} assumptions
				</button>

				{#if showAssumptions}
					<div class="mt-2 space-y-3 rounded-lg bg-[var(--dash-bg)] p-3">
						<label class="flex items-center justify-between gap-3 text-sm">
							<span class="text-[var(--dash-text-secondary)]">Freelance billable hours / year</span>
							<input
								type="number"
								min="0"
								bind:value={incomeAssumptions.freelanceBillableHours}
								class="w-24 rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
							/>
						</label>
						<label class="flex items-center justify-between gap-3 text-sm">
							<span class="text-[var(--dash-text-secondary)]"
								>Freelance deductions (tax + contributions + costs)</span
							>
							<div class="relative w-24 flex-shrink-0">
								<input
									type="number"
									min="0"
									max="100"
									bind:value={incomeAssumptions.freelanceDeductionPct}
									class="w-full rounded-md border border-[var(--dash-border)] px-3 py-1.5 pr-6 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
								/>
								<span
									class="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-[var(--dash-text-muted)]"
									>%</span
								>
							</div>
						</label>
						<label class="flex items-center justify-between gap-3 text-sm">
							<span class="text-[var(--dash-text-secondary)]">Employment payroll tax</span>
							<div class="relative w-24 flex-shrink-0">
								<input
									type="number"
									min="0"
									max="100"
									bind:value={incomeAssumptions.employmentTaxPct}
									class="w-full rounded-md border border-[var(--dash-border)] px-3 py-1.5 pr-6 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
								/>
								<span
									class="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-[var(--dash-text-muted)]"
									>%</span
								>
							</div>
						</label>
						<div class="flex justify-end">
							<AutoSaveIndicator field={incomeField} />
						</div>
					</div>
				{/if}
			{/if}

			<!-- Per-scenario rates -->
			<div class="mt-4">
				<div class="mb-2 text-xs font-medium tracking-wide text-[var(--dash-text-muted)] uppercase">
					Rate by scenario
				</div>
				<div class="space-y-2">
					{#each exampleScenarios as scenario}
						<div class="flex items-center justify-between rounded-lg bg-[var(--dash-bg)] px-3 py-2">
							<div>
								<span class="text-sm font-medium text-[var(--dash-text)]">{scenario.label}</span>
								<span class="ml-2 text-xs text-[var(--dash-text-muted)]">{scenario.detail}</span>
							</div>
							<div class="flex-shrink-0 text-right">
								<span class="text-sm font-medium text-[var(--dash-text)]"
									>{formatCurrency(scenario.rate, scenario.currency)}/hr</span
								>
								<span class="ml-2 text-xs text-[var(--dash-text-muted)]"
									>{formatCurrency(
										hourlyToRate(scenario.rate, 'month'),
										scenario.currency
									)}/mo</span
								>
								<span class="ml-2 text-xs text-[var(--dash-text-muted)]"
									>{formatCurrency(hourlyToRate(scenario.rate, 'year'), scenario.currency)}/yr</span
								>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</Card>
	{/if}
</div>
