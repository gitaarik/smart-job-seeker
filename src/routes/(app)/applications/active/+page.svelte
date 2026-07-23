<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { portalToBody } from "$lib/actions/portal";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBuilding,
    faCalendar,
    faCalendarCheck,
    faChevronDown,
    faClock,
    faFilter,
    faGlobe,
    faHandPointRight,
    faLayerGroup,
    faMapMarkerAlt,
    faMoneyBillWave,
    faPaperPlane,
    faPlus,
    faSearch,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import CategoryPill from "$lib/components/CategoryPill.svelte";
  import { formatSalaryRange, timeAgo } from "$lib/format";
  import {
    statusOptions,
    getStatusLabel,
    getStatusColor,
    getStatusDotColor,
  } from "$lib/application-status";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let applications = $derived(data.applications);
  let openDropdown = $state<string | null>(null);
  let showCreateModal = $state(false);
  let creating = $state(false);

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

  function formatSalary(
    min: number | null,
    max: number | null,
    currency: string | null,
    period: string | null,
  ): string {
    const result = formatSalaryRange(min, max, currency, period);
    return result === "Not specified" ? "" : result;
  }

  function asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value : [];
  }

</script>

<svelte:window onclick={handleWindowClick} />

<svelte:head>
  <title>Applications - Smart Job Seeker</title>
