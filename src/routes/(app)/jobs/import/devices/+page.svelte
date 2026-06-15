<script lang="ts">
  import type { PageData } from "./$types";
  import { onDestroy, onMount } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
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
    faUserMinus,
  } from "@fortawesome/free-solid-svg-icons";
  import { faGithub } from "@fortawesome/free-brands-svg-icons";

  import Card from "../../../components/Card.svelte";
  import CopyButton from "../../../components/CopyButton.svelte";
  import Spinner from "$lib/components/Spinner.svelte";
  import { portalToBody } from "$lib/actions/portal";

  let { data }: { data: PageData } = $props();

  let apiKeys = $state(data.apiKeys);
  let sharedDevices = $derived(data.sharedDevices);
  let sortedApiKeys = $derived(
    [...apiKeys].sort((a, b) => Number(!!a.revoked) - Number(!!b.revoked)),
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

  function isStale(key: typeof apiKeys[number]): boolean {
    if (key.revoked) return false;
    const now = Date.now();
    const created = key.date_created ? new Date(key.date_created).getTime() : 0;
    const lastUsed = key.last_used ? new Date(key.last_used).getTime() : null;
    if (lastUsed === null) {
      return now - created > STALE_NEVER_USED_DAYS * 24 * 3600 * 1000;
    }
    return now - lastUsed > STALE_LAST_USED_DAYS * 24 * 3600 * 1000;
  }

  function isDuplicate(key: typeof apiKeys[number]): boolean {
    return !key.revoked && duplicateNames.has(key.name);
  }
  let showAddForm = $state(false);
  let showManualInstall = $state(false);
  // Setup-instructions panel is open by default; once a user has things wired
  // up they tend to collapse it, so persist that choice across visits.
  const SETUP_STORAGE_KEY = "devices:setupExpanded";
  let setupExpanded = $state(true);

  function toggleSetup() {
    setupExpanded = !setupExpanded;
    try {
      localStorage.setItem(SETUP_STORAGE_KEY, String(setupExpanded));
    } catch {
      // Ignore storage failures (private mode, quota) — toggle still works.
    }
  }
  let newKeyName = $state("");
  let isCreating = $state(false);
  let newlyCreatedKey = $state<string | null>(null);
  let newlyCreatedKeyId = $state<number | null>(null);
  let newlyCreatedKeyName = $state<string>("");
  let visibleKeyId = $state<number | null>(null);

  function dismissNewKey() {
    newlyCreatedKey = null;
    newlyCreatedKeyId = null;
    newlyCreatedKeyName = "";
  }
  let errorMessage = $state<string | null>(null);
  let installTab = $state<"desktop" | "docker">("desktop");

  // Overflow menu and rename state
  let menuOpenKeyId = $state<number | null>(null);
  let menuDropUp = $state(false);
  let editingKeyId = $state<number | null>(null);
  let editKeyName = $state("");

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
      const res = await fetch(
        `/api/api-keys/${keyId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "rename", name }),
        },
      );
      if (res.ok) {
        editingKeyId = null;
        await invalidateAll();
        apiKeys = data.apiKeys;
      }
    } catch {
      errorMessage = "Failed to rename device key";
    }
  }

  // Tunnel status polling
  interface DeviceStatus {
    apiKeyId: number;
    apiKeyName: string;
    connectedAt: string;
    lastHeartbeat: string;
    clientVersion: string;
  }
  interface PreferredDevice extends DeviceStatus {
    isShared: boolean;
    ownerLabel: string | null;
  }
  let connectedDevices = $state<DeviceStatus[]>([]);
  let sharedDeviceStatuses = $state<Map<number, DeviceStatus>>(new Map());
  let preferredDevice = $state<PreferredDevice | null>(null);
  let sjsBrowserStatus = $state<string>("checking");
  let statusPollInterval: ReturnType<typeof setInterval> | null = null;

  // Derive tunnel URL from current host
  let sjsBrowserUrl = $derived(
    typeof window !== "undefined"
      ? `wss://${window.location.host}/tunnel`
      : "wss://app.smartjobseeker.com/tunnel",
  );

  // Live wiring for the just-created device key: the tunnel poll surfaces the
  // device the instant it connects, so the setup wizard can confirm it.
  let newKeyConnected = $derived(
    newlyCreatedKeyId !== null &&
      connectedDevices.some((d) => d.apiKeyId === newlyCreatedKeyId),
  );
  let newKeyDockerCmd = $derived(
    newlyCreatedKey
      ? `docker run -d --name sjs-browser --restart unless-stopped \\
  --shm-size 512m -v sjs_chrome_data:/data \\
  -e SJS_SERVER_URL="${sjsBrowserUrl}" \\
  -e SJS_API_TOKEN="${newlyCreatedKey}" \\
  gitaarik036/sjs-browser:latest`
      : "",
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
      sjsBrowserStatus = status.connected ? "connected" : "disconnected";
    } catch {
      sjsBrowserStatus = "unavailable";
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
          const res = await fetch(
            `/api/tunnel/status?apiKeyId=${s.api_key.id}`,
          );
          if (!res.ok) return [s.api_key.id, undefined] as const;
          const body = await res.json();
          return [
            s.api_key.id,
            (body.devices || [])[0] as DeviceStatus | undefined,
          ] as const;
        } catch {
          return [s.api_key.id, undefined] as const;
        }
      }),
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
      pollPreferredDevice(),
    ]);
  }

  onMount(() => {
    try {
      const stored = localStorage.getItem(SETUP_STORAGE_KEY);
      if (stored !== null) setupExpanded = stored === "true";
    } catch {
      // Ignore storage failures — fall back to the default (expanded).
    }
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
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName.trim(),
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        errorMessage = result.error || result.message ||
          "Failed to create device key";
        return;
      }

      newlyCreatedKey = result.key;
      newlyCreatedKeyId = result.id;
      newlyCreatedKeyName = newKeyName.trim();
      newKeyName = "";
      showAddForm = false;
      // Surface the new device immediately so the wizard can watch it connect.
      await pollOwnedSjsBrowserStatus();
      await invalidateAll();
      apiKeys = data.apiKeys;
    } catch {
      errorMessage = "Failed to create device key";
    } finally {
      isCreating = false;
    }
  }

  async function revokeApiKey(keyId: number) {
    if (!confirm("Revoke this device key? The device will be disconnected.")) {
      return;
    }

    try {
      const res = await fetch(
        `/api/api-keys/${keyId}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        await invalidateAll();
        apiKeys = data.apiKeys;
      }
    } catch {
      errorMessage = "Failed to revoke device key";
    }
  }

  async function activateApiKey(keyId: number) {
    try {
      const res = await fetch(
        `/api/api-keys/${keyId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "activate" }),
        },
      );
      if (res.ok) {
        await invalidateAll();
        apiKeys = data.apiKeys;
      }
    } catch {
      errorMessage = "Failed to activate device key";
    }
  }

  async function deleteApiKey(keyId: number) {
    if (!confirm("Delete this device key? This cannot be undone.")) return;

    try {
      const res = await fetch(
        `/api/api-keys/${keyId}?permanent=true`,
        { method: "DELETE" },
      );
      if (res.ok) {
        await invalidateAll();
        apiKeys = data.apiKeys;
      }
    } catch {
      errorMessage = "Failed to delete device key";
    }
  }

  function formatDate(date: Date | string | null): string {
    if (!date) return "Never";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatRelativeTime(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
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
      const res = await fetch("/api/device-shares/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKeyId: sharingKeyId }),
      });
      const body = await res.json();
      if (res.ok) {
        inviteLink = body.url;
      } else {
        errorMessage = body.error || "Failed to create invite link";
      }
    } catch {
      errorMessage = "Failed to create invite link";
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
        fetch("/api/contacts"),
        fetch(`/api/device-shares?apiKeyId=${apiKeyId}`),
      ]);
      const contactsData = await contactsRes.json();
      const sharesData = await sharesRes.json();

      // Only show accepted contacts
      sharingContacts = (contactsData.contacts || [])
        .filter((c: { status: string }) => c.status === "accepted")
        .map((c: { user: ContactUser }) => c.user);
      sharingExisting = sharesData.shares || [];
    } catch {
      errorMessage = "Failed to load sharing data";
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
      const res = await fetch("/api/device-shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKeyId: sharingKeyId, userId }),
      });

      if (res.ok) {
        await openShareModal(sharingKeyId);
      } else {
        const data = await res.json();
        errorMessage = data.error || "Failed to share device";
      }
    } catch {
      errorMessage = "Failed to share device";
    }
  }

  async function unshareFromContact(userId: string) {
    if (!sharingKeyId) return;

    try {
      const res = await fetch("/api/device-shares", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKeyId: sharingKeyId, userId }),
      });

      if (res.ok) {
        await openShareModal(sharingKeyId);
      }
    } catch {
      errorMessage = "Failed to unshare device";
    }
  }
