<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faCheck, faCopy } from "@fortawesome/free-solid-svg-icons";

  let {
    text,
    size = "md",
    label = "",
  }: {
    text: string;
    size?: "sm" | "md";
    label?: string;
  } = $props();

  let copied = $state(false);
  let timeout: ReturnType<typeof setTimeout> | null = null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => { copied = false; }, 2000);
    } catch {
      // clipboard not available
    }
  }
</script>

<button
  type="button"
  onclick={copy}
  class="inline-flex items-center gap-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
  title={copied ? "Copied!" : "Copy"}
>
  <FontAwesomeIcon
    icon={copied ? faCheck : faCopy}
    class="{size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} {copied ? 'text-[var(--dash-success)]' : ''}"
  />
  {#if label}
    <span class="{size === 'sm' ? 'text-xs' : 'text-sm'} {copied ? 'text-[var(--dash-success)]' : ''}">{copied ? "Copied!" : label}</span>
  {:else if copied}
    <span class="{size === 'sm' ? 'text-xs' : 'text-sm'} text-[var(--dash-success)]">Copied!</span>
  {/if}
</button>
