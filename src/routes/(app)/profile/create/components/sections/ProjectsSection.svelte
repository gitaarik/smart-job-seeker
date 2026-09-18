<script lang="ts">
	import { OpenRows } from '$lib/components/open-rows';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faChevronDown,
		faChevronUp,
		faLaptopCode,
		faPlus,
		faTrash
	} from '@fortawesome/free-solid-svg-icons';
	import type { SideProject } from '$lib/server/resume/types';
	import Card from '../../../../components/Card.svelte';
	import TechnologyTagsEditor from '$lib/components/TechnologyTagsEditor.svelte';
	import AchievementsList from '$lib/components/AchievementsList.svelte';

	interface Props {
		projects: SideProject[];
	}

	let { projects = $bindable() }: Props = $props();

	let isExpanded = $state(false);
	const expandedItems = new OpenRows<SideProject>();

	function toggleItem(item: SideProject) {
		// Give the expanded editor its nested lists to bind into. Idempotent,
		// so it costs nothing on the way closed.
		if (!item.technologies) item.technologies = [];
		if (!item.achievements) item.achievements = [];
		expandedItems.toggle(item);
	}

	function removeItem(item: SideProject) {
		if (!confirm('Remove this project?')) return;
		projects = projects.filter((row) => row !== item);
	}

	function addProject() {
		projects = [
			...projects,
			{
				name: '',
				achievements: [],
				technologies: []
			}
		];
		expandedItems.open(projects[projects.length - 1]);
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
				<FontAwesomeIcon icon={faLaptopCode} class="h-5 w-5 text-[var(--dash-primary)]" />
			</div>
			<span class="text-base font-semibold text-[var(--dash-text)]">Side Projects</span>
			<span class="text-sm text-[var(--dash-text-secondary)]">({projects.length})</span>
		</div>
		<FontAwesomeIcon
			icon={isExpanded ? faChevronUp : faChevronDown}
			class="h-4 w-4 text-[var(--dash-text-muted)]"
		/>
	</button>

	{#if isExpanded}
		<div class="divide-y divide-[var(--dash-border)] border-t border-[var(--dash-border)]">
			{#each projects as project (project)}
				<div class={expandedItems.has(project) ? 'border-l-2 border-l-[var(--dash-primary)]' : ''}>
					<div
						class="flex items-center justify-between transition-colors hover:bg-[var(--dash-bg)]"
					>
						<button
							type="button"
							onclick={() => toggleItem(project)}
							class="flex-1 self-stretch p-3 text-left sm:p-4"
						>
							<div class="text-sm font-semibold text-[var(--dash-text)]">
								{project.name || 'Project'}
							</div>
							{#if project.url}
								<div class="max-w-xs truncate text-xs text-[var(--dash-text-secondary)] sm:text-sm">
									{project.url}
								</div>
							{/if}
						</button>
						<div class="flex items-center gap-2">
							<button
								type="button"
								onclick={() => removeItem(project)}
								class="flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 text-xs text-[var(--dash-text)] transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
								aria-label="Remove"
							>
								<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
								<span class="hidden sm:inline">Remove</span>
							</button>
							<button
								type="button"
								onclick={() => toggleItem(project)}
								class="p-1"
								aria-label={expandedItems.has(project) ? 'Collapse' : 'Expand'}
							>
								<FontAwesomeIcon
									icon={expandedItems.has(project) ? faChevronUp : faChevronDown}
									class="h-4 w-4 text-[var(--dash-text-muted)]"
								/>
							</button>
						</div>
					</div>

					{#if expandedItems.has(project)}
						<div class="space-y-4 px-3 py-4 sm:px-4">
							<div class="grid gap-4 md:grid-cols-2">
								<div>
									<label class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
										Project Name
									</label>
									<input
										type="text"
										bind:value={project.name}
										class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
									/>
								</div>

								<div>
									<label class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
										URL
									</label>
									<input
										type="url"
										bind:value={project.url}
										class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
									/>
								</div>
							</div>

							<div>
								<label class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
									Summary
								</label>
								<textarea
									bind:value={project.summary}
									rows="3"
									class="w-full resize-none rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
								></textarea>
							</div>

							<div>
								<label class="mb-2 block text-sm font-medium text-[var(--dash-text)]">
									Technologies
								</label>
								<TechnologyTagsEditor bind:technologies={project.technologies} />
							</div>

							<div>
								<label class="mb-2 block text-sm font-medium text-[var(--dash-text)]">
									Achievements
								</label>
								<AchievementsList bind:achievements={project.achievements} />
							</div>
						</div>
					{/if}
				</div>
			{/each}

			<div class="p-3 sm:p-4">
				<button
					type="button"
					onclick={addProject}
					class="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--dash-border)] py-2 text-sm text-[var(--dash-primary)] transition-colors hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary-hover)]"
				>
					<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
					Add project
				</button>
			</div>
		</div>
	{/if}
</Card>
