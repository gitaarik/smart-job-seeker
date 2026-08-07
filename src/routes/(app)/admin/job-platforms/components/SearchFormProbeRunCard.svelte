<script lang="ts">
	/**
	 * Renders one discovery run's body: status header, action bar, logs,
	 * findings summary. Used twice:
	 *  - The standalone run detail page renders this full-width with its own
	 *    page chrome around it.
	 *  - The per-platform discovery page renders one per run row, lazy-loading
	 *    logs only when the row is expanded.
	 *
	 * The component manages its own polling lifecycle so the parent only has
	 * to decide *when* to mount/unmount it (e.g. inside an `{#if expanded}`).
	 *
	 * Findings shape is the new search-form probe output:
	 * `{ entry_map, results_map, post_submit_url, configure_warnings, notes }`.
	 * The old URL-template / filter-preset apply form is gone — the scraper
	 * now drives the search UI directly every run, so there's nothing to
	 * "promote into a preset" from a discovery run.
	 */
	import { onMount, onDestroy } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck, faCloud, faCopy, faDesktop } from '@fortawesome/free-solid-svg-icons';
	import BrowserViewModal from './BrowserViewModal.svelte';

	type DiscoveryRun = {
		id: number;
		platform_id: number;
		target_url: string;
		status: string;
		started_at: Date | string;
		finished_at: Date | string | null;
		error_message: string | null;
		triggered_by_user_id: string | null;
		platform_credential_id: number | null;
		sjsbrowser_api_key_id: number | null;
		bullmq_job_id: string | null;
		live_url: string | null;
		findings: {
			platform_name?: string;
			platform_key?: string;
			search_page_url?: string | null;
			post_submit_url?: string;
			entry_map?: unknown;
			results_map?: unknown;
			configure_warnings?: string[];
			notes?: string[];
		} | null;
		applied_at: Date | string | null;
		applied_platform_id: number | null;
	};

	type LogLine = {
		id: number;
		discovery_run_id: number;
		level: string;
		message: string;
		timestamp: Date | string;
	};

	interface Props {
		initialRun: DiscoveryRun;
		initialLogs?: LogLine[];
		platformName?: string | null;
		/** Hide the inline "Open browser view" button. Used by the per-platform
		 *  discovery page, where the status box at the top owns the button so we
		 *  don't show two of them for the latest run. */
		hideBrowserView?: boolean;
		credentialLabel: (id: number | null) => string;
		deviceLabel: (apiKeyId: number | null) => string | null;
	}

	let {
		initialRun,
		initialLogs = [],
		platformName: _platformName = null,
		hideBrowserView = false,
		credentialLabel,
		deviceLabel
	}: Props = $props();

	let run = $state<DiscoveryRun>(initialRun);
	let logs = $state<LogLine[]>(initialLogs);
	let logsLoaded = $state(initialLogs.length > 0);
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let showBrowser = $state(false);
	let copied = $state(false);
	let cancelling = $state(false);
	let cancelError = $state<string | null>(null);

	const canViewBrowser = $derived(Boolean(run.live_url) || Boolean(run.sjsbrowser_api_key_id));

	function isTerminal(status: string) {
		return ['success', 'error', 'cancelled'].includes(status);
	}

	async function copyId() {
		try {
			await navigator.clipboard.writeText(String(run.id));
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// clipboard may be blocked
		}
	}

	async function cancelRun() {
		if (!confirm('Cancel this discovery run?')) return;
		cancelling = true;
		cancelError = null;
		try {
			const res = await fetch(`/api/admin/search-form-probe/${run.id}/cancel`, {
				method: 'POST'
			});
			if (!res.ok) {
				cancelError = (await res.text()) || `HTTP ${res.status}`;
			}
			await poll();
		} finally {
			cancelling = false;
		}
	}

	async function poll() {
		const sinceId = logs.length > 0 ? logs[logs.length - 1].id : 0;
		const res = await fetch(`/api/admin/search-form-probe/${run.id}?since=${sinceId}`);
		if (!res.ok) return;
		const fresh = await res.json();
		run = fresh.run;
		logsLoaded = true;
		if (fresh.logs.length > 0) logs = [...logs, ...fresh.logs];
		if (isTerminal(run.status) && pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
	}

	onMount(() => {
		if (!logsLoaded) poll();
		if (!isTerminal(run.status)) pollTimer = setInterval(poll, 2000);
	});
	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
	});

	function statusColor(s: string) {
		if (s === 'success') return 'text-green-600 dark:text-green-400';
		if (s === 'error') return 'text-red-600 dark:text-red-400';
		if (s === 'running' || s === 'queued') return 'text-blue-600 dark:text-blue-400';
		return 'text-[var(--dash-text-muted)]';
	}

	function levelColor(level: string) {
		if (level === 'error') return 'text-red-600 dark:text-red-400';
		if (level === 'warn') return 'text-amber-600 dark:text-amber-400';
		if (level === 'debug') return 'text-[var(--dash-text-muted)]';
		return 'text-[var(--dash-text)]';
	}

	const devName = $derived(deviceLabel(run.sjsbrowser_api_key_id));
	const findings = $derived(run.findings ?? {});
