<script lang="ts">
	/**
	 * Salary Prep: a salary ask and a freelance rate, each in its own unit with
	 * its own assumptions, and what one is worth as the other. See
	 * lib/salary/settings.ts for why they are two asks and not one hourly rate.
	 */
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import { armOn } from '$lib/actions/arm-on';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faBuilding, faLaptop, faMoneyBillWave } from '@fortawesome/free-solid-svg-icons';
	import Card from '../../components/Card.svelte';
	import SectionHeader from '../../profile/components/SectionHeader.svelte';
	import { resolve } from '$app/paths';
	import { autoSaveField, type AutoSaveField } from '$lib/components/auto-save.svelte';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import {
		normalizeAdjustments,
		normalizeEmployed,
		normalizeFreelance,
		type EmployedSettings,
		type FreelanceSettings
	} from '$lib/salary/settings';
	import AdjustmentsCard from './components/AdjustmentsCard.svelte';
	import Comparison from './components/Comparison.svelte';
	import EmployedPane from './components/EmployedPane.svelte';
	import FreelancePane from './components/FreelancePane.svelte';

	let { data }: { data: PageData } = $props();

	// Seeded from the server once, at mount, and owned from then on: each section
	// saves itself, and nothing else writes these while the page is open (no
	// assistant capability edits salary). The auto-save baselines start from the
	// same values.
	const loaded = untrack(() => data);
	const startCurrency = loaded.employed?.currency ?? loaded.freelance?.currency ?? 'EUR';

	let employed = $state<EmployedSettings>(
		loaded.employed ?? normalizeEmployed({ currency: startCurrency })
	);
	let freelance = $state<FreelanceSettings>(
		loaded.freelance ?? normalizeFreelance({ currency: startCurrency })
	);
	// A pane shows once they set it up, or when their match settings look for
	// that kind of work. The other one waits behind a button.
	let employedOn = $state(loaded.employed != null || loaded.wanted.employed);
	let freelanceOn = $state(loaded.freelance != null || loaded.wanted.freelance);
	let adjustments = $state(loaded.adjustments);

	async function postAction(action: string, settings: string) {
		const formData = new FormData();
		formData.set('settings', settings);
		const response = await fetch(`?/${action}`, {
			method: 'POST',
			headers: { 'x-sveltekit-action': 'true' },
			body: formData
		});
		const result = await response.json().catch(() => null);
		if (result?.type !== 'success') throw new Error("Couldn't save, try again");
	}

	/**
	 * One field per ask, holding its JSON, or "null" once it is removed. After an
	 * undo the page has to show what was restored; after an ordinary save it
	 * already does, and writing the saved value back would undo whatever was
	 * typed while the save was in flight. Only an undo leaves `field.value` equal
	 * to what was just saved while the page shows something else.
	 */
	function askField(
		action: string,
		initial: string,
		restore: (saved: string) => void
	): AutoSaveField<string> {
		const field: AutoSaveField<string> = autoSaveField<string>({
			armOnInteraction: true,
			initial,
			save: (v) => postAction(action, v),
			onSaved: (v) => {
				if (field.value === v) restore(v);
			},
			debounceMs: 700
		});
		return field;
	}

	const employedField = askField(
		'saveEmployed',
		loaded.employed ? JSON.stringify(loaded.employed) : 'null',
		(saved) => {
			employedOn = saved !== 'null';
			if (employedOn && saved !== JSON.stringify(employed))
				employed = normalizeEmployed(JSON.parse(saved));
		}
	);
	$effect(() => employedField.set(employedOn ? JSON.stringify(employed) : 'null'));

	const freelanceField = askField(
		'saveFreelance',
		loaded.freelance ? JSON.stringify(loaded.freelance) : 'null',
		(saved) => {
			freelanceOn = saved !== 'null';
			if (freelanceOn && saved !== JSON.stringify(freelance))
				freelance = normalizeFreelance(JSON.parse(saved));
		}
	);
	$effect(() => freelanceField.set(freelanceOn ? JSON.stringify(freelance) : 'null'));

	const adjustmentsField = askField(
		'saveAdjustments',
		JSON.stringify(loaded.adjustments),
		(saved) => {
			if (saved !== JSON.stringify(adjustments))
				adjustments = normalizeAdjustments(JSON.parse(saved));
		}
	);
	$effect(() => adjustmentsField.set(JSON.stringify(adjustments)));
</script>

<svelte:head>
	<title>Salary Prep - Smart Job Seeker</title>
</svelte:head>

{#snippet addPane(
	title: string,
	icon: typeof faBuilding,
	text: string,
	button: string,
	onadd: () => void,
	save: AutoSaveField<string>
)}
	<Card padding="lg" class="flex flex-col items-start justify-center gap-3 border-dashed">
		<div class="flex items-center gap-2">
			<FontAwesomeIcon {icon} class="h-4 w-4 text-[var(--dash-text-muted)]" />
			<h3 class="text-base font-semibold text-[var(--dash-text-secondary)]">{title}</h3>
		</div>
		<p class="text-sm text-[var(--dash-text-muted)]">{text}</p>
		<div class="flex w-full items-center justify-between gap-3">
			<button
				type="button"
				onclick={onadd}
				class="rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-primary)] transition-colors hover:border-[var(--dash-primary)] hover:bg-[var(--dash-primary)]/5"
			>
				{button}
			</button>
			<AutoSaveIndicator field={save} />
		</div>
	</Card>
{/snippet}

<div
	class="space-y-6"
	use:armOn={() => {
		employedField.arm();
		freelanceField.arm();
		adjustmentsField.arm();
	}}
>
	<SectionHeader title="Salary Prep" icon={faMoneyBillWave} />

	<p class="text-sm text-[var(--dash-text-secondary)]">
		What you ask for a job and for freelance work, each in the unit it is quoted in, and what each
		leaves you. Every application measures its pay against these.
		<a
			href={resolve('/guide/[slug]', { slug: 'salary-prep' })}
			class="text-[var(--dash-primary)] hover:underline">Read the guide</a
		>.
	</p>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		{#if employedOn}
			<EmployedPane
				bind:settings={employed}
				fxRates={data.fxRates}
				save={employedField}
				onremove={data.wanted.employed ? undefined : () => (employedOn = false)}
			/>
		{:else}
			{@render addPane(
				'Employed',
				faBuilding,
				'Your match settings look for freelance work only. Add a salary to see what a job would have to pay to match your rate.',
				'Add a salary ask',
				() => (employedOn = true),
				employedField
			)}
		{/if}

		{#if freelanceOn}
			<FreelancePane
				bind:settings={freelance}
				fxRates={data.fxRates}
				save={freelanceField}
				onremove={data.wanted.freelance ? undefined : () => (freelanceOn = false)}
			/>
		{:else}
			{@render addPane(
				'Freelance',
				faLaptop,
				'Your match settings look for employment only. Add a rate to see what freelancing would have to pay to match your salary.',
				'Add a freelance rate',
				() => (freelanceOn = true),
				freelanceField
			)}
		{/if}
	</div>

	{#if employedOn && freelanceOn}
		<Comparison {employed} {freelance} fxRates={data.fxRates} />
	{/if}

	<AdjustmentsCard
		bind:adjustments
		employed={employedOn ? employed : null}
		freelance={freelanceOn ? freelance : null}
		save={adjustmentsField}
	/>
</div>
