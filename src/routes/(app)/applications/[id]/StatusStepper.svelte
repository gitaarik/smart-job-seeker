<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faPencil, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
	import { OpenRows } from '$lib/components/open-rows';
	import type { TimeFormat } from '$lib/format-date';
	import {
		formatRoundWhen,
		roundState,
		stepperPhases,
		stepsByPhase,
		defaultStepByPhase,
		resultOptions,
		roundKinds,
		roundKindValues,
		getStepperPhase,
		isFinishedStatus,
		MAX_ROUNDS,
		type InterviewRound
	} from '$lib/application-status';

	let {
		status,
		statusStep,
		rounds,
		addRound = false,
		timeFormat = '24h',
		saving = $bindable(false),
		oncancel,
		onsave
	}: {
		status: string;
		statusStep: string | null;
		rounds: readonly InterviewRound[];
		/**
		 * Open on interviewing with a new round ready to fill in: what "Invited to
		 * interview" and "Next round" mean.
		 */
		addRound?: boolean;
		timeFormat?: TimeFormat;
		saving?: boolean;
		oncancel: () => void;
		onsave: () => void;
	} = $props();
	// Links the labels to their controls; unique per open picker.
	const uid = $props.id();

	/**
	 * One round as the inputs hold it: strings, because an empty input is "",
	 * and a flag for a kind typed rather than picked. Keyed by the row object in
	 * the list below, not its index, so removing a round cannot hand one row's
	 * custom-kind input to the next.
	 */
	interface RoundRow {
		kind: string;
		customKind: boolean;
		date: string;
		time: string;
		with: string;
	}

	function toRow(round: InterviewRound): RoundRow {
		const kind = round.kind ?? '';
		return {
			kind,
			customKind: kind !== '' && !roundKindValues.includes(kind),
			date: round.date ?? '',
			time: round.time ?? '',
			with: round.with ?? ''
		};
	}

	const blankRow = (): RoundRow => ({ kind: '', customKind: false, date: '', time: '', with: '' });

	// State. The picker starts on the status it is shown and owns the selection
	// from then on; the page mounts a fresh one whenever that status changes
	// (`{#key}` on status, stage and rounds), so nothing here follows the props.
	const shown = untrack(() => ({ status, statusStep, rounds: [...rounds], addRound }));
	// A `draft` (the old column default) opens on applying, which is where it is;
	// the application layout reads it the same way.
	const startPhase = shown.addRound
		? 'interviewing'
		: shown.status === 'draft'
			? 'applying'
			: getStepperPhase(shown.status);
	// A new round to fill in when asked for one, and on an interviewing
	// application that somehow has none (being there means being invited).
	const startRows = shown.rounds.map(toRow);
	if (shown.addRound || (startPhase === 'interviewing' && startRows.length === 0)) {
		startRows.push(blankRow());
	}
	let selectedPhase = $state(startPhase);
	let selectedStep = $state(shown.statusStep || '');
	let selectedResult = $state(isFinishedStatus(shown.status) ? shown.status : '');
	let description = $state('');
	let customStepActive = $state(false);
	let customStepText = $state('');
	let noteOpen = $state(false);
	let rows = $state<RoundRow[]>(startRows);

	/**
	 * The rounds open for editing. A round already behind them starts as one line
	 * and opens on a click: by the fourth round the editor would otherwise be
	 * three filled-in forms to scroll past to reach the one being added. Seeded
	 * once from the rows as they opened, on purpose: from then on the applicant
	 * decides what is open.
	 */
	const open = new OpenRows<RoundRow>(
		untrack(() => {
			const asRounds = rows.map((row) => ({
				kind: row.kind || null,
				date: row.date || null,
				time: row.time || null,
				with: row.with || null
			}));
			return rows.filter((_, i) => roundState(asRounds, i) !== 'done');
		})
	);

	// Derived
	let stepOptions = $derived(stepsByPhase[selectedPhase] || []);

	// The actual DB status to submit
	let submitStatus = $derived(selectedPhase === 'result' ? selectedResult : selectedPhase);
	let submitStep = $derived(customStepActive ? customStepText : selectedStep);

	/**
	 * The rounds as the editor shows them, but only from the interviewing view.
	 * The rounds are only on screen there, so a round added on the way in and then
	 * left behind for "Not selected" must not be saved as a blank round 3.
	 */
	let submitRounds = $derived(
		selectedPhase === 'interviewing'
			? rows.map((row) => ({
					kind: row.kind.trim() || null,
					date: row.date || null,
					time: row.time || null,
					with: row.with.trim() || null
				}))
			: shown.rounds
	);

	function selectPhase(phase: string) {
		if (phase === selectedPhase) return;
		selectedPhase = phase;
		customStepActive = false;
		customStepText = '';
		selectedResult = '';
		selectedStep = phase === 'result' ? '' : defaultStepByPhase[phase] || '';
		// Being moved to interviewing means being invited to a round, open to fill in.
		if (phase === 'interviewing' && rows.length === 0) addRow();
	}

	function onStepChange(e: Event) {
		const val = (e.currentTarget as HTMLSelectElement).value;
		if (val === '__custom__') {
			customStepActive = true;
			selectedStep = '';
		} else {
			customStepActive = false;
			customStepText = '';
			selectedStep = val;
		}
	}

	function onKindChange(row: RoundRow, e: Event) {
		const val = (e.currentTarget as HTMLSelectElement).value;
		row.customKind = val === '__custom__';
		row.kind = row.customKind ? '' : val;
	}

	/** What a picked kind means, under the dropdown, so "Intro" is not a guess. */
	function hintFor(kind: string): string | undefined {
		return roundKinds.find((k) => k.value === kind)?.hint;
	}

	function removeRound(row: RoundRow) {
		rows = rows.filter((r) => r !== row);
	}

	function addRow() {
		rows.push(blankRow());
		// The proxy the list holds, not the object pushed: identity is the proxy's.
		open.open(rows[rows.length - 1]);
	}

	/** A closed round on one line: "Intro · Mon, Sep 28, 14:00 · Anna (CTO)". */
	function summary(row: RoundRow): string {
		return [
			row.kind || 'Kind not known',
			formatRoundWhen(row.date || null, row.time || null, timeFormat),
			row.with
		]
			.filter(Boolean)
			.join(' · ');
	}

	const inputClass =
		'w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-sm text-[var(--dash-text)] focus:border-[var(--dash-primary)] focus:outline-none';
	const labelClass = 'mb-1 block text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase';