</script>

<div class="space-y-6">
	<div class="space-y-1">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="min-w-0">
				<p class="truncate font-mono text-xs text-[var(--dash-text-muted)]">
					{run.target_url}
				</p>
				<div class="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--dash-text-muted)]">
					<span class="font-mono">#{run.id}</span>
					<button
						type="button"
						onclick={copyId}
						class="inline-flex cursor-pointer items-center gap-1 p-0.5 transition-colors hover:text-[var(--dash-primary)]"
						aria-label="Copy run ID"
					>
						<FontAwesomeIcon
							icon={copied ? faCheck : faCopy}
							class="h-3 w-3 {copied ? 'text-green-600' : ''}"
						/>
						{#if copied}
							<span class="text-green-600">Copied!</span>
						{/if}
					</button>
					<span>·</span>
					<span>Started {new Date(run.started_at).toLocaleString()}</span>
					<span>·</span>
					<span
						>Credential: <span class="text-[var(--dash-text)]"
							>{credentialLabel(run.platform_credential_id)}</span
						></span
					>
					{#if devName}
						<span>·</span>
						<span>Device: <span class="text-[var(--dash-text)]">{devName}</span></span>
					{/if}
				</div>
			</div>
			<span class="text-sm font-medium {statusColor(run.status)}">{run.status}</span>
		</div>
		{#if run.error_message}
			<p class="text-xs text-red-600 dark:text-red-400">{run.error_message}</p>
		{/if}
	</div>

	<div class="flex flex-wrap items-center gap-2">
		{#if !hideBrowserView && canViewBrowser}
			<button
				type="button"
				onclick={() => (showBrowser = true)}
				class="inline-flex items-center gap-1.5 rounded border border-[var(--dash-border)] px-3 py-1.5 text-xs hover:bg-[var(--dash-bg)]"
			>
				<FontAwesomeIcon icon={run.live_url ? faCloud : faDesktop} class="h-3 w-3" />
				Open browser view
			</button>
		{/if}
		{#if !isTerminal(run.status) && run.status !== 'cancelling'}
			<button
				type="button"
				onclick={cancelRun}
				disabled={cancelling}
				class="rounded border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
				>{cancelling ? 'Cancelling…' : 'Cancel run'}</button
			>
		{/if}
		{#if run.status === 'cancelling'}
			<span class="text-xs text-amber-600 dark:text-amber-400">
				Cancellation requested — waiting for worker to abort…
			</span>
		{/if}
		{#if cancelError}
			<span class="text-xs text-red-600 dark:text-red-400">{cancelError}</span>
		{/if}
	</div>

	<section class="space-y-2">
		<h3 class="text-xs font-medium tracking-wide text-[var(--dash-text-muted)] uppercase">Logs</h3>
		<div
			class="max-h-[40vh] overflow-y-auto rounded border border-[var(--dash-border)] bg-black/90 p-3 font-mono text-xs text-white"
		>
			{#each logs as line (line.id)}
				<div class="flex gap-2">
					<span class="shrink-0 text-[var(--dash-text-muted)]">
						{new Date(line.timestamp).toLocaleTimeString()}
					</span>
					<span class="shrink-0 uppercase {levelColor(line.level)}">{line.level}</span>
					<span class="text-white">{line.message}</span>
				</div>
			{:else}
				<p class="text-[var(--dash-text-muted)]">No logs yet.</p>
			{/each}
		</div>
	</section>

	{#if run.findings && Object.keys(run.findings).length > 0}
		<section class="space-y-3">
			<h3 class="text-xs font-medium tracking-wide text-[var(--dash-text-muted)] uppercase">
				Findings
			</h3>
			<div
				class="space-y-3 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4 text-sm"
			>
				<dl class="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[max-content_1fr]">
					{#if findings.platform_name}
						<dt class="pt-0.5 text-xs font-medium text-[var(--dash-text-secondary)] sm:text-right">
							Platform
						</dt>
						<dd class="text-[var(--dash-text)]">{findings.platform_name}</dd>
					{/if}
					{#if findings.search_page_url}
						<dt class="pt-0.5 text-xs font-medium text-[var(--dash-text-secondary)] sm:text-right">
							Search page
						</dt>
						<dd class="min-w-0">
							<a
								href={findings.search_page_url}
								target="_blank"
								rel="noopener noreferrer"
								class="font-mono text-xs break-all text-[var(--dash-primary)] hover:underline"
								>{findings.search_page_url}</a
							>
						</dd>
					{/if}
					{#if findings.post_submit_url}
						<dt class="pt-0.5 text-xs font-medium text-[var(--dash-text-secondary)] sm:text-right">
							After submit
						</dt>
						<dd class="min-w-0">
							<code class="font-mono text-xs break-all text-[var(--dash-text)]"
								>{findings.post_submit_url}</code
							>
						</dd>
					{/if}
				</dl>

				{#if (findings.configure_warnings?.length ?? 0) > 0}
					<div class="border-t border-[var(--dash-border)] pt-2">
						<p class="mb-1 text-xs font-medium text-amber-700 dark:text-amber-400">Warnings</p>
						<ul class="list-disc space-y-0.5 pl-5 text-xs text-[var(--dash-text-secondary)]">
							{#each findings.configure_warnings! as w (w)}
								<li>{w}</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if (findings.notes?.length ?? 0) > 0}
					<div class="border-t border-[var(--dash-border)] pt-2">
						<p class="mb-1 text-xs font-medium text-[var(--dash-text-secondary)]">Notes</p>
						<ul class="list-disc space-y-0.5 pl-5 text-xs text-[var(--dash-text-secondary)]">
							{#each findings.notes! as note (note)}
								<li>{note}</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if findings.entry_map || findings.results_map}
					<details class="border-t border-[var(--dash-border)] pt-2">
						<summary class="cursor-pointer text-xs font-medium text-[var(--dash-text-secondary)]">
							Raw form maps (debug)
						</summary>
						<pre
							class="mt-2 max-h-96 overflow-auto font-mono text-[10px] text-[var(--dash-text-muted)]"><code
								>{JSON.stringify(
									{ entry_map: findings.entry_map, results_map: findings.results_map },
									null,
									2
								)}</code
							></pre>
					</details>
				{/if}
			</div>
		</section>
	{/if}
</div>

{#if !hideBrowserView}
	<BrowserViewModal
		bind:open={showBrowser}
		liveUrl={run.live_url}
		apiKeyId={run.sjsbrowser_api_key_id}
		deviceName={deviceLabel(run.sjsbrowser_api_key_id)}
	/>
{/if}
