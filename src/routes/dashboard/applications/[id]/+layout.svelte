<script lang="ts">
  import type { LayoutData } from "./$types";
  import { page } from "$app/stores";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faClipboardList,
    faEnvelope,
    faFileAlt,
    faHistory,
    faMoneyBillWave,
  } from "@fortawesome/free-solid-svg-icons";
  import type { Snippet } from "svelte";
  import TabNav from "../../components/TabNav.svelte";

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  let app = $derived(data.application);

  const basePath = $derived(`/dashboard/applications/${app.id}`);

  const tabs = $derived([
    { label: "Overview", href: basePath, icon: faClipboardList },
    { label: "Texts", href: `${basePath}/letters`, icon: faEnvelope },
    { label: "Salary", href: `${basePath}/salary`, icon: faMoneyBillWave },
    { label: "Documents", href: `${basePath}/documents`, icon: faFileAlt },
    { label: "Timeline", href: `${basePath}/timeline`, icon: faHistory },
  ]);

  function isTabActive(href: string): boolean {
    const currentPath = $page.url.pathname;
    if (href === basePath) {
      return currentPath === basePath;
    }
    return currentPath.startsWith(href);
  }
</script>

<!-- Back link -->
<div class="mb-4">
  <a
    href="/dashboard/applications/active"
    class="flex items-center gap-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
  >
    <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
    <span class="text-sm">All Applications</span>
  </a>
</div>

<div class="-mx-4">
  <TabNav {tabs} isActive={isTabActive}>
    <div class="px-4 pt-3">
      {@render children()}
    </div>
  </TabNav>
</div>
