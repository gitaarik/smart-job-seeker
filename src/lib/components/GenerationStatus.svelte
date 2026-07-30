<script lang="ts">
  /**
   * Resumable "AI is working…" banner for LLM generations.
   *
   * The in-flight state is tracked server-side (see ai-generation-status.ts), so
   * unlike the ephemeral client-side spinner it survives a page refresh, a
   * second tab, or coming back later. While `active`, this polls (invalidateAll)
   * so the result appears on its own when the generation finishes. It's
   * self-terminating: the poll re-reads the server flag, which clears when the
   * generation ends (or after the staleness TTL), flipping `active` to false.
   */
  import { invalidateAll } from "$app/navigation";
  import Spinner from "$lib/components/Spinner.svelte";

  let {
    active = false,
    message =
      "The AI is still working on this. You can leave — the result will appear here when it's ready.",
    intervalMs = 2500,
  }: {
    active?: boolean;
    message?: string;
    intervalMs?: number;
  } = $props();

  $effect(() => {
    if (!active) return;
    const id = setInterval(() => {
      invalidateAll();
    }, intervalMs);
    return () => clearInterval(id);
  });
</script>

{#if active}
  <div
    class="flex items-center gap-3 rounded-lg border border-[var(--dash-primary)]/30 bg-[var(--dash-primary-light)] p-3"
    role="status"
    aria-live="polite"
  >
    <Spinner size="w-4 h-4" />
    <p class="text-sm text-[var(--dash-text)]">{message}</p>
  </div>
{/if}
