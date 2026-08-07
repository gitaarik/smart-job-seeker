<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faExternalLink, faGraduationCap, faPencil } from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../components/SectionHeader.svelte';
	import EmptyState from '../../components/EmptyState.svelte';
	import ItemCard from '../../components/ItemCard.svelte';
	import { getEducationLogoUrl } from '$lib/utils/entity-media-url';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let education = $derived(data.education);
	let expandedId = $state<number | null>(null);
	let showAddForm = $state(false);

	// Form states for new entry
	let newInstitution = $state('');
	let newArea = $state('');
	let newStudyType = $state('');
	let newLocation = $state('');
	let newUrl = $state('');
	let newGraduationYear = $state('');
	let newStartDate = $state('');
	let newEndDate = $state('');
	let newSummary = $state('');

	function formatDisplayDate(date: Date | string | null): string {
		if (!date) return '';
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('en-US', {
			month: 'short',
			year: 'numeric'
		});
	}

	function toggleExpand(id: number) {
		expandedId = expandedId === id ? null : id;
	}

	function resetAddForm() {
		showAddForm = false;
		newInstitution = '';
		newArea = '';
		newStudyType = '';
		newLocation = '';
		newUrl = '';
		newGraduationYear = '';
		newStartDate = '';
		newEndDate = '';
		newSummary = '';
	}
</script>

<svelte:head>
	<title>Education - Profile - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<SectionHeader
		title="Education"
		icon={faGraduationCap}
		showAddButton={!showAddForm && education.length > 0}
		addLabel="Add Education"
		onAdd={() => (showAddForm = true)}
	/>

	{#if form?.error}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{form.error}</p>
		</div>
	{/if}

	<!-- Add Form -->
	{#if showAddForm}
		<form
			method="POST"
			action="?/create"
			class="rounded-lg border border-[var(--dash-primary)] bg-[var(--dash-card)] p-4"
		>
			<h3 class="mb-4 font-medium text-[var(--dash-text)]">Add New Education</h3>
			<div class="space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<label
							for="new-institution"
							class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
						>
							Institution <span class="text-[var(--dash-error)]">*</span>
						</label>
						<input
							type="text"
							id="new-institution"
							name="institution"
							bind:value={newInstitution}
							placeholder="e.g., University of Technology"
							required
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
					</div>

					<div>
						<label for="new-area" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
							Field of Study
						</label>
						<input
							type="text"
							id="new-area"
							name="area"
							bind:value={newArea}
							placeholder="e.g., Computer Science"
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
					</div>

					<div>
						<label
							for="new-study-type"
							class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
						>
							Degree Type
						</label>
						<input
							type="text"
							id="new-study-type"
							name="study_type"
							bind:value={newStudyType}
							placeholder="e.g., Bachelor's, Master's, PhD"
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
					</div>

					<div>
						<label
							for="new-location"
							class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
						>
							Location
						</label>
						<input
							type="text"
							id="new-location"
							name="location"
							bind:value={newLocation}
							placeholder="e.g., Boston, MA"
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
					</div>

					<div>
						<label for="new-url" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
							Website URL
						</label>
						<input
							type="url"
							id="new-url"
							name="url"
							bind:value={newUrl}
							placeholder="https://university.edu"
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
					</div>

					<div>
						<label
							for="new-graduation-year"
							class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
						>
							Graduation Year
						</label>
						<input
							type="number"
							id="new-graduation-year"
							name="graduation_year"
							bind:value={newGraduationYear}
							placeholder="e.g., 2020"
							min="1950"
							max="2100"
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
					</div>

					<div>
						<label
							for="new-start-date"
							class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
						>
							Start Date
						</label>
						<input
							type="date"
							id="new-start-date"
							name="start_date"
							bind:value={newStartDate}
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
					</div>

					<div>
						<label
							for="new-end-date"
							class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
						>
							End Date
						</label>
						<input
							type="date"
							id="new-end-date"
							name="end_date"
							bind:value={newEndDate}
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
					</div>
				</div>

				<div>
					<label for="new-summary" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						Summary
					</label>
					<textarea
						id="new-summary"
						name="summary"
						bind:value={newSummary}
						rows={3}
						placeholder="Brief description of your studies, achievements, etc."
						class="w-full resize-y rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					></textarea>
				</div>
			</div>

			<div class="mt-4 flex justify-end gap-2">
				<button
					type="button"
					onclick={resetAddForm}
					class="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
				>
					Cancel
				</button>
				<button
					type="submit"
					class="rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
				>
					Create & Edit Details
				</button>
			</div>
		</form>
	{/if}

	<!-- Education List -->
	{#if education.length === 0 && !showAddForm}
		<EmptyState
			icon={faGraduationCap}
			title="No education entries yet"
			description="Add your educational background, degrees, and academic achievements."
			actionLabel="Add First Education"
			onAction={() => (showAddForm = true)}
		/>
	{:else}
		<div class="space-y-3">
			{#each education as edu (edu.id)}
				<ItemCard
					id={edu.id}
					{expandedId}
					onToggle={toggleExpand}
					icon={faGraduationCap}
					imageUrl={getEducationLogoUrl(edu)}
					imageAlt="{edu.institution} logo"
				>
					{#snippet title()}
						{edu.institution}
					{/snippet}

					{#snippet subtitle()}
						{#if edu.study_type}
							<span class="max-w-[150px] truncate sm:max-w-none">{edu.study_type}</span>
						{/if}
						{#if edu.study_type && edu.area}
							<span class="text-[var(--dash-text-muted)]">in</span>
						{/if}
						{#if edu.area}
							<span class="max-w-[150px] truncate sm:max-w-none">{edu.area}</span>
						{/if}
						{#if edu.graduation_year}
							<span class="text-[var(--dash-text-muted)]">({edu.graduation_year})</span>
						{/if}
					{/snippet}

					{#snippet dateline()}
						{formatDisplayDate(edu.start_date) || 'N/A'} – {formatDisplayDate(edu.end_date) ||
							'Present'}
					{/snippet}

					{#snippet expandedContent()}
						<!-- Website link in top right -->
						{#if edu.url}
							<a
								href={edu.url}
								target="_blank"
								rel="noopener"
								class="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 text-xs text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-border)]"
							>
								Website
								<FontAwesomeIcon icon={faExternalLink} class="h-3 w-3" />
							</a>
						{/if}

						{#if edu.location}
							<div>
								<p class="mb-1 text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase">
									Location
								</p>
								<p class="text-sm text-[var(--dash-text)]">{edu.location}</p>
							</div>
						{/if}

						{#if edu.summary}
							<div>
								<p class="mb-1 text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase">
									Summary
								</p>
								<p class="text-sm text-[var(--dash-text)]">{edu.summary}</p>
							</div>
						{/if}
					{/snippet}

					{#snippet headerActions()}
						<a
							href="/profile/education/{edu.id}"
							class="cursor-pointer p-1.5 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
							aria-label="Edit"
							onclick={(e) => e.stopPropagation()}
						>
							<FontAwesomeIcon icon={faPencil} class="h-4 w-4" />
						</a>
					{/snippet}
				</ItemCard>
			{/each}
		</div>
	{/if}
</div>
