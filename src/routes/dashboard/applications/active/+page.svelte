<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowRight,
    faBriefcase,
    faCalendar,
    faChevronDown,
    faChevronRight,
    faFilter,
    faGlobe,
    faLayerGroup,
    faMapMarkerAlt,
    faPaperPlane,
    faPlus,
    faSearch,
    faStickyNote,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../components/Card.svelte";
  import PlatformLogo from "$lib/components/PlatformLogo.svelte";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import {
    statusOptions,
    getStatusLabel,
    getStatusColor,
  } from "$lib/application-status";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let applications = $derived(data.applications);
  let expandedId = $state<number | null>(null);
  let openDropdown = $state<string | null>(null);

  // Filter state synced from server data
  let groupFilter = $state(data.currentGroup);
  let phaseFilter = $state(data.currentPhase);
  let platformFilter = $state(data.currentPlatform);
  let searchInput = $state(data.currentSearch);
  let searchInputEl: HTMLInputElement;

  $effect(() => {
    groupFilter = data.currentGroup;
    phaseFilter = data.currentPhase;
    platformFilter = data.currentPlatform;
    searchInput = data.currentSearch;
  });

  const groupOptions = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "action", label: "Needs Action" },
    { value: "finished", label: "Finished" },
  ];

  let hasActiveFilters = $derived(
    groupFilter !== "all" || phaseFilter !== "" || platformFilter !== "" || searchInput !== "",
  );

  function buildUrl(overrides: Record<string, string> = {}) {
    const params = new URLSearchParams();
    const g = overrides.group ?? groupFilter;
    const p = overrides.phase ?? phaseFilter;
    const pl = overrides.platform ?? platformFilter;
    const q = overrides.search ?? searchInput;
    if (g && g !== "all") params.set("group", g);
    if (p) params.set("phase", p);
    if (pl) params.set("platform", pl);
    if (q) params.set("q", q);
    return `?${params.toString()}`;
  }

  function setGroup(value: string) {
    groupFilter = value;
    // Clear phase filter when changing group (phase is a sub-filter)
    phaseFilter = "";
    goto(buildUrl({ group: value, phase: "" }));
  }

  function setPhase(value: string) {
    phaseFilter = value;
    goto(buildUrl({ phase: value }));
  }

  function setPlatform(value: string) {
    platformFilter = value;
    goto(buildUrl({ platform: value }));
  }

  function applySearch() {
    goto(buildUrl());
  }

  function clearFilters() {
    groupFilter = "all";
    phaseFilter = "";
    platformFilter = "";
    searchInput = "";
    goto("?");
  }

  function toggleDropdown(name: string) {
    openDropdown = openDropdown === name ? null : name;
  }

  function handleWindowClick(e: MouseEvent) {
    if (!openDropdown) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-dropdown]")) return;
    openDropdown = null;
  }

  function formatDate(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function toggleExpand(id: number) {
    expandedId = expandedId === id ? null : id;
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="space-y-6">
  <SectionHeader
    title="All Applications"
    icon={faPaperPlane}
  />

  {#if form?.error}
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  <!-- Filters -->
  <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg p-3 sm:p-4">
    <div class="inline-flex flex-col gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <!-- Group -->
      <div class="relative" data-dropdown="group">
        <button
          type="button"
          onclick={() => toggleDropdown("group")}
          class="px-2.5 py-1.5 text-xs rounded-md border transition-colors flex items-center gap-1.5 {groupFilter !== 'all'
            ? 'bg-[var(--dash-primary)]/10 border-[var(--dash-primary)]/30 text-[var(--dash-primary)]'
            : 'bg-[var(--dash-bg)] border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}"
        >
          <FontAwesomeIcon icon={faFilter} class="w-3 h-3 opacity-60" />
          {groupOptions.find(o => o.value === groupFilter)?.label ?? "All"}
          {#if groupFilter === "all"}
            <FontAwesomeIcon icon={faChevronDown} class="w-2.5 h-2.5 opacity-50" />
          {/if}
        </button>
        {#if openDropdown === "group"}
          <div class="absolute top-full left-0 mt-1 z-20 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg shadow-lg py-1 min-w-[160px]">
            {#each groupOptions as opt}
              <button
                type="button"
                onclick={() => { setGroup(opt.value); openDropdown = null; }}
                class="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors"
              >
                <span class="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 {groupFilter === opt.value
                  ? 'border-[var(--dash-primary)]'
                  : 'border-[var(--dash-border)]'}">
                  {#if groupFilter === opt.value}
                    <span class="w-2 h-2 rounded-full bg-[var(--dash-primary)]"></span>
                  {/if}
                </span>
                <span class="text-[var(--dash-text)]">{opt.label}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Phase -->
      <div class="relative" data-dropdown="phase">
        <button
          type="button"
          onclick={() => toggleDropdown("phase")}
          class="px-2.5 py-1.5 text-xs rounded-md border transition-colors flex items-center gap-1.5 {phaseFilter
            ? 'bg-[var(--dash-primary)]/10 border-[var(--dash-primary)]/30 text-[var(--dash-primary)]'
            : 'bg-[var(--dash-bg)] border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}"
        >
          <FontAwesomeIcon icon={faLayerGroup} class="w-3 h-3 opacity-60" />
          {phaseFilter ? getStatusLabel(phaseFilter) : "Phase"}
          {#if !phaseFilter}
            <FontAwesomeIcon icon={faChevronDown} class="w-2.5 h-2.5 opacity-50" />
          {/if}
        </button>
        {#if openDropdown === "phase"}
          <div class="absolute top-full left-0 mt-1 z-20 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg shadow-lg py-1 min-w-[160px]">
            <button
              type="button"
              onclick={() => { setPhase(""); openDropdown = null; }}
              class="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors"
            >
              <span class="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 {!phaseFilter
                ? 'border-[var(--dash-primary)]'
                : 'border-[var(--dash-border)]'}">
                {#if !phaseFilter}
                  <span class="w-2 h-2 rounded-full bg-[var(--dash-primary)]"></span>
                {/if}
              </span>
              <span class="text-[var(--dash-text)]">Any phase</span>
            </button>
            {#each statusOptions as opt}
              <button
                type="button"
                onclick={() => { setPhase(opt.value); openDropdown = null; }}
                class="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors"
              >
                <span class="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 {phaseFilter === opt.value
                  ? 'border-[var(--dash-primary)]'
                  : 'border-[var(--dash-border)]'}">
                  {#if phaseFilter === opt.value}
                    <span class="w-2 h-2 rounded-full bg-[var(--dash-primary)]"></span>
                  {/if}
                </span>
                <span class="{getStatusColor(opt.value)} text-xs px-1.5 py-0.5 rounded-full">{opt.label}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Platform -->
      {#if data.platforms.length > 0}
        <div class="relative" data-dropdown="platform">
          <button
            type="button"
            onclick={() => toggleDropdown("platform")}
            class="px-2.5 py-1.5 text-xs rounded-md border transition-colors flex items-center gap-1.5 {platformFilter
              ? 'bg-[var(--dash-primary)]/10 border-[var(--dash-primary)]/30 text-[var(--dash-primary)]'
              : 'bg-[var(--dash-bg)] border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}"
          >
            <FontAwesomeIcon icon={faGlobe} class="w-3 h-3 opacity-60" />
            {platformFilter ? data.platforms.find(p => String(p.id) === platformFilter)?.name ?? "Platform" : "Platform"}
            {#if !platformFilter}
              <FontAwesomeIcon icon={faChevronDown} class="w-2.5 h-2.5 opacity-50" />
            {/if}
          </button>
          {#if openDropdown === "platform"}
            <div class="absolute top-full left-0 mt-1 z-20 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg shadow-lg py-1 min-w-[160px]">
              <button
                type="button"
                onclick={() => { setPlatform(""); openDropdown = null; }}
                class="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors"
              >
                <span class="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 {!platformFilter
                  ? 'border-[var(--dash-primary)]'
                  : 'border-[var(--dash-border)]'}">
                  {#if !platformFilter}
                    <span class="w-2 h-2 rounded-full bg-[var(--dash-primary)]"></span>
                  {/if}
                </span>
                <span class="text-[var(--dash-text)]">Any platform</span>
              </button>
              {#each data.platforms as plat}
                <button
                  type="button"
                  onclick={() => { setPlatform(String(plat.id)); openDropdown = null; }}
                  class="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors"
                >
                  <span class="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 {platformFilter === String(plat.id)
                    ? 'border-[var(--dash-primary)]'
                    : 'border-[var(--dash-border)]'}">
                    {#if platformFilter === String(plat.id)}
                      <span class="w-2 h-2 rounded-full bg-[var(--dash-primary)]"></span>
                    {/if}
                  </span>
                  <span class="text-[var(--dash-text)]">{plat.name}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      {#if hasActiveFilters}
        <button
          type="button"
          onclick={clearFilters}
          class="px-2.5 py-1.5 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors flex items-center gap-1"
        >
          <FontAwesomeIcon icon={faTimes} class="w-3 h-3" />
          Clear
        </button>
      {/if}

      <form method="POST" action="?/createApplication" use:enhance>
        <button
          type="submit"
          class="flex items-center gap-2 px-2.5 py-1.5 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors"
        >
          <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
          New
        </button>
      </form>
    </div>

    <!-- Search -->
    <div class="flex">
      <div class="relative flex-1">
        <FontAwesomeIcon
          icon={faSearch}
          class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--dash-text-muted)]"
        />
        <input
          type="text"
          bind:value={searchInput}
          bind:this={searchInputEl}
          onkeydown={(e) => e.key === "Enter" && applySearch()}
          onfocus={() => { openDropdown = null; }}
          placeholder="Search job title, company, notes..."
          class="w-full pl-7 pr-7 py-1.5 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-l-md text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]"
        />
        {#if searchInput}
          <button
            type="button"
            onclick={() => {
              searchInput = "";
              applySearch();
              searchInputEl?.focus();
            }}
            class="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors"
            aria-label="Clear search"
          >
            <FontAwesomeIcon icon={faTimes} class="w-3 h-3" />
          </button>
        {/if}
      </div>
      <button
        type="button"
        onclick={applySearch}
        class="px-3 py-1.5 text-xs bg-[var(--dash-primary)] text-white rounded-r-md hover:bg-[var(--dash-primary-hover)] transition-colors flex items-center gap-1.5"
      >
        <FontAwesomeIcon icon={faSearch} class="w-3 h-3" />
        Search
      </button>
    </div>
    </div>
  </div>

  <!-- Applications List -->
  {#if applications.length === 0}
    <EmptyState
      icon={faPaperPlane}
      title="No applications yet"
      description={hasActiveFilters
        ? "No applications match your current filters."
        : "Your job applications will appear here. Start by applying to jobs from the matches page."}
    />
  {:else}
    <div class="space-y-3">
      {#each applications as app (app.id)}
        {@const job = app.jobs}
        <Card class="overflow-hidden">
          <!-- Header -->
          <button
            type="button"
            onclick={() => toggleExpand(app.id)}
            class="w-full flex items-center justify-between p-4 hover:bg-[var(--dash-bg)] transition-colors text-left"
          >
            <div class="flex items-center gap-4 flex-1 min-w-0">
              <div
                class="
                  w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 {getStatusColor(
                  app.status,
                  )}
                "
              >
                <FontAwesomeIcon icon={faPaperPlane} class="w-4 h-4" />
              </div>

              <div class="flex-1 min-w-0">
                <h3 class="font-medium text-[var(--dash-text)] truncate">
                  {job?.title || "Unknown Position"}
                </h3>
                <div class="mt-1 space-y-0.5">
                  <div>
                    <span class="text-xs px-2 py-0.5 rounded-full font-medium {getStatusColor(app.status)}">
                      {getStatusLabel(app.status)}
                    </span>
                  </div>
                  {#if app.status_step}
                    <p class="text-sm text-[var(--dash-text-secondary)] italic">{app.status_step}</p>
                  {/if}
                  {#if app.status_action}
                    <p class="text-xs text-[var(--dash-primary)] font-medium">
                      → {app.status_action}
                      {#if app.status_action === "Scheduled" && app.status_action_date}
                        — {formatDate(app.status_action_date)}
                      {/if}
                    </p>
                  {/if}
                </div>
              </div>
            </div>

            <div class="flex items-center ml-4">
              <span class="inline-block transition-transform duration-200 {expandedId === app.id ? 'rotate-90' : ''}">
                <FontAwesomeIcon
                  icon={faChevronRight}
                  class="w-4 h-4 text-[var(--dash-text-secondary)]"
                />
              </span>
            </div>
          </button>

          <!-- Expanded Content -->
          {#if expandedId === app.id}
            <div class="border-t border-[var(--dash-border)] p-4 space-y-3">
              <!-- Job title -->
              <h4 class="text-lg font-bold text-[var(--dash-text)]">{job?.title || "Unknown Position"}</h4>

              <!-- Job info row -->
              <div class="flex items-center gap-3 text-sm text-[var(--dash-text-secondary)] flex-wrap">
                {#if job?.company}
                  <span class="flex items-center gap-1">
                    <FontAwesomeIcon icon={faBriefcase} class="w-3.5 h-3.5" />
                    {job.company}
                  </span>
                {/if}
                {#if job?.office_location}
                  <span class="flex items-center gap-1">
                    <FontAwesomeIcon icon={faMapMarkerAlt} class="w-3.5 h-3.5" />
                    {job.office_location}
                  </span>
                {/if}
                {#if job?.job_platforms}
                  <span class="flex items-center gap-1">
                    <PlatformLogo
                      platformUrl={job.job_platforms.url}
                      size="w-3.5 h-3.5"
                    />
                    {job.job_platforms.name}
                  </span>
                {/if}
              </div>

              {#if job?.id}
                <div>
                  <a
                    href="/dashboard/jobs/{job.id}"
                    class="inline-flex items-center gap-1.5 text-xs text-[var(--dash-primary)] hover:underline"
                  >
                    View Job
                    <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
                  </a>
                </div>
              {/if}

              {#if app.salary_expectation}
                <p class="text-sm text-[var(--dash-text)]">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: app.salary_currency || "EUR",
                    maximumFractionDigits: 0,
                  }).format(Number(app.salary_expectation))}{#if app.salary_period} / {app.salary_period}{/if}
                </p>
              {/if}

              {#if app.application_note}
                <div class="flex gap-2 px-3 py-2 rounded-lg bg-[var(--dash-bg)] border border-[var(--dash-border)]">
                  <FontAwesomeIcon icon={faStickyNote} class="w-3.5 h-3.5 text-[var(--dash-text-muted)] mt-0.5 flex-shrink-0" />
                  <p class="text-sm text-[var(--dash-text-secondary)] italic">{app.application_note}</p>
                </div>
              {/if}

              {#if app.discontinued_reason}
                <div
                  class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-3 text-sm"
                >
                  <p class="text-[var(--dash-error)] font-medium">
                    Discontinued: {app.discontinued_reason}
                  </p>
                  {#if app.discontinued_note}
                    <p class="text-[var(--dash-error)] mt-1">{app.discontinued_note}</p>
                  {/if}
                </div>
              {/if}

            </div>
          {/if}

          <!-- Footer (always visible) -->
          <div class="border-t border-[var(--dash-border)] px-4 py-2 flex justify-end md:justify-start items-center gap-2">
            <a
              href="/dashboard/applications/{app.id}"
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-hover)] transition-colors whitespace-nowrap"
            >
              Open
              <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
            </a>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>

