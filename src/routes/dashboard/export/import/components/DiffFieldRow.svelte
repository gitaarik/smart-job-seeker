<script lang="ts">
  import type { FieldDiff } from "$lib/resume-diff";

  interface Props {
    diff: FieldDiff;
    showUnchanged?: boolean;
  }

  let { diff = $bindable(), showUnchanged = false }: Props = $props();
</script>

{#if diff.changed || showUnchanged}
  <div
    class="flex items-start gap-3 py-2 px-3 rounded-md {diff.changed
      ? 'bg-[var(--dash-bg)]'
      : ''}"
  >
    {#if diff.changed}
      <label class="flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          bind:checked={diff.enabled}
          class="rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
        />
      </label>
    {:else}
      <div class="w-4 flex-shrink-0"></div>
    {/if}

    <div class="flex-1 min-w-0">
      <div
        class="text-xs font-medium text-[var(--dash-text-secondary)] mb-0.5"
      >
        {diff.label}
      </div>
      {#if diff.changed}
        <div class="space-y-0.5">
          {#if diff.current}
            <div
              class="text-sm text-[var(--dash-text-muted)] line-through break-words"
            >
              {diff.current}
            </div>
          {/if}
          {#if diff.incoming}
            <div class="text-sm text-[var(--dash-text)] break-words">
              {diff.incoming}
            </div>
          {:else}
            <div class="text-sm text-[var(--dash-text-muted)] italic">
              (removed)
            </div>
          {/if}
        </div>
      {:else}
        <div class="text-sm text-[var(--dash-text-muted)]">
          {diff.current || "—"}
        </div>
      {/if}
    </div>
  </div>
{/if}