</script>

<svelte:head>
  <title>My Devices - Job Import - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-4">
  <p class="text-sm text-[var(--dash-text-secondary)]">
    Connect a device to import jobs from your own IP address. Use the desktop
    app on your computer or a self-hosted Docker container on a NAS or server.
  </p>

  <!-- Connection Status -->
  <Card padding="md">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span
          class={preferredDevice ? "text-green-500" : "text-[var(--dash-text-muted)]"}
        >
          <FontAwesomeIcon icon={faDesktop} class="w-4 h-4" />
        </span>
        <div>
          <p
            class="font-medium text-[var(--dash-text)] flex items-center gap-2 flex-wrap"
          >
            {#if sjsBrowserStatus === "checking"}
              Checking connection...
            {:else if preferredDevice}
              <span>{preferredDevice.apiKeyName}</span>
              <span
                class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-success-light)] text-[var(--dash-success)] w-fit"
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
              &middot; connected {
                formatRelativeTime(preferredDevice.connectedAt)
              }
              {#if preferredDevice.isShared && preferredDevice.ownerLabel}
                &middot; shared by {preferredDevice.ownerLabel}
              {/if}
            </p>
          {:else if sjsBrowserStatus !== "checking"}
            <p class="text-sm text-[var(--dash-text-muted)]">
              Follow the setup steps below to connect
            </p>
          {/if}
        </div>
      </div>
      {#if sjsBrowserStatus === "checking"}
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
        flex items-center justify-between w-full text-left {setupExpanded
        ? 'mb-4'
        : ''}
      "
      aria-expanded={setupExpanded}
    >
      <h2 class="font-medium text-[var(--dash-text)]">Setup Instructions</h2>
      <FontAwesomeIcon
        icon={setupExpanded ? faChevronUp : faChevronDown}
        class="w-3.5 h-3.5 text-[var(--dash-text-muted)]"
      />
    </button>
    {#if setupExpanded}
      <ol class="space-y-4 text-sm text-[var(--dash-text-secondary)]">
        <!-- Step 1: Install -->
        <li class="flex gap-3">
          <span
            class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--dash-primary-light)] text-[var(--dash-primary)] flex items-center justify-center text-xs font-semibold"
          >1</span>
          <div class="flex-1">
            <p class="text-[var(--dash-text)] mb-2">Install</p>

            <!-- Install type tabs -->
            <div
              class="flex rounded-md overflow-hidden border border-[var(--dash-border)] w-fit mb-3"
            >
              <button
                type="button"
                onclick={() => {
                  installTab = "desktop";
                }}
                class="px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors {installTab === 'desktop' ? 'bg-[var(--dash-primary)] text-white' : 'bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)]'}"
              >
                <FontAwesomeIcon icon={faDesktop} class="w-3 h-3" />
                Desktop App
              </button>
              <button
                type="button"
                onclick={() => {
                  installTab = "docker";
                }}
                class="px-3 py-1.5 text-xs flex items-center gap-1.5 border-l border-[var(--dash-border)] transition-colors {installTab === 'docker' ? 'bg-[var(--dash-primary)] text-white' : 'bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)]'}"
              >
                <FontAwesomeIcon icon={faServer} class="w-3 h-3" />
                Docker
              </button>
            </div>

            {#if installTab === "desktop"}
              <!-- Desktop App instructions -->
              <p>
                Download the installer for your platform from <a
                  href="https://github.com/gitaarik/sjs-desktop/releases/latest"
                  target="_blank"
                  rel="noopener"
                  class="text-[var(--dash-primary)] hover:underline"
                >GitHub Releases</a>:
              </p>
              <div class="mt-2 space-y-1.5 text-xs">
                <div class="flex items-center gap-2">
                  <span class="text-[var(--dash-text-secondary)] w-16"
                  >macOS</span>
                  <a
                    href="https://github.com/gitaarik/sjs-desktop/releases/latest"
                    target="_blank"
                    rel="noopener"
                    class="text-[var(--dash-primary)] hover:underline font-mono"
                  >.dmg</a>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-[var(--dash-text-secondary)] w-16"
                  >Windows</span>
                  <a
                    href="https://github.com/gitaarik/sjs-desktop/releases/latest"
                    target="_blank"
                    rel="noopener"
                    class="text-[var(--dash-primary)] hover:underline font-mono"
                  >.exe installer</a>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-[var(--dash-text-secondary)] w-16"
                  >Linux</span>
                  <a
                    href="https://github.com/gitaarik/sjs-desktop/releases/latest"
                    target="_blank"
                    rel="noopener"
                    class="text-[var(--dash-primary)] hover:underline font-mono"
                  >.deb</a>
                  <span class="text-[var(--dash-text-secondary)]">or</span>
                  <a
                    href="https://github.com/gitaarik/sjs-desktop/releases/latest"
                    target="_blank"
                    rel="noopener"
                    class="text-[var(--dash-primary)] hover:underline font-mono"
                  >.AppImage</a>
                </div>
              </div>
              <p class="mt-2 text-xs text-[var(--dash-text-secondary)]">
                A compatible browser will be downloaded automatically on first
                launch.
              </p>

              <!-- Manual install toggle -->
              <button
                type="button"
                onclick={() => {
                  showManualInstall = !showManualInstall;
                }}
                class="mt-2 flex items-center gap-1 text-xs text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
              >
                <FontAwesomeIcon
                  icon={showManualInstall ? faChevronUp : faChevronDown}
                  class="w-2.5 h-2.5"
                />
                <span>Manual install from source</span>
              </button>

              {#if showManualInstall}
                <div
                  class="mt-2 bg-[var(--dash-bg)] rounded-lg p-3 text-xs text-[var(--dash-text-secondary)] space-y-2"
                >
                  <p>
                    Requires <a
                      href="https://nodejs.org/"
                      target="_blank"
                      rel="noopener"
                      class="text-[var(--dash-primary)] hover:underline"
                    >Node.js 20+</a> and <a
                      href="https://www.rust-lang.org/tools/install"
                      target="_blank"
                      rel="noopener"
                      class="text-[var(--dash-primary)] hover:underline"
                    >Rust</a>. Clone the repo and build:
                  </p>
                  <div
                    class="bg-[var(--dash-card)] rounded p-2 font-mono text-[var(--dash-text-secondary)] space-y-0.5"
                  >
                    <div>
                      git clone https://github.com/gitaarik/sjs-desktop.git
                    </div>
                    <div>cd sjs-desktop</div>
                    <div>npm install && npm run ui:install</div>
                    <div>npm run tauri:build</div>
                  </div>
                  <p>
                    The installer will be in <code
                      class="bg-[var(--dash-card)] px-1 rounded"
                    >src-tauri/target/release/bundle/</code>.
                  </p>
                </div>
              {/if}

              <!-- Source code link -->
              <p class="mt-2 text-xs text-[var(--dash-text-secondary)]">
                <a
                  href="https://github.com/gitaarik/sjs-desktop"
                  target="_blank"
                  rel="noopener"
                  class="inline-flex items-center gap-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
                >
                  <FontAwesomeIcon icon={faGithub} class="w-3 h-3" />
                  <span>View on GitHub</span>
                </a>
              </p>
            {:else}
              <!-- Docker instructions -->
              <p>
                Run sjs-browser as a Docker container on a NAS (TrueNAS,
                Synology, Unraid) or any server with Docker. The container
                auto-updates the SJS code on its own — no Watchtower or
                platform-level auto-update needed.
              </p>

              <div class="mt-3 space-y-3">
                <div>
                  <p class="text-xs font-medium text-[var(--dash-text)] mb-1">
                    Docker Compose (recommended)
                  </p>
                  <p class="text-xs text-[var(--dash-text-secondary)] mb-2">
                    Create a <code class="bg-[var(--dash-bg)] px-1 rounded"
                    >docker-compose.yml</code> file:
                  </p>
                  <div
                    class="bg-[var(--dash-bg)] rounded-lg p-3 text-xs font-mono text-[var(--dash-text-secondary)] overflow-x-auto"
                  >
                    <pre
                      class="whitespace-pre"
                    >services:
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
                  <p class="text-xs text-[var(--dash-text-secondary)] mt-2">
                    Then run: <code class="bg-[var(--dash-bg)] px-1 rounded"
                    >docker compose up -d</code>
                  </p>
                </div>

                <div>
                  <p class="text-xs font-medium text-[var(--dash-text)] mb-1">
                    Docker Run
                  </p>
                  <div
                    class="bg-[var(--dash-bg)] rounded-lg p-3 text-xs font-mono text-[var(--dash-text-secondary)] overflow-x-auto"
                  >
                    <pre
                      class="whitespace-pre"
                    >docker run -d \
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
                  <p class="text-xs font-medium text-[var(--dash-text)] mb-1">
                    TrueNAS Scale
                  </p>
                  <p class="text-xs text-[var(--dash-text-secondary)]">
                    Use <strong>Custom App</strong> with image <code
                      class="bg-[var(--dash-bg)] px-1 rounded"
                    >gitaarik036/sjs-browser:latest</code>. Add environment
                    variables <code class="bg-[var(--dash-bg)] px-1 rounded"
                    >SJS_SERVER_URL</code> and <code
                      class="bg-[var(--dash-bg)] px-1 rounded"
                    >SJS_API_TOKEN</code>. Set shared memory to 512 MB.
                  </p>
                </div>

                <div>
                  <p class="text-xs font-medium text-[var(--dash-text)] mb-1">
                    Updates
                  </p>
                  <p class="text-xs text-[var(--dash-text-secondary)]">
                    On every container restart and every six hours, sjs-browser
                    fetches the latest signed release tarball from <a
                      href="https://github.com/gitaarik/sjs-browser/releases"
                      target="_blank"
                      rel="noopener"
                      class="underline"
                    >GitHub</a> and verifies its signature against a public key
                    baked into the image. To pin a specific version: set <code
                      class="bg-[var(--dash-bg)] px-1 rounded"
                    >SJS_BROWSER_CHANNEL=v0.5.27</code>. To opt out entirely:
                    set it to <code class="bg-[var(--dash-bg)] px-1 rounded"
                    >disabled</code>. Pull a new image (<code
                      class="bg-[var(--dash-bg)] px-1 rounded"
                    >docker compose pull</code>) every few months for Chrome and
                    base-OS bumps.
                  </p>
                </div>

                <p class="text-xs text-[var(--dash-text-secondary)]">
                  You can view and control the browser directly from the
                  dashboard during import — no extra ports needed.
                </p>
              </div>
            {/if}
          </div>
        </li>

        <!-- Step 2: Create device key -->
        <li class="flex gap-3">
          <span
            class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--dash-primary-light)] text-[var(--dash-primary)] flex items-center justify-center text-xs font-semibold"
          >2</span>
          <div>
            <p class="text-[var(--dash-text)]">Create a device key below</p>
            <p>
              Each device needs its own key. The key name identifies the device.
            </p>
          </div>
        </li>

        <!-- Step 3: Connect -->
        <li class="flex gap-3">
          <span
            class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--dash-primary-light)] text-[var(--dash-primary)] flex items-center justify-center text-xs font-semibold"
          >3</span>
          <div>
            <p class="text-[var(--dash-text)]">Connect the device</p>
            {#if installTab === "desktop"}
              <p>
                In the desktop app, select the <strong>{
                  typeof window !== "undefined" &&
                  (window.location.host.startsWith("app.")
                    ? "Production"
                    : window.location.host.startsWith("preview.")
                    ? "Preview"
                    : "Dev")
                }</strong> server and enter your device key.
              </p>
            {:else}
              <p>
                Replace <code class="bg-[var(--dash-bg)] px-1 rounded text-xs"
                >your-api-key-here</code> in the config with your device key and
                start the container.
              </p>
            {/if}
          </div>
        </li>

        <!-- Step 4: Start importing -->
        <li class="flex gap-3">
          <span
            class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--dash-primary-light)] text-[var(--dash-primary)] flex items-center justify-center text-xs font-semibold"
          >4</span>
          <div>
            <p class="text-[var(--dash-text)]">Start importing</p>
            <p>
              Once connected (shown above), start an import from the Import
              Tasks page. Select "My device" as the browser and choose which
              device to use.
            </p>
          </div>
        </li>
      </ol>
    {/if}
  </Card>

  <!-- Newly Created Key — connect wizard -->
  {#if newlyCreatedKey}
    <Card padding="lg">
      <div class="flex items-start justify-between mb-3">
        <div>
          <h2 class="font-medium text-[var(--dash-text)]">
            Connect "{newlyCreatedKeyName || "your device"}"
          </h2>
          <p class="text-sm text-[var(--dash-text-secondary)]">
            Run the container below on your NAS or server — the key is already
            filled in. Or paste the key into the desktop app.
          </p>
        </div>
        <button
          type="button"
          onclick={dismissNewKey}
          class="text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] ml-4 flex-shrink-0"
          title="Dismiss"
        >
          <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
        </button>
      </div>

      <!-- Pre-filled docker command -->
      <div class="relative">
        <div
          class="bg-[var(--dash-bg)] rounded-lg p-3 pr-10 text-xs font-mono text-[var(--dash-text-secondary)] overflow-x-auto"
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
          class="flex-1 min-w-0 truncate bg-[var(--dash-bg)] px-2 py-1 rounded border border-[var(--dash-border)] font-mono text-[var(--dash-text-secondary)]"
        >{newlyCreatedKey}</code>
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
          <span class="w-2 h-2 rounded-full bg-[var(--dash-success)]"></span>
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
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-error)] text-sm">{errorMessage}</p>
    </div>
  {/if}

  <!-- Device Keys -->
  <Card>
    <div
      class="flex items-center justify-between p-4 border-b border-[var(--dash-border)]"
    >
      <div class="flex items-center gap-2">
        <FontAwesomeIcon
          icon={faKey}
          class="w-4 h-4 text-[var(--dash-text-secondary)]"
        />
        <h2 class="font-medium text-[var(--dash-text)]">Device Keys</h2>
      </div>
      {#if !showAddForm}
        <button
          type="button"
          onclick={() => {
            showAddForm = true;
          }}
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
        >
          <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
          <span>New Key</span>
        </button>
      {/if}
    </div>

    {#if showAddForm}
      <div class="p-4 border-b border-[var(--dash-border)] bg-[var(--dash-bg)]">
        <div class="flex items-end gap-3">
          <div class="flex-1">
            <label
              for="key-name"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Key Name
            </label>
            <input
              type="text"
              id="key-name"
              bind:value={newKeyName}
              placeholder="e.g., My Laptop, NAS"
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)] text-[var(--dash-text)]"
              onkeydown={(e) => {
                if (e.key === "Enter") createApiKey();
              }}
            />
          </div>
          <button
            type="button"
            onclick={createApiKey}
            disabled={isCreating || !newKeyName.trim()}
            class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              newKeyName = "";
            }}
            class="px-3 py-2 border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    {/if}

    {#if apiKeys.length === 0}
      <div class="p-8 text-center text-[var(--dash-text-secondary)]">
        <FontAwesomeIcon icon={faKey} class="w-8 h-8 mb-2 opacity-30" />
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
                class={`w-2 h-2 rounded-full flex-shrink-0 ${
                  key.revoked
                    ? "bg-[var(--dash-text-muted)]"
                    : deviceStatus
                    ? "bg-[var(--dash-success)]"
                    : "bg-[var(--dash-text-muted)]"
                }`}
              >
              </div>
              <div class="flex-1 min-w-0">
                {#if editingKeyId === key.id}
                  <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                    <input
                      type="text"
                      bind:value={editKeyName}
                      class="flex-1 min-w-0 px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:border-[var(--dash-primary)]"
                      onkeydown={(e) => {
                        if (e.key === "Enter") renameApiKey(key.id);
                        if (e.key === "Escape") editingKeyId = null;
                      }}
                    />
                    <div class="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onclick={() => renameApiKey(key.id)}
                        class="px-2 py-1 bg-[var(--dash-primary)] text-white rounded text-sm hover:bg-[var(--dash-primary-hover)] transition-colors"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onclick={() => {
                          editingKeyId = null;
                        }}
                        class="px-2 py-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                {:else}
                  <div
                    class="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2"
                  >
                    <p class="font-medium text-[var(--dash-text)] truncate">
                      {key.name}
                    </p>
                    {#if key.revoked}
                      <span
                        class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-bg)] text-[var(--dash-text-muted)] w-fit"
                      >
                        Revoked
                      </span>
                    {:else if deviceStatus}
                      <span
                        class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-success-light)] text-[var(--dash-success)] w-fit"
                      >
                        Connected
                      </span>
                    {:else if isDuplicate(key) && isStale(key)}
                      <span
                        class="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 w-fit"
                        title="Another key has the same name and this one hasn't connected — likely a leftover from the per-profile setup. Safe to delete."
                      >
                        Duplicate · unused
                      </span>
                    {:else if isDuplicate(key)}
                      <span
                        class="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 w-fit"
                        title="Another key has the same name — leftover from the per-profile setup, or a deliberate second device."
                      >
                        Duplicate
                      </span>
                    {:else if isStale(key)}
                      <span
                        class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-bg)] text-[var(--dash-text-muted)] w-fit"
                        title="No tunnel client has connected with this key recently."
                      >
                        Unused
                      </span>
                    {/if}
                  </div>
                  <p class="text-xs text-[var(--dash-text-muted)]">
                    {#if deviceStatus}
                      v{deviceStatus.clientVersion} &middot; connected {
                        formatRelativeTime(deviceStatus.connectedAt)
                      }
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
                    class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
                    title={visibleKeyId === key.id ? "Hide key" : "Show key"}
                  >
                    <FontAwesomeIcon
                      icon={visibleKeyId === key.id ? faEyeSlash : faEye}
                      class="w-4 h-4"
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
                    class="p-2 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors"
                    title="More actions"
                  >
                    <FontAwesomeIcon
                      icon={faEllipsisVertical}
                      class="w-4 h-4"
                    />
                  </button>
                  {#if menuOpenKeyId === key.id}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="fixed inset-0 z-10"
                      onclick={() => {
                        menuOpenKeyId = null;
                      }}
                      onkeydown={(e) => e.key === "Escape" && (menuOpenKeyId = null)}
                    >
                    </div>
                    <div
                      class={`absolute right-0 z-20 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg shadow-lg py-1 min-w-[170px] ${
                        menuDropUp ? "bottom-full mb-1" : "top-full mt-1"
                      }`}
                    >
                      <button
                        type="button"
                        onclick={() => {
                          editingKeyId = key.id;
                          editKeyName = key.name;
                          menuOpenKeyId = null;
                        }}
                        class="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors text-[var(--dash-text)]"
                      >
                        <FontAwesomeIcon icon={faPencil} class="w-3.5 h-3.5" />
                        Rename
                      </button>
                      {#if key.revoked}
                        <button
                          type="button"
                          onclick={() => {
                            activateApiKey(key.id);
                            menuOpenKeyId = null;
                          }}
                          class="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors text-[var(--dash-success)]"
                        >
                          <FontAwesomeIcon icon={faUndo} class="w-3.5 h-3.5" />
                          Re-activate
                        </button>
                        <button
                          type="button"
                          onclick={() => {
                            menuOpenKeyId = null;
                            deleteApiKey(key.id);
                          }}
                          class="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors text-[var(--dash-error)]"
                        >
                          <FontAwesomeIcon icon={faTrash} class="w-3.5 h-3.5" />
                          Delete
                        </button>
                      {:else}
                        <button
                          type="button"
                          onclick={() => {
                            menuOpenKeyId = null;
                            openShareModal(key.id);
                          }}
                          class="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors text-[var(--dash-text)]"
                        >
                          <FontAwesomeIcon
                            icon={faShareAlt}
                            class="w-3.5 h-3.5"
                          />
                          Share
                        </button>
                        <button
                          type="button"
                          onclick={() => {
                            menuOpenKeyId = null;
                            revokeApiKey(key.id);
                          }}
                          class="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors text-[var(--dash-error)]"
                        >
                          <FontAwesomeIcon icon={faTrash} class="w-3.5 h-3.5" />
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
                  class="text-xs bg-[var(--dash-bg)] px-3 py-1.5 rounded border border-[var(--dash-border)] font-mono select-all text-[var(--dash-text-secondary)]"
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
      <div
        class="flex items-center gap-2 p-4 border-b border-[var(--dash-border)]"
      >
        <FontAwesomeIcon
          icon={faShareAlt}
          class="w-4 h-4 text-[var(--dash-text-secondary)]"
        />
        <h2 class="font-medium text-[var(--dash-text)]">Shared with You</h2>
      </div>
      <div class="divide-y divide-[var(--dash-border)]">
        {#each sharedDevices as share (share.id)}
          {@const ownerLabel = share.api_key.owner?.name || share.api_key.owner?.email ||
          "Unknown"}
          {@const sharedStatus = getSharedDeviceStatus(share.api_key.id)}
          <div class="p-4 flex items-center gap-3">
            <div
              class={`w-2 h-2 rounded-full flex-shrink-0 ${
                sharedStatus ? "bg-[var(--dash-success)]" : "bg-[var(--dash-text-muted)]"
              }`}
            >
            </div>
            <div class="flex-1 min-w-0">
              <div
                class="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2"
              >
                <p class="font-medium text-[var(--dash-text)] truncate">
                  {share.api_key.name}
                </p>
                {#if sharedStatus}
                  <span
                    class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-success-light)] text-[var(--dash-success)] w-fit"
                  >
                    Connected
                  </span>
                {/if}
              </div>
              <p class="text-xs text-[var(--dash-text-muted)]">
                {#if sharedStatus}
                  v{sharedStatus.clientVersion} &middot; connected {
                    formatRelativeTime(sharedStatus.connectedAt)
                  } &middot; shared by {ownerLabel}
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
        class="px-4 py-3 border-t border-[var(--dash-border)] text-xs text-[var(--dash-text-secondary)]"
      >
        Select these devices on the Import Tasks page to import jobs through
        them.
      </div>
    </Card>
  {/if}
</div>

<!-- Share Device Modal -->
{#if sharingKeyId !== null}
  {@const sharingKey = apiKeys.find((k) => k.id === sharingKeyId)}
  <div
    use:portalToBody={{ onClose: () => (sharingKeyId = null) }}
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
  >
    <div
      class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] w-full max-w-md shadow-xl"
    >
      <div
        class="flex items-center justify-between p-4 border-b border-[var(--dash-border)]"
      >
        <h3 class="font-medium text-[var(--dash-text)]">
          Share "{sharingKey?.name}"
        </h3>
        <button
          type="button"
          onclick={() => {
            sharingKeyId = null;
          }}
          class="p-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors"
        >
          <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
        </button>
      </div>

      <div class="p-4">
        {#if sharingLoading}
          <div class="flex items-center justify-center py-8">
            <Spinner size="w-6 h-6" />
          </div>
        {:else}
          {#if sharingContacts.length === 0 && sharingExisting.length === 0}
            <p class="text-sm text-[var(--dash-text-secondary)] mb-4">
              No contacts yet — invite someone with a link below, or <a
                href="/contacts"
                class="text-[var(--dash-primary)] hover:underline"
              >add a contact</a> to share directly.
            </p>
          {:else}
            <!-- Currently shared with -->
            {#if sharingExisting.length > 0}
              <div class="mb-4">
                <p
                  class="text-xs font-medium text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2"
                >
                  Shared with
                </p>
                <div class="space-y-2">
                  {#each sharingExisting as share (share.id)}
                    <div
                      class="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--dash-primary)]/5 border border-[var(--dash-primary)]/20"
                    >
                      <div class="flex items-center gap-2">
                        <div
                          class="w-6 h-6 rounded-full bg-[var(--dash-primary)]/20 flex items-center justify-center text-xs font-medium text-[var(--dash-primary)]"
                        >
                          {
                            (share.user.name || share.user.email)[0].toUpperCase()
                          }
                        </div>
                        <span class="text-sm text-[var(--dash-text)]">{
                          share.user.name || share.user.email
                        }</span>
                      </div>
                      <button
                        type="button"
                        onclick={() => unshareFromContact(share.user.id)}
                        class="p-1 text-[var(--dash-text-muted)] hover:text-red-400 transition-colors"
                        title="Remove access"
                      >
                        <FontAwesomeIcon
                          icon={faUserMinus}
                          class="w-3.5 h-3.5"
                        />
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
                  class="text-xs font-medium text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2"
                >
                  Your contacts
                </p>
                <div class="space-y-1">
                  {#each unsharedContacts as contact (contact.id)}
                    <button
                      type="button"
                      onclick={() => shareWithContact(contact.id)}
                      class="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--dash-bg)] transition-colors text-left"
                    >
                      <div
                        class="w-6 h-6 rounded-full bg-[var(--dash-text-muted)]/20 flex items-center justify-center text-xs font-medium text-[var(--dash-text-muted)]"
                      >
                        {(contact.name || contact.email)[0].toUpperCase()}
                      </div>
                      <span class="text-sm text-[var(--dash-text)]">{
                        contact.name || contact.email
                      }</span>
                    </button>
                  {/each}
                </div>
              </div>
            {:else if sharingExisting.length > 0}
              <p
                class="text-sm text-[var(--dash-text-secondary)] text-center py-2"
              >
                Shared with all your contacts.
              </p>
            {/if}
          {/if}

          <!-- Invite by link -->
          <div class="mt-4 pt-4 border-t border-[var(--dash-border)]">
            <p
              class="text-xs font-medium text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1"
            >
              Invite by link
            </p>
            <p class="text-xs text-[var(--dash-text-secondary)] mb-2">
              Anyone with this link can use this device to scrape jobs — no
              setup or install on their end. They create an account (or sign in)
              to accept.
            </p>
            {#if inviteLink}
              <div class="flex items-center gap-2">
                <code
                  class="flex-1 min-w-0 truncate text-xs bg-[var(--dash-bg)] px-3 py-1.5 rounded border border-[var(--dash-border)] font-mono text-[var(--dash-text-secondary)]"
                >{inviteLink}</code>
                <span class="shrink-0"><CopyButton text={inviteLink} /></span>
              </div>
              <p class="text-xs text-[var(--dash-text-muted)] mt-1.5">
                Single-use · expires in 7 days
              </p>
            {:else}
              <button
                type="button"
                onclick={createInviteLink}
                disabled={inviteLoading}
                class="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50"
              >
                {#if inviteLoading}
                  <Spinner size="w-3.5 h-3.5" />
                {:else}
                  <FontAwesomeIcon icon={faLink} class="w-3.5 h-3.5" />
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