</script>

<form
	method="POST"
	action="?/updateStatus"
	use:enhance={() => {
		saving = true;
		return async ({ update }) => {
			await update();
			saving = false;
			onsave();
		};
	}}
>
	<input type="hidden" name="status" value={submitStatus} />
	<input
		type="hidden"
		name="step"
		value={selectedPhase === 'applying' || selectedPhase === 'negotiating' ? submitStep : ''}
	/>
	<input type="hidden" name="rounds" value={JSON.stringify(submitRounds)} />

	<div class="space-y-4">
		<!-- Phase: dropdown on mobile, segmented control on desktop -->
		<div>
			<label id="{uid}-phase-label" for="{uid}-phase" class={labelClass}>Phase</label>
			<!-- Mobile dropdown -->
			<select
				id="{uid}-phase"
				value={selectedPhase}
				onchange={(e) => selectPhase((e.currentTarget as HTMLSelectElement).value)}
				class="{inputClass} sm:hidden"
			>
				{#each stepperPhases as phase (phase.value)}
					<option value={phase.value}>{phase.label}</option>
				{/each}
			</select>
			<!-- Desktop segmented control -->
			<div
				role="group"
				aria-labelledby="{uid}-phase-label"
				class="hidden overflow-hidden rounded-lg border border-[var(--dash-border)] sm:inline-flex"
			>
				{#each stepperPhases as phase, i (phase.value)}
					<button
						type="button"
						onclick={() => selectPhase(phase.value)}
						class="px-3 py-2 text-sm transition-colors {selectedPhase === phase.value
							? 'bg-[var(--dash-primary)]/10 font-medium text-[var(--dash-primary)]'
							: 'text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)]'} {i > 0
							? 'border-l border-[var(--dash-border)]'
							: ''}"
					>
						{phase.label}
					</button>
				{/each}
			</div>
		</div>

		{#if selectedPhase === 'result'}
			<!-- Result selection -->
			<div>
				<p id="{uid}-result" class={labelClass}>Result</p>
				<div role="group" aria-labelledby="{uid}-result" class="grid grid-cols-2 gap-2">
					{#each resultOptions as option (option.value)}
						<button
							type="button"
							onclick={() => (selectedResult = option.value)}
							class="rounded-lg border-2 px-3 py-2.5 text-center text-sm font-medium transition-all
                {selectedResult === option.value
								? option.value === 'accepted'
									? 'border-green-400 bg-green-100 text-green-700'
									: 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
								: 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
						>
							{option.label}
						</button>
					{/each}
				</div>
			</div>
		{:else if selectedPhase === 'interviewing'}
			<!-- Rounds: one row each, in order, added as they come -->
			<div>
				<p class={labelClass}>Rounds</p>
				<div class="space-y-3">
					{#each rows as row, i (row)}
						{#if !open.has(row)}
							<button
								type="button"
								onclick={() => open.open(row)}
								class="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--dash-border)] px-3 py-2 text-left text-sm transition-colors hover:border-[var(--dash-primary)]"
							>
								<span class="min-w-0">
									<span class="font-medium text-[var(--dash-text)]">{`Round ${i + 1}`}</span>
									<span class="text-[var(--dash-text-muted)]">{` · ${summary(row)}`}</span>
								</span>
								<span
									class="flex flex-shrink-0 items-center gap-1 text-xs text-[var(--dash-text-muted)]"
								>
									<FontAwesomeIcon icon={faPencil} class="h-3 w-3" />
									Edit
								</span>
							</button>
						{:else}
							<div
								role="group"
								aria-labelledby="{uid}-round-{i}"
								class="space-y-2 rounded-lg border border-[var(--dash-border)] p-3"
							>
								<div class="flex items-center justify-between">
									<p id="{uid}-round-{i}" class="text-sm font-medium text-[var(--dash-text)]">
										Round {i + 1}
									</p>
									{#if rows.length > 1}
										<button
											type="button"
											onclick={() => removeRound(row)}
											class="flex h-6 w-6 items-center justify-center rounded text-[var(--dash-text-muted)] transition-colors hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)]"
											aria-label="Remove round {i + 1}"
										>
											<FontAwesomeIcon icon={faXmark} class="h-3.5 w-3.5" />
										</button>
									{/if}
								</div>
								<div>
									<label for="{uid}-kind-{i}" class="sr-only">Kind of round {i + 1}</label>
									<select
										id="{uid}-kind-{i}"
										value={row.customKind ? '__custom__' : row.kind}
										onchange={(e) => onKindChange(row, e)}
										class={inputClass}
									>
										<option value="">Kind not known yet</option>
										{#each roundKinds as kind (kind.value)}
											<option value={kind.value} title={kind.hint}>{kind.value}</option>
										{/each}
										<option value="__custom__">Custom...</option>
									</select>
									{#if !row.customKind && hintFor(row.kind)}
										<p class="mt-1 text-xs text-[var(--dash-text-muted)]">{hintFor(row.kind)}</p>
									{/if}
									{#if row.customKind}
										<input
											type="text"
											bind:value={row.kind}
											maxlength="60"
											placeholder="What kind of round"
											aria-label="Custom kind of round {i + 1}"
											class="mt-2 {inputClass}"
										/>
									{/if}
								</div>
								<div class="grid grid-cols-2 gap-2">
									<div>
										<label
											for="{uid}-date-{i}"
											class="mb-1 block text-xs text-[var(--dash-text-muted)]">Date</label
										>
										<input
											id="{uid}-date-{i}"
											type="date"
											bind:value={row.date}
											class={inputClass}
										/>
									</div>
									<div>
										<label
											for="{uid}-time-{i}"
											class="mb-1 block text-xs text-[var(--dash-text-muted)]">Time</label
										>
										<input
											id="{uid}-time-{i}"
											type="time"
											bind:value={row.time}
											class={inputClass}
										/>
									</div>
								</div>
								<div>
									<label
										for="{uid}-with-{i}"
										class="mb-1 block text-xs text-[var(--dash-text-muted)]">With</label
									>
									<input
										id="{uid}-with-{i}"
										type="text"
										bind:value={row.with}
										maxlength="200"
										placeholder="Who you meet, e.g. Anna (CTO)"
										class={inputClass}
									/>
								</div>
							</div>
						{/if}
					{/each}
				</div>
				{#if rows.length < MAX_ROUNDS}
					<button
						type="button"
						onclick={addRow}
						class="mt-3 flex items-center gap-1.5 text-sm font-medium text-[var(--dash-primary)] transition-colors hover:text-[var(--dash-primary-hover)]"
					>
						<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
						Add round
					</button>
				{/if}
				<p class="mt-2 text-xs text-[var(--dash-text-muted)]">
					Leave the date empty until it is booked. Once it has passed, the round shows as waiting
					for the result on its own.
				</p>
			</div>
		{:else if stepOptions.length > 0}
			<!-- Stage dropdown, for applying and negotiating -->
			<div>
				<label for="{uid}-step" class={labelClass}>Stage</label>
				<select
					id="{uid}-step"
					value={customStepActive ? '__custom__' : selectedStep}
					onchange={onStepChange}
					class={inputClass}
				>
					<option value="">— None —</option>
					{#each stepOptions as step, i (i)}
						<option value={step}>{step}</option>
					{/each}
					<option value="__custom__">Custom...</option>
				</select>
				{#if customStepActive}
					<input
						type="text"
						bind:value={customStepText}
						placeholder="Custom stage..."
						aria-label="Custom stage"
						class="mt-2 {inputClass}"
					/>
				{/if}
			</div>
		{/if}

		<!-- Note (collapsible) -->
		<div>
			{#if noteOpen}
				<label for="{uid}-description" class={labelClass}>Note</label>
				<textarea
					id="{uid}-description"
					name="description"
					bind:value={description}
					rows={2}
					placeholder="Any additional context..."
					class="{inputClass} resize-y"></textarea>
			{:else}
				<button
					type="button"
					onclick={() => (noteOpen = true)}
					class="text-sm text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text-secondary)]"
				>
					+ Add note
				</button>
			{/if}
		</div>
	</div>

	<!-- Footer -->
	<div class="mt-5 flex flex-wrap justify-end gap-2">
		<button
			type="button"
			onclick={oncancel}
			class="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-sm whitespace-nowrap text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
		>
			Cancel
		</button>
		<button
			type="submit"
			disabled={saving || (selectedPhase === 'result' && !selectedResult)}
			class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-sm whitespace-nowrap text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:opacity-50"
		>
			{saving ? 'Saving...' : 'Save'}
		</button>
	</div>
</form>
