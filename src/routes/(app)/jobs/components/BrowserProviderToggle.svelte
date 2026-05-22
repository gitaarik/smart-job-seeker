<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCloud,
    faCog,
    faHouseSignal,
  } from "@fortawesome/free-solid-svg-icons";

  interface Device {
    apiKeyId: number;
    apiKeyName: string;
    connected: boolean;
  }

  interface Props {
    value: string | null;
    sjsBrowserApiKey?: number | null;
    devices?: Device[];
    localBrowserAllowed?: boolean;
    disabled?: boolean;
    onchange?: (value: string | null) => void;
  }

  let {
    value = $bindable(),
    sjsBrowserApiKey = $bindable(null),
    devices = [],
    localBrowserAllowed = false,
    disabled = false,
    onchange,
  }: Props = $props();

  const connectedCount = $derived(devices.filter((d) => d.connected).length);

  function select(v: string | null) {
    if (disabled) return;
    value = v;
    onchange?.(v);
  }

  function selectDevice(e: Event) {
    const select = e.target as HTMLSelectElement;
    sjsBrowserApiKey = select.value ? parseInt(select.value, 10) : null;
  }
</script>

<div>
  <div class="flex items-center gap-2">
    <div
      class="flex rounded-md overflow-hidden border border-[var(--dash-border)]"
    >
      <button
        type="button"
        {disabled}
        onclick={() => select("tunnel")}
        class="px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors disabled:opacity-60 {value === 'tunnel' ? 'bg-[var(--dash-primary)] text-white' : 'bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)]'}"
      >
        <FontAwesomeIcon icon={faHouseSignal} class="w-3 h-3" />
        My device
        {#if connectedCount > 0}
          <span
            class="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-[var(--dash-success)]"
            title="{connectedCount} {connectedCount === 1
              ? 'device'
              : 'devices'} online"
          ></span>
        {/if}
      </button>
      <button
        type="button"
        {disabled}
        onclick={() => select("hosted")}
        class="px-3 py-1.5 text-xs flex items-center gap-1.5 border-l border-[var(--dash-border)] transition-colors disabled:opacity-60 {value === 'hosted' ? 'bg-[var(--dash-primary)] text-white' : 'bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)]'}"
      >
        <FontAwesomeIcon icon={faCloud} class="w-3 h-3" />
        Cloud
      </button>
      {#if localBrowserAllowed}
        <button
          type="button"
          {disabled}
          onclick={() => select(null)}
          class="px-3 py-1.5 text-xs flex items-center gap-1.5 border-l border-[var(--dash-border)] transition-colors disabled:opacity-60 {value === null ? 'bg-[var(--dash-primary)] text-white' : 'bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)]'}"
        >
          <FontAwesomeIcon icon={faCog} class="w-3 h-3" />
          Local
        </button>
      {/if}
    </div>
  </div>

  {#if value === "tunnel" && devices.length > 0}
    <div class="mt-2">
      <select
        {disabled}
        value={sjsBrowserApiKey ?? ""}
        onchange={selectDevice}
        class="px-2 py-1 text-xs border border-[var(--dash-border)] rounded-md bg-[var(--dash-card)] text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
      >
        <option value="">Any connected device</option>
        {#each devices as device (device.apiKeyId)}
          <option value={device.apiKeyId}>
            {device.apiKeyName}{device.connected ? "" : " (offline)"}
          </option>
        {/each}
      </select>
    </div>
  {/if}

  <p class="text-xs text-[var(--dash-text-muted)] mt-2">
    {#if value === "tunnel"}
      Uses your own device's browser via the tunnel (residential IP). Less
      likely to be detected, but requires a connected device.
    {:else if value === "hosted"}
      Uses a cloud-hosted anti-detect browser (datacenter IP). Fast and
      reliable, but may trigger bot detection on some platforms.
    {:else}
      Uses the server's default browser.
    {/if}
  </p>
</div>
