<script lang="ts">
  import type { Snippet } from "svelte";
  import { page } from "$app/stores";
  import { faBullseye, faChartBar, faSearch, faSliders } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import TabNav from "../../components/TabNav.svelte";

  let { children }: { children: Snippet } = $props();

  const tabs = [
    { label: "Job Import", href: "/dashboard/jobs/matching/import", icon: faSearch },
    { label: "Match Config", href: "/dashboard/jobs/matching/config", icon: faSliders },
    { label: "Match Progress", href: "/dashboard/jobs/matching/progress", icon: faChartBar },
  ];

  function isTabActive(href: string): boolean {
    return $page.url.pathname.startsWith(href);
  }
</script>

<div class="space-y-6">
  <SectionHeader title="Import & Match" icon={faBullseye} />

  <TabNav {tabs} isActive={isTabActive}>
    {@render children()}
  </TabNav>
</div>
