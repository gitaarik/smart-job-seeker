<script lang="ts">
  import type { PageData } from "./$types";
  import { onMount, onDestroy } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronDown,
    faChevronUp,
    faCircle,
    faCopy,
    faDesktop,
    faEye,
    faEyeSlash,
    faKey,
    faPlus,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import { faGithub } from "@fortawesome/free-brands-svg-icons";

  import Card from "../../components/Card.svelte";
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

  // Tunnel status polling
  let tunnelConnected = $state(false);
  let tunnelVersion = $state<string | null>(null);
  let tunnelConnectedAt = $state<string | null>(null);
  let tunnelStatus = $state<string>("checking");
  let statusPollInterval: ReturnType<typeof setInterval> | null = null;

  async function pollTunnelStatus() {
    try {
      const res = await fetch(`/api/tunnel?profileId=${data.profileId}`);
      const status = await res.json();
      tunnelConnected = status.connected === true;
      tunnelVersion = status.clientVersion || null;
      tunnelConnectedAt = status.connectedAt || null;
      tunnelStatus = status.connected ? "connected" : "disconnected";
    } catch {
      tunnelStatus = "unavailable";
      tunnelConnected = false;
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
    if (!confirm("Revoke this API key? The desktop app will be disconnected.")) return;

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
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center gap-3">
    <FontAwesomeIcon icon={faDesktop} class="w-5 h-5 text-[var(--dash-text-secondary)]" />
    <h1 class="text-xl font-semibold text-[var(--dash-text)]">Local Scraping Setup</h1>
  </div>

  <p class="text-[var(--dash-text-secondary)]">
    Run the desktop app on your computer to scrape from your home IP address. This avoids datacenter IP detection that can trigger CAPTCHAs.
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
            {:else if tunnelConnected}
              Desktop App Connected
            {:else}
              Desktop App Not Connected
            {/if}
          </p>
          {#if tunnelConnected && tunnelVersion}
            <p class="text-sm text-[var(--dash-text-muted)]">
              v{tunnelVersion}
              {#if tunnelConnectedAt}
                &middot; connected {formatRelativeTime(tunnelConnectedAt)}
              {/if}
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
      <li class="flex gap-3">
        <span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--dash-primary-light)] text-[var(--dash-primary)] flex items-center justify-center text-xs font-semibold">1</span>
        <div>
          <p class="text-[var(--dash-text)]">Install the desktop app</p>
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
        </div>
      </li>
      <li class="flex gap-3">
        <span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--dash-primary-light)] text-[var(--dash-primary)] flex items-center justify-center text-xs font-semibold">2</span>
        <div>
          <p class="text-[var(--dash-text)]">Create an API key below</p>
          <p>This authenticates your desktop app with the server.</p>
        </div>
      </li>
      <li class="flex gap-3">
        <span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--dash-primary-light)] text-[var(--dash-primary)] flex items-center justify-center text-xs font-semibold">3</span>
        <div>
          <p class="text-[var(--dash-text)]">Connect the desktop app</p>
          <p>In the app, select the <strong>{typeof window !== 'undefined' && window.location.host.startsWith('preview.') ? 'Preview' : 'Dev'}</strong> server and enter your API key.</p>
        </div>
      </li>
      <li class="flex gap-3">
        <span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--dash-primary-light)] text-[var(--dash-primary)] flex items-center justify-center text-xs font-semibold">4</span>
        <div>
          <p class="text-[var(--dash-text)]">Start scraping</p>
          <p>Once connected (shown above), start a scrape from your Search Task page. The scraper will use your local Chrome and residential IP.</p>
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
              placeholder="e.g., My Laptop"
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
        <p>No API keys yet. Create one to connect the desktop app.</p>
      </div>
    {:else}
      <div class="divide-y divide-[var(--dash-border)]">
        {#each apiKeys as key (key.id)}
          <div class="p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <div class={`w-2 h-2 rounded-full flex-shrink-0 ${key.revoked ? 'bg-[var(--dash-text-muted)]' : 'bg-[var(--dash-success)]'}`}></div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="font-medium text-[var(--dash-text)] truncate">{key.name}</p>
                    {#if key.revoked}
                      <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-bg)] text-[var(--dash-text-muted)]">
                        Revoked
                      </span>
                    {/if}
                  </div>
                  <p class="text-xs text-[var(--dash-text-muted)]">
                    Created {formatDate(key.date_created)}
                    {#if key.last_used}
                      &middot; Last used {formatDate(key.last_used)}
                    {/if}
                  </p>
                </div>
              </div>
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
                {#if !key.revoked}
                  <button
                    type="button"
                    onclick={() => revokeApiKey(key.id)}
                    class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
                    title="Revoke key"
                  >
                    <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
                  </button>
                {/if}
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
