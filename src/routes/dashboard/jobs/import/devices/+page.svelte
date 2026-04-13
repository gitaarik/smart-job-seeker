<script lang="ts">
  import type { PageData } from "./$types";
  import { onMount, onDestroy } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronDown,
    faChevronUp,
    faCopy,
    faDesktop,
    faEye,
    faEyeSlash,
    faEllipsisVertical,
    faKey,
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
  import Spinner from "$lib/components/Spinner.svelte";

  let { data }: { data: PageData } = $props();

  let apiKeys = $state(data.apiKeys);
  let showAddForm = $state(false);
  let showManualInstall = $state(false);
  let newKeyName = $state("");
  let isCreating = $state(false);
  let newlyCreatedKey = $state<string | null>(null);
  let copiedKeyId = $state<number | null>(null);
  let visibleKeyId = $state<number | null>(null);
  let errorMessage = $state<string | null>(null);
  let installTab = $state<"desktop" | "docker">("desktop");

  // Overflow menu and rename state
  let menuOpenKeyId = $state<number | null>(null);
  let editingKeyId = $state<number | null>(null);
  let editKeyName = $state("");

  async function renameApiKey(keyId: number) {
    const name = editKeyName.trim();
    if (!name) return;

    try {
      const res = await fetch(`/api/api-keys/${keyId}?profileId=${data.profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", name }),
      });
      if (res.ok) {
        editingKeyId = null;
        await invalidateAll();
        apiKeys = data.apiKeys;
      }
    } catch {
      errorMessage = "Failed to rename API key";
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
  let connectedDevices = $state<DeviceStatus[]>([]);
  let tunnelStatus = $state<string>("checking");
  let statusPollInterval: ReturnType<typeof setInterval> | null = null;

  let tunnelConnected = $derived(connectedDevices.length > 0);

  // Derive tunnel URL from current host
  let tunnelUrl = $derived(
    typeof window !== "undefined"
      ? `wss://${window.location.host}/tunnel`
      : "wss://app.smartjobseeker.com/tunnel",
  );

  function getDeviceStatus(apiKeyId: number): DeviceStatus | undefined {
    return connectedDevices.find((d) => d.apiKeyId === apiKeyId);
  }

  async function pollTunnelStatus() {
    try {
      const res = await fetch(`/api/tunnel?profileId=${data.profileId}`);
      const status = await res.json();
      connectedDevices = status.devices || [];
      tunnelStatus = status.connected ? "connected" : "disconnected";
    } catch {
      tunnelStatus = "unavailable";
      connectedDevices = [];
    }
  }

  onMount(() => {
    pollTunnelStatus();
    statusPollInterval = setInterval(pollTunnelStatus, 5000);
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
        body: JSON.stringify({ name: newKeyName.trim(), profileId: data.profileId }),
      });

      const result = await res.json();

      if (!res.ok) {
        errorMessage = result.error || result.message || "Failed to create API key";
        return;
      }

      newlyCreatedKey = result.key;
      newKeyName = "";
      showAddForm = false;
      await invalidateAll();
      apiKeys = data.apiKeys;
    } catch {
      errorMessage = "Failed to create API key";
    } finally {
      isCreating = false;
    }
  }

  async function revokeApiKey(keyId: number) {
    if (!confirm("Revoke this API key? The device will be disconnected.")) return;

    try {
      const res = await fetch(`/api/api-keys/${keyId}?profileId=${data.profileId}`, { method: "DELETE" });
      if (res.ok) {
        await invalidateAll();
        apiKeys = data.apiKeys;
      }
    } catch {
      errorMessage = "Failed to revoke API key";
    }
  }

  async function activateApiKey(keyId: number) {
    try {
      const res = await fetch(`/api/api-keys/${keyId}?profileId=${data.profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate" }),
      });
      if (res.ok) {
        await invalidateAll();
        apiKeys = data.apiKeys;
      }
    } catch {
      errorMessage = "Failed to activate API key";
    }
  }

  async function deleteApiKey(keyId: number) {
    if (!confirm("Permanently delete this API key? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/api-keys/${keyId}?profileId=${data.profileId}&permanent=true`, { method: "DELETE" });
      if (res.ok) {
        await invalidateAll();
        apiKeys = data.apiKeys;
      }
    } catch {
      errorMessage = "Failed to delete API key";
    }
  }

  async function copyToClipboard(text: string, keyId?: number) {
    try {
      await navigator.clipboard.writeText(text);
      if (keyId !== undefined) {
        copiedKeyId = keyId;
        setTimeout(() => { copiedKeyId = null; }, 2000);
      }
    } catch {
      // Fallback: select text
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

  async function openShareModal(apiKeyId: number) {
    sharingKeyId = apiKeyId;
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
  <title>My Devices - Import Jobs - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-4">
  <p class="text-sm text-[var(--dash-text-secondary)]">
    Connect a device to scrape from your own IP address. Use the desktop app on your computer or a self-hosted Docker container on a NAS or server.
  </p>

  <!-- Connection Status -->
  <Card padding="md">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class={`w-3 h-3 rounded-full ${tunnelConnected ? 'bg-[var(--dash-success)]' : 'bg-[var(--dash-text-muted)]'}`}></div>
        <div>
          <p class="font-medium text-[var(--dash-text)]">
            {#if tunnelStatus === "checking"}
              Checking connection...
            {:else if connectedDevices.length > 1}
              {connectedDevices.length} Devices Connected
            {:else if connectedDevices.length === 1}
              {connectedDevices[0].apiKeyName} Connected
            {:else}
              No Device Connected
            {/if}
          </p>
          {#if connectedDevices.length === 1}
            <p class="text-sm text-[var(--dash-text-muted)]">
              v{connectedDevices[0].clientVersion}
              &middot; connected {formatRelativeTime(connectedDevices[0].connectedAt)}
            </p>
          {:else if connectedDevices.length > 1}
            <p class="text-sm text-[var(--dash-text-muted)]">
              {connectedDevices.map((d) => d.apiKeyName).join(", ")}
            </p>
          {:else if tunnelStatus !== "checking"}
            <p class="text-sm text-[var(--dash-text-muted)]">
              Follow the setup steps below to connect
            </p>
          {/if}
        </div>
      </div>
      {#if tunnelStatus === "checking"}
        <Spinner size="w-4 h-4" color="var(--dash-text-muted)" />
      {/if}
    </div>
  </Card>

  <!-- Setup Instructions -->
  <Card padding="lg">
    <h2 class="font-medium text-[var(--dash-text)] mb-4">Setup Instructions</h2>
    <ol class="space-y-4 text-sm text-[var(--dash-text-secondary)]">

      <!-- Step 1: Install -->
      <li class="flex gap-3">
        <span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--dash-primary-light)] text-[var(--dash-primary)] flex items-center justify-center text-xs font-semibold">1</span>
        <div class="flex-1">
          <p class="text-[var(--dash-text)] mb-2">Install</p>

          <!-- Install type tabs -->
          <div class="flex rounded-md overflow-hidden border border-[var(--dash-border)] w-fit mb-3">
            <button
              type="button"
              onclick={() => { installTab = "desktop"; }}
              class="px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors {installTab === 'desktop' ? 'bg-[var(--dash-primary)] text-white' : 'bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)]'}"
            >
              <FontAwesomeIcon icon={faDesktop} class="w-3 h-3" />
              Desktop App
            </button>
            <button
              type="button"
              onclick={() => { installTab = "docker"; }}
              class="px-3 py-1.5 text-xs flex items-center gap-1.5 border-l border-[var(--dash-border)] transition-colors {installTab === 'docker' ? 'bg-[var(--dash-primary)] text-white' : 'bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)]'}"
            >
              <FontAwesomeIcon icon={faServer} class="w-3 h-3" />
              Docker
            </button>
          </div>

          {#if installTab === "desktop"}
            <!-- Desktop App instructions -->
            <p>Download the installer for your platform from <a href="https://github.com/gitaarik/sjs-desktop/releases/latest" target="_blank" rel="noopener" class="text-[var(--dash-primary)] hover:underline">GitHub Releases</a>:</p>
            <div class="mt-2 space-y-1.5 text-xs">
              <div class="flex items-center gap-2">
                <span class="text-[var(--dash-text-secondary)] w-16">macOS</span>
                <a href="https://github.com/gitaarik/sjs-desktop/releases/latest" target="_blank" rel="noopener" class="text-[var(--dash-primary)] hover:underline font-mono">.dmg</a>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[var(--dash-text-secondary)] w-16">Windows</span>
                <a href="https://github.com/gitaarik/sjs-desktop/releases/latest" target="_blank" rel="noopener" class="text-[var(--dash-primary)] hover:underline font-mono">.exe installer</a>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[var(--dash-text-secondary)] w-16">Linux</span>
                <a href="https://github.com/gitaarik/sjs-desktop/releases/latest" target="_blank" rel="noopener" class="text-[var(--dash-primary)] hover:underline font-mono">.deb</a>
                <span class="text-[var(--dash-text-secondary)]">or</span>
                <a href="https://github.com/gitaarik/sjs-desktop/releases/latest" target="_blank" rel="noopener" class="text-[var(--dash-primary)] hover:underline font-mono">.AppImage</a>
              </div>
            </div>
            <p class="mt-2 text-xs text-[var(--dash-text-secondary)]">A compatible browser will be downloaded automatically on first launch.</p>

            <!-- Manual install toggle -->
            <button
              type="button"
              onclick={() => { showManualInstall = !showManualInstall; }}
              class="mt-2 flex items-center gap-1 text-xs text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
            >
              <FontAwesomeIcon icon={showManualInstall ? faChevronUp : faChevronDown} class="w-2.5 h-2.5" />
              <span>Manual install from source</span>
            </button>

            {#if showManualInstall}
              <div class="mt-2 bg-[var(--dash-bg)] rounded-lg p-3 text-xs text-[var(--dash-text-secondary)] space-y-2">
                <p>Requires <a href="https://nodejs.org/" target="_blank" rel="noopener" class="text-[var(--dash-primary)] hover:underline">Node.js 20+</a> and <a href="https://www.rust-lang.org/tools/install" target="_blank" rel="noopener" class="text-[var(--dash-primary)] hover:underline">Rust</a>. Clone the repo and build:</p>
                <div class="bg-[var(--dash-card)] rounded p-2 font-mono text-[var(--dash-text-secondary)] space-y-0.5">
                  <div>git clone https://github.com/gitaarik/sjs-desktop.git</div>
                  <div>cd sjs-desktop</div>
                  <div>npm install && npm run ui:install</div>
                  <div>npm run tauri:build</div>
                </div>
                <p>The installer will be in <code class="bg-[var(--dash-card)] px-1 rounded">src-tauri/target/release/bundle/</code>.</p>
              </div>
            {/if}

            <!-- Source code link -->
            <p class="mt-2 text-xs text-[var(--dash-text-secondary)]">
              <a href="https://github.com/gitaarik/sjs-desktop" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors">
                <FontAwesomeIcon icon={faGithub} class="w-3 h-3" />
                <span>View on GitHub</span>
              </a>
            </p>
          {:else}
            <!-- Docker instructions -->
            <p>Run the tunnel client as a Docker container on a NAS (TrueNAS, Synology, Unraid) or any server with Docker.</p>

            <div class="mt-3 space-y-3">
              <div>
                <p class="text-xs font-medium text-[var(--dash-text)] mb-1">Docker Compose (recommended)</p>
                <p class="text-xs text-[var(--dash-text-secondary)] mb-2">Create a <code class="bg-[var(--dash-bg)] px-1 rounded">docker-compose.yml</code> file:</p>
                <div class="bg-[var(--dash-bg)] rounded-lg p-3 text-xs font-mono text-[var(--dash-text-secondary)] overflow-x-auto">
                  <pre class="whitespace-pre">services:
  sjs-tunnel:
    image: gitaarik036/sjs-tunnel-client:latest
    restart: unless-stopped
    shm_size: "512m"
    volumes:
      - chrome_data:/data
    environment:
      SJS_SERVER_URL: "{tunnelUrl}"
      SJS_API_TOKEN: "your-api-key-here"
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: "2"

volumes:
  chrome_data:</pre>
                </div>
                <p class="text-xs text-[var(--dash-text-secondary)] mt-2">Then run: <code class="bg-[var(--dash-bg)] px-1 rounded">docker compose up -d</code></p>
              </div>

              <div>
                <p class="text-xs font-medium text-[var(--dash-text)] mb-1">Docker Run</p>
                <div class="bg-[var(--dash-bg)] rounded-lg p-3 text-xs font-mono text-[var(--dash-text-secondary)] overflow-x-auto">
                  <pre class="whitespace-pre">docker run -d \
  --name sjs-tunnel \
  --restart unless-stopped \
  --shm-size 512m \
  -v sjs_chrome_data:/data \
  -e SJS_SERVER_URL="{tunnelUrl}" \
  -e SJS_API_TOKEN="your-api-key-here" \
  gitaarik036/sjs-tunnel-client:latest</pre>
                </div>
              </div>

              <div>
                <p class="text-xs font-medium text-[var(--dash-text)] mb-1">TrueNAS Scale</p>
                <p class="text-xs text-[var(--dash-text-secondary)]">
                  Use <strong>Custom App</strong> with image <code class="bg-[var(--dash-bg)] px-1 rounded">gitaarik036/sjs-tunnel-client:latest</code>.
                  Add environment variables <code class="bg-[var(--dash-bg)] px-1 rounded">SJS_SERVER_URL</code> and <code class="bg-[var(--dash-bg)] px-1 rounded">SJS_API_TOKEN</code>.
                  Set shared memory to 512 MB.
                </p>
              </div>

              <p class="text-xs text-[var(--dash-text-secondary)]">
                You can view and control the browser directly from the dashboard during scraping — no extra ports needed.
              </p>
            </div>
          {/if}
        </div>
      </li>

      <!-- Step 2: Create API key -->
      <li class="flex gap-3">
        <span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--dash-primary-light)] text-[var(--dash-primary)] flex items-center justify-center text-xs font-semibold">2</span>
        <div>
          <p class="text-[var(--dash-text)]">Create an API key below</p>
          <p>Each device needs its own API key. The key name identifies the device.</p>
        </div>
      </li>

      <!-- Step 3: Connect -->
      <li class="flex gap-3">
        <span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--dash-primary-light)] text-[var(--dash-primary)] flex items-center justify-center text-xs font-semibold">3</span>
        <div>
          <p class="text-[var(--dash-text)]">Connect the device</p>
          {#if installTab === "desktop"}
            <p>In the desktop app, select the <strong>{typeof window !== 'undefined' && (window.location.host.startsWith('app.') ? 'Production' : window.location.host.startsWith('preview.') ? 'Preview' : 'Dev')}</strong> server and enter your API key.</p>
          {:else}
            <p>Replace <code class="bg-[var(--dash-bg)] px-1 rounded text-xs">your-api-key-here</code> in the config with your API key and start the container.</p>
          {/if}
        </div>
      </li>

      <!-- Step 4: Start scraping -->
      <li class="flex gap-3">
        <span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--dash-primary-light)] text-[var(--dash-primary)] flex items-center justify-center text-xs font-semibold">4</span>
        <div>
          <p class="text-[var(--dash-text)]">Start scraping</p>
          <p>Once connected (shown above), start a scrape from your Import Task page. Select "My device" as the browser and choose which device to use.</p>
        </div>
      </li>
    </ol>
  </Card>

  <!-- Newly Created Key Banner -->
  {#if newlyCreatedKey}
    <div class="bg-[var(--dash-success-light)] border border-[var(--dash-success)] rounded-lg p-4">
      <div class="flex items-center justify-between">
        <p class="font-medium text-[var(--dash-success)]">API key created. You can view and copy it from the list below.</p>
        <button
          type="button"
          onclick={() => { newlyCreatedKey = null; }}
          class="text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] ml-4 flex-shrink-0"
        >
          <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
        </button>
      </div>
    </div>
  {/if}

  <!-- Error Message -->
  {#if errorMessage}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{errorMessage}</p>
    </div>
  {/if}

  <!-- API Keys -->
  <Card>
    <div class="flex items-center justify-between p-4 border-b border-[var(--dash-border)]">
      <div class="flex items-center gap-2">
        <FontAwesomeIcon icon={faKey} class="w-4 h-4 text-[var(--dash-text-secondary)]" />
        <h2 class="font-medium text-[var(--dash-text)]">API Keys</h2>
      </div>
      {#if !showAddForm}
        <button
          type="button"
          onclick={() => { showAddForm = true; }}
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
            <label for="key-name" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
              Key Name
            </label>
            <input
              type="text"
              id="key-name"
              bind:value={newKeyName}
              placeholder="e.g., My Laptop, NAS"
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent bg-[var(--dash-card)] text-[var(--dash-text)]"
              onkeydown={(e) => { if (e.key === "Enter") createApiKey(); }}
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
            onclick={() => { showAddForm = false; newKeyName = ""; }}
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
        <p>No API keys yet. Create one to connect a device.</p>
      </div>
    {:else}
      <div class="divide-y divide-[var(--dash-border)]">
        {#each apiKeys as key (key.id)}
          {@const deviceStatus = getDeviceStatus(key.id)}
          <div class="p-4">
            <!-- Name row -->
            <div class="flex items-center gap-3">
              <div class={`w-2 h-2 rounded-full flex-shrink-0 ${key.revoked ? 'bg-[var(--dash-text-muted)]' : deviceStatus ? 'bg-[var(--dash-success)]' : 'bg-[var(--dash-text-muted)]'}`}></div>
              <div class="flex-1 min-w-0">
                {#if editingKeyId === key.id}
                  <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                    <input
                      type="text"
                      bind:value={editKeyName}
                      class="flex-1 min-w-0 px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:border-[var(--dash-primary)]"
                      onkeydown={(e) => { if (e.key === "Enter") renameApiKey(key.id); if (e.key === "Escape") editingKeyId = null; }}
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
                        onclick={() => { editingKeyId = null; }}
                        class="px-2 py-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                {:else}
                  <div class="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                    <p class="font-medium text-[var(--dash-text)] truncate">{key.name}</p>
                    {#if key.revoked}
                      <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-bg)] text-[var(--dash-text-muted)] w-fit">
                        Revoked
                      </span>
                    {:else if deviceStatus}
                      <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-success-light)] text-[var(--dash-success)] w-fit">
                        Connected
                      </span>
                    {/if}
                  </div>
                  <p class="text-xs text-[var(--dash-text-muted)]">
                    {#if deviceStatus}
                      v{deviceStatus.clientVersion} &middot; connected {formatRelativeTime(deviceStatus.connectedAt)}
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
                    onclick={() => { visibleKeyId = visibleKeyId === key.id ? null : key.id; }}
                    class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
                    title={visibleKeyId === key.id ? "Hide key" : "Show key"}
                  >
                    <FontAwesomeIcon icon={visibleKeyId === key.id ? faEyeSlash : faEye} class="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onclick={() => copyToClipboard(key.key_plain, key.id)}
                    class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
                    title="Copy key"
                  >
                    <FontAwesomeIcon icon={copiedKeyId === key.id ? faCheck : faCopy} class="w-4 h-4 {copiedKeyId === key.id ? 'text-[var(--dash-success)]' : ''}" />
                  </button>
                {/if}

                <!-- Overflow menu -->
                <div class="relative">
                  <button
                    type="button"
                    onclick={() => { menuOpenKeyId = menuOpenKeyId === key.id ? null : key.id; }}
                    class="p-2 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors"
                    title="More actions"
                  >
                    <FontAwesomeIcon icon={faEllipsisVertical} class="w-4 h-4" />
                  </button>
                  {#if menuOpenKeyId === key.id}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="fixed inset-0 z-10"
                      onclick={() => { menuOpenKeyId = null; }}
                      onkeydown={(e) => e.key === "Escape" && (menuOpenKeyId = null)}
                    ></div>
                    <div class="absolute right-0 top-full mt-1 z-20 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg shadow-lg py-1 min-w-[170px]">
                      <button
                        type="button"
                        onclick={() => { editingKeyId = key.id; editKeyName = key.name; menuOpenKeyId = null; }}
                        class="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors text-[var(--dash-text)]"
                      >
                        <FontAwesomeIcon icon={faPencil} class="w-3.5 h-3.5" />
                        Rename
                      </button>
                      {#if key.revoked}
                        <button
                          type="button"
                          onclick={() => { activateApiKey(key.id); menuOpenKeyId = null; }}
                          class="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors text-[var(--dash-success)]"
                        >
                          <FontAwesomeIcon icon={faUndo} class="w-3.5 h-3.5" />
                          Re-activate
                        </button>
                        <button
                          type="button"
                          onclick={() => { menuOpenKeyId = null; deleteApiKey(key.id); }}
                          class="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors text-[var(--dash-error)]"
                        >
                          <FontAwesomeIcon icon={faTrash} class="w-3.5 h-3.5" />
                          Delete permanently
                        </button>
                      {:else}
                        <button
                          type="button"
                          onclick={() => { menuOpenKeyId = null; openShareModal(key.id); }}
                          class="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors text-[var(--dash-text)]"
                        >
                          <FontAwesomeIcon icon={faShareAlt} class="w-3.5 h-3.5" />
                          Share
                        </button>
                        <button
                          type="button"
                          onclick={() => { menuOpenKeyId = null; revokeApiKey(key.id); }}
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
                <code class="text-xs bg-[var(--dash-bg)] px-3 py-1.5 rounded border border-[var(--dash-border)] font-mono select-all text-[var(--dash-text-secondary)]">
                  {key.key_plain}
                </code>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </Card>
</div>

<!-- Share Device Modal -->
{#if sharingKeyId !== null}
  {@const sharingKey = apiKeys.find((k) => k.id === sharingKeyId)}
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] w-full max-w-md shadow-xl">
      <div class="flex items-center justify-between p-4 border-b border-[var(--dash-border)]">
        <h3 class="font-medium text-[var(--dash-text)]">
          Share "{sharingKey?.name}"
        </h3>
        <button
          type="button"
          onclick={() => { sharingKeyId = null; }}
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
        {:else if sharingContacts.length === 0}
          <div class="text-center py-6">
            <p class="text-sm text-[var(--dash-text-secondary)]">
              No contacts yet. <a href="/dashboard/contacts" class="text-[var(--dash-primary)] hover:underline">Add contacts</a> to share devices.
            </p>
          </div>
        {:else}
          <!-- Currently shared with -->
          {#if sharingExisting.length > 0}
            <div class="mb-4">
              <p class="text-xs font-medium text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2">Shared with</p>
              <div class="space-y-2">
                {#each sharingExisting as share (share.id)}
                  <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--dash-primary)]/5 border border-[var(--dash-primary)]/20">
                    <div class="flex items-center gap-2">
                      <div class="w-6 h-6 rounded-full bg-[var(--dash-primary)]/20 flex items-center justify-center text-xs font-medium text-[var(--dash-primary)]">
                        {(share.user.name || share.user.email)[0].toUpperCase()}
                      </div>
                      <span class="text-sm text-[var(--dash-text)]">{share.user.name || share.user.email}</span>
                    </div>
                    <button
                      type="button"
                      onclick={() => unshareFromContact(share.user.id)}
                      class="p-1 text-[var(--dash-text-muted)] hover:text-red-400 transition-colors"
                      title="Remove access"
                    >
                      <FontAwesomeIcon icon={faUserMinus} class="w-3.5 h-3.5" />
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
              <p class="text-xs font-medium text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2">Your contacts</p>
              <div class="space-y-1">
                {#each unsharedContacts as contact (contact.id)}
                  <button
                    type="button"
                    onclick={() => shareWithContact(contact.id)}
                    class="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--dash-bg)] transition-colors text-left"
                  >
                    <div class="w-6 h-6 rounded-full bg-[var(--dash-text-muted)]/20 flex items-center justify-center text-xs font-medium text-[var(--dash-text-muted)]">
                      {(contact.name || contact.email)[0].toUpperCase()}
                    </div>
                    <span class="text-sm text-[var(--dash-text)]">{contact.name || contact.email}</span>
                  </button>
                {/each}
              </div>
            </div>
          {:else if sharingExisting.length > 0}
            <p class="text-sm text-[var(--dash-text-secondary)] text-center py-2">
              Shared with all your contacts.
            </p>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}
