<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCloud,
    faDesktop,
    faExternalLinkAlt,
    faExpand,
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

  {#if isCloudMode && liveUrl}
    <!-- Cloud mode: GoLogin live view renders at native browser resolution
         which can be small on mobile. Show prominent "open in new tab" on small screens. -->
    <div class="sm:hidden flex flex-col items-center gap-3 p-6 bg-[var(--dash-bg)]">
      <p class="text-sm text-[var(--dash-text-secondary)] text-center">
        Open the browser view in a new tab for the best experience on mobile.
      </p>
      <a
        href={liveUrl}
        target="_blank"
        rel="noopener"
        class="inline-flex items-center gap-2 px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
      >
        <FontAwesomeIcon icon={faExpand} class="w-4 h-4" />
        Open Browser View
      </a>
    </div>
    <div class="hidden sm:block relative" style="padding-bottom: 56.25%;">
      <iframe
        src={browserViewUrl}
        class="absolute inset-0 w-full h-full border-0"
        title="Browser view"
      ></iframe>
    </div>
  {:else}
    <!-- VNC mode: noVNC has built-in resize=scale, works well at any size -->
    <div class="relative" style="padding-bottom: 56.25%;">
      <iframe
        src={browserViewUrl}
        class="absolute inset-0 w-full h-full border-0"
        title="Browser view"
      ></iframe>
    </div>
  {/if}

  {#if statusMessage}
    <div class="p-3 bg-[var(--dash-bg)] border-t border-[var(--dash-border)]">
      <p class="text-sm text-[var(--dash-text-secondary)]">{statusMessage}</p>
    </div>
  {/if}
</Card>