</svelte:head>

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

      <button
        type="button"
        onclick={() => (showCreateModal = true)}
        class="flex items-center gap-2 px-2.5 py-1.5 text-xs bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors"
      >
        <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
        New
      </button>
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
        {@const job = app.job}
        {@const salaryText = job ? formatSalary(job.salary_min, job.salary_max, job.salary_currency, job.salary_period) : ""}
        {@const workLocations = asStringArray(job?.work_location)}
        {@const jobTypes = asStringArray(job?.job_types)}
        {@const experienceLevels = asStringArray(job?.experience_levels)}
        <a
          href="/applications/{app.id}"
          data-app-id={app.id}
          class="block bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden hover:border-[var(--dash-primary)] hover:ring-2 hover:ring-[var(--dash-primary)]/20 transition-all"
        >
          <div class="p-3 sm:p-4">
            <!-- Title (full width) -->
            <h3 class="font-medium text-[var(--dash-text)] text-sm sm:text-base line-clamp-2 sm:truncate">
              {job?.title || "Unknown Position"}
            </h3>

            <!-- Details + Status widget row -->
            <div class="flex items-start gap-3 mt-1">
              <!-- Details -->
              <div class="flex-1 min-w-0">
                <!-- Company, location, platform -->
                <div class="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-[var(--dash-text-secondary)] flex-wrap">
                  {#if job?.company}
                    <span class="flex items-center gap-1">
                      <FontAwesomeIcon icon={faBuilding} class="w-3 h-3" />
                      <span class="truncate max-w-[120px] sm:max-w-none">{job.company}</span>
                    </span>
                  {/if}
                  {#if job?.office_location}
                    <span class="flex items-center gap-1">
                      <FontAwesomeIcon icon={faMapMarkerAlt} class="w-3 h-3" />
                      <span class="truncate max-w-[100px] sm:max-w-none">{job.office_location}</span>
                    </span>
                  {/if}
                  {#if job?.job_platform}
                    <span class="flex items-center gap-1">
                      <FontAwesomeIcon icon={faGlobe} class="w-3.5 h-3.5 text-[var(--dash-text-muted)]" />
                      {job.job_platform.name}
                    </span>
                  {/if}
                </div>

                <!-- Tags: work location, job type, experience level -->
                {#if workLocations.length > 0 || jobTypes.length > 0 || experienceLevels.length > 0}
                  <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {#each workLocations as loc}
                      <CategoryPill category="work_location" value={loc} />
                    {/each}
                    {#each jobTypes as type}
                      <CategoryPill category="job_type" value={type} />
                    {/each}
                    {#each experienceLevels as level}
                      <CategoryPill category="experience_level" value={level} />
                    {/each}
                  </div>
                {/if}

                <!-- Salary and Date row -->
                <div class="flex items-center justify-between mt-1.5 sm:mt-2">
                  <div class="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm flex-wrap">
                    {#if salaryText}
                      <span class="flex items-center gap-1 text-[var(--dash-success)]">
                        <FontAwesomeIcon icon={faMoneyBillWave} class="w-3 h-3" />
                        <span class="truncate max-w-[140px] sm:max-w-none">{salaryText}</span>
                      </span>
                    {/if}
                    {#if app.date_created}
                      <span class="flex items-center gap-1 text-[var(--dash-text-secondary)]">
                        <FontAwesomeIcon icon={faCalendar} class="w-3 h-3" />
                        {timeAgo(app.date_created)}
                        <span class="opacity-50">{formatDate(app.date_created)}</span>
                      </span>
                    {/if}
                  </div>
                </div>
              </div>

              <!-- Status widget (right side) -->
              <div class="flex-shrink-0 self-center">
                <div class="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-bg)] flex flex-col items-center justify-center gap-1 px-3 py-2.5">
                  <span class="text-xs font-semibold uppercase tracking-wide {getStatusDotColor(app.status)} whitespace-nowrap">
                    {getStatusLabel(app.status)}
                  </span>
                  {#if app.status_step}
                    <span class="text-xs text-[var(--dash-text-secondary)] italic whitespace-nowrap">
                      {app.status_step}
                    </span>
                  {/if}
                  {#if app.status_action}
                    {@const isWaiting = app.status_action.startsWith("Awaiting")}
                    {@const isScheduled = app.status_action === "Scheduled"}
                    <span class="text-xs font-medium whitespace-nowrap flex items-center gap-1 {isWaiting ? 'text-[var(--dash-text-muted)]' : isScheduled ? 'text-[var(--dash-success)]' : 'text-[var(--dash-primary)]'}">
                      {#key app.status_action}
                        <FontAwesomeIcon icon={isWaiting ? faClock : isScheduled ? faCalendarCheck : faHandPointRight} class="w-3 h-3" />
                      {/key}
                      {app.status_action}
                    </span>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>

{#if showCreateModal}
  <div
    use:portalToBody={{ onClose: () => (showCreateModal = false) }}
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
    role="dialog"
    onclick={(e) => { if (e.target === e.currentTarget) showCreateModal = false; }}
  >
    <div class="bg-[var(--dash-card)] rounded-xl shadow-lg max-w-lg w-full p-6 my-8">
      <div class="flex items-start justify-between mb-1">
        <h3 class="text-lg font-semibold text-[var(--dash-text)]">New application</h3>
        <button
          type="button"
          onclick={() => (showCreateModal = false)}
          class="p-1 -mr-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors"
          aria-label="Close"
        >
          <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
        </button>
      </div>
      <p class="text-xs text-[var(--dash-text-muted)] mb-4">
        Add a job you're applying to that isn't in your list yet. Leave everything blank
        to create an empty application you can fill in later.
      </p>

      <form
        method="POST"
        action="?/createApplication"
        use:enhance={() => {
          creating = true;
          return async ({ update }) => {
            // Action redirects on success; only reached on failure.
            await update();
            creating = false;
          };
        }}
        class="space-y-3"
      >
        <div>
          <label for="ca-title" class="block text-xs font-medium text-[var(--dash-text-muted)] mb-1">Job title</label>
          <input id="ca-title" name="title" type="text" placeholder="e.g. Senior Frontend Engineer"
            class="w-full px-3 py-1.5 text-sm bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="ca-company" class="block text-xs font-medium text-[var(--dash-text-muted)] mb-1">Company</label>
            <input id="ca-company" name="company" type="text" placeholder="e.g. Acme Inc."
              class="w-full px-3 py-1.5 text-sm bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]" />
          </div>
          <div>
            <label for="ca-location" class="block text-xs font-medium text-[var(--dash-text-muted)] mb-1">Location</label>
            <input id="ca-location" name="office_location" type="text" placeholder="e.g. Amsterdam / Remote"
              class="w-full px-3 py-1.5 text-sm bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]" />
          </div>
        </div>
        <div>
          <label for="ca-url" class="block text-xs font-medium text-[var(--dash-text-muted)] mb-1">Job URL</label>
          <input id="ca-url" name="source_url" type="url" placeholder="https://…"
            class="w-full px-3 py-1.5 text-sm bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]" />
          <p class="text-[10px] text-[var(--dash-text-muted)] mt-1">If it's from a known job platform, we'll link it automatically.</p>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label for="ca-salmin" class="block text-xs font-medium text-[var(--dash-text-muted)] mb-1">Salary min</label>
            <input id="ca-salmin" name="salary_min" type="number" inputmode="numeric" placeholder="0"
              class="w-full px-2 py-1.5 text-sm bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]" />
          </div>
          <div>
            <label for="ca-salmax" class="block text-xs font-medium text-[var(--dash-text-muted)] mb-1">Salary max</label>
            <input id="ca-salmax" name="salary_max" type="number" inputmode="numeric" placeholder="0"
              class="w-full px-2 py-1.5 text-sm bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]" />
          </div>
          <div>
            <label for="ca-cur" class="block text-xs font-medium text-[var(--dash-text-muted)] mb-1">Currency</label>
            <input id="ca-cur" name="salary_currency" type="text" value="EUR"
              class="w-full px-2 py-1.5 text-sm bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]" />
          </div>
          <div>
            <label for="ca-per" class="block text-xs font-medium text-[var(--dash-text-muted)] mb-1">Period</label>
            <select id="ca-per" name="salary_period"
              class="w-full px-2 py-1.5 text-sm bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]">
              <option value="">—</option>
              <option value="year">year</option>
              <option value="month">month</option>
              <option value="week">week</option>
              <option value="day">day</option>
              <option value="hour">hour</option>
            </select>
          </div>
        </div>
        <div>
          <label for="ca-desc" class="block text-xs font-medium text-[var(--dash-text-muted)] mb-1">Description <span class="font-normal">(optional)</span></label>
          <textarea id="ca-desc" name="job_description" rows="4" placeholder="Paste the job description…"
            class="w-full px-3 py-1.5 text-sm bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] resize-y"></textarea>
          <p class="text-[10px] text-[var(--dash-text-muted)] mt-1">Paste the full posting and we'll extract skills, location, salary and more — this may take a few seconds.</p>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onclick={() => (showCreateModal = false)}
            class="px-3 py-1.5 text-sm rounded-md border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={creating}
            class="flex items-center gap-2 px-4 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-60"
          >
            <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
            {creating ? "Creating…" : "Create application"}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

