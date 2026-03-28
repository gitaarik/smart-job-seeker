<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
  import Card from "./Card.svelte";

  interface Props {
    label: string;
    value: string | number;
    icon: IconDefinition;
    color?: string;
    href?: string;
    highlight?: boolean;
  }

  let {
    label,
    value,
    icon,
    color = "text-[var(--dash-text-muted)]",
    href,
    highlight = false,
  }: Props = $props();
</script>

{#if href}
  <a {href} class="block group">
    <Card padding="sm">
      <div class="flex items-center justify-between gap-2.5">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <p class="text-lg font-semibold text-[var(--dash-text)]">
              {value}
            </p>
            {#if highlight}
              <span
                class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"
              ></span>
            {/if}
          </div>
          <p
            class="text-xs text-[var(--dash-text-secondary)] truncate group-hover:text-[var(--dash-primary)] transition-colors"
          >
            {label}
          </p>
        </div>
        <div
          class="w-8 h-8 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center shrink-0 group-hover:bg-[var(--dash-border)] transition-colors"
        >
          <FontAwesomeIcon {icon} class="w-4 h-4 {color}" />
        </div>
      </div>
    </Card>
  </a>
{:else}
  <Card padding="sm">
    <div class="flex items-center justify-between gap-2.5">
      <div class="min-w-0">
        <div class="flex items-center gap-1.5">
          <p class="text-lg font-semibold text-[var(--dash-text)]">
            {value}
          </p>
          {#if highlight}
            <span
              class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"
            ></span>
          {/if}
        </div>
        <p
          class="text-xs text-[var(--dash-text-secondary)] truncate"
        >
          {label}
        </p>
      </div>
      <div
        class="w-8 h-8 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center shrink-0"
      >
        <FontAwesomeIcon {icon} class="w-4 h-4 {color}" />
      </div>
    </div>
  </Card>
{/if}
