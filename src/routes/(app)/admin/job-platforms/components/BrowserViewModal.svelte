<script lang="ts">
	/**
	 * Modal that renders a live view of the discovery worker's browser
	 * session — used by both the per-platform discovery page's status box
	 * and the SearchFormProbeRunCard. Renders an iframe of `liveUrl` for hosted
	 * sessions, or polls `/api/tunnel/screencast` when the run was routed
	 * through a desktop device.
	 *
	 * Polling starts on open and stops on close/unmount. The blob URL for
	 * the latest screenshot is revoked between frames so we don't leak.
	 */
	import { onDestroy } from 'svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCloud,
		faDesktop,
		faExternalLinkAlt,
		faSync,
		faTimes
	} from '@fortawesome/free-solid-svg-icons';
	import Spinner from '$lib/components/Spinner.svelte';
	import { portalToBody } from '$lib/actions/portal';

	interface Props {
		open: boolean;
		liveUrl: string | null;
		apiKeyId: number | null;
		deviceName?: string | null;
		onClose?: () => void;
	}

	let { open = $bindable(), liveUrl, apiKeyId, deviceName = null, onClose }: Props = $props();

	const isCloudMode = $derived(Boolean(liveUrl));
	const isTunnelMode = $derived(!isCloudMode && Boolean(apiKeyId));

	let screenshotSrc = $state<string | null>(null);
	let screenshotLoading = $state(false);
	let pollingInterval: ReturnType<typeof setInterval> | null = null;

	async function fetchScreenshot() {
		if (!isTunnelMode || !apiKeyId) return;
		try {
			const res = await fetch(`/api/tunnel/screencast/${apiKeyId}`);
			if (res.ok && res.status !== 204) {
				const blob = await res.blob();
				const url = URL.createObjectURL(blob);
				if (screenshotSrc) URL.revokeObjectURL(screenshotSrc);
				screenshotSrc = url;
				screenshotLoading = false;
			}
		} catch {
			// Retry on next tick.
		}
	}

	function startPolling() {
		if (pollingInterval || !isTunnelMode) return;
		screenshotLoading = !screenshotSrc;
		fetchScreenshot();
		pollingInterval = setInterval(fetchScreenshot, 2000);
	}

	function stopPolling() {
		if (pollingInterval) {
			clearInterval(pollingInterval);
			pollingInterval = null;
		}
	}

	function close() {
		open = false;
		stopPolling();
		onClose?.();
	}

	// Open/close drives polling — start when opening into tunnel mode,
	// stop on close (including via Escape / backdrop click).
	$effect(() => {
		if (open && isTunnelMode) startPolling();
		if (!open) stopPolling();
	});

	onDestroy(() => {
		stopPolling();
		if (screenshotSrc) URL.revokeObjectURL(screenshotSrc);
	});
</script>

{#if open && (isCloudMode || isTunnelMode)}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		use:portalToBody={{ onClose: close }}
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		onclick={close}
		role="presentation"
	>
		<div class="absolute inset-0 bg-black/60"></div>
		<div
			class="relative flex h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)]"
			onclick={(e) => e.stopPropagation()}
			role="presentation"
		>
			<div
				class="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--dash-border)] px-4 py-2"
			>
				<div class="flex min-w-0 items-center gap-2">
					<FontAwesomeIcon
						icon={isCloudMode ? faCloud : faDesktop}
						class="h-4 w-4 shrink-0 text-[var(--dash-text-secondary)]"
					/>
					<span class="text-sm font-medium text-[var(--dash-text)]">Browser view</span>
					<span
						class="shrink-0 rounded bg-[var(--dash-bg)] px-2 py-0.5 text-xs text-[var(--dash-text-muted)]"
					>
						{isCloudMode ? 'Cloud' : (deviceName ?? 'Tunnel')}
					</span>
				</div>
				<div class="flex items-center gap-2">
					{#if isTunnelMode}
						<button
							type="button"
							onclick={fetchScreenshot}
							class="p-1 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
							title="Refresh screenshot"
							aria-label="Refresh screenshot"
						>
							<FontAwesomeIcon icon={faSync} class="h-3.5 w-3.5" />
						</button>
					{/if}
					{#if isCloudMode && liveUrl}
						<a
							href={liveUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="p-1 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
							title="Open in new tab"
							aria-label="Open in new tab"
						>
							<FontAwesomeIcon icon={faExternalLinkAlt} class="h-4 w-4" />
						</a>
					{/if}
					<button
						type="button"
						onclick={close}
						class="p-1 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
						aria-label="Close browser view"
					>
						<FontAwesomeIcon icon={faTimes} class="h-4 w-4" />
					</button>
				</div>
			</div>
			<div class="relative w-full flex-1 bg-black">
				{#if isCloudMode && liveUrl}
					<iframe src={liveUrl} title="Browser view" class="absolute inset-0 h-full w-full border-0"
					></iframe>
				{:else if isTunnelMode}
					{#if screenshotSrc}
						<img
							src={screenshotSrc}
							alt="Browser screenshot"
							class="absolute inset-0 h-full w-full object-contain select-none"
							draggable="false"
						/>
					{:else if screenshotLoading}
						<div class="absolute inset-0 flex items-center justify-center bg-[var(--dash-bg)]">
							<div class="text-center">
								<Spinner size="w-6 h-6" color="var(--dash-text-muted)" />
								<p class="mt-2 text-sm text-[var(--dash-text-muted)]">Loading screenshot…</p>
							</div>
						</div>
					{:else}
						<div class="absolute inset-0 flex items-center justify-center bg-[var(--dash-bg)] p-4">
							<p class="text-center text-sm text-[var(--dash-text-muted)]">
								No screenshot yet. The desktop device may not be connected, or the discovery worker
								hasn't started a browser session.
							</p>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}
