<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCloud,
    faDesktop,
    faExternalLinkAlt,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "./Card.svelte";

  interface Props {
    liveUrl: string | null;
    statusMessage?: string;
    onclose?: () => void;
  }

  let { liveUrl, statusMessage = "", onclose }: Props = $props();

  let isCloudMode = $derived(!!liveUrl);
  let browserViewUrl = $derived(liveUrl || "/vnc/vnc.html?autoconnect=true&resize=scale");
</script>

<Card class="overflow-hidden">
  <div class="flex items-center justify-between p-3 border-b border-[var(--dash-border)]">
    <div class="flex items-center gap-2">
      <FontAwesomeIcon icon={isCloudMode ? faCloud : faDesktop} class="w-4 h-4 text-[var(--dash-text-secondary)]" />
      <h2 class="font-medium text-[var(--dash-text)]">Browser View</h2>
      {#if isCloudMode}
        <span class="text-xs text-[var(--dash-text-muted)] bg-[var(--dash-bg)] px-2 py-0.5 rounded">
          Cloud
        </span>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      {#if isCloudMode && liveUrl}
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener"
          class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
          title="Open in new tab"
        >
          <FontAwesomeIcon icon={faExternalLinkAlt} class="w-4 h-4" />
        </a>
      {/if}
      {#if onclose}
        <button
          onclick={onclose}
          class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
        >
          <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
        </button>
      {/if}
    </div>
  </div>
  <div class="relative" style="padding-bottom: 56.25%;">
    <iframe
      src={browserViewUrl}
      class="absolute inset-0 w-full h-full border-0"
      title="Browser view"
    ></iframe>
  </div>
  {#if statusMessage}
    <div class="p-3 bg-[var(--dash-bg)] border-t border-[var(--dash-border)]">
      <p class="text-sm text-[var(--dash-text-secondary)]">{statusMessage}</p>
    </div>
  {/if}
</Card>
