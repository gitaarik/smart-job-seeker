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
  import { getStatusLabel, getStatusColor } from "$lib/application-status";

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  let app = $derived(data.application);
  let job = $derived(app.jobs);

  const basePath = $derived(`/dashboard/applications/${app.id}`);

  const tabs = [
    { label: "Overview", href: "", icon: faClipboardList },
    { label: "Letters", href: "/letters", icon: faEnvelope },
    { label: "Timeline", href: "/timeline", icon: faHistory },
    { label: "Documents", href: "/documents", icon: faFileAlt },
    { label: "Salary", href: "/salary", icon: faMoneyBillWave },
  ];

  function isTabActive(tabHref: string): boolean {
    const currentPath = $page.url.pathname;
    const fullHref = basePath + tabHref;
    if (tabHref === "") {
      return currentPath === basePath;
    }
    return currentPath.startsWith(fullHref);
  }
</script>

<!-- Header -->
<div class="space-y-4 mb-6">
  <div class="flex items-center gap-4">
    <a
      href="/dashboard/applications/active"
      class="p-2 rounded-lg border border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)] transition-colors"
      aria-label="Back to applications"
    >
      <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
    </a>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-3 flex-wrap">
        <h1 class="text-2xl font-bold text-[var(--dash-text)] truncate">
          {job?.title || `Application #${app.id}`}
        </h1>
        <span
          class="text-xs px-2.5 py-1 rounded-full font-medium {getStatusColor(app.status)}"
        >
          {getStatusLabel(app.status)}{#if app.status_step} &middot; {app.status_step}{/if}{#if app.status_action} &rarr; {app.status_action}{/if}
        </span>
      </div>
      {#if job?.company}
        <p class="text-sm text-[var(--dash-text-secondary)] mt-0.5">
          {job.company}
          {#if job.office_location}
            <span class="mx-1">&middot;</span>{job.office_location}
          {/if}
          {#if job.job_platforms?.name}
            <span class="mx-1">&middot;</span>{job.job_platforms.name}
          {/if}
        </p>
      {/if}
    </div>
  </div>

  <!-- Tab Navigation -->
  <div class="flex gap-1 border-b border-[var(--dash-border)] overflow-x-auto">
    {#each tabs as tab}
      <a
        href="{basePath}{tab.href}"
        class="
          flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
          {isTabActive(tab.href)
          ? 'border-[var(--dash-primary)] text-[var(--dash-primary)]'
          : 'border-transparent text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] hover:border-[var(--dash-border)]'}
        "
      >
        <FontAwesomeIcon icon={tab.icon} class="w-4 h-4" />
        {tab.label}
      </a>
    {/each}
  </div>
</div>

{@render children()}
