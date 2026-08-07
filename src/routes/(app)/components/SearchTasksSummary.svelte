<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { getSearchTaskStatusIcon } from '$lib/search-task-status';
	import { searchTaskDisplayName } from '$lib/format';
	import Card from './Card.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	interface SearchTask {
		id: number;
		note: string | null;
		is_active: boolean;
		status: string | null;
		status_message: string | null;
		last_run: Date | string | null;
		last_run_jobs_found: number | null;
		job_platform: { name: string } | null;
	}

	interface SearchTasksData {
		tasks: SearchTask[];
		totalCount: number;
		activeCount: number;
		lastRun: Date | string | null;
		totalJobsFound: number;
	}

	interface Props {
		searchTasks: SearchTasksData;
	}

	let { searchTasks }: Props = $props();

	function timeAgo(date: Date | string | null): string {
		if (!date) return 'Never';
		const d = typeof date === 'string' ? new Date(date) : date;
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 30) return `${diffDays}d ago`;
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	// Show the 5 most recently run tasks
	const recentTasks = $derived(
		[...searchTasks.tasks]
			.sort((a, b) => {
				const aTime = a.last_run ? new Date(a.last_run).getTime() : 0;
				const bTime = b.last_run ? new Date(b.last_run).getTime() : 0;
				return bTime - aTime;
			})
			.slice(0, 4)
	);
</script>

<div>
	<div class="mb-3 flex items-center justify-between">
		<h3 class="text-base font-semibold text-[var(--dash-text)]">Import Tasks</h3>
		<a href="/jobs/import/tasks" class="text-sm text-[var(--dash-primary)] hover:underline">
			{searchTasks.totalCount === 0 ? 'Add' : 'Manage'}
		</a>
	</div>
	<Card padding="md">
		<p class="mb-3 text-xs text-[var(--dash-text-secondary)]">
			{searchTasks.activeCount} active / {searchTasks.totalCount} total
		</p>

		{#if searchTasks.totalCount === 0}
			<p class="text-xs text-[var(--dash-text-secondary)]">
				No search tasks configured yet. Set up automated job searches to find matching positions.
			</p>
		{:else}
			<div class="space-y-2">
				{#each recentTasks as task (task.id)}
					{@const statusIcon = getSearchTaskStatusIcon(task)}
					<div class="flex items-center gap-2 text-xs">
						{#if statusIcon.spinner}
							<Spinner size={statusIcon.iconSize} color="var(--dash-primary)" class="shrink-0" />
						{:else}
							<FontAwesomeIcon
								icon={statusIcon.icon}
								class="{statusIcon.iconSize} {statusIcon.colorClass} shrink-0"
							/>
						{/if}

						<!-- Platform name + optional note -->
						<span class="min-w-0 flex-1 truncate text-[var(--dash-text)]">
							{searchTaskDisplayName(task.job_platform?.name, task.note)}
						</span>

						<!-- Jobs found -->
						{#if task.last_run_jobs_found != null && task.last_run_jobs_found > 0}
							<span class="shrink-0 whitespace-nowrap text-[var(--dash-text-secondary)]">
								{task.last_run_jobs_found} jobs
							</span>
						{/if}

						<!-- Time -->
						{#if task.last_run}
							<span class="shrink-0 whitespace-nowrap text-[var(--dash-text-muted)]">
								{timeAgo(task.last_run)}
							</span>
						{:else}
							<span class="shrink-0 whitespace-nowrap text-[var(--dash-text-muted)]">
								Not run yet
							</span>
						{/if}
					</div>
				{/each}
				{#if searchTasks.totalCount > 4}
					<a href="/jobs/import/tasks" class="text-xs text-[var(--dash-primary)] hover:underline">
						+{searchTasks.totalCount - 4} more
					</a>
				{/if}
			</div>
		{/if}
	</Card>
</div>
