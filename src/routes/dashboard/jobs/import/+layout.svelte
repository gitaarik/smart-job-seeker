<script lang="ts">
  import type { Snippet } from "svelte";
  import { page } from "$app/stores";
  import { faBullseye, faChartBar, faDesktop, faSearch, faSliders } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import TabNav from "../../components/TabNav.svelte";

  let { children }: { children: Snippet } = $props();

  const tabs = [
    { label: "Job Import", href: "/dashboard/jobs/import/tasks", icon: faSearch },
    { label: "Match Config", href: "/dashboard/jobs/import/config", icon: faSliders },
    { label: "Match Progress", href: "/dashboard/jobs/import/progress", icon: faChartBar },
    { label: "Local Scraping", href: "/dashboard/jobs/import/local-scraping", icon: faDesktop },
  ];

  function isTabActive(href: string): boolean {
    return $page.url.pathname.startsWith(href);
  }
</script>

<div class="space-y-6">
  <SectionHeader title="Import Jobs" icon={faBullseye} />

  <TabNav {tabs} isActive={isTabActive}>
    {@render children()}
  </TabNav>
</div>
