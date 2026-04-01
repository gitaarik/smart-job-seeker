<!--
  Colored tag pill for job taxonomy categories (job type, work location, experience level).
  Resolves raw values to icons via the taxonomy, handles non-canonical forms automatically.

  Usage:
    <CategoryPill category="job_type" value="full_time" />
    <CategoryPill category="work_location" value="Remote" />
-->
<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { getIcon, CATEGORY_COLORS } from "$lib/data/job-icons";
  import {
    formatJobType,
    formatWorkLocation,
    formatExperienceLevel,
  } from "$lib/format";

  interface Props {
    category: "job_type" | "work_location" | "experience_level";
    value: string;
  }

  let { category, value }: Props = $props();

  const formatters: Record<string, (v: string) => string> = {
    job_type: formatJobType,
    work_location: formatWorkLocation,
    experience_level: formatExperienceLevel,
  };

  let icon = $derived(getIcon(category, value));
  let label = $derived(formatters[category]?.(value) ?? value);
  let colors = $derived(CATEGORY_COLORS[category] ?? "");
</script>

<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border {colors}">
  {#if icon}<FontAwesomeIcon {icon} class="w-2.5 h-2.5" />{/if}
  {label}
</span>
