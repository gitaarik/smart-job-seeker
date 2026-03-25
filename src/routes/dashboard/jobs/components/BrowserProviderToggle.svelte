<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCloud,
    faCog,
    faDesktop,
  } from "@fortawesome/free-solid-svg-icons";

  interface Props {
    value: string | null;
    localBrowserAllowed?: boolean;
    disabled?: boolean;
    onchange?: (value: string | null) => void;
  }

  let {
    value = $bindable(),
    localBrowserAllowed = false,
    disabled = false,
    onchange,
  }: Props = $props();

  function select(v: string | null) {
    if (disabled) return;
    value = v;
    onchange?.(v);
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
        onclick={() => select("local")}
        class="px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors disabled:opacity-60 {value === 'local' ? 'bg-[var(--dash-primary)] text-white' : 'bg-[var(--dash-bg)] text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)]'}"
      >
        <FontAwesomeIcon icon={faDesktop} class="w-3 h-3" />
        Desktop
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
  <p class="text-xs text-[var(--dash-text-muted)] mt-2">
    {#if value === "local"}
      Uses your own computer's browser via the desktop app (residential IP).
      Less likely to be detected, but requires the desktop app to be running.
    {:else if value === "hosted"}
      Uses a cloud-hosted anti-detect browser (datacenter IP). Fast and
      reliable, but may trigger bot detection on some platforms.
    {:else}
      Uses the server's default browser.
    {/if}
  </p>
</div>
