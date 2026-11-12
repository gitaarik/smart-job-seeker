<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import { timeAgo } from '$lib/format';
	import {
		ATS_BOARD_STATUS_LABEL,
		atsCareersUrl,
		type AtsBoardStatus
	} from '$lib/job-platforms/ats-boards';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faExternalLinkAlt,
		faRotate,
		faTriangleExclamation
	} from '@fortawesome/free-solid-svg-icons';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let sweeping = $state(false);

	const careersUrl = $derived(atsCareersUrl(data.board.provider, data.board.slug));
	const fmt = (n: number) => n.toLocaleString('en-US');
	const when = (d: Date | string | null) => (d ? new Date(d).toLocaleString() : 'never');

	const facts = $derived<[string, string][]>([
		['Open postings', fmt(data.counts.open)],
		['Posted in the last 30 days', fmt(data.counts.open_30d)],
		['Closed, not yet pruned', fmt(data.counts.closed)],
		['Promoted into jobs', fmt(data.counts.promoted)],
		['Listed at last fetch', fmt(data.board.posting_count)],
		['Last fetch', when(data.board.last_fetched_at)],
		['Last success', when(data.board.last_ok_at)],
		['Consecutive failures', String(data.board.consecutive_failures)]
	]);

	function statusClass(status: string): string {
		switch (status) {
			case 'live':
				return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300';
			case 'throttled':
				return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
			default:
				return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
		}
	}
</script>

<svelte:head>
	<title>{data.board.provider}/{data.board.slug} - Career-site feeds - Admin</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<a
			href={resolve('/(app)/admin/job-platforms/feeds')}
			class="inline-flex items-center gap-1 text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
		>
			<FontAwesomeIcon icon={faArrowLeft} class="h-3 w-3" />
			Career-site feeds
		</a>
		<div class="mt-2 flex flex-wrap items-center justify-between gap-3">
			<h1 class="flex flex-wrap items-center gap-2 text-2xl font-semibold text-[var(--dash-text)]">
				{data.board.company_name ?? data.board.slug}
				<span class="font-mono text-base font-normal text-[var(--dash-text-muted)]"
					>{data.board.provider}/{data.board.slug}</span
				>
				<span
					class="inline-flex items-center rounded px-2 py-0.5 text-xs font-normal {statusClass(
						data.board.status
					)}"
					>{ATS_BOARD_STATUS_LABEL[data.board.status as AtsBoardStatus] ?? data.board.status}</span
				>
			</h1>
			<form
				method="POST"
				action="?/sweep"
				use:enhance={() => {
					sweeping = true;
					return async ({ update }) => {
						await update({ reset: false });
						sweeping = false;
					};
				}}
			>
				<button
					type="submit"
					disabled={sweeping}
					class="inline-flex items-center gap-1.5 rounded bg-[var(--dash-primary)] px-3 py-1.5 text-sm text-white hover:bg-[var(--dash-primary-hover)] disabled:opacity-60"
				>
					<FontAwesomeIcon icon={faRotate} class="h-3 w-3" />
					{sweeping ? 'Queueing…' : 'Sweep now'}
				</button>
			</form>
		</div>
		<div class="mt-1 flex flex-wrap gap-3 text-sm text-[var(--dash-text-secondary)]">
			{#if careersUrl}
				<ExternalLink
					href={careersUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1 hover:text-[var(--dash-primary)] hover:underline"
				>
					<FontAwesomeIcon icon={faExternalLinkAlt} class="h-3 w-3" />
					Careers page
				</ExternalLink>
			{/if}
			{#if data.platform}
				<a
					href={resolve('/(app)/admin/job-platforms/[id]', { id: String(data.platform.id) })}
					class="hover:text-[var(--dash-primary)] hover:underline">Platform: {data.platform.name}</a
				>
			{/if}
			<span>Source: {data.board.source}</span>
		</div>
	</div>

	{#if form?.error}
		<div
			class="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
		>
			<FontAwesomeIcon icon={faTriangleExclamation} class="h-4 w-4" />
			{form.error}
		</div>
	{:else if form?.message}
		<div
			class="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200"
		>
			{form.message}
		</div>
	{/if}

	<dl class="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
		{#each facts as [label, value] (label)}
			<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-3">
				<dt class="text-xs text-[var(--dash-text-secondary)]">{label}</dt>
				<dd class="mt-1 font-medium text-[var(--dash-text)] tabular-nums">{value}</dd>
			</div>
		{/each}
	</dl>

	{#if data.board.last_error}
		<div
			class="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
		>
			Last error: <span class="font-mono text-xs">{data.board.last_error}</span>
		</div>
	{/if}

	<section class="space-y-2">
		<h2 class="text-lg font-medium text-[var(--dash-text)]">Postings</h2>
		<p class="text-xs text-[var(--dash-text-muted)]">
			Open first, newest first; the first {data.postingsLimit}. A posting with a job was promoted by
			a feed task.
		</p>
		<div
			class="overflow-x-auto rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)]"
		>
			<table class="w-full text-sm">
				<thead
					class="bg-[var(--dash-bg)] text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase"
				>
					<tr>
						<th class="px-3 py-2 text-left">Title</th>
						<th class="px-3 py-2 text-left">Where</th>
						<th class="px-3 py-2 text-left">Posted</th>
						<th class="px-3 py-2 text-left">First seen</th>
						<th class="px-3 py-2 text-left">Closed</th>
						<th class="px-3 py-2 text-left">Job</th>
					</tr>
				</thead>
				<tbody>
					{#each data.postings as p (p.id)}
						<tr class="border-t border-[var(--dash-border)] {p.closed_at ? 'opacity-60' : ''}">
							<td class="px-3 py-2">
								<ExternalLink
									href={p.source_url}
									target="_blank"
									rel="noopener noreferrer"
									class="text-[var(--dash-primary)] hover:underline">{p.title}</ExternalLink
								>
							</td>
							<td class="px-3 py-2 text-xs text-[var(--dash-text-secondary)]">
								{p.location_text ?? ''}
								{#if p.country_codes.length}
									<span class="text-[var(--dash-text-muted)]">({p.country_codes.join(', ')})</span>
								{/if}
								{#if p.work_location}
									<span class="text-[var(--dash-text-muted)]">· {p.work_location}</span>
								{/if}
							</td>
							<td class="px-3 py-2 text-xs whitespace-nowrap text-[var(--dash-text-secondary)]"
								>{p.published_at ? timeAgo(p.published_at) : ''}</td
							>
							<td class="px-3 py-2 text-xs whitespace-nowrap text-[var(--dash-text-secondary)]"
								>{timeAgo(p.first_seen_at)}</td
							>
							<td class="px-3 py-2 text-xs whitespace-nowrap text-[var(--dash-text-secondary)]"
								>{p.closed_at ? timeAgo(p.closed_at) : ''}</td
							>
							<td class="px-3 py-2 text-xs whitespace-nowrap">
								{#if p.job_id}
									<a
										href={resolve('/(app)/jobs/[id]', { id: String(p.job_id) })}
										class="text-[var(--dash-primary)] hover:underline">#{p.job_id}</a
									>
								{/if}
							</td>
						</tr>
					{/each}
					{#if data.postings.length === 0}
						<tr class="border-t border-[var(--dash-border)]">
							<td colspan="6" class="px-3 py-6 text-center text-[var(--dash-text-muted)]"
								>No postings stored for this board.</td
							>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	</section>
</div>
