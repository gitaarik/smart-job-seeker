<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faGlobe } from "@fortawesome/free-solid-svg-icons";

  interface Props {
    platformUrl: string | null | undefined;
    size?: string; // Tailwind size class like "w-5 h-5"
    class?: string;
  }

  let { platformUrl, size = "w-5 h-5", class: className = "" }: Props = $props();

  let imgFailed = $state(false);

  let faviconUrl = $derived.by(() => {
    if (!platformUrl) return null;
    try {
      const parsed = new URL(
        platformUrl.startsWith("http") ? platformUrl : `https://${platformUrl}`,
      );
      return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=128`;
    } catch {
      return null;
    }
  });
</script>

{#if faviconUrl && !imgFailed}
  <img
    src={faviconUrl}
    alt=""
    class="{size} {className} rounded-sm object-contain"
    onerror={() => (imgFailed = true)}
  />
{:else}
  <FontAwesomeIcon icon={faGlobe} class="{size} {className} text-[var(--dash-text-muted)]" />
{/if}
