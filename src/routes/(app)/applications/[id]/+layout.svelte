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

  const basePath = $derived(`/applications/${app.id}`);

  const tabs = $derived([
    { label: "Overview", href: basePath, icon: faClipboardList },
    { label: "Texts", href: `${basePath}/texts`, icon: faEnvelope },
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

<svelte:head>
  <title>{app.job?.title || 'Application'} - Applications - Smart Job Seeker</title>
</svelte:head>

<TabNav {tabs} isActive={isTabActive} inset>
  {#snippet header()}
    <!-- Back link + title -->
    <div class="mb-4">
      <a
        href="/applications/active"
        class="inline-flex items-center gap-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
      >
        <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
        <span class="text-sm">All Applications</span>
      </a>
      {#if app.job?.title}
        <h1 class="text-sm font-medium text-[var(--dash-text)] mt-1 truncate">{app.job.title}</h1>
      {/if}
    </div>
  {/snippet}
  {@render children()}
</TabNav>
