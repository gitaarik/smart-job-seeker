<script lang="ts">
	import type { PageData } from './$types';
	import { onDestroy, onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faChevronDown,
		faChevronUp,
		faDesktop,
		faEllipsisVertical,
		faEye,
		faEyeSlash,
		faKey,
		faLink,
		faPencil,
		faPlus,
		faServer,
		faShareAlt,
		faTimes,
		faTrash,
		faUndo,
		faUserMinus
	} from '@fortawesome/free-solid-svg-icons';
	import { faGithub } from '@fortawesome/free-brands-svg-icons';

	import Card from '../../../components/Card.svelte';
	import CopyButton from '../../../components/CopyButton.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { portalToBody } from '$lib/actions/portal';

	let { data }: { data: PageData } = $props();

	let apiKeys = $state(data.apiKeys);
	let sharedDevices = $derived(data.sharedDevices);
	let sortedApiKeys = $derived(
		[...apiKeys].sort((a, b) => Number(!!a.revoked) - Number(!!b.revoked))
	);

	// Cleanup hints. A key gets flagged when:
	//   - duplicate: another non-revoked key shares the same name (leftover
	//     from the pre-user-wide era where the same physical device often
	//     registered once per profile)
	//   - stale: never used and created more than 7 days ago, OR last_used
	//     was more than 30 days ago
	// These don't auto-delete — they just tag the row so the user knows
	// which ones are safe to clean up.
	const STALE_NEVER_USED_DAYS = 7;
	const STALE_LAST_USED_DAYS = 30;

	let duplicateNames = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const k of apiKeys) {
			if (k.revoked) continue;
			counts.set(k.name, (counts.get(k.name) ?? 0) + 1);
		}
		const dupes = new Set<string>();
		for (const [name, count] of counts) {
			if (count > 1) dupes.add(name);
		}
		return dupes;
	});

	function isStale(key: (typeof apiKeys)[number]): boolean {
		if (key.revoked) return false;
		const now = Date.now();
		const created = key.date_created ? new Date(key.date_created).getTime() : 0;
		const lastUsed = key.last_used ? new Date(key.last_used).getTime() : null;
		if (lastUsed === null) {
			return now - created > STALE_NEVER_USED_DAYS * 24 * 3600 * 1000;
		}
		return now - lastUsed > STALE_LAST_USED_DAYS * 24 * 3600 * 1000;
	}

	function isDuplicate(key: (typeof apiKeys)[number]): boolean {
		return !key.revoked && duplicateNames.has(key.name);
	}
	let showAddForm = $state(false);
	let showManualInstall = $state(false);
	// Setup-instructions panel is open by default; once a user has things wired
	// up they tend to collapse it, so persist that choice. Backed by a cookie
	// (read in +page.server.ts) so SSR renders the right state — no flash on
	// refresh. Initial value comes from the server-rendered load data.
	let setupExpanded = $state(data.setupExpanded);

	function toggleSetup() {
		setupExpanded = !setupExpanded;
		// 1-year cookie; lax is fine for a same-site UI preference.
		document.cookie = `devices_setup_expanded=${setupExpanded}; path=/; max-age=31536000; samesite=lax`;
	}
	let newKeyName = $state('');
	let isCreating = $state(false);
	let newlyCreatedKey = $state<string | null>(null);
	let newlyCreatedKeyId = $state<number | null>(null);
	let newlyCreatedKeyName = $state<string>('');
	let visibleKeyId = $state<number | null>(null);

	function dismissNewKey() {
		newlyCreatedKey = null;
		newlyCreatedKeyId = null;
		newlyCreatedKeyName = '';
	}
	let errorMessage = $state<string | null>(null);
	let installTab = $state<'desktop' | 'docker'>('desktop');

	// Overflow menu and rename state
	let menuOpenKeyId = $state<number | null>(null);
	let menuDropUp = $state(false);
	let editingKeyId = $state<number | null>(null);
	let editKeyName = $state('');

	function toggleMenu(keyId: number, event: MouseEvent) {
		if (menuOpenKeyId === keyId) {
			menuOpenKeyId = null;
			return;
		}
		const button = event.currentTarget as HTMLElement;
		const rect = button.getBoundingClientRect();
		menuDropUp = rect.bottom + 200 > window.innerHeight;
		menuOpenKeyId = keyId;
	}

	async function renameApiKey(keyId: number) {
		const name = editKeyName.trim();
		if (!name) return;

		try {
			const res = await fetch(`/api/api-keys/${keyId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'rename', name })
			});
			if (res.ok) {
				editingKeyId = null;
				await invalidateAll();
				apiKeys = data.apiKeys;
			}
		} catch {
			errorMessage = 'Failed to rename device key';
		}
	}

	// Tunnel status polling
	interface DeviceStatus {
		apiKeyId: number;
		apiKeyName: string;
		connectedAt: string;
		lastHeartbeat: string;
		/** App code — auto-updates from the release tarball on every boot. */
		clientVersion: string;
		/** The image under it, which only moves on a pull. See staleImage(). */
		imageVersion?: string;
	}
	interface PreferredDevice extends DeviceStatus {
		isShared: boolean;
		ownerLabel: string | null;
	}
	let connectedDevices = $state<DeviceStatus[]>([]);
	let sharedDeviceStatuses = $state<Map<number, DeviceStatus>>(new Map());
	let preferredDevice = $state<PreferredDevice | null>(null);
	let sjsBrowserStatus = $state<string>('checking');
	let statusPollInterval: ReturnType<typeof setInterval> | null = null;

	// Derive tunnel URL from current host
	let sjsBrowserUrl = $derived(
		typeof window !== 'undefined'
			? `wss://${window.location.host}/tunnel`
			: 'wss://app.smartjobseeker.com/tunnel'
	);

	// Live wiring for the just-created device key: the tunnel poll surfaces the
	// device the instant it connects, so the setup wizard can confirm it.
	let newKeyConnected = $derived(
		newlyCreatedKeyId !== null && connectedDevices.some((d) => d.apiKeyId === newlyCreatedKeyId)
	);
	let newKeyDockerCmd = $derived(
		newlyCreatedKey
			? `docker run -d --name sjs-browser --restart unless-stopped \\
  --shm-size 512m -v sjs_chrome_data:/data \\
  -e SJS_SERVER_URL="${sjsBrowserUrl}" \\
  -e SJS_API_TOKEN="${newlyCreatedKey}" \\
  gitaarik036/sjs-browser:latest`
			: ''
	);

	function getDeviceStatus(apiKeyId: number): DeviceStatus | undefined {
		return connectedDevices.find((d) => d.apiKeyId === apiKeyId);
	}

	function getSharedDeviceStatus(apiKeyId: number): DeviceStatus | undefined {
		return sharedDeviceStatuses.get(apiKeyId);
	}

	async function pollOwnedSjsBrowserStatus() {
		try {
			const res = await fetch(`/api/tunnel/status`);
			const status = await res.json();
			connectedDevices = status.devices || [];
			sjsBrowserStatus = status.connected ? 'connected' : 'disconnected';
		} catch {
			sjsBrowserStatus = 'unavailable';
			connectedDevices = [];
		}
	}

	// Shared devices each belong to a different owner profile, so poll them per-key.
	async function pollSharedDeviceStatuses() {
		if (sharedDevices.length === 0) {
			if (sharedDeviceStatuses.size > 0) sharedDeviceStatuses = new Map();
			return;
		}
		const results = await Promise.all(
			sharedDevices.map(async (s) => {
				try {
					const res = await fetch(`/api/tunnel/status?apiKeyId=${s.api_key.id}`);
					if (!res.ok) return [s.api_key.id, undefined] as const;
					const body = await res.json();
					return [s.api_key.id, (body.devices || [])[0] as DeviceStatus | undefined] as const;
				} catch {
					return [s.api_key.id, undefined] as const;
				}
			})
		);
		const next = new Map<number, DeviceStatus>();
		for (const [id, dev] of results) {
			if (dev) next.set(id, dev);
		}
		sharedDeviceStatuses = next;
	}

	async function pollPreferredDevice() {
		try {
			const res = await fetch(`/api/tunnel/status/preferred`);
			const result = await res.json();
			preferredDevice = result.device ?? null;
		} catch {
			preferredDevice = null;
		}
	}

	async function pollSjsBrowserStatus() {
		await Promise.all([
			pollOwnedSjsBrowserStatus(),
			pollSharedDeviceStatuses(),
			pollPreferredDevice()
		]);
	}

	onMount(() => {
		pollSjsBrowserStatus();
		statusPollInterval = setInterval(pollSjsBrowserStatus, 5000);
	});

	onDestroy(() => {
		if (statusPollInterval) clearInterval(statusPollInterval);
	});

	async function createApiKey() {
		if (!newKeyName.trim()) return;
		isCreating = true;
		errorMessage = null;

		try {
			const res = await fetch('/api/api-keys', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newKeyName.trim()
				})
			});

			const result = await res.json();

			if (!res.ok) {
				errorMessage = result.error || result.message || 'Failed to create device key';
				return;
			}

			newlyCreatedKey = result.key;
			newlyCreatedKeyId = result.id;
			newlyCreatedKeyName = newKeyName.trim();
			newKeyName = '';
			showAddForm = false;
			// Surface the new device immediately so the wizard can watch it connect.
			await pollOwnedSjsBrowserStatus();
			await invalidateAll();
			apiKeys = data.apiKeys;
		} catch {
			errorMessage = 'Failed to create device key';
		} finally {
			isCreating = false;
		}
	}

	async function revokeApiKey(keyId: number) {
		if (!confirm('Revoke this device key? The device will be disconnected.')) {
			return;
		}

		try {
			const res = await fetch(`/api/api-keys/${keyId}`, { method: 'DELETE' });
			if (res.ok) {
				await invalidateAll();
				apiKeys = data.apiKeys;
			}
		} catch {
			errorMessage = 'Failed to revoke device key';
		}
	}

	async function activateApiKey(keyId: number) {
		try {
			const res = await fetch(`/api/api-keys/${keyId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'activate' })
			});
			if (res.ok) {
				await invalidateAll();
				apiKeys = data.apiKeys;
			}
		} catch {
			errorMessage = 'Failed to activate device key';
		}
	}

	async function deleteApiKey(keyId: number) {
		if (!confirm('Delete this device key? This cannot be undone.')) return;

		try {
			const res = await fetch(`/api/api-keys/${keyId}?permanent=true`, { method: 'DELETE' });
			if (res.ok) {
				await invalidateAll();
				apiKeys = data.apiKeys;
			}
		} catch {
			errorMessage = 'Failed to delete device key';
		}
	}

	function formatDate(date: Date | string | null): string {
		if (!date) return 'Never';
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	/**
	 * The image version, but only when it is worth showing.
	 *
	 * A device reports two versions. The app auto-updates from the release
	 * tarball on every boot; the image under it — Chrome, Node, base OS — moves
	 * only when the host pulls. Showing both always would put a second, usually
	 * identical number in every row, so this returns one only when they
	 * disagree, which is the entire signal.
	 *
	 * Why it exists: `:latest` sat on sjs-browser v1.0.1 from 2026-07-11 while
	 * instances auto-updated their app code to v1.0.4 and reported *that*. A
	 * Chrome version pin shipped in v1.0.2 never arrived, and no readout
	 * anywhere said so.
	 *
	 * `unknown` is not a mismatch — it means a client older than v1.0.5 that
	 * cannot report its image at all. Flagging that as stale would be a
	 * permanent false alarm on exactly the devices least able to answer.
	 */
	function staleImage(d: { clientVersion: string; imageVersion?: string }): string | null {
		if (!d.imageVersion || d.imageVersion === 'unknown') return null;
		if (d.imageVersion === d.clientVersion) return null;
		return d.imageVersion;
	}

	function formatRelativeTime(dateStr: string): string {
		const d = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		const diffHours = Math.floor(diffMs / 3600000);
		if (diffHours < 24) return `${diffHours}h ago`;
		return formatDate(dateStr);
	}

	// Device sharing
	interface ContactUser {
		id: string;
		name: string | null;
		email: string;
	}
	interface DeviceShare {
		id: number;
		date_created: Date | null;
		user: ContactUser & { image: string | null };
	}

	let sharingKeyId = $state<number | null>(null);
	let sharingContacts = $state<ContactUser[]>([]);
	let sharingExisting = $state<DeviceShare[]>([]);
	let sharingLoading = $state(false);

	// Invite-by-link: bring in someone who isn't a contact (or a user) yet.
	let inviteLink = $state<string | null>(null);
	let inviteLoading = $state(false);

	async function createInviteLink() {
		if (!sharingKeyId) return;
		inviteLoading = true;
		try {
			const res = await fetch('/api/device-shares/invite', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ apiKeyId: sharingKeyId })
			});
			const body = await res.json();
			if (res.ok) {
				inviteLink = body.url;
			} else {
				errorMessage = body.error || 'Failed to create invite link';
			}
		} catch {
			errorMessage = 'Failed to create invite link';
		} finally {
			inviteLoading = false;
		}
	}

	async function openShareModal(apiKeyId: number) {
		sharingKeyId = apiKeyId;
		inviteLink = null;
		sharingLoading = true;

		try {
			const [contactsRes, sharesRes] = await Promise.all([
				fetch('/api/contacts'),
				fetch(`/api/device-shares?apiKeyId=${apiKeyId}`)
			]);
			const contactsData = await contactsRes.json();
			const sharesData = await sharesRes.json();

			// Only show accepted contacts
			sharingContacts = (contactsData.contacts || [])
				.filter((c: { status: string }) => c.status === 'accepted')
				.map((c: { user: ContactUser }) => c.user);
			sharingExisting = sharesData.shares || [];
		} catch {
			errorMessage = 'Failed to load sharing data';
			sharingKeyId = null;
		} finally {
			sharingLoading = false;
		}
	}

	function isSharedWith(userId: string): boolean {
		return sharingExisting.some((s) => s.user.id === userId);
	}

	async function shareWithContact(userId: string) {
		if (!sharingKeyId) return;

		try {
			const res = await fetch('/api/device-shares', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ apiKeyId: sharingKeyId, userId })
			});

			if (res.ok) {
				await openShareModal(sharingKeyId);
			} else {
				const data = await res.json();
				errorMessage = data.error || 'Failed to share device';
			}
		} catch {
			errorMessage = 'Failed to share device';
		}
	}

	async function unshareFromContact(userId: string) {
		if (!sharingKeyId) return;

		try {
			const res = await fetch('/api/device-shares', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ apiKeyId: sharingKeyId, userId })
			});

			if (res.ok) {
				await openShareModal(sharingKeyId);
			}
		} catch {
			errorMessage = 'Failed to unshare device';
		}
	}
</script>

<svelte:head>
	<title>My Devices - Job Import - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-4">
	<p class="text-sm text-[var(--dash-text-secondary)]">
		Connect a device to import jobs from your own IP address. Use the desktop app on your computer
		or a self-hosted Docker container on a NAS or server.
		<a
			href="/guide/devices"
			target="_blank"
			rel="noopener"
			class="text-[var(--dash-primary)] hover:underline">How devices &amp; sharing work →</a
		>
	</p>

	<!-- Connection Status -->
	<Card padding="md">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<span class={preferredDevice ? 'text-green-500' : 'text-[var(--dash-text-muted)]'}>
					<FontAwesomeIcon icon={faDesktop} class="h-4 w-4" />
				</span>
				<div>
					<p class="flex flex-wrap items-center gap-2 font-medium text-[var(--dash-text)]">
						{#if sjsBrowserStatus === 'checking'}
							Checking connection...
						{:else if preferredDevice}
							<span>{preferredDevice.apiKeyName}</span>
							<span
								class="w-fit rounded-full bg-[var(--dash-success-light)] px-2 py-0.5 text-xs text-[var(--dash-success)]"
							>
								Connected
							</span>
						{:else}
							No Device Connected
						{/if}
					</p>
					{#if preferredDevice}
						<p class="text-sm text-[var(--dash-text-muted)]">
							v{preferredDevice.clientVersion}
							{#if staleImage(preferredDevice)}
								&middot; <span
									title="The container image is older than the app code. Pull a new image to update Chrome, Node and the base OS."
									>image v{staleImage(preferredDevice)}</span
								>
							{/if}
							&middot; connected {formatRelativeTime(preferredDevice.connectedAt)}
							{#if preferredDevice.isShared && preferredDevice.ownerLabel}
								&middot; shared by {preferredDevice.ownerLabel}
							{/if}
						</p>
					{:else if sjsBrowserStatus !== 'checking'}
						<p class="text-sm text-[var(--dash-text-muted)]">
							Follow the setup steps below to connect
						</p>
					{/if}
				</div>
			</div>
			{#if sjsBrowserStatus === 'checking'}
				<Spinner size="w-4 h-4" color="var(--dash-text-muted)" />
			{/if}
		</div>
	</Card>

	<!-- Setup Instructions -->
	<Card padding="lg">
		<button
			type="button"
			onclick={toggleSetup}
			class="
        flex w-full items-center justify-between text-left {setupExpanded ? 'mb-4' : ''}
      "
			aria-expanded={setupExpanded}
		>
			<h2 class="font-medium text-[var(--dash-text)]">Setup Instructions</h2>
			<span
				class="
          inline-block text-[var(--dash-text-muted)] transition-transform duration-200 {setupExpanded
					? 'rotate-180'
					: ''}
        "
			>
				<FontAwesomeIcon icon={faChevronDown} class="h-3.5 w-3.5" />
			</span>
		</button>
		{#if setupExpanded}
			<ol class="space-y-4 text-sm text-[var(--dash-text-secondary)]">
				<!-- Step 1: Install -->
				<li class="flex gap-3">
					<span
						class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--dash-primary-light)] text-xs font-semibold text-[var(--dash-primary)]"
						>1</span
					>
					<div class="flex-1">
						<p class="mb-2 text-[var(--dash-text)]">Install</p>

						<!-- Install type tabs -->
						<div
							class="mb-3 flex w-fit overflow-hidden rounded-md border border-[var(--dash-border)]"
						>
							<button
								type="button"
								onclick={() => {
									installTab = 'desktop';
								}}
								class="flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors {installTab ===
								'desktop'
									? 'bg-[var(--dash-primary)] text-white'
									: 'bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)]'}"
							>
								<FontAwesomeIcon icon={faDesktop} class="h-3 w-3" />
								Desktop App
							</button>
							<button
								type="button"
								onclick={() => {
									installTab = 'docker';
								}}
								class="flex items-center gap-1.5 border-l border-[var(--dash-border)] px-3 py-1.5 text-xs transition-colors {installTab ===
								'docker'
									? 'bg-[var(--dash-primary)] text-white'
									: 'bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)]'}"
							>
								<FontAwesomeIcon icon={faServer} class="h-3 w-3" />
								Docker
							</button>
						</div>

						{#if installTab === 'desktop'}
							<!-- Desktop App instructions -->
							<p>
								Download the installer for your platform from <a
									href="https://github.com/gitaarik/sjs-desktop/releases/latest"
									target="_blank"
									rel="noopener"
									class="text-[var(--dash-primary)] hover:underline">GitHub Releases</a
								>:
							</p>
							<div class="mt-2 space-y-1.5 text-xs">
								<div class="flex items-center gap-2">
									<span class="w-16 text-[var(--dash-text-secondary)]">macOS</span>
									<a
										href="https://github.com/gitaarik/sjs-desktop/releases/latest"
										target="_blank"
										rel="noopener"
										class="font-mono text-[var(--dash-primary)] hover:underline">.dmg</a
									>
								</div>
								<div class="flex items-center gap-2">
									<span class="w-16 text-[var(--dash-text-secondary)]">Windows</span>
									<a
										href="https://github.com/gitaarik/sjs-desktop/releases/latest"
										target="_blank"
										rel="noopener"
										class="font-mono text-[var(--dash-primary)] hover:underline">.exe installer</a
									>
								</div>
								<div class="flex items-center gap-2">
									<span class="w-16 text-[var(--dash-text-secondary)]">Linux</span>
									<a
										href="https://github.com/gitaarik/sjs-desktop/releases/latest"
										target="_blank"
										rel="noopener"
										class="font-mono text-[var(--dash-primary)] hover:underline">.deb</a
									>
									<span class="text-[var(--dash-text-secondary)]">or</span>
									<a
										href="https://github.com/gitaarik/sjs-desktop/releases/latest"
										target="_blank"
										rel="noopener"
										class="font-mono text-[var(--dash-primary)] hover:underline">.AppImage</a
									>
								</div>
							</div>
							<p class="mt-2 text-xs text-[var(--dash-text-secondary)]">
								A compatible browser will be downloaded automatically on first launch.
							</p>

							<!-- Manual install toggle -->
							<button
								type="button"
								onclick={() => {
									showManualInstall = !showManualInstall;
								}}
								class="mt-2 flex items-center gap-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
							>
								<FontAwesomeIcon
									icon={showManualInstall ? faChevronUp : faChevronDown}
									class="h-2.5 w-2.5"
								/>
								<span>Manual install from source</span>
							</button>

							{#if showManualInstall}
								<div
									class="mt-2 space-y-2 rounded-lg bg-[var(--dash-bg)] p-3 text-xs text-[var(--dash-text-secondary)]"
								>
									<p>
										Requires <a
											href="https://nodejs.org/"
											target="_blank"
											rel="noopener"
											class="text-[var(--dash-primary)] hover:underline">Node.js 20+</a
										>
										and
										<a
											href="https://www.rust-lang.org/tools/install"
											target="_blank"
											rel="noopener"
											class="text-[var(--dash-primary)] hover:underline">Rust</a
										>. Clone the repo and build:
									</p>
									<div
										class="space-y-0.5 rounded bg-[var(--dash-card)] p-2 font-mono text-[var(--dash-text-secondary)]"
									>
										<div>git clone https://github.com/gitaarik/sjs-desktop.git</div>
										<div>cd sjs-desktop</div>
										<div>npm install && npm run ui:install</div>
										<div>npm run tauri:build</div>
									</div>
									<p>
										The installer will be in <code class="rounded bg-[var(--dash-card)] px-1"
											>src-tauri/target/release/bundle/</code
										>.
									</p>
								</div>
							{/if}

							<!-- Source code link -->
							<p class="mt-2 text-xs text-[var(--dash-text-secondary)]">
								<a
									href="https://github.com/gitaarik/sjs-desktop"
									target="_blank"
									rel="noopener"
									class="inline-flex items-center gap-1 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
								>
									<FontAwesomeIcon icon={faGithub} class="h-3 w-3" />
									<span>View on GitHub</span>
								</a>
							</p>
						{:else}
							<!-- Docker instructions -->
							<p>
								Run sjs-browser as a Docker container on a NAS (TrueNAS, Synology, Unraid) or any
								server with Docker. The container auto-updates the SJS code on its own — no
								Watchtower or platform-level auto-update needed.
							</p>

							<div class="mt-3 space-y-3">
								<div>
									<p class="mb-1 text-xs font-medium text-[var(--dash-text)]">
										Docker Compose (recommended)
									</p>
									<p class="mb-2 text-xs text-[var(--dash-text-secondary)]">
										Create a <code class="rounded bg-[var(--dash-bg)] px-1">docker-compose.yml</code
										> file:
									</p>
									<div
										class="overflow-x-auto rounded-lg bg-[var(--dash-bg)] p-3 font-mono text-xs text-[var(--dash-text-secondary)]"
									>
										<pre class="whitespace-pre">services:
  sjs-browser:
    image: gitaarik036/sjs-browser:latest
    restart: unless-stopped
    shm_size: "512m"
    volumes:
      - chrome_data:/data
    environment:
      SJS_SERVER_URL: "{sjsBrowserUrl}"
      SJS_API_TOKEN: "your-api-key-here"
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: "2"

volumes:
  chrome_data:</pre>
									</div>
									<p class="mt-2 text-xs text-[var(--dash-text-secondary)]">
										Then run: <code class="rounded bg-[var(--dash-bg)] px-1"
											>docker compose up -d</code
										>
									</p>
								</div>

								<div>
									<p class="mb-1 text-xs font-medium text-[var(--dash-text)]">Docker Run</p>
									<div
										class="overflow-x-auto rounded-lg bg-[var(--dash-bg)] p-3 font-mono text-xs text-[var(--dash-text-secondary)]"
									>
										<pre class="whitespace-pre">docker run -d \
  --name sjs-browser \
  --restart unless-stopped \
  --shm-size 512m \
  -v sjs_chrome_data:/data \
  -e SJS_SERVER_URL="{sjsBrowserUrl}" \
  -e SJS_API_TOKEN="your-api-key-here" \
  gitaarik036/sjs-browser:latest</pre>
									</div>
								</div>

								<div>
									<p class="mb-1 text-xs font-medium text-[var(--dash-text)]">TrueNAS Scale</p>
									<p class="text-xs text-[var(--dash-text-secondary)]">
										Use <strong>Custom App</strong> with image
										<code class="rounded bg-[var(--dash-bg)] px-1"
											>gitaarik036/sjs-browser:latest</code
										>. Add environment variables
										<code class="rounded bg-[var(--dash-bg)] px-1">SJS_SERVER_URL</code>
										and <code class="rounded bg-[var(--dash-bg)] px-1">SJS_API_TOKEN</code>. Set
										shared memory to 512 MB.
									</p>
								</div>

								<div>
									<p class="mb-1 text-xs font-medium text-[var(--dash-text)]">Updates</p>
									<p class="text-xs text-[var(--dash-text-secondary)]">
										On every container restart and every six hours, sjs-browser fetches the latest
										signed release tarball from <a
											href="https://github.com/gitaarik/sjs-browser/releases"
											target="_blank"
											rel="noopener"
											class="underline">GitHub</a
										>
										and verifies its signature against a public key baked into the image. To pin a specific
										version: set
										<code class="rounded bg-[var(--dash-bg)] px-1">SJS_BROWSER_CHANNEL=v0.5.27</code
										>. To opt out entirely: set it to
										<code class="rounded bg-[var(--dash-bg)] px-1">disabled</code>. Pull a new image
										(<code class="rounded bg-[var(--dash-bg)] px-1">docker compose pull</code>)
										every few months for Chrome and base-OS bumps.
									</p>
								</div>

								<p class="text-xs text-[var(--dash-text-secondary)]">
									You can view and control the browser directly from the dashboard during import —
									no extra ports needed.
								</p>
							</div>
						{/if}
					</div>
				</li>

				<!-- Step 2: Create device key -->
				<li class="flex gap-3">
					<span
						class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--dash-primary-light)] text-xs font-semibold text-[var(--dash-primary)]"
						>2</span
					>
					<div>
						<p class="text-[var(--dash-text)]">Create a device key below</p>
						<p>Each device needs its own key. The key name identifies the device.</p>
					</div>
				</li>

				<!-- Step 3: Connect -->
				<li class="flex gap-3">
					<span
						class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--dash-primary-light)] text-xs font-semibold text-[var(--dash-primary)]"
						>3</span
					>
					<div>
						<p class="text-[var(--dash-text)]">Connect the device</p>
						{#if installTab === 'desktop'}
							<p>
								In the desktop app, select the <strong
									>{typeof window !== 'undefined' &&
										(window.location.host.startsWith('app.')
											? 'Production'
											: window.location.host.startsWith('preview.')
												? 'Preview'
												: 'Dev')}</strong
								> server and enter your device key.
							</p>
						{:else}
							<p>
								Replace <code class="rounded bg-[var(--dash-bg)] px-1 text-xs"
									>your-api-key-here</code
								> in the config with your device key and start the container.
							</p>
						{/if}
					</div>
				</li>

				<!-- Step 4: Start importing -->
				<li class="flex gap-3">
					<span
						class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--dash-primary-light)] text-xs font-semibold text-[var(--dash-primary)]"
						>4</span
					>
					<div>
						<p class="text-[var(--dash-text)]">Start importing</p>
						<p>
							Once connected (shown above), start an import from the Import Tasks page. Select "My
							device" as the browser and choose which device to use.
						</p>
					</div>
				</li>
			</ol>
		{/if}
	</Card>

	<!-- Newly Created Key — connect wizard -->
	{#if newlyCreatedKey}
		<Card padding="lg">
			<div class="mb-3 flex items-start justify-between">
				<div>
					<h2 class="font-medium text-[var(--dash-text)]">
						Connect "{newlyCreatedKeyName || 'your device'}"
					</h2>
					<p class="text-sm text-[var(--dash-text-secondary)]">
						Run the container below on your NAS or server — the key is already filled in. Or paste
						the key into the desktop app.
					</p>
				</div>
				<button
					type="button"
					onclick={dismissNewKey}
					class="ml-4 flex-shrink-0 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]"
					title="Dismiss"
				>
					<FontAwesomeIcon icon={faTimes} class="h-4 w-4" />
				</button>
			</div>

			<!-- Pre-filled docker command -->
			<div class="relative">
				<div
					class="overflow-x-auto rounded-lg bg-[var(--dash-bg)] p-3 pr-10 font-mono text-xs text-[var(--dash-text-secondary)]"
				>
					<pre class="whitespace-pre">{newKeyDockerCmd}</pre>
				</div>
				<div class="absolute top-2 right-2">
					<CopyButton text={newKeyDockerCmd} />
				</div>
			</div>

			<!-- Or use the raw key -->
			<div class="mt-2 flex items-center gap-2 text-xs">
				<span class="text-[var(--dash-text-muted)]">Device key:</span>
				<code
					class="min-w-0 flex-1 truncate rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 font-mono text-[var(--dash-text-secondary)]"
					>{newlyCreatedKey}</code
				>
				<span class="shrink-0"><CopyButton text={newlyCreatedKey} /></span>
			</div>

			<!-- Live connection status -->
			<div
				class="
          mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm {newKeyConnected
					? 'bg-[var(--dash-success-light)] text-[var(--dash-success)]'
					: 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)]'}
        "
			>
				{#if newKeyConnected}
					<span class="h-2 w-2 rounded-full bg-[var(--dash-success)]"></span>
					<span>Connected! Your device is online and ready to import.</span>
				{:else}
					<Spinner size="w-3.5 h-3.5" color="var(--dash-text-muted)" />
					<span>Waiting for your device to connect…</span>
				{/if}
			</div>
		</Card>
	{/if}

	<!-- Error Message -->
	{#if errorMessage}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{errorMessage}</p>
		</div>
	{/if}

	<!-- Device Keys -->
	<Card>
		<div class="flex items-center justify-between border-b border-[var(--dash-border)] p-4">
			<div class="flex items-center gap-2">
				<FontAwesomeIcon icon={faKey} class="h-4 w-4 text-[var(--dash-text-secondary)]" />
				<h2 class="font-medium text-[var(--dash-text)]">Device Keys</h2>
			</div>
			{#if !showAddForm}
				<button
					type="button"
					onclick={() => {
						showAddForm = true;
					}}
					class="flex items-center gap-1.5 rounded-lg bg-[var(--dash-primary)] px-3 py-1.5 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
				>
					<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
					<span>New Key</span>
				</button>
			{/if}
		</div>

		{#if showAddForm}
			<div class="border-b border-[var(--dash-border)] bg-[var(--dash-bg)] p-4">
				<div class="flex items-end gap-3">
					<div class="flex-1">
						<label for="key-name" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
							Key Name
						</label>
						<input
							type="text"
							id="key-name"
							bind:value={newKeyName}
							placeholder="e.g., My Laptop, NAS"
							class="w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-2 text-[var(--dash-text)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
							onkeydown={(e) => {
								if (e.key === 'Enter') createApiKey();
							}}
						/>
					</div>
					<button
						type="button"
						onclick={createApiKey}
						disabled={isCreating || !newKeyName.trim()}
						class="rounded-md bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isCreating}
							<Spinner size="w-4 h-4" />
						{:else}
							Create
						{/if}
					</button>
					<button
						type="button"
						onclick={() => {
							showAddForm = false;
							newKeyName = '';
						}}
						class="rounded-md border border-[var(--dash-border)] px-3 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
					>
						Cancel
					</button>
				</div>
			</div>
		{/if}

		{#if apiKeys.length === 0}
			<div class="p-8 text-center text-[var(--dash-text-secondary)]">
				<FontAwesomeIcon icon={faKey} class="mb-2 h-8 w-8 opacity-30" />
				<p>No device keys yet. Create one to connect a device.</p>
			</div>
		{:else}
			<div class="divide-y divide-[var(--dash-border)]">
				{#each sortedApiKeys as key (key.id)}
					{@const deviceStatus = getDeviceStatus(key.id)}
					<div class="p-4">
						<!-- Name row -->
						<div class="flex items-center gap-3">
							<div
								class={`h-2 w-2 flex-shrink-0 rounded-full ${
									key.revoked
										? 'bg-[var(--dash-text-muted)]'
										: deviceStatus
											? 'bg-[var(--dash-success)]'
											: 'bg-[var(--dash-text-muted)]'
								}`}
							></div>
							<div class="min-w-0 flex-1">
								{#if editingKeyId === key.id}
									<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
										<input
											type="text"
											bind:value={editKeyName}
											class="min-w-0 flex-1 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)] focus:border-[var(--dash-primary)] focus:outline-none"
											onkeydown={(e) => {
												if (e.key === 'Enter') renameApiKey(key.id);
												if (e.key === 'Escape') editingKeyId = null;
											}}
										/>
										<div class="flex shrink-0 items-center gap-2">
											<button
												type="button"
												onclick={() => renameApiKey(key.id)}
												class="rounded bg-[var(--dash-primary)] px-2 py-1 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
											>
												Save
											</button>
											<button
												type="button"
												onclick={() => {
													editingKeyId = null;
												}}
												class="px-2 py-1 text-sm text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
											>
												Cancel
											</button>
										</div>
									</div>
								{:else}
									<div class="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
										<p class="truncate font-medium text-[var(--dash-text)]">
											{key.name}
										</p>
										{#if key.revoked}
											<span
												class="w-fit rounded-full bg-[var(--dash-bg)] px-2 py-0.5 text-xs text-[var(--dash-text-muted)]"
											>
												Revoked
											</span>
										{:else if deviceStatus}
											<span
												class="w-fit rounded-full bg-[var(--dash-success-light)] px-2 py-0.5 text-xs text-[var(--dash-success)]"
											>
												Connected
											</span>
										{:else if isDuplicate(key) && isStale(key)}
											<span
												class="w-fit rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400"
												title="Another key has the same name and this one hasn't connected — likely a leftover from the per-profile setup. Safe to delete."
											>
												Duplicate · unused
											</span>
										{:else if isDuplicate(key)}
											<span
												class="w-fit rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400"
												title="Another key has the same name — leftover from the per-profile setup, or a deliberate second device."
											>
												Duplicate
											</span>
										{:else if isStale(key)}
											<span
												class="w-fit rounded-full bg-[var(--dash-bg)] px-2 py-0.5 text-xs text-[var(--dash-text-muted)]"
												title="No tunnel client has connected with this key recently."
											>
												Unused
											</span>
										{/if}
									</div>
									<p class="text-xs text-[var(--dash-text-muted)]">
										{#if deviceStatus}
											v{deviceStatus.clientVersion}
											{#if staleImage(deviceStatus)}
												&middot; <span
													title="The container image is older than the app code. Pull a new image to update Chrome, Node and the base OS."
													>image v{staleImage(deviceStatus)}</span
												>
											{/if}
											&middot; connected {formatRelativeTime(deviceStatus.connectedAt)}
										{:else}
											Created {formatDate(key.date_created)}
											{#if key.last_used}
												&middot; Last used {formatDate(key.last_used)}
											{/if}
										{/if}
									</p>
								{/if}
							</div>

							<!-- Actions: inline on sm+, minimal on mobile -->
							<div class="flex items-center gap-1">
								{#if key.key_plain && !key.revoked}
									<button
										type="button"
										onclick={() => {
											visibleKeyId = visibleKeyId === key.id ? null : key.id;
										}}
										class="p-2 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
										title={visibleKeyId === key.id ? 'Hide key' : 'Show key'}
									>
										<FontAwesomeIcon
											icon={visibleKeyId === key.id ? faEyeSlash : faEye}
											class="h-4 w-4"
										/>
									</button>
									<span class="p-2">
										<CopyButton text={key.key_plain} />
									</span>
								{/if}

								<!-- Overflow menu -->
								<div class="relative">
									<button
										type="button"
										onclick={(e) => toggleMenu(key.id, e)}
										class="p-2 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
										title="More actions"
									>
										<FontAwesomeIcon icon={faEllipsisVertical} class="h-4 w-4" />
									</button>
									{#if menuOpenKeyId === key.id}
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div
											class="fixed inset-0 z-10"
											onclick={() => {
												menuOpenKeyId = null;
											}}
											onkeydown={(e) => e.key === 'Escape' && (menuOpenKeyId = null)}
										></div>
										<div
											class={`absolute right-0 z-20 min-w-[170px] rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] py-1 shadow-lg ${
												menuDropUp ? 'bottom-full mb-1' : 'top-full mt-1'
											}`}
										>
											<button
												type="button"
												onclick={() => {
													editingKeyId = key.id;
													editKeyName = key.name;
													menuOpenKeyId = null;
												}}
												class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
											>
												<FontAwesomeIcon icon={faPencil} class="h-3.5 w-3.5" />
												Rename
											</button>
											{#if key.revoked}
												<button
													type="button"
													onclick={() => {
														activateApiKey(key.id);
														menuOpenKeyId = null;
													}}
													class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--dash-success)] transition-colors hover:bg-[var(--dash-bg)]"
												>
													<FontAwesomeIcon icon={faUndo} class="h-3.5 w-3.5" />
													Re-activate
												</button>
												<button
													type="button"
													onclick={() => {
														menuOpenKeyId = null;
														deleteApiKey(key.id);
													}}
													class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--dash-error)] transition-colors hover:bg-[var(--dash-bg)]"
												>
													<FontAwesomeIcon icon={faTrash} class="h-3.5 w-3.5" />
													Delete
												</button>
											{:else}
												<button
													type="button"
													onclick={() => {
														menuOpenKeyId = null;
														openShareModal(key.id);
													}}
													class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
												>
													<FontAwesomeIcon icon={faShareAlt} class="h-3.5 w-3.5" />
													Share
												</button>
												<button
													type="button"
													onclick={() => {
														menuOpenKeyId = null;
														revokeApiKey(key.id);
													}}
													class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--dash-error)] transition-colors hover:bg-[var(--dash-bg)]"
												>
													<FontAwesomeIcon icon={faTrash} class="h-3.5 w-3.5" />
													Revoke
												</button>
											{/if}
										</div>
									{/if}
								</div>
							</div>
						</div>

						{#if visibleKeyId === key.id && key.key_plain}
							<div class="mt-2 ml-5">
								<code
									class="rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 font-mono text-xs text-[var(--dash-text-secondary)] select-all"
								>
									{key.key_plain}
								</code>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</Card>

	<!-- Devices Shared With You -->
	{#if sharedDevices.length > 0}
		<Card>
			<div class="flex items-center gap-2 border-b border-[var(--dash-border)] p-4">
				<FontAwesomeIcon icon={faShareAlt} class="h-4 w-4 text-[var(--dash-text-secondary)]" />
				<h2 class="font-medium text-[var(--dash-text)]">Shared with You</h2>
			</div>
			<div class="divide-y divide-[var(--dash-border)]">
				{#each sharedDevices as share (share.id)}
					{@const ownerLabel = share.api_key.owner?.name || share.api_key.owner?.email || 'Unknown'}
					{@const sharedStatus = getSharedDeviceStatus(share.api_key.id)}
					<div class="flex items-center gap-3 p-4">
						<div
							class={`h-2 w-2 flex-shrink-0 rounded-full ${
								sharedStatus ? 'bg-[var(--dash-success)]' : 'bg-[var(--dash-text-muted)]'
							}`}
						></div>
						<div class="min-w-0 flex-1">
							<div class="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
								<p class="truncate font-medium text-[var(--dash-text)]">
									{share.api_key.name}
								</p>
								{#if sharedStatus}
									<span
										class="w-fit rounded-full bg-[var(--dash-success-light)] px-2 py-0.5 text-xs text-[var(--dash-success)]"
									>
										Connected
									</span>
								{/if}
							</div>
							<p class="text-xs text-[var(--dash-text-muted)]">
								{#if sharedStatus}
									v{sharedStatus.clientVersion}
									{#if staleImage(sharedStatus)}
										&middot; <span
											title="The container image is older than the app code. Pull a new image to update Chrome, Node and the base OS."
											>image v{staleImage(sharedStatus)}</span
										>
									{/if}
									&middot; connected {formatRelativeTime(sharedStatus.connectedAt)}
									&middot; shared by {ownerLabel}
								{:else}
									Shared by {ownerLabel}
									{#if share.date_created}
										&middot; {formatDate(share.date_created)}
									{/if}
								{/if}
							</p>
						</div>
					</div>
				{/each}
			</div>
			<div
				class="border-t border-[var(--dash-border)] px-4 py-3 text-xs text-[var(--dash-text-secondary)]"
			>
				Select these devices on the Import Tasks page to import jobs through them.
			</div>
		</Card>
	{/if}
</div>

<!-- Share Device Modal -->
{#if sharingKeyId !== null}
	{@const sharingKey = apiKeys.find((k) => k.id === sharingKeyId)}
	<div
		use:portalToBody={{ onClose: () => (sharingKeyId = null) }}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
	>
		<div
			class="w-full max-w-md rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] shadow-xl"
		>
			<div class="flex items-center justify-between border-b border-[var(--dash-border)] p-4">
				<h3 class="font-medium text-[var(--dash-text)]">
					Share "{sharingKey?.name}"
				</h3>
				<button
					type="button"
					onclick={() => {
						sharingKeyId = null;
					}}
					class="p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
				>
					<FontAwesomeIcon icon={faTimes} class="h-4 w-4" />
				</button>
			</div>

			<div class="p-4">
				{#if sharingLoading}
					<div class="flex items-center justify-center py-8">
						<Spinner size="w-6 h-6" />
					</div>
				{:else}
					{#if sharingContacts.length === 0 && sharingExisting.length === 0}
						<p class="mb-4 text-sm text-[var(--dash-text-secondary)]">
							No contacts yet — invite someone with a link below, or <a
								href="/contacts"
								class="text-[var(--dash-primary)] hover:underline">add a contact</a
							> to share directly.
						</p>
					{:else}
						<!-- Currently shared with -->
						{#if sharingExisting.length > 0}
							<div class="mb-4">
								<p
									class="mb-2 text-xs font-medium tracking-wide text-[var(--dash-text-secondary)] uppercase"
								>
									Shared with
								</p>
								<div class="space-y-2">
									{#each sharingExisting as share (share.id)}
										<div
											class="flex items-center justify-between rounded-lg border border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/5 px-3 py-2"
										>
											<div class="flex items-center gap-2">
												<div
													class="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--dash-primary)]/20 text-xs font-medium text-[var(--dash-primary)]"
												>
													{(share.user.name || share.user.email)[0].toUpperCase()}
												</div>
												<span class="text-sm text-[var(--dash-text)]"
													>{share.user.name || share.user.email}</span
												>
											</div>
											<button
												type="button"
												onclick={() => unshareFromContact(share.user.id)}
												class="p-1 text-[var(--dash-text-muted)] transition-colors hover:text-red-400"
												title="Remove access"
											>
												<FontAwesomeIcon icon={faUserMinus} class="h-3.5 w-3.5" />
											</button>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Available contacts to share with -->
						{@const unsharedContacts = sharingContacts.filter((c) => !isSharedWith(c.id))}
						{#if unsharedContacts.length > 0}
							<div>
								<p
									class="mb-2 text-xs font-medium tracking-wide text-[var(--dash-text-secondary)] uppercase"
								>
									Your contacts
								</p>
								<div class="space-y-1">
									{#each unsharedContacts as contact (contact.id)}
										<button
											type="button"
											onclick={() => shareWithContact(contact.id)}
											class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--dash-bg)]"
										>
											<div
												class="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--dash-text-muted)]/20 text-xs font-medium text-[var(--dash-text-muted)]"
											>
												{(contact.name || contact.email)[0].toUpperCase()}
											</div>
											<span class="text-sm text-[var(--dash-text)]"
												>{contact.name || contact.email}</span
											>
										</button>
									{/each}
								</div>
							</div>
						{:else if sharingExisting.length > 0}
							<p class="py-2 text-center text-sm text-[var(--dash-text-secondary)]">
								Shared with all your contacts.
							</p>
						{/if}
					{/if}

					<!-- Invite by link -->
					<div class="mt-4 border-t border-[var(--dash-border)] pt-4">
						<p
							class="mb-1 text-xs font-medium tracking-wide text-[var(--dash-text-secondary)] uppercase"
						>
							Invite by link
						</p>
						<p class="mb-2 text-xs text-[var(--dash-text-secondary)]">
							Anyone with this link can use this device to scrape jobs — no setup or install on
							their end. They create an account (or sign in) to accept.
						</p>
						{#if inviteLink}
							<div class="flex items-center gap-2">
								<code
									class="min-w-0 flex-1 truncate rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 font-mono text-xs text-[var(--dash-text-secondary)]"
									>{inviteLink}</code
								>
								<span class="shrink-0"><CopyButton text={inviteLink} /></span>
							</div>
							<p class="mt-1.5 text-xs text-[var(--dash-text-muted)]">
								Single-use · expires in 7 days
							</p>
						{:else}
							<button
								type="button"
								onclick={createInviteLink}
								disabled={inviteLoading}
								class="flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)] disabled:opacity-50"
							>
								{#if inviteLoading}
									<Spinner size="w-3.5 h-3.5" />
								{:else}
									<FontAwesomeIcon icon={faLink} class="h-3.5 w-3.5" />
								{/if}
								<span>Create invite link</span>
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
