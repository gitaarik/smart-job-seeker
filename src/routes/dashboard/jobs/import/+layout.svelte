<script lang="ts">
  import type { Snippet } from "svelte";
  import { page } from "$app/stores";
  import { faChartBar, faDesktop, faDownload, faEnvelope, faRobot, faSliders } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import TabNav from "../../components/TabNav.svelte";

  let { children }: { children: Snippet } = $props();

  const tabs = [
    { label: "Import Jobs", href: "/dashboard/jobs/import/tasks", icon: faDownload },
    { label: "Match Config", href: "/dashboard/jobs/import/config", icon: faSliders },
    { label: "Match Progress", href: "/dashboard/jobs/import/progress", icon: faChartBar },
    { label: "My Devices", href: "/dashboard/jobs/import/devices", icon: faDesktop },
    { label: "Email Digest", href: "/dashboard/jobs/import/notifications", icon: faEnvelope },
  ];

  function isTabActive(href: string): boolean {
    return $page.url.pathname.startsWith(href);
  }
</script>

<TabNav {tabs} isActive={isTabActive} inset>
  {#snippet header()}
    <SectionHeader title="Import Config" icon={faRobot} />
  {/snippet}
  {@render children()}
</TabNav>
