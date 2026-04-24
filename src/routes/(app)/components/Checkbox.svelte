<script lang="ts">
  let {
    checked = $bindable(false),
    disabled = false,
    label = "",
    onchange,
  }: {
    checked: boolean;
    disabled?: boolean;
    label?: string;
    onchange?: () => void;
  } = $props();
</script>

<label class="flex items-center gap-1.5 text-sm text-[var(--dash-text)] cursor-pointer {disabled ? 'opacity-50 pointer-events-none' : ''}">
  <input
    type="checkbox"
    bind:checked
    {disabled}
    {onchange}
    class="rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
  />
  {#if label}{label}{/if}
</label>
