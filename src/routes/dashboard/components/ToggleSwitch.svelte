<script lang="ts">
  let {
    checked = $bindable(false),
    disabled = false,
    label = "",
    description = "",
  }: {
    checked: boolean;
    disabled?: boolean;
    label?: string;
    description?: string;
  } = $props();
</script>

<label class="flex items-center justify-between cursor-pointer {disabled ? 'opacity-50 pointer-events-none' : ''}" class:gap-4={label || description}>
  {#if label || description}
    <div>
      {#if label}
        <span class="font-medium text-[var(--dash-text)]">{label}</span>
      {/if}
      {#if description}
        <p class="text-xs text-[var(--dash-text-muted)] mt-0.5">{description}</p>
      {/if}
    </div>
  {/if}
  <div class="relative shrink-0">
    <input
      type="checkbox"
      bind:checked
      {disabled}
      class="sr-only peer"
    />
    <div class="w-11 h-6 bg-[var(--dash-border)] rounded-full peer-checked:bg-[var(--dash-primary)] transition-colors"></div>
    <div class="absolute left-[2px] top-[2px] w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5"></div>
  </div>
</label>
