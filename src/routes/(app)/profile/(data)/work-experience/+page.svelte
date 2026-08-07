<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faBriefcase, faExternalLink, faPencil } from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../components/SectionHeader.svelte';
	import EmptyState from '../../components/EmptyState.svelte';
	import ItemCard from '../../components/ItemCard.svelte';
	import ReorderableList from '../../components/ReorderableList.svelte';
	import { getWorkExperienceLogoUrl } from '$lib/utils/entity-media-url';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let experiences = $derived(data.experiences);
	let expandedId = $state<number | null>(null);
	let showAddForm = $state(false);
	let reorderMode = $state(false);

	// Form states for new entry
	let newName = $state('');
	let newPosition = $state('');
	let newLocation = $state('');
	let newWebsite = $state('');
	let newDescription = $state('');
	let newSummary = $state('');
	let newStartDate = $state('');
	let newEndDate = $state('');

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
		newName = '';
		newPosition = '';
		newLocation = '';
		newWebsite = '';
		newDescription = '';
		newSummary = '';
		newStartDate = '';
		newEndDate = '';
	}
</script>

<svelte:head>
	<title>Experience - Profile - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<SectionHeader
		title="Work Experience"
		icon={faBriefcase}
		showAddButton={!showAddForm && experiences.length > 0}
		addLabel="Add Experience"
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
			<h3 class="mb-4 font-medium text-[var(--dash-text)]">Add New Work Experience</h3>
			<div class="space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<label for="new-name" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
							Company Name <span class="text-[var(--dash-error)]">*</span>
						</label>
						<input
							type="text"
							id="new-name"
							name="name"
							bind:value={newName}
							placeholder="e.g., Acme Corp"
							required
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
					</div>

					<div>
						<label
							for="new-position"
							class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
						>
							Position <span class="text-[var(--dash-error)]">*</span>
						</label>
						<input
							type="text"
							id="new-position"
							name="position"
							bind:value={newPosition}
							placeholder="e.g., Senior Software Engineer"
							required
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
							placeholder="e.g., San Francisco, CA"
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
					</div>

					<div>
						<label for="new-website" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
							Website
						</label>
						<input
							type="url"
							id="new-website"
							name="website"
							bind:value={newWebsite}
							placeholder="https://company.com"
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
					<label
						for="new-description"
						class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
					>
						Description
					</label>
					<textarea
						id="new-description"
						name="description"
						bind:value={newDescription}
						rows={2}
						placeholder="Brief description of the company..."
						class="w-full resize-y rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					></textarea>
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
						placeholder="Summary of your role and responsibilities..."
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

	<!-- Experiences List -->
	{#if experiences.length === 0 && !showAddForm}
		<EmptyState
			icon={faBriefcase}
			title="No work experience yet"
			description="Add your professional work history, including companies, positions, and achievements."
			actionLabel="Add First Experience"
			onAction={() => (showAddForm = true)}
		/>
	{:else}
		<ReorderableList
			bind:reorderMode
			items={experiences}
			ordering={data.ordering}
			type="work-experience"
			label="Experience"
			disabled={showAddForm}
		>
			{#snippet row(exp)}
				<FontAwesomeIcon
					icon={faBriefcase}
					class="h-4 w-4 flex-shrink-0 text-[var(--dash-primary)]"
				/>
				<h3 class="truncate text-base font-semibold text-[var(--dash-text)]">
					{exp.position || 'Untitled'}
				</h3>
				{#if exp.name}
					<span class="flex-shrink-0 truncate text-xs text-[var(--dash-text-muted)]">
						{exp.name}
					</span>
				{/if}
			{/snippet}
		</ReorderableList>

		{#if !reorderMode}
			<div class="space-y-3">
				{#each experiences as exp (exp.id)}
					<ItemCard
						id={exp.id}
						{expandedId}
						onToggle={toggleExpand}
						icon={faBriefcase}
						imageUrl={getWorkExperienceLogoUrl(exp)}
						imageAlt="{exp.name} logo"
					>
						{#snippet title()}
							{exp.position}
						{/snippet}

						{#snippet subtitle()}
							<span class="max-w-[150px] truncate sm:max-w-none">{exp.name}</span>
							{#if exp.location}
								<span class="text-[var(--dash-text-muted)]">•</span>
								<span class="max-w-[100px] truncate sm:max-w-none">{exp.location}</span>
							{/if}
						{/snippet}

						{#snippet dateline()}
							{formatDisplayDate(exp.start_date) || 'N/A'} – {formatDisplayDate(exp.end_date) ||
								'Present'}
						{/snippet}

						{#snippet expandedContent()}
							<!-- Website link in top right -->
							{#if exp.website}
								<a
									href={exp.website}
									target="_blank"
									rel="noopener"
									class="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 text-xs text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-border)]"
								>
									Website
									<FontAwesomeIcon icon={faExternalLink} class="h-3 w-3" />
								</a>
							{/if}

							{#if exp.summary}
								<div>
									<p class="mb-1 text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase">
										Summary
									</p>
									<p class="text-sm text-[var(--dash-text)]">{exp.summary}</p>
								</div>
							{/if}

							{#if exp.work_experience_technologies.length > 0}
								<div>
									<p class="mb-2 text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase">
										Technologies
									</p>
									<div class="flex flex-wrap gap-1">
										{#each exp.work_experience_technologies as tech}
											<span
												class="rounded bg-[var(--dash-bg)] px-2 py-1 text-xs text-[var(--dash-text)]"
												>{tech.name}</span
											>
										{/each}
									</div>
								</div>
							{/if}

							{#if exp.work_experience_achievements.length > 0}
								<div>
									<p class="mb-2 text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase">
										Achievements
									</p>
									<ul class="space-y-1 text-sm text-[var(--dash-text)]">
										{#each exp.work_experience_achievements as achievement}
											<li class="flex items-start gap-2">
												<span class="mt-1 text-[var(--dash-primary)]">•</span>
												<span>{achievement.description}</span>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
						{/snippet}

						{#snippet headerActions()}
							<a
								href="/profile/work-experience/{exp.id}"
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
	{/if}
</div>
