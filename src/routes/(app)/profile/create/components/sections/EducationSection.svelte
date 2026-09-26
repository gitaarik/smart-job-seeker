<script lang="ts">
	import { OpenRows } from '$lib/components/open-rows';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faChevronDown,
		faChevronUp,
		faGraduationCap,
		faPlus,
		faTrash
	} from '@fortawesome/free-solid-svg-icons';
	import type { Education } from '$lib/server/resume/types';
	import Card from '../../../../components/Card.svelte';

	interface Props {
		education: Education[];
	}

	let { education = $bindable() }: Props = $props();
	// Links each label to its field; unique per mounted section.
	const uid = $props.id();

	let isExpanded = $state(false);
	const expandedItems = new OpenRows<Education>();

	function toggleItem(item: Education) {
		expandedItems.toggle(item);
	}

	function removeItem(item: Education) {
		if (!confirm('Remove this education entry?')) return;
		education = education.filter((row) => row !== item);
	}

	function addEducation() {
		education = [
			...education,
			{
				institution: ''
			}
		];
		expandedItems.open(education[education.length - 1]);
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
				<FontAwesomeIcon icon={faGraduationCap} class="h-5 w-5 text-[var(--dash-primary)]" />
			</div>
			<span class="text-base font-semibold text-[var(--dash-text)]">Education</span>
			<span class="text-sm text-[var(--dash-text-secondary)]">({education.length})</span>
		</div>
		<FontAwesomeIcon
			icon={isExpanded ? faChevronUp : faChevronDown}
			class="h-4 w-4 text-[var(--dash-text-muted)]"
		/>
	</button>

	{#if isExpanded}
		<div class="divide-y divide-[var(--dash-border)] border-t border-[var(--dash-border)]">
			{#each education as edu, i (edu)}
				<div class={expandedItems.has(edu) ? 'border-l-2 border-l-[var(--dash-primary)]' : ''}>
					<div
						class="flex items-center justify-between transition-colors hover:bg-[var(--dash-bg)]"
					>
						<button
							type="button"
							onclick={() => toggleItem(edu)}
							class="flex-1 self-stretch p-3 text-left sm:p-4"
						>
							<div class="text-sm font-semibold text-[var(--dash-text)]">
								{edu.studyType || 'Degree'}
								{edu.area ? `in ${edu.area}` : ''}
							</div>
							<div class="text-xs text-[var(--dash-text-secondary)] sm:text-sm">
								{edu.institution || 'Institution'}
								{#if edu.startDate || edu.endDate}
									<span class="text-[var(--dash-text-muted)]">
										&middot; {edu.startDate || '?'} – {edu.endDate || 'Present'}
									</span>
								{/if}
							</div>
						</button>
						<div class="flex items-center gap-2">
							<button
								type="button"
								onclick={() => removeItem(edu)}
								class="flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 text-xs text-[var(--dash-text)] transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
								aria-label="Remove"
							>
								<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
								<span class="hidden sm:inline">Remove</span>
							</button>
							<button
								type="button"
								onclick={() => toggleItem(edu)}
								class="p-1"
								aria-label={expandedItems.has(edu) ? 'Collapse' : 'Expand'}
							>
								<FontAwesomeIcon
									icon={expandedItems.has(edu) ? faChevronUp : faChevronDown}
									class="h-4 w-4 text-[var(--dash-text-muted)]"
								/>
							</button>
						</div>
					</div>

					{#if expandedItems.has(edu)}
						<div class="space-y-4 px-3 py-4 sm:px-4">
							<div class="grid gap-4 md:grid-cols-2">
								<div>
									<label
										for="{uid}-{i}-institution"
										class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
									>
										Institution
									</label>
									<input
										id="{uid}-{i}-institution"
										type="text"
										bind:value={edu.institution}
										class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
									/>
								</div>

								<div>
									<label
										for="{uid}-{i}-studyType"
										class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
									>
										Degree Type
									</label>
									<input
										id="{uid}-{i}-studyType"
										type="text"
										bind:value={edu.studyType}
										placeholder="Bachelor's, Master's, etc."
										class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
									/>
								</div>
							</div>

							<div class="grid gap-4 md:grid-cols-2">
								<div>
									<label
										for="{uid}-{i}-area"
										class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
									>
										Field of Study
									</label>
									<input
										id="{uid}-{i}-area"
										type="text"
										bind:value={edu.area}
										class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
									/>
								</div>

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
										bind:value={edu.location}
										class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
									/>
								</div>
							</div>

							<div class="grid gap-4 md:grid-cols-3">
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
										bind:value={edu.startDate}
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
										bind:value={edu.endDate}
										class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
									/>
								</div>

								<div>
									<label
										for="{uid}-{i}-graduationYear"
										class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
									>
										Graduation Year
									</label>
									<input
										id="{uid}-{i}-graduationYear"
										type="number"
										bind:value={edu.graduationYear}
										class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
									/>
								</div>
							</div>
						</div>
					{/if}
				</div>
			{/each}

			<div class="p-3 sm:p-4">
				<button
					type="button"
					onclick={addEducation}
					class="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--dash-border)] py-2 text-sm text-[var(--dash-primary)] transition-colors hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary-hover)]"
				>
					<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
					Add education
				</button>
			</div>
		</div>
	{/if}
</Card>
