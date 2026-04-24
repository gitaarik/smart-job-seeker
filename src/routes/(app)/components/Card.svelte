<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    padding?: "none" | "sm" | "md" | "lg" | "responsive";
    class?: string;
    children: Snippet;
  }

  let { padding = "none", class: className = "", children }: Props = $props();

  const paddingMap: Record<string, string> = {
    none: "",
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
    responsive: "p-4 sm:p-6",
  };
</script>

<div
  class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] {paddingMap[padding]} {className}"
>
  {@render children()}
</div>
