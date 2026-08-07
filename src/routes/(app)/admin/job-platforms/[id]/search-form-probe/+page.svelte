<script lang="ts">
	import type { PageData } from './$types';
	import { onDestroy, onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faCheck,
		faChevronDown,
		faChevronRight,
		faClock,
		faCloud,
		faDesktop,
		faExclamationTriangle,
		faPlay,
		faStop,
		faTimes,
		faTriangleExclamation
	} from '@fortawesome/free-solid-svg-icons';
	import Spinner from '$lib/components/Spinner.svelte';
	import CredentialSelector from '../../../../jobs/components/CredentialSelector.svelte';
	import SearchFormProbeRunCard from '../../components/SearchFormProbeRunCard.svelte';
	import BrowserViewModal from '../../components/BrowserViewModal.svelte';

	let { data }: { data: PageData } = $props();

	type DiscoveryRun = (typeof data.runs)[number];

	// Scraper options state. Default credential + device come from whatever
	// the most recent run used, falling back to the first available cred. The
	// user can change them on the page; clicking Start bakes the current
	// selection into the new run.
	const initialMostRecentRun = data.runs[0] ?? null;
	let credentials = $state(data.credentials);
	let selectedCredentialId = $state<string>(
		initialMostRecentRun?.platform_credential_id != null &&
			data.credentials.some((c) => c.id === initialMostRecentRun.platform_credential_id)
			? String(initialMostRecentRun.platform_credential_id)
			: data.credentials[0]
				? String(data.credentials[0].id)
				: ''
	);
	let loginMode = $state('auto');
	let selectedDeviceId = $state<string>(
		initialMostRecentRun?.sjsbrowser_api_key_id != null
			? String(initialMostRecentRun.sjsbrowser_api_key_id)
			: ''
	);

	// Featured run = the one driving the status box. Starts as the most
	// recent run from the server snapshot; replaced when the user clicks
	// Start. Polled while non-terminal so the status updates live.
	let featuredRun = $state<DiscoveryRun | null>(initialMostRecentRun);
	let featuredPollTimer: ReturnType<typeof setInterval> | null = null;

	let starting = $state(false);
	let startError = $state<string | null>(null);
	let cancelling = $state(false);
	let cancelError = $state<string | null>(null);
	let browserViewOpen = $state(false);

	// Run history: pre-expand the most recent run so the page is useful on
	// first load. Each row toggles independently after that.
	let expandedRunIds = $state<Set<number>>(
		new Set(initialMostRecentRun ? [initialMostRecentRun.id] : [])
	);

	function toggleRun(runId: number) {
		if (expandedRunIds.has(runId)) {
			expandedRunIds.delete(runId);
		} else {
			expandedRunIds.add(runId);
		}
		expandedRunIds = new Set(expandedRunIds);
	}

	function isTerminal(status: string | undefined): boolean {
		return ['success', 'error', 'cancelled'].includes(status ?? '');
	}

	const isActive = $derived(featuredRun !== null && !isTerminal(featuredRun.status));
	const canStart = $derived(
		Boolean(data.platform.login_page_url) && Boolean(selectedCredentialId) && !isActive && !starting
	);
	const canViewBrowser = $derived(
		featuredRun !== null &&
			isActive &&
			(Boolean(featuredRun.live_url) || Boolean(featuredRun.sjsbrowser_api_key_id))
	);

	async function pollFeaturedRun() {
		if (!featuredRun) return;
		try {
			const res = await fetch(`/api/admin/search-form-probe/${featuredRun.id}`);
			if (!res.ok) return;
			const json = await res.json();
			featuredRun = json.run;
			if (isTerminal(featuredRun?.status) && featuredPollTimer) {
				clearInterval(featuredPollTimer);
				featuredPollTimer = null;
				// Reload the runs list so the history reflects the new terminal state.
				invalidateAll();
			}
		} catch {
			// Retry next tick.
		}
	}

	function startFeaturedPolling() {
		if (featuredPollTimer || !featuredRun || isTerminal(featuredRun.status)) {
			return;
		}
		featuredPollTimer = setInterval(pollFeaturedRun, 2000);
	}

	onMount(() => {
		startFeaturedPolling();
	});
	onDestroy(() => {
		if (featuredPollTimer) clearInterval(featuredPollTimer);
	});

	async function startDiscovery() {
		if (!canStart) return;
		starting = true;
		startError = null;
		try {
			const res = await fetch('/api/admin/search-form-probe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					platform_id: data.platform.id,
					platform_credential_id: Number(selectedCredentialId),
					sjsbrowser_api_key_id: selectedDeviceId ? Number(selectedDeviceId) : null
				})
			});
			if (!res.ok) {
				startError = (await res.text()) || `HTTP ${res.status}`;
				return;
			}
			const json = await res.json();
			featuredRun = json.run;
			// Auto-expand the new run in the history.
			expandedRunIds = new Set([json.run.id, ...expandedRunIds]);
			await invalidateAll();
			startFeaturedPolling();
		} finally {
			starting = false;
		}
	}

	async function cancelRun() {
		if (!featuredRun || !confirm('Cancel this discovery run?')) return;
		cancelling = true;
		cancelError = null;
		try {
			const res = await fetch(`/api/admin/search-form-probe/${featuredRun.id}/cancel`, {
				method: 'POST'
			});
			if (!res.ok) {
				cancelError = (await res.text()) || `HTTP ${res.status}`;
				return;
			}
			await pollFeaturedRun();
		} finally {
			cancelling = false;
		}
	}

	function statusBoxIconClasses(s: string | undefined) {
		if (s === 'success') {
			return {
				bg: 'bg-green-500/15 dark:bg-green-500/20',
				text: 'text-green-600 dark:text-green-400'
			};
		}
		if (s === 'error') {
			return {
				bg: 'bg-red-500/15 dark:bg-red-500/20',
				text: 'text-red-600 dark:text-red-400'
			};
		}
		if (s === 'running' || s === 'queued' || s === 'cancelling') {
			return {
				bg: 'bg-blue-500/15 dark:bg-blue-500/20',
				text: 'text-blue-600 dark:text-blue-400'
			};
		}
		if (s === 'cancelled') {
			return {
				bg: 'bg-[var(--dash-bg)]',
				text: 'text-[var(--dash-text-muted)]'
			};
		}
		return {
			bg: 'bg-[var(--dash-bg)]',
			text: 'text-[var(--dash-text-muted)]'
		};
	}

	function statusHeading(run: DiscoveryRun | null): string {
		if (!run) return 'Ready to run';
		if (run.status === 'queued') return 'Queued';
		if (run.status === 'running') return 'Running…';
		if (run.status === 'cancelling') return 'Cancelling…';
		if (run.status === 'success') return 'Completed';
		if (run.status === 'error') return 'Failed';
		if (run.status === 'cancelled') return 'Cancelled';
		return run.status;
	}

	function statusSubtext(run: DiscoveryRun | null): string {
		if (!run) {
			return 'No runs yet — pick a credential below and start a discovery.';
		}
		const when = new Date(run.started_at).toLocaleString();
		if (run.status === 'queued') return `Run #${run.id} · waiting for worker since ${when}`;
		if (run.status === 'running') return `Run #${run.id} · started ${when}`;
		if (run.status === 'cancelling') return `Run #${run.id} · waiting for worker to abort`;
		if (run.status === 'error' && run.error_message) {
			return run.error_message;
		}
		return `Run #${run.id} · started ${when}`;
	}

	function statusListColor(s: string) {
		if (s === 'success') return 'text-green-600 dark:text-green-400';
		if (s === 'error') return 'text-red-600 dark:text-red-400';
		if (s === 'running' || s === 'queued' || s === 'cancelling') {
			return 'text-blue-600 dark:text-blue-400';
		}
		if (s === 'cancelled') return 'text-[var(--dash-text-muted)]';
		return 'text-[var(--dash-text-muted)]';
	}

	const iconClasses = $derived(statusBoxIconClasses(featuredRun?.status));

	function credentialLabel(id: number | null): string {
		if (id == null) return '(no credential)';
		const cred = data.credentials.find((c) => c.id === id);
		if (!cred) return `#${id}`;
		return cred.username ?? '(no username)';
	}

	function deviceLabel(apiKeyId: number | null): string | null {
		if (apiKeyId == null) return null;
		const dev = data.devices.find((d) => d.apiKeyId === apiKeyId);
		return dev?.apiKeyName ?? `#${apiKeyId}`;
	}
