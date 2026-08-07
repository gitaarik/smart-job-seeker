<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { formatDateTime } from '$lib/format-date';
	import type { TimeFormat } from '$lib/format-date';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faBan,
		faCheck,
		faCheckCircle,
		faChevronDown,
		faChevronRight,
		faClock,
		faExternalLinkAlt,
		faGlobe,
		faHistory,
		faLink,
		faPlay,
		faStop,
		faTimes,
		faTimesCircle
	} from '@fortawesome/free-solid-svg-icons';
	import BrowserView from './BrowserView.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import LogViewer from './LogViewer.svelte';
	import { portalToBody } from '$lib/actions/portal';
	import CountrySelect from '../jobs/components/CountrySelect.svelte';
	import CredentialSelector from '../jobs/components/CredentialSelector.svelte';
	import BrowserProviderToggle from '../jobs/components/BrowserProviderToggle.svelte';

	interface Props {
		jobId: number;
		sourceUrl: string | null;
		platformName: string | null;
		platformCredentials: { id: number; username: string | null }[];
		platformId: number;
		profileId: number;
		selectedCredentialId: string;
		loginUrl: string | null;
		defaultBrowserProvider: string | null;
		defaultKeepMinimized: boolean;
		defaultCountryCode: string;
		browserFingerprint: {
			language: string;
			timezone: string;
		};
		browserFingerprintDefaults: { language: string; timezone: string };
		/** If the job already has an active rescrape, pass "queued" or "scraping" to resume monitoring */
		initialStatus?: string;
		onclose: () => void;
		oncomplete?: () => void;
	}

	let {
		jobId,
		sourceUrl,
		platformName,
		platformCredentials,
		platformId,
		profileId,
		selectedCredentialId: initialCredentialId,
		loginUrl,
		defaultBrowserProvider,
		defaultKeepMinimized,
		defaultCountryCode,
		browserFingerprint,
		browserFingerprintDefaults,
		initialStatus,
		onclose,
		oncomplete
	}: Props = $props();

	interface LogEntry {
		id: number | string;
		level: string;
		message: string;
		timestamp: string;
	}

	interface RescrapeRun {
		id: number;
		status: string;
		started_at: string;
		finished_at: string | null;
		message: string | null;
	}

	// If resuming an active rescrape, skip config and go straight to polling
	const resuming = initialStatus === 'queued' || initialStatus === 'scraping';

	// Config state
	let credentials = $state(platformCredentials);
	let credentialId = $state(initialCredentialId);
	let browserProvider = $state<string | null>(defaultBrowserProvider);
	let keepMinimized = $state(defaultKeepMinimized);
	let countryCode = $state('');
	let browserLanguage = $state(browserFingerprint.language);
	let browserTimezone = $state(browserFingerprint.timezone);
	let showAdvanced = $state(false);
	let started = $state(resuming);

	// Scraping state
	let status = $state<string>(resuming ? initialStatus! : 'idle');
	let message = $state<string>(resuming ? 'Resuming...' : '');
	let liveUrl = $state<string | null>(null);
	let logs = $state<LogEntry[]>([]);
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let lastMessage = '';
	let logIdCounter = 0;
	let isCancelling = $state(false);
	let isActive = $derived(status === 'queued' || status === 'scraping');
	let isComplete = $derived(status === 'completed');
	let isError = $derived(status === 'error');
	let isCancelled = $derived(status === 'cancelled');

	// Run history
	let history = $state<RescrapeRun[]>([]);
	let historyLoaded = $state(false);

	function addLogEntry(msg: string) {
		if (msg === lastMessage || !msg) return;
		lastMessage = msg;
		logs = [
			...logs,
			{
				id: ++logIdCounter,
				level: 'info',
				message: msg,
				timestamp: new Date().toISOString()
			}
		];
	}

	async function triggerRescrape() {
		started = true;
		status = 'queued';
		message = 'Waiting in queue...';

		try {
			const body: Record<string, unknown> = {};
			if (countryCode) body.countryCode = countryCode;
			if (browserLanguage) body.browserLanguage = browserLanguage;
			if (browserTimezone) body.browserTimezone = browserTimezone;
			if (credentialId !== 'none') {
				body.credentialId = parseInt(credentialId);
			}
			if (browserProvider !== null) body.browserProvider = browserProvider;
			if (browserProvider === 'local') body.keepMinimized = keepMinimized;

			const hasBody = Object.keys(body).length > 0;
			const response = await fetch(`/api/jobs/${jobId}/rescrape`, {
				method: 'POST',
				headers: hasBody ? { 'Content-Type': 'application/json' } : {},
				body: hasBody ? JSON.stringify(body) : undefined
			});
			const result = await response.json();

			if (!response.ok) {
				status = 'error';
				message = result.error || 'Failed to start rescrape';
				addLogEntry(`Error: ${message}`);
				return;
			}

			if (result.status === 'already_queued') {
				addLogEntry('Already queued for rescrape');
			} else {
				addLogEntry('Queued for rescrape');
			}

			startPolling();
		} catch (err) {
			status = 'error';
			message = err instanceof Error ? err.message : 'Failed to start rescrape';
			addLogEntry(`Error: ${message}`);
		}
	}

	function startPolling() {
		if (pollInterval) return;
		pollInterval = setInterval(pollStatus, 1500);
	}

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	async function pollStatus() {
		try {
			const response = await fetch(`/api/jobs/${jobId}/rescrape`);
			if (!response.ok) return;

			const result = await response.json();
			status = result.status;
			message = result.message || '';
			liveUrl = result.liveUrl || null;

			// Add progress messages as log entries
			if (
				result.message &&
				!result.message.startsWith('✓') &&
				!result.message.includes('Extracted data:')
			) {
				addLogEntry(result.message);
			}

			if (!['queued', 'scraping'].includes(result.status)) {
				stopPolling();

				if (result.status === 'completed') {
					addLogEntry('Rescrape completed successfully');
					// Reload history
					loadHistory();
					if (oncomplete) {
						setTimeout(oncomplete, 1500);
					}
				} else if (result.status === 'error') {
					logs = [
						...logs,
						{
							id: ++logIdCounter,
							level: 'error',
							message: result.message || 'Rescrape failed',
							timestamp: new Date().toISOString()
						}
					];
					loadHistory();
				}
			}
		} catch {
			// Ignore polling errors
		}
	}

	async function loadHistory() {
		try {
			const response = await fetch(`/api/jobs/${jobId}/rescrape`);
			if (!response.ok) return;
			const result = await response.json();
			if (result.history) {
				history = result.history;
			}
			historyLoaded = true;
		} catch {
			// Ignore
		}
	}

	async function cancelRescrape() {
		if (!confirm('Cancel this rescrape?')) return;
		isCancelling = true;
		try {
			const response = await fetch(`/api/jobs/${jobId}/rescrape`, {
				method: 'DELETE'
			});
			const result = await response.json();
			if (response.ok) {
				stopPolling();
				// Reset to initial config screen so user can start a new rescrape
				started = false;
				status = 'idle';
				message = '';
				liveUrl = null;
				logs = [];
				lastMessage = '';
				loadHistory();
			} else {
				addLogEntry(`Failed to cancel: ${result.error || 'Unknown error'}`);
			}
		} catch (err) {
			addLogEntry(`Failed to cancel: ${err instanceof Error ? err.message : 'Unknown error'}`);
		} finally {
			isCancelling = false;
		}
	}

	function formatRunDate(dateStr: string): string {
		return formatDateTime(dateStr, ($page.data as { timeFormat: TimeFormat }).timeFormat);
	}

	function statusColor(s: string): string {
		switch (s) {
			case 'completed':
				return 'text-[var(--dash-success)]';
			case 'error':
				return 'text-[var(--dash-error)]';
			case 'cancelled':
				return 'text-[var(--dash-text-muted)]';
			case 'scraping':
				return 'text-[var(--dash-primary)]';
			case 'queued':
				return 'text-[var(--dash-text-muted)]';
			default:
				return 'text-[var(--dash-text-secondary)]';
		}
	}

	onMount(() => {
		if (resuming) {
			pollStatus();
			startPolling();
		}
		loadHistory();
		return () => stopPolling();
	});
