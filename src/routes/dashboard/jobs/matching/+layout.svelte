<script lang="ts">
  import type { Snippet } from "svelte";
  import { page } from "$app/stores";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faBullseye, faChartBar, faSliders } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";

  let { children }: { children: Snippet } = $props();

  const tabs = [
    { label: "Match Config", href: "/dashboard/jobs/matching/config", icon: faSliders },
    { label: "Match Progress", href: "/dashboard/jobs/matching/progress", icon: faChartBar },
  ];

  let currentPath = $derived($page.url.pathname);
</script>

<div class="space-y-6">
  <SectionHeader title="Job Matching" icon={faBullseye} />

  <!-- Tab navigation -->
  <div class="flex border-b border-[var(--dash-border)]">
    {#each tabs as tab}
      <a
        href={tab.href}
        class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
          {currentPath.startsWith(tab.href)
            ? 'border-[var(--dash-primary)] text-[var(--dash-primary)]'
            : 'border-transparent text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] hover:border-[var(--dash-border)]'}"
      >
        <FontAwesomeIcon icon={tab.icon} class="w-4 h-4" />
        {tab.label}
      </a>
    {/each}
  </div>

  {@render children()}
</div>
