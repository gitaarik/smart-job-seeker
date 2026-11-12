<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import { timeAgo } from '$lib/format';
	import {
		ATS_BOARD_STATUS_LABEL,
		ATS_BOARD_STATUSES,
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

	let sweeping = $state<string | null>(null);

	const totals = $derived({
		live: data.providers.reduce((n, p) => n + p.live, 0),
		open: data.providers.reduce((n, p) => n + p.open_postings, 0),
		open30d: data.providers.reduce((n, p) => n + p.open_30d, 0)
	});

	const fmt = (n: number) => n.toLocaleString('en-US');

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

	function statusLabel(status: string): string {
		return ATS_BOARD_STATUS_LABEL[status as AtsBoardStatus] ?? status;
	}

	const inputClass =
		'rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)]';
	const buttonClass =
		'inline-flex items-center gap-1.5 rounded border border-[var(--dash-border)] px-2 py-1 text-xs text-[var(--dash-text)] hover:bg-[var(--dash-bg)] disabled:opacity-50';
</script>

<svelte:head>
	<title>Career-site feeds - Admin - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<a
			href={resolve('/(app)/admin/job-platforms')}
			class="inline-flex items-center gap-1 text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
		>
			<FontAwesomeIcon icon={faArrowLeft} class="h-3 w-3" />
			Job platforms
		</a>
		<div class="mt-2 flex flex-wrap items-center justify-between gap-3">
			<h1 class="text-2xl font-semibold text-[var(--dash-text)]">Career-site feeds</h1>
			<p class="text-sm text-[var(--dash-text-secondary)] tabular-nums">
				{fmt(totals.live)} live boards · {fmt(totals.open)} open postings · {fmt(totals.open30d)} posted
				in the last 30 days
			</p>
		</div>
		<p class="mt-2 text-sm text-[var(--dash-text-secondary)]">
			One board per company hiring through an applicant tracking system. The worker fetches every
			live board once a night and keeps the postings in a corpus the feed platforms search; a
			board's row is its health record. "Sweep now" puts the boards on the worker's queue; the
			worker checks its free disk and prunes old postings first.
		</p>
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

	<!-- Providers -->
	<div class="overflow-x-auto rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)]">
		<table class="w-full text-sm">
			<thead
				class="bg-[var(--dash-bg)] text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase"
			>
				<tr>
					<th class="px-3 py-2 text-left">Provider</th>
					<th class="px-3 py-2 text-right">Live</th>
					<th class="px-3 py-2 text-right">Throttled</th>
					<th class="px-3 py-2 text-right">Gone</th>
					<th class="px-3 py-2 text-right">Closed</th>
					<th class="px-3 py-2 text-right">Open postings</th>
					<th class="px-3 py-2 text-right">Last 30 days</th>
					<th class="px-3 py-2 text-left">Last sweep</th>
					<th class="px-3 py-2 text-right"></th>
				</tr>
			</thead>
			<tbody>
				{#each data.providers as p (p.provider)}
					<tr class="border-t border-[var(--dash-border)]">
						<td class="px-3 py-2 font-medium">
							{#if p.platform_id !== null}
								<a
									href={resolve('/(app)/admin/job-platforms/[id]', { id: String(p.platform_id) })}
									class="text-[var(--dash-primary)] hover:underline">{p.platform_name}</a
								>
							{:else}
								{p.provider}
							{/if}
							<span class="ml-1 font-mono text-xs text-[var(--dash-text-muted)]">{p.provider}</span>
						</td>
						<td class="px-3 py-2 text-right tabular-nums">{fmt(p.live)}</td>
						<td class="px-3 py-2 text-right tabular-nums">{fmt(p.throttled)}</td>
						<td class="px-3 py-2 text-right text-[var(--dash-text-muted)] tabular-nums"
							>{fmt(p.gone)}</td
						>
						<td class="px-3 py-2 text-right text-[var(--dash-text-muted)] tabular-nums"
							>{fmt(p.closed)}</td
						>
						<td class="px-3 py-2 text-right tabular-nums">{fmt(p.open_postings)}</td>
						<td class="px-3 py-2 text-right tabular-nums">{fmt(p.open_30d)}</td>
						<td class="px-3 py-2 text-xs whitespace-nowrap text-[var(--dash-text-secondary)]">
							{#if p.last_fetched_at}
								<span title={new Date(p.last_fetched_at).toLocaleString()}
									>{timeAgo(p.last_fetched_at)}</span
								>
								<span class="text-[var(--dash-text-muted)]">
									· {fmt(p.fetched_24h)} of {fmt(p.live + p.throttled)} in 24h</span
								>
							{:else}
								<span class="text-[var(--dash-text-muted)]">never</span>
							{/if}
						</td>
						<td class="px-3 py-2 text-right">
							<form
								method="POST"
								action="?/sweep"
								class="inline"
								use:enhance={() => {
									sweeping = p.provider;
									return async ({ update }) => {
										await update({ reset: false });
										sweeping = null;
									};
								}}
							>
								<input type="hidden" name="provider" value={p.provider} />
								<button type="submit" class={buttonClass} disabled={sweeping !== null}>
									<FontAwesomeIcon icon={faRotate} class="h-3 w-3" />
									{sweeping === p.provider ? 'Queueing…' : 'Sweep now'}
								</button>
							</form>
						</td>
					</tr>
				{/each}
				{#if data.providers.length === 0}
					<tr class="border-t border-[var(--dash-border)]">
						<td colspan="9" class="px-3 py-6 text-center text-[var(--dash-text-muted)]">
							No boards yet. Seed them with <code>npm run ats:seed</code> from cloud.
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>

	<div class="flex flex-wrap items-center gap-4 text-sm text-[var(--dash-text-secondary)]">
		<span>
			Queue:
			{#if data.queue}
				<span class="tabular-nums">
					{fmt(data.queue.waiting)} waiting · {fmt(data.queue.active)} active · {fmt(
						data.queue.delayed
					)} delayed · {fmt(data.queue.failed)} failed
				</span>
			{:else}
				<span class="text-red-600 dark:text-red-400">not reachable</span>
			{/if}
		</span>
		<form
			method="POST"
			action="?/sweep"
			class="inline"
			use:enhance={() => {
				sweeping = 'all';
				return async ({ update }) => {
					await update({ reset: false });
					sweeping = null;
				};
			}}
		>
			<button type="submit" class={buttonClass} disabled={sweeping !== null}>
				<FontAwesomeIcon icon={faRotate} class="h-3 w-3" />
				{sweeping === 'all' ? 'Queueing…' : 'Sweep every provider now'}
			</button>
		</form>
	</div>

	<!-- Recent errors -->
	<section class="space-y-2">
		<h2 class="text-lg font-medium text-[var(--dash-text)]">Recent errors</h2>
		<p class="text-xs text-[var(--dash-text-muted)]">
			Live and throttled boards whose last fetch failed. A board that answered 404 is retired as
			gone and not listed here.
		</p>
		{#if data.recentErrors.length === 0}
			<p class="text-sm text-[var(--dash-text-muted)]">None.</p>
		{:else}
			<div
				class="overflow-x-auto rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)]"
			>
				<table class="w-full text-sm">
					<thead
						class="bg-[var(--dash-bg)] text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase"
					>
						<tr>
							<th class="px-3 py-2 text-left">Board</th>
							<th class="px-3 py-2 text-left">Status</th>
							<th class="px-3 py-2 text-right">Failures</th>
							<th class="px-3 py-2 text-left">When</th>
							<th class="px-3 py-2 text-left">Error</th>
						</tr>
					</thead>
					<tbody>
						{#each data.recentErrors as b (b.id)}
							<tr class="border-t border-[var(--dash-border)]">
								<td class="px-3 py-2 whitespace-nowrap">
									<a
										href={resolve('/(app)/admin/job-platforms/feeds/[boardId]', {
											boardId: String(b.id)
										})}
										class="text-[var(--dash-primary)] hover:underline">{b.provider}/{b.slug}</a
									>
								</td>
								<td class="px-3 py-2">
									<span
										class="inline-flex items-center rounded px-2 py-0.5 text-xs {statusClass(
											b.status
										)}">{statusLabel(b.status)}</span
									>
								</td>
								<td class="px-3 py-2 text-right tabular-nums">{b.consecutive_failures}</td>
								<td class="px-3 py-2 text-xs whitespace-nowrap text-[var(--dash-text-secondary)]"
									>{timeAgo(b.last_fetched_at)}</td
								>
								<td class="px-3 py-2 font-mono text-xs text-[var(--dash-text-secondary)]"
									>{b.last_error}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<!-- Boards -->
	<section class="space-y-2">
		<h2 class="text-lg font-medium text-[var(--dash-text)]">Boards</h2>
		<form method="GET" class="flex flex-wrap items-end gap-2">
			<div>
				<label class="mb-1 block text-xs text-[var(--dash-text-secondary)]" for="q"
					>Slug or company</label
				>
				<input
					id="q"
					name="q"
					type="search"
					value={data.filters.q}
					class={inputClass}
					placeholder="stripe"
				/>
			</div>
			<div>
				<label class="mb-1 block text-xs text-[var(--dash-text-secondary)]" for="provider"
					>Provider</label
				>
				<select id="provider" name="provider" class={inputClass} value={data.filters.provider}>
					<option value="">any</option>
					{#each data.providers as p (p.provider)}
						<option value={p.provider}>{p.provider}</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="mb-1 block text-xs text-[var(--dash-text-secondary)]" for="status"
					>Status</label
				>
				<select id="status" name="status" class={inputClass} value={data.filters.status}>
					<option value="">any</option>
					{#each ATS_BOARD_STATUSES as s (s)}
						<option value={s}>{ATS_BOARD_STATUS_LABEL[s]}</option>
					{/each}
				</select>
			</div>
			<button type="submit" class="{buttonClass} py-1.5">Filter</button>
		</form>
		<p class="text-xs text-[var(--dash-text-muted)]">
			The first {data.boardListLimit} by posting count. Click a board for its postings and its own "sweep
			now".
		</p>
		<div
			class="overflow-x-auto rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)]"
		>
			<table class="w-full text-sm">
				<thead
					class="bg-[var(--dash-bg)] text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase"
				>
					<tr>
						<th class="px-3 py-2 text-left">Board</th>
						<th class="px-3 py-2 text-left">Company</th>
						<th class="px-3 py-2 text-left">Status</th>
						<th class="px-3 py-2 text-right">Postings</th>
						<th class="px-3 py-2 text-left">Last fetch</th>
						<th class="px-3 py-2 text-left">Source</th>
					</tr>
				</thead>
				<tbody>
					{#each data.boards as b (b.id)}
						<tr class="border-t border-[var(--dash-border)]">
							<td class="px-3 py-2 whitespace-nowrap">
								<a
									href={resolve('/(app)/admin/job-platforms/feeds/[boardId]', {
										boardId: String(b.id)
									})}
									class="text-[var(--dash-primary)] hover:underline">{b.provider}/{b.slug}</a
								>
								{#if atsCareersUrl(b.provider, b.slug)}
									<ExternalLink
										href={atsCareersUrl(b.provider, b.slug) ?? ''}
										target="_blank"
										rel="noopener noreferrer"
										class="ml-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)]"
										title="Open the careers page"
									>
										<FontAwesomeIcon icon={faExternalLinkAlt} class="h-3 w-3" />
									</ExternalLink>
								{/if}
							</td>
							<td class="px-3 py-2 text-[var(--dash-text-secondary)]">{b.company_name ?? ''}</td>
							<td class="px-3 py-2">
								<span
									class="inline-flex items-center rounded px-2 py-0.5 text-xs {statusClass(
										b.status
									)}">{statusLabel(b.status)}</span
								>
							</td>
							<td class="px-3 py-2 text-right tabular-nums">{fmt(b.posting_count)}</td>
							<td class="px-3 py-2 text-xs whitespace-nowrap text-[var(--dash-text-secondary)]">
								{#if b.last_fetched_at}
									{timeAgo(b.last_fetched_at)}
									{#if b.last_error}
										<span class="text-red-600 dark:text-red-400" title={b.last_error}>· failed</span
										>
									{/if}
								{:else}
									<span class="text-[var(--dash-text-muted)]">never</span>
								{/if}
							</td>
							<td class="px-3 py-2 text-xs text-[var(--dash-text-muted)]">{b.source}</td>
						</tr>
					{/each}
					{#if data.boards.length === 0}
						<tr class="border-t border-[var(--dash-border)]">
							<td colspan="6" class="px-3 py-6 text-center text-[var(--dash-text-muted)]"
								>No boards match.</td
							>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	</section>
</div>