</script>

<!-- Modal backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	use:portalToBody={{ onClose: onclose }}
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="mx-4 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-[var(--dash-border)] bg-[var(--dash-bg)] shadow-xl"
		onclick={(e) => e.stopPropagation()}
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-[var(--dash-border)] p-4">
			<div class="flex items-center gap-3">
				<h2 class="text-lg font-semibold text-[var(--dash-text)]">
					Rescrape Job #{jobId}
				</h2>
				{#if isActive}
					<Spinner size="w-4 h-4" color="var(--dash-primary)" />
				{:else if isComplete}
					<FontAwesomeIcon icon={faCheckCircle} class="h-4 w-4 text-[var(--dash-success)]" />
				{:else if isCancelled}
					<FontAwesomeIcon icon={faBan} class="h-4 w-4 text-[var(--dash-text-muted)]" />
				{:else if isError}
					<FontAwesomeIcon icon={faTimesCircle} class="h-4 w-4 text-[var(--dash-error)]" />
				{/if}
			</div>
			<button
				onclick={onclose}
				class="p-1 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
			>
				<FontAwesomeIcon icon={faTimes} class="h-5 w-5" />
			</button>
		</div>

		<!-- Content -->
		<div class="space-y-4 p-4">
			{#if !resuming}
				<!-- Config section — visible when not resuming an existing rescrape -->
				<div class="space-y-3">
					<!-- Source URL -->
					{#if sourceUrl}
						<div>
							<label class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
								>Source URL</label
							>
							<a
								href={sourceUrl}
								target="_blank"
								rel="noopener"
								class="flex items-center gap-1 text-sm break-all text-[var(--dash-primary)] hover:underline"
							>
								{sourceUrl}
								<FontAwesomeIcon icon={faExternalLinkAlt} class="h-3 w-3 flex-shrink-0" />
							</a>
						</div>
					{/if}

					<!-- Login URL -->
					<div>
						<label class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]">
							<FontAwesomeIcon icon={faLink} class="h-3 w-3" />
							Login URL
						</label>
						{#if loginUrl}
							<a
								href={loginUrl}
								target="_blank"
								rel="noopener"
								class="flex items-center gap-1 text-sm break-all text-[var(--dash-primary)] hover:underline"
							>
								{loginUrl}
								<FontAwesomeIcon icon={faExternalLinkAlt} class="h-3 w-3 flex-shrink-0" />
							</a>
						{:else}
							<p class="text-sm text-[var(--dash-text-muted)]">Not configured</p>
						{/if}
					</div>

					<!-- Credentials -->
					<CredentialSelector
						bind:credentials
						bind:selectedId={credentialId}
						{platformId}
						{profileId}
						{platformName}
						disabled={started}
					/>

					<!-- Browser Provider -->
					<div>
						<label class="mb-2 block text-xs font-medium text-[var(--dash-text-secondary)]"
							>Browser Provider</label
						>
						<BrowserProviderToggle bind:value={browserProvider} disabled={started} />
					</div>

					<!-- Browser Location (hosted mode only) -->
					{#if browserProvider === 'hosted'}
						<div>
							<div class="mb-1 flex items-center gap-1.5">
								<FontAwesomeIcon icon={faGlobe} class="h-3 w-3 text-[var(--dash-text-secondary)]" />
								<label class="text-xs font-medium text-[var(--dash-text-secondary)]"
									>Browser Location</label
								>
							</div>
							<div class="max-w-xs">
								<CountrySelect
									bind:value={countryCode}
									fallback={defaultCountryCode}
									disabled={started}
								/>
							</div>
							{#if !started}
								<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
									The country the browser will appear to browse from. If empty, your profile's
									country is used.
								</p>
							{/if}
						</div>

						<!-- Advanced: browser fingerprint toggle -->
						<button
							type="button"
							onclick={() => (showAdvanced = !showAdvanced)}
							class="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text-secondary)]"
						>
							<FontAwesomeIcon
								icon={showAdvanced ? faChevronDown : faChevronRight}
								class="h-2.5 w-2.5"
							/>
							Advanced
						</button>

						{#if showAdvanced}
							<div class="space-y-3 border-t border-[var(--dash-border)] pt-2">
								<div>
									<label
										for="rescrape_language"
										class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
									>
										Language
									</label>
									<input
										type="text"
										id="rescrape_language"
										bind:value={browserLanguage}
										placeholder={browserFingerprintDefaults.language}
										disabled={started}
										class="w-full rounded-md border border-[var(--dash-border)] px-2.5 py-1.5 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none disabled:opacity-50"
									/>
									{#if !browserLanguage}
										<p class="mt-0.5 text-xs text-[var(--dash-text-muted)]">
											Defaults to <span class="font-mono"
												>{browserFingerprintDefaults.language}</span
											> based on country
										</p>
									{/if}
								</div>

								<div>
									<label
										for="rescrape_timezone"
										class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
									>
										Timezone
									</label>
									<input
										type="text"
										id="rescrape_timezone"
										bind:value={browserTimezone}
										placeholder={browserFingerprintDefaults.timezone}
										disabled={started}
										class="w-full rounded-md border border-[var(--dash-border)] px-2.5 py-1.5 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none disabled:opacity-50"
									/>
									{#if !browserTimezone}
										<p class="mt-0.5 text-xs text-[var(--dash-text-muted)]">
											Defaults to <span class="font-mono"
												>{browserFingerprintDefaults.timezone}</span
											> based on country
										</p>
									{/if}
								</div>
							</div>
						{/if}
					{/if}

					<!-- Keep Minimized (desktop/local mode only) -->
					{#if browserProvider === 'local'}
						<label class="flex items-center gap-2 text-sm text-[var(--dash-text)]">
							<input
								type="checkbox"
								bind:checked={keepMinimized}
								disabled={started}
								class="rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
							/>
							Keep browser minimized
						</label>
					{/if}
				</div>
			{/if}

			{#if started}
				<!-- Scraping progress -->
				<div class="space-y-4 border-t border-[var(--dash-border)] pt-4">
					<!-- Status -->
					<div class="flex items-center gap-2 text-sm">
						{#if isActive}
							<span class="text-[var(--dash-primary)]">
								{status === 'queued' ? 'Waiting in queue...' : message || 'Processing...'}
							</span>
						{:else if isComplete}
							<span class="text-[var(--dash-success)]">Completed</span>
						{:else if isCancelled}
							<span class="text-[var(--dash-text-muted)]">Cancelled</span>
						{:else if isError}
							<span class="text-[var(--dash-error)]">{message || 'Failed'}</span>
						{/if}
					</div>

					<!-- Browser View -->
					{#if isActive || liveUrl}
						<BrowserView
							{liveUrl}
							statusMessage={isActive
								? 'Watch the rescrape progress. You may need to intervene if a CAPTCHA or login is required.'
								: ''}
						/>
					{/if}

					<!-- Logs -->
					<LogViewer
						{logs}
						loading={isActive}
						maxHeight="max-h-48"
						timeFormat={($page.data as { timeFormat: import('$lib/format-date').TimeFormat })
							.timeFormat}
					/>

					<!-- Completed extraction summary -->
					{#if isComplete && message && message.includes('Extracted data:')}
						<div
							class="rounded-lg border border-[var(--dash-success)] bg-[var(--dash-success-light)] p-3"
						>
							<p class="text-sm whitespace-pre-line text-[var(--dash-success)]">
								{message}
							</p>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Run History -->
			{#if historyLoaded && history.length > 0}
				<div class="border-t border-[var(--dash-border)] pt-4">
					<div class="mb-2 flex items-center gap-2">
						<FontAwesomeIcon
							icon={faHistory}
							class="h-3.5 w-3.5 text-[var(--dash-text-secondary)]"
						/>
						<h3 class="text-sm font-medium text-[var(--dash-text-secondary)]">Run History</h3>
					</div>
					<div class="space-y-1.5">
						{#each history as run}
							<div
								class="flex items-center gap-3 rounded-md bg-[var(--dash-bg)] px-3 py-1.5 text-xs"
							>
								<span class="flex items-center gap-1 text-[var(--dash-text-muted)]">
									<FontAwesomeIcon icon={faClock} class="h-3 w-3" />
									{formatRunDate(run.started_at)}
								</span>
								<span class="font-medium {statusColor(run.status)}">{run.status}</span>
								{#if run.message}
									<span class="flex-1 truncate text-[var(--dash-text-muted)]" title={run.message}>
										{run.message.length > 80 ? run.message.slice(0, 80) + '...' : run.message}
									</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="flex justify-end border-t border-[var(--dash-border)] p-4">
			{#if !started}
				<div class="flex gap-2">
					<button
						onclick={onclose}
						class="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
					>
						Cancel
					</button>
					<button
						onclick={triggerRescrape}
						class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
					>
						<FontAwesomeIcon icon={faPlay} class="h-3 w-3" />
						Start Rescrape
					</button>
				</div>
			{:else}
				<div class="flex gap-2">
					{#if isActive}
						<button
							onclick={cancelRescrape}
							disabled={isCancelling}
							class="flex items-center gap-2 rounded-lg border border-[var(--dash-error)]/30 px-4 py-2 text-sm text-[var(--dash-error)] transition-colors hover:bg-[var(--dash-error)]/10 disabled:opacity-50"
						>
							{#if isCancelling}
								<Spinner size="w-3 h-3" />
							{:else}
								<FontAwesomeIcon icon={faStop} class="h-3 w-3" />
							{/if}
							Cancel Rescrape
						</button>
					{/if}
					<button
						onclick={onclose}
						class="
              rounded-lg px-4 py-2 text-sm {isActive
							? 'border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)]'
							: 'bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-hover)]'} transition-colors
            "
					>
						{#if isActive}
							Close
						{:else if isComplete}
							<span class="flex items-center gap-2">
								<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
								Done
							</span>
						{:else}
							Close
						{/if}
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>
