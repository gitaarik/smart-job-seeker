<script lang="ts">
  import type { Snippet } from "svelte";
  import { page } from "$app/stores";
  import {
    faDownload,
    faFileImport,
    faExchangeAlt,
    faSlidersH,
    faFileExport,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import TabNav from "../../components/TabNav.svelte";

  let { children }: { children: Snippet } = $props();

  const tabs = [
    { label: "Profile Import", href: "/data/profile-import", icon: faFileImport },
    { label: "Profile Export", href: "/data/profile-export", icon: faDownload },
    { label: "Settings Import", href: "/data/settings-import", icon: faSlidersH },
    { label: "Settings Export", href: "/data/settings-export", icon: faFileExport },
  ];

  function isTabActive(href: string): boolean {
    return $page.url.pathname.startsWith(href);
  }
</script>

<TabNav {tabs} isActive={isTabActive} inset>
  {#snippet header()}
    <SectionHeader title="Import & Export" icon={faExchangeAlt} />
  {/snippet}
  {@render children()}
</TabNav>
