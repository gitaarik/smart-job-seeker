<script lang="ts">
	/**
	 * Percentages that move an ask by what a job is. Freelancing is not among
	 * them any more: it has its own ask, and the comparison prices the gap.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faSliders } from '@fortawesome/free-solid-svg-icons';
	import Card from '../../../components/Card.svelte';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import type { SaveStatus } from '$lib/components/auto-save.svelte';
	import { formatCurrency } from '$lib/salary/conversion';
	import type {
		EmployedSettings,
		FreelanceSettings,
		SalaryAdjustments
	} from '$lib/salary/settings';
	import { INPUT_CLASS, numberOrNull, periodLabel, unitLabel } from './salary-ui';

	interface Props {
		adjustments: SalaryAdjustments;
		/** The asks to preview on, when they are set up. */
		employed: EmployedSettings | null;
		freelance: FreelanceSettings | null;
		save: SaveStatus;
	}

	let { adjustments = $bindable(), employed, freelance, save }: Props = $props();

	type Row = {
		group: keyof SalaryAdjustments;
		option: string;
		label: string;
	};

	const BOTH: Row[] = [
		{ group: 'work_arrangement', option: 'onsite', label: 'On-site' },
		{ group: 'work_arrangement', option: 'hybrid', label: 'Hybrid' },
		{ group: 'company_type', option: 'startup', label: 'Startup' },
		{ group: 'company_type', option: 'corporate', label: 'Corporate' },
		{ group: 'company_type', option: 'agency', label: 'Agency or consultancy' }
	];
	const SALARY_ONLY: Row[] = [
		{ group: 'employment_type', option: 'part_time', label: 'Part-time' },
		{ group: 'employment_type', option: 'internship', label: 'Internship' }
	];

	function setPct(row: Row, pct: number | null) {
		const options = { ...(adjustments[row.group] ?? {}) };
		if (pct == null) delete options[row.option];
		else options[row.option] = Math.min(Math.max(Math.round(pct), -100), 1000);
		adjustments = { ...adjustments, [row.group]: options };
	}

	function previews(row: Row, pct: number, salaryOnly: boolean): string[] {
		const out: string[] = [];
		if (employed?.amount != null) {
			const amount = Math.round((employed.amount * (100 + pct)) / 100);
			out.push(`${formatCurrency(amount, employed.currency)} ${periodLabel(employed.period)}`);
		}
		if (!salaryOnly && freelance?.amount != null) {
			const amount = Math.round((freelance.amount * (100 + pct)) / 100);
			out.push(`${formatCurrency(amount, freelance.currency)} ${unitLabel(freelance.unit)}`);
		}
		return out;
	}
</script>

{#snippet rows(list: Row[], salaryOnly: boolean)}
	{#each list as row (row.option)}
		{@const pct = adjustments[row.group]?.[row.option]}
		<div
			class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-[var(--dash-bg-inset)] px-3 py-2"
		>
			<label for="adj-{row.option}" class="w-36 flex-shrink-0 text-sm text-[var(--dash-text)]"
				>{row.label}</label
			>
			<div class="relative w-24 flex-shrink-0">
				<input
					id="adj-{row.option}"
					type="number"
					step="1"
					value={pct ?? ''}
					placeholder="0"
					oninput={(e) => setPct(row, numberOrNull(e.currentTarget.value))}
					class="{INPUT_CLASS} w-full pr-7 {pct != null && pct > 0
						? 'text-[var(--dash-success)]'
						: pct != null && pct < 0
							? 'text-[var(--dash-error)]'
							: ''}"
				/>
				<span
					class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-[var(--dash-text-muted)]"
					>%</span
				>
			</div>
			{#if pct != null && pct !== 0}
				<span class="text-xs text-[var(--dash-text-muted)]">
					{previews(row, pct, salaryOnly).join(' · ')}
				</span>
			{/if}
		</div>
	{/each}
{/snippet}

<Card padding="lg">
	<div class="flex items-center gap-2">
		<FontAwesomeIcon icon={faSliders} class="h-4 w-4 text-[var(--dash-primary)]" />
		<h3 class="text-base font-semibold text-[var(--dash-text)]">Adjustments by job</h3>
	</div>
	<p class="mt-1 mb-4 text-sm text-[var(--dash-text-secondary)]">
		Move your ask by what a job is. The ones that match a job add up, and apply to whichever ask the
		job is priced in. Postings rarely say what kind of company it is, so you pick that on an
		application's Salary tab.
	</p>

	<div class="grid grid-cols-1 gap-2 xl:grid-cols-2">
		{@render rows(BOTH, false)}
	</div>

	<p class="mt-5 mb-2 text-xs font-medium tracking-wide text-[var(--dash-text-muted)] uppercase">
		Salary only
	</p>
	<div class="grid grid-cols-1 gap-2 xl:grid-cols-2">
		{@render rows(SALARY_ONLY, true)}
	</div>

	<div class="mt-4 flex justify-end">
		<AutoSaveIndicator field={save} />
	</div>
</Card>
