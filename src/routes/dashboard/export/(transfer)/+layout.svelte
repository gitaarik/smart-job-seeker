<script lang="ts">
  import type { Snippet } from "svelte";
  import { page } from "$app/stores";
  import { faDownload, faFileImport, faExchangeAlt } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import TabNav from "../../components/TabNav.svelte";

  let { children }: { children: Snippet } = $props();

  const tabs = [
    { label: "Import", href: "/dashboard/export/import", icon: faFileImport },
    { label: "Export", href: "/dashboard/export/data", icon: faDownload },
  ];

  function isTabActive(href: string): boolean {
    return $page.url.pathname.startsWith(href);
  }
</script>

<div class="space-y-6">
  <SectionHeader title="Import & Export" icon={faExchangeAlt} />

  <TabNav {tabs} isActive={isTabActive}>
    {@render children()}
  </TabNav>
</div>
