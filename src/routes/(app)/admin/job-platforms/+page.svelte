<script lang="ts">
	import type { PageData } from './$types';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faExternalLinkAlt, faPenToSquare } from '@fortawesome/free-solid-svg-icons';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Job Platforms - Admin - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold text-[var(--dash-text)]">Job Platforms</h1>
		<p class="text-sm text-[var(--dash-text-secondary)]">
			{data.platforms.length} total · {data.platforms.filter(
				(p) => p.status === 'published' && p.search_page_url !== null
			).length} suggestable
		</p>
	</div>

	<p class="text-sm text-[var(--dash-text-secondary)]">
		Any published platform with a <code>search_page_url</code> shows up in the AI suggestion flow at
		<code>/jobs/import/tasks</code>. Click a platform name to edit it, manage presets, see signals,
		and review change history.
	</p>

	<div class="overflow-x-auto rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)]">
		<table class="w-full text-sm">
			<thead
				class="bg-[var(--dash-bg)] text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase"
			>
				<tr>
					<th class="px-3 py-2 text-left">Name</th>
					<th class="px-3 py-2 text-left">Key</th>
					<th class="px-3 py-2 text-left">Status</th>
					<th class="px-3 py-2 text-left">Search form</th>
					<th class="px-3 py-2 text-left">Signals</th>
					<th class="px-3 py-2 text-left">Edits</th>
					<th class="px-3 py-2 text-right"></th>
				</tr>
			</thead>
			<tbody>
				{#each data.platforms as platform (platform.id)}
					<tr class="border-t border-[var(--dash-border)]">
						<td class="px-3 py-2 font-medium">
							<a
								href="/admin/job-platforms/{platform.id}"
								class="text-[var(--dash-primary)] hover:underline">{platform.name}</a
							>
							<a
								href={platform.url}
								target="_blank"
								rel="noopener noreferrer"
								class="ml-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)]"
								title="Open base URL"
							>
								<FontAwesomeIcon icon={faExternalLinkAlt} class="h-3 w-3" />
							</a>
						</td>
						<td class="px-3 py-2 font-mono text-xs text-[var(--dash-text-secondary)]">
							{platform.key}
						</td>
						<td class="px-3 py-2">
							<span
								class="inline-flex items-center rounded px-2 py-0.5 text-xs {platform.status ===
								'published'
									? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
									: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}"
								>{platform.status}</span
							>
						</td>
						<td class="px-3 py-2 text-xs whitespace-nowrap tabular-nums">
							{#if platform.search_page_url}
								<span class="text-green-600 dark:text-green-400">configured</span>
							{:else}
								<span class="text-[var(--dash-text-muted)]">none</span>
							{/if}
						</td>
						<td class="px-3 py-2 text-xs whitespace-nowrap tabular-nums">
							{#if platform.success_count + platform.failure_count > 0}
								<span class="text-green-600 dark:text-green-400" title="Successful runs"
									>{platform.success_count}</span
								>
								<span class="mx-0.5 text-[var(--dash-text-muted)]">/</span>
								<span class="text-red-600 dark:text-red-400" title="Failed runs"
									>{platform.failure_count}</span
								>
							{:else}
								<span class="text-[var(--dash-text-muted)]">—</span>
							{/if}
						</td>
						<td class="px-3 py-2 text-[var(--dash-text-secondary)] tabular-nums"
							>{platform.change_count}</td
						>
						<td class="px-3 py-2 text-right">
							<a
								href="/admin/job-platforms/{platform.id}"
								class="inline-flex items-center gap-1 rounded border border-[var(--dash-border)] px-2 py-1 text-xs text-[var(--dash-text)] hover:bg-[var(--dash-bg)]"
							>
								<FontAwesomeIcon icon={faPenToSquare} class="h-3 w-3" />
								Edit
							</a>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