</script>

<svelte:head>
	<title>Discovery — {data.platform.name} — Admin</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6 p-6">
	<div class="space-y-1">
		<a
			href="/admin/job-platforms/{data.platform.id}"
			class="inline-flex items-center gap-1 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)]"
		>
			<FontAwesomeIcon icon={faArrowLeft} class="h-3 w-3" />
			Back to {data.platform.name}
		</a>
		<h1 class="text-2xl font-semibold text-[var(--dash-text)]">
			{data.platform.name} discovery
		</h1>
		<p class="text-sm text-[var(--dash-text-secondary)]">
			Run the discovery scraper to auto-detect this platform's search URL template + filter
			parameters. Discovery logs in first (so it can reach gated listings), then probes the search
			form and filter widgets.
		</p>
	</div>

	{#if !data.platform.login_page_url}
		<div
			class="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
		>
			<FontAwesomeIcon icon={faTriangleExclamation} class="mt-0.5 h-4 w-4 shrink-0" />
			<div>
				<p class="font-medium">Platform has no login page URL.</p>
				<p class="mt-1">
					Discovery requires login, so we need to know where the login form is.
					<a href="/admin/job-platforms/{data.platform.id}" class="font-medium underline"
						>Set it on the platform</a
					>
					first, then come back here.
				</p>
			</div>
		</div>
	{/if}

	<!-- Status box: status of the current/new run + Start / Cancel / Browser view. -->
	<section
		class="space-y-3 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4"
	>
		<div class="flex min-w-0 items-start gap-4">
			<div
				class="h-10 w-10 rounded-full {iconClasses.bg} flex shrink-0 items-center justify-center"
			>
				{#if featuredRun?.status === 'running'}
					<Spinner size="w-5 h-5" color="var(--dash-primary)" />
				{:else if featuredRun?.status === 'queued'}
					<FontAwesomeIcon icon={faClock} class="h-5 w-5 {iconClasses.text}" />
				{:else if featuredRun?.status === 'cancelling'}
					<Spinner size="w-5 h-5" color="var(--dash-primary)" />
				{:else if featuredRun?.status === 'success'}
					<FontAwesomeIcon icon={faCheck} class="h-5 w-5 {iconClasses.text}" />
				{:else if featuredRun?.status === 'error'}
					<FontAwesomeIcon icon={faTimes} class="h-5 w-5 {iconClasses.text}" />
				{:else if featuredRun?.status === 'cancelled'}
					<FontAwesomeIcon icon={faStop} class="h-5 w-5 {iconClasses.text}" />
				{:else}
					<FontAwesomeIcon icon={faPlay} class="h-5 w-5 text-[var(--dash-text-secondary)]" />
				{/if}
			</div>

			<div class="min-w-0 flex-1">
				<p class="font-medium text-[var(--dash-text)]">
					{statusHeading(featuredRun)}
				</p>
				<p class="text-sm break-words text-[var(--dash-text-secondary)]">
					{statusSubtext(featuredRun)}
				</p>
				{#if featuredRun}
					<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
						Credential: <span class="text-[var(--dash-text)]"
							>{credentialLabel(featuredRun.platform_credential_id)}</span
						>
						{#if featuredRun.sjsbrowser_api_key_id}
							· Device: <span class="text-[var(--dash-text)]"
								>{deviceLabel(featuredRun.sjsbrowser_api_key_id) ??
									`#${featuredRun.sjsbrowser_api_key_id}`}</span
							>
						{/if}
					</p>
				{/if}
			</div>

			<div class="flex shrink-0 items-center gap-2">
				{#if canViewBrowser && featuredRun}
					<button
						type="button"
						onclick={() => (browserViewOpen = true)}
						class="inline-flex items-center gap-1.5 rounded border border-[var(--dash-border)] px-3 py-1.5 text-sm hover:bg-[var(--dash-bg)]"
					>
						<FontAwesomeIcon
							icon={featuredRun.live_url ? faCloud : faDesktop}
							class="h-3.5 w-3.5"
						/>
						Browser view
					</button>
				{/if}
				{#if isActive && featuredRun?.status !== 'cancelling'}
					<button
						type="button"
						onclick={cancelRun}
						disabled={cancelling}
						class="inline-flex items-center gap-1.5 rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
					>
						<FontAwesomeIcon icon={faStop} class="h-3.5 w-3.5" />
						{cancelling ? 'Cancelling…' : 'Cancel'}
					</button>
				{:else if !isActive}
					<button
						type="button"
						onclick={startDiscovery}
						disabled={!canStart}
						class="inline-flex items-center gap-1.5 rounded bg-[var(--dash-primary)] px-4 py-2 text-sm text-white hover:bg-[var(--dash-primary-hover)] disabled:opacity-60"
					>
						<FontAwesomeIcon icon={faPlay} class="h-3.5 w-3.5" />
						{starting ? 'Queuing…' : featuredRun ? 'Start new run' : 'Start discovery'}
					</button>
				{/if}
			</div>
		</div>

		{#if startError}
			<p class="text-xs text-red-600 dark:text-red-400">{startError}</p>
		{/if}
		{#if cancelError}
			<p class="text-xs text-red-600 dark:text-red-400">{cancelError}</p>
		{/if}
		{#if featuredRun?.status === 'error' && featuredRun.error_message}
			<p class="text-xs break-words text-red-600 dark:text-red-400">
				{featuredRun.error_message}
			</p>
		{/if}
	</section>

	<!-- Scraper options: credentials + device that the next run will use. -->
	<section class="space-y-3">
		<h2 class="text-xs font-medium tracking-wide text-[var(--dash-text-muted)] uppercase">
			Scraper options
		</h2>
		<div class="space-y-4 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4">
			{#if data.profileId !== null}
				<CredentialSelector
					bind:credentials
					bind:selectedId={selectedCredentialId}
					bind:loginMode
					platformId={data.platform.id}
					profileId={data.profileId}
					platformName={data.platform.name}
					hideLoginMode={true}
				/>
			{:else}
				<p class="text-xs text-amber-600 dark:text-amber-400">
					Can't load credential picker — admin user has no profile yet.
				</p>
			{/if}

			<div class="border-t border-[var(--dash-border)] pt-3">
				<label
					class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
					for="discovery-device"
					>Device <span class="font-normal text-[var(--dash-text-muted)]">(optional)</span></label
				>
				<select
					id="discovery-device"
					bind:value={selectedDeviceId}
					class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1.5 text-sm text-[var(--dash-text)]"
				>
					<option value="">(default browser provider)</option>
					{#each data.devices as d (d.apiKeyId)}
						<option value={String(d.apiKeyId)}>{d.apiKeyName}</option>
					{/each}
				</select>
				<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
					Routes the session through your desktop tunnel instead of the hosted browser provider.
				</p>
			</div>
		</div>
	</section>

	<!-- Run history -->
	<section class="space-y-3">
		<h2 class="text-xs font-medium tracking-wide text-[var(--dash-text-muted)] uppercase">
			Run history <span
				class="font-normal tracking-normal text-[var(--dash-text-muted)] normal-case"
				>({data.runs.length})</span
			>
		</h2>
		{#if data.runs.length === 0}
			<div
				class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4 text-sm text-[var(--dash-text-muted)]"
			>
				No discovery runs yet.
			</div>
		{:else}
			<div
				class="divide-y divide-[var(--dash-border)] overflow-hidden rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)]"
			>
				{#each data.runs as run (run.id)}
					{@const devName = deviceLabel(run.sjsbrowser_api_key_id)}
					{@const expanded = expandedRunIds.has(run.id)}
					<div class={expanded ? 'bg-[var(--dash-bg)]/30' : ''}>
						<button
							type="button"
							onclick={() => toggleRun(run.id)}
							class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--dash-bg)]"
							aria-expanded={expanded}
						>
							<div class="flex min-w-0 flex-1 items-start gap-3">
								<FontAwesomeIcon
									icon={expanded ? faChevronDown : faChevronRight}
									class="mt-1 h-3 w-3 shrink-0 text-[var(--dash-text-muted)]"
								/>
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-baseline gap-2">
										<span class="font-mono text-sm text-[var(--dash-text)]">Run #{run.id}</span>
										<span class="text-xs text-[var(--dash-text-muted)]">
											{new Date(run.started_at).toLocaleString()}
										</span>
										{#if run.applied_at}
											<span class="text-xs text-green-600 dark:text-green-400">applied</span>
										{/if}
									</div>
									<div class="mt-0.5 text-xs text-[var(--dash-text-secondary)]">
										{credentialLabel(run.platform_credential_id)}
										{#if devName}
											· {devName}
										{/if}
									</div>
									{#if run.error_message && run.status === 'error'}
										<div class="mt-0.5 truncate text-xs text-red-600 dark:text-red-400">
											{run.error_message}
										</div>
									{/if}
								</div>
							</div>
							<span class="text-xs font-medium {statusListColor(run.status)} shrink-0"
								>{run.status}</span
							>
						</button>
						{#if expanded}
							<div class="border-t border-[var(--dash-border)] px-4 pt-2 pb-4">
								<SearchFormProbeRunCard
									initialRun={run}
									platformName={data.platform.name}
									hideBrowserView={true}
									{credentialLabel}
									{deviceLabel}
								/>
								<p class="mt-3 text-xs text-[var(--dash-text-muted)]">
									<a
										href={`/admin/job-platforms/search-form-probe/${run.id}`}
										class="underline hover:text-[var(--dash-primary)]">Open run page</a
									>
									for a permalink to this run.
								</p>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>

<BrowserViewModal
	bind:open={browserViewOpen}
	liveUrl={featuredRun?.live_url ?? null}
	apiKeyId={featuredRun?.sjsbrowser_api_key_id ?? null}
	deviceName={featuredRun ? deviceLabel(featuredRun.sjsbrowser_api_key_id) : null}
/>
