<script lang="ts">
	import { OpenRows } from '$lib/components/open-rows';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faBriefcase,
		faChevronDown,
		faChevronUp,
		faPlus,
		faTrash
	} from '@fortawesome/free-solid-svg-icons';
	import type { WorkExperience } from '$lib/server/resume/types';
	import Card from '../../../../components/Card.svelte';
	import AchievementsList from '$lib/components/AchievementsList.svelte';

	interface Props {
		work: WorkExperience[];
	}

	let { work = $bindable() }: Props = $props();
	// Links each label to its field; unique per mounted section.
	const uid = $props.id();

	let isExpanded = $state(true);
	const expandedItems = new OpenRows<WorkExperience>(work.slice(0, 1));

	function toggleItem(item: WorkExperience) {
		// Give the expanded editor its nested lists to bind into. Idempotent,
		// so it costs nothing on the way closed.
		if (!item.achievements) item.achievements = [];
		expandedItems.toggle(item);
	}

	function removeItem(item: WorkExperience) {
		if (!confirm('Remove this work experience?')) return;
		work = work.filter((row) => row !== item);
	}

	function addWork() {
		work = [
			...work,
			{
				name: '',
				position: '',
				achievements: [],
				technologies: []
			}
		];
		expandedItems.open(work[work.length - 1]);
		isExpanded = true;
	}
</script>

<Card class="overflow-hidden">
	<button
		type="button"
		onclick={() => (isExpanded = !isExpanded)}
		class="flex w-full items-center justify-between p-3 transition-colors hover:bg-[var(--dash-bg)] sm:p-4"
	>
		<div class="flex items-center gap-3">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--dash-primary)]/10"
			>
				<FontAwesomeIcon icon={faBriefcase} class="h-5 w-5 text-[var(--dash-primary)]" />
			</div>
			<span class="text-base font-semibold text-[var(--dash-text)]">Work Experience</span>
			<span class="text-sm text-[var(--dash-text-secondary)]">({work.length})</span>
		</div>
		<FontAwesomeIcon
			icon={isExpanded ? faChevronUp : faChevronDown}
			class="h-4 w-4 text-[var(--dash-text-muted)]"
		/>
	</button>

	{#if isExpanded}
		<div class="divide-y divide-[var(--dash-border)] border-t border-[var(--dash-border)]">
			{#each work as job, i (job)}
				<div class={expandedItems.has(job) ? 'border-l-2 border-l-[var(--dash-primary)]' : ''}>
					<div
						class="flex items-center justify-between transition-colors hover:bg-[var(--dash-bg)]"
					>
						<button
							type="button"
							onclick={() => toggleItem(job)}
							class="flex-1 self-stretch p-3 text-left sm:p-4"
						>
							<div class="text-sm font-semibold text-[var(--dash-text)]">
								{job.position || 'Position'}
							</div>
							<div class="text-xs text-[var(--dash-text-secondary)] sm:text-sm">
								{job.name || 'Company'}
								{#if job.startDate || job.endDate}
									<span class="text-[var(--dash-text-muted)]">
										&middot; {job.startDate || '?'} – {job.endDate || 'Present'}
									</span>
								{/if}
							</div>
						</button>
						<div class="flex items-center gap-2">
							<button
								type="button"
								onclick={() => removeItem(job)}
								class="flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 text-xs text-[var(--dash-text)] transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
								aria-label="Remove"
							>
								<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
								<span class="hidden sm:inline">Remove</span>
							</button>
							<button
								type="button"
								onclick={() => toggleItem(job)}
								class="p-1"
								aria-label={expandedItems.has(job) ? 'Collapse' : 'Expand'}
							>
								<FontAwesomeIcon
									icon={expandedItems.has(job) ? faChevronUp : faChevronDown}
									class="h-4 w-4 text-[var(--dash-text-muted)]"
								/>
							</button>
						</div>
					</div>

					{#if expandedItems.has(job)}
						<div class="space-y-4 px-3 py-4 sm:px-4">
							<div class="grid gap-4 md:grid-cols-2">
								<div>
									<label
										for="{uid}-{i}-position"
										class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
									>
										Position
									</label>
									<input
										id="{uid}-{i}-position"
										type="text"
										bind:value={job.position}
										class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
									/>
								</div>

								<div>
									<label
										for="{uid}-{i}-name"
										class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
									>
										Company
									</label>
									<input
										id="{uid}-{i}-name"
										type="text"
										bind:value={job.name}
										class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
									/>
								</div>
							</div>

							<div class="grid gap-4 md:grid-cols-3">
								<div>
									<label
										for="{uid}-{i}-location"
										class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
									>
										Location
									</label>
									<input
										id="{uid}-{i}-location"
										type="text"
										bind:value={job.location}
										class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
									/>
								</div>

								<div>
									<label
										for="{uid}-{i}-startDate"
										class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
									>
										Start Date
									</label>
									<input
										id="{uid}-{i}-startDate"
										type="date"
										bind:value={job.startDate}
										class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
									/>
								</div>

								<div>
									<label
										for="{uid}-{i}-endDate"
										class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
									>
										End Date
									</label>
									<input
										id="{uid}-{i}-endDate"
										type="date"
										bind:value={job.endDate}
										class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
									/>
								</div>
							</div>

							<div>
								<label
									for="{uid}-{i}-summary"
									class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
								>
									Summary
								</label>
								<textarea
									id="{uid}-{i}-summary"
									bind:value={job.summary}
									rows="3"
									class="w-full resize-none rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
								></textarea>
							</div>

							<div>
								<p class="mb-2 block text-sm font-medium text-[var(--dash-text)]">Achievements</p>
								<AchievementsList bind:achievements={job.achievements} />
							</div>
						</div>
					{/if}
				</div>
			{/each}

			<div class="p-3 sm:p-4">
				<button
					type="button"
					onclick={addWork}
					class="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--dash-border)] py-2 text-sm text-[var(--dash-primary)] transition-colors hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary-hover)]"
				>
					<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
					Add work experience
				</button>
			</div>
		</div>
	{/if}
</Card>
