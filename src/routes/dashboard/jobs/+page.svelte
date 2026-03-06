<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { navigating } from "$app/stores";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowRight,
    faBan,
    faBriefcase,
    faBookmark,
    faCheck,
    faListCheck,
    faChevronLeft,
    faChevronRight,
    faFilter,
    faMoneyBillWave,
    faSearch,
    faSpinner,
    faStar as faStarSolid,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";
  import { faStar as faStarRegular } from "@fortawesome/free-regular-svg-icons";
  import SectionHeader from "../profile/components/SectionHeader.svelte";
  import EmptyState from "../profile/components/EmptyState.svelte";
  import JobCard from "./components/JobCard.svelte";
  import { formatJobType, formatWorkLocation } from "$lib/format";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let jobs = $derived(data.jobs);
  let platforms = $derived(data.platforms);
  let totalCount = $derived(data.totalCount);
  let currentPage = $derived(data.currentPage);
  let totalPages = $derived(data.totalPages);
  let filters = $derived(data.filters);

  // Use a plain object for reactivity (Svelte 5 tracks object property access)
  let savedJobIds = $state<Record<number, boolean>>(
    Object.fromEntries(data.savedJobIds.map((id: number) => [id, true]))
  );

  // Track rejected jobs
  let rejectedJobIds = $state<Record<number, boolean>>(
    Object.fromEntries(
      Object.entries(data.matchesByJobId)
        .filter(([_, m]) => m.status === "rejected")
        .map(([id, _]) => [parseInt(id), true])
    )
  );

  // Store match data by job ID
  let matchesByJobId = $derived(data.matchesByJobId);

  function isSaved(jobId: number): boolean {
    return savedJobIds[jobId] === true;
  }

  function isRejected(jobId: number): boolean {
    return rejectedJobIds[jobId] === true;
  }

  function toggleSaved(jobId: number, save: boolean) {
    if (save) {
      savedJobIds[jobId] = true;
      // Also unreject if it was rejected
      delete rejectedJobIds[jobId];
    } else {
      delete savedJobIds[jobId];
    }
  }

  function toggleRejected(jobId: number, rejected: boolean) {
    if (rejected) {
      rejectedJobIds[jobId] = true;
      // Also unsave if it was saved
      delete savedJobIds[jobId];
    } else {
      delete rejectedJobIds[jobId];
    }
  }

  function getMatch(jobId: number) {
    const m = matchesByJobId[jobId];
    if (!m || m.score === 0) return null;
    return {
      id: m.id,
      score: m.score,
      skill_match_percentage: m.skill_match_percentage,
      matched_skills: m.matched_skills as string[] | null,
      match_summary: m.match_summary as string | null,
      status: m.status,
    };
  }

  function isMatched(jobId: number): boolean {
    const m = matchesByJobId[jobId];
    return !!m?.reasoning;
  }

  let profileSkillLevels = $derived(data.profileSkillLevels);

  function getSkillMatchStrength(jobId: number, skill: string): "strong" | "weak" | null {
    const match = getMatch(jobId);
    if (!match?.matched_skills) return null;
    if (!match.matched_skills.includes(skill)) return null;
    const level = profileSkillLevels[skill.toLowerCase()];
    if (level === "weak") return "weak";
    return "strong";
  }

  // Local state for form inputs
  let filterType = $state(filters.filter);
  let searchInput = $state(filters.search);
  let platformFilter = $state(filters.platform);
  let workLocationFilter = $state(filters.workLocation);
  let jobTypeFilter = $state(filters.jobType);
  let minScoreFilter = $state(filters.minScore);
  let datePostedFilter = $state(filters.datePosted);
  let showFilters = $state(false);
  let expandedId = $state<number | null>(null);
  let searchInputEl: HTMLInputElement;

  // Filter type options (tabs)
  const filterTabs = [
    { value: "all", label: "All Jobs", mobileLabel: "All", icon: faBriefcase },
    { value: "matches", label: "Matches", mobileLabel: "Matches", icon: faListCheck },
    { value: "saved", label: "Saved", mobileLabel: "Saved", icon: faBookmark },
  ];

  // Get page title based on filter
  let pageTitle = $derived(
    filterType === "matches"
      ? "Job Matches"
      : filterType === "saved"
        ? "Saved Jobs"
        : "All Jobs"
  );

  let pageIcon = $derived(
    filterType === "matches"
      ? faListCheck
      : filterType === "saved"
        ? faBookmark
        : faBriefcase
  );

  function buildUrl(overrides: Record<string, string | undefined> = {}) {
    const params = new URLSearchParams();
    const f = overrides.filter ?? filterType;
    const q = overrides.search ?? searchInput;
    const p = overrides.platform ?? platformFilter;
    const wl = overrides.workLocation ?? workLocationFilter;
    const jt = overrides.jobType ?? jobTypeFilter;
    const ms = overrides.minScore ?? minScoreFilter;
    const dp = overrides.datePosted ?? datePostedFilter;
    const pg = overrides.page ?? "1";

    if (f !== "all") params.set("filter", f);
    if (q) params.set("q", q);
    if (p) params.set("platform", p);
    if (wl) params.set("workLocation", wl);
    if (jt) params.set("jobType", jt);
    if (ms) params.set("minScore", ms);
    if (dp) params.set("datePosted", dp);
    if (pg !== "1") params.set("page", pg);

    return `?${params.toString()}`;
  }

  function switchFilter(filter: string) {
    filterType = filter;
    goto(buildUrl({ filter, page: "1" }));
  }

  function applyFilters() {
    goto(buildUrl({ page: "1" }));
  }

  function clearFilters() {
    searchInput = "";
    platformFilter = "";
    workLocationFilter = "";
    jobTypeFilter = "";
    minScoreFilter = "";
    datePostedFilter = "";
    goto(buildUrl({
      search: "",
      platform: "",
      workLocation: "",
      jobType: "",
      minScore: "",
      datePosted: "",
      page: "1",
    }));
  }

  function goToPage(page: number) {
    goto(buildUrl({ page: page.toString() }));
  }

  function toggleExpand(id: number) {
    expandedId = expandedId === id ? null : id;
  }

  function formatDate(date: Date | string | null): string {
    if (!date) return "N/A";
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
    if (!min && !max) return "";
    const curr = currency || "USD";
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
      maximumFractionDigits: 0,
    });
    let result = "";
    if (min && max) {
      result = `${formatter.format(min)} - ${formatter.format(max)}`;
    } else if (min) {
      result = `From ${formatter.format(min)}`;
    } else if (max) {
      result = `Up to ${formatter.format(max)}`;
    }
    if (period) {
      result += ` / ${period}`;
    }
    return result;
  }

  function truncate(text: string | null, maxLength: number): string {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }

  // Check if any filters are active (excluding filter type)
  let hasActiveFilters = $derived(
    filters.search || filters.platform || filters.workLocation ||
    filters.jobType || filters.minScore || filters.datePosted
  );

  // Count active filters for badge
  let activeFilterCount = $derived(
    [filters.platform, filters.workLocation, filters.jobType, filters.minScore, filters.datePosted]
      .filter(Boolean).length
  );

  // Empty state messages
  let emptyTitle = $derived(
    filterType === "matches"
      ? "No job matches yet"
      : filterType === "saved"
        ? "No saved jobs yet"
        : "No jobs found"
  );

  let emptyDescription = $derived(
    hasActiveFilters
      ? "Try adjusting your filters or search terms."
      : filterType === "matches"
        ? "Job matches will appear here once you set up job searches and run the matching process."
        : filterType === "saved"
          ? "Jobs you save will appear here for easy access."
          : "No jobs have been imported yet. Set up job searches to start importing jobs."
  );
</script>

<div class="space-y-6">
  <SectionHeader title={pageTitle} icon={pageIcon} />

  {#if form?.error}
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  <!-- Filter Tabs -->
  <div class="flex flex-wrap gap-2">
    {#each filterTabs as tab}
      <button
        type="button"
        onclick={() => switchFilter(tab.value)}
        class="px-3 sm:px-4 py-2 rounded-lg transition-colors flex items-center gap-2 {filterType ===
        tab.value
          ? 'bg-[var(--dash-primary)] text-white'
          : 'bg-[var(--dash-card)] border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)]'}"
      >
        <FontAwesomeIcon icon={tab.icon} class="w-4 h-4" />
        <span class="sm:hidden">{tab.mobileLabel}</span>
        <span class="hidden sm:inline">{tab.label}</span>
      </button>
    {/each}
  </div>

  <!-- Search Bar -->
  <div class="flex gap-2">
    <div class="relative flex-1 flex">
      <FontAwesomeIcon
        icon={faSearch}
        class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)]"
      />
      <input
        type="text"
        bind:value={searchInput}
        bind:this={searchInputEl}
        onkeydown={(e) => e.key === "Enter" && applyFilters()}
        placeholder="Search jobs..."
        class="w-full pl-10 pr-8 py-2 bg-[var(--dash-card)] border border-[var(--dash-border)] border-r-0 rounded-l-lg text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
      />
      {#if searchInput}
        <button
          type="button"
          onclick={() => {
            searchInput = "";
            applyFilters();
            searchInputEl?.focus();
          }}
          class="absolute right-12 top-1/2 -translate-y-1/2 p-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors"
          aria-label="Clear search"
        >
          <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
        </button>
      {/if}
      <button
        type="button"
        onclick={applyFilters}
        class="px-3 py-2 bg-[var(--dash-primary)] text-white rounded-r-lg hover:bg-[var(--dash-primary-hover)] transition-colors flex items-center justify-center"
        aria-label="Search"
      >
        <FontAwesomeIcon icon={faArrowRight} class="w-4 h-4" />
      </button>
    </div>
    <button
      type="button"
      onclick={() => (showFilters = !showFilters)}
      class="px-3 py-2 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors flex items-center justify-center gap-2 relative"
      aria-label="Filters"
    >
      <FontAwesomeIcon icon={faFilter} class="w-4 h-4" />
      {#if activeFilterCount > 0}
        <span class="text-xs font-medium bg-[var(--dash-primary)] text-white rounded-full w-5 h-5 flex items-center justify-center">
          {activeFilterCount}
        </span>
      {/if}
    </button>
  </div>

  <!-- Filters Panel -->
  {#if showFilters}
    <div
      class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg p-4 space-y-4"
    >
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <!-- Platform Filter -->
        <div>
          <label class="block text-sm text-[var(--dash-text-secondary)] mb-1">Platform</label>
          <select
            bind:value={platformFilter}
            class="w-full px-3 py-2 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]"
          >
            <option value="">All</option>
            {#each platforms as platform}
              <option value={platform.id.toString()}>{platform.name}</option>
            {/each}
          </select>
        </div>

        <!-- Work Location Filter -->
        <div>
          <label class="block text-sm text-[var(--dash-text-secondary)] mb-1">Work Location</label>
          <select
            bind:value={workLocationFilter}
            class="w-full px-3 py-2 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]"
          >
            <option value="">All</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
          </select>
        </div>

        <!-- Job Type Filter -->
        <div>
          <label class="block text-sm text-[var(--dash-text-secondary)] mb-1">Job Type</label>
          <select
            bind:value={jobTypeFilter}
            class="w-full px-3 py-2 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]"
          >
            <option value="">All</option>
            <option value="full_time">Full-time</option>
            <option value="contract">Contract</option>
            <option value="part_time">Part-time</option>
            <option value="freelance">Freelance</option>
          </select>
        </div>

        <!-- Date Posted Filter -->
        <div>
          <label class="block text-sm text-[var(--dash-text-secondary)] mb-1">Date Posted</label>
          <select
            bind:value={datePostedFilter}
            class="w-full px-3 py-2 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]"
          >
            <option value="">Any time</option>
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </div>

        <!-- Min Score Filter (only on Matches tab) -->
        {#if filterType === "matches"}
          <div>
            <label class="block text-sm text-[var(--dash-text-secondary)] mb-1">Min Score</label>
            <select
              bind:value={minScoreFilter}
              class="w-full px-3 py-2 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]"
            >
              <option value="">Any</option>
              <option value="40">40+</option>
              <option value="60">60+</option>
              <option value="80">80+</option>
            </select>
          </div>
        {/if}
      </div>

      <div class="flex gap-2">
        <button
          type="button"
          onclick={applyFilters}
          class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
        >
          Apply Filters
        </button>
        {#if hasActiveFilters}
          <button
            type="button"
            onclick={clearFilters}
            class="px-4 py-2 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-border)] transition-colors flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faTimes} class="w-3 h-3" />
            Clear Filters
          </button>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Results Count -->
  <div class="text-sm text-[var(--dash-text-secondary)]">
    {#if $navigating}
      <span class="flex items-center gap-2">
        <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 animate-spin" />
        Loading...
      </span>
    {:else if totalCount === 0}
      No jobs found
    {:else if totalCount === 1}
      1 job found
    {:else}
      {totalCount.toLocaleString()} jobs found
      {#if currentPage > 1 || totalPages > 1}
        <span class="mx-1">•</span>
        Page {currentPage} of {totalPages}
      {/if}
    {/if}
  </div>

  <!-- Jobs List -->
  {#if jobs.length === 0}
    <EmptyState icon={pageIcon} title={emptyTitle} description={emptyDescription} />
  {:else}
    <div class="space-y-3">
      {#each jobs as job (job.id)}
        <JobCard
          {job}
          match={getMatch(job.id)}
          matched={isMatched(job.id)}
          {profileSkillLevels}
          isSaved={isSaved(job.id)}
          isRejected={isRejected(job.id)}
          isExpanded={expandedId === job.id}
          onToggleExpand={() => toggleExpand(job.id)}
          onToggleSaved={(saved) => toggleSaved(job.id, saved)}
          onToggleRejected={(rejected) => toggleRejected(job.id, rejected)}
        >
          {#snippet expandedContent()}
            <!-- Job Info Grid -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              {#if job.salary_min || job.salary_max}
                <div>
                  <p
                    class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1"
                  >
                    Salary
                  </p>
                  <p
                    class="font-medium text-[var(--dash-text)] flex items-center gap-1"
                  >
                    <FontAwesomeIcon
                      icon={faMoneyBillWave}
                      class="w-4 h-4 text-[var(--dash-success)]"
                    />
                    {formatSalary(
                      job.salary_min,
                      job.salary_max,
                      job.salary_currency,
                      job.salary_period,
                    )}
                  </p>
                </div>
              {/if}
              {#if job.job_types && Array.isArray(job.job_types) && job.job_types.length > 0}
                <div>
                  <p
                    class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1"
                  >
                    Job Type
                  </p>
                  <p class="font-medium text-[var(--dash-text)]">
                    {job.job_types.map(formatJobType).join(", ")}
                  </p>
                </div>
              {/if}
              {#if job.work_location && Array.isArray(job.work_location) && job.work_location.length > 0}
                <div>
                  <p
                    class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1"
                  >
                    Work Location
                  </p>
                  <p class="font-medium text-[var(--dash-text)]">
                    {job.work_location.map(formatWorkLocation).join(", ")}
                  </p>
                </div>
              {/if}
            </div>

            <!-- Skills -->
            {#if job.skills_required && Array.isArray(job.skills_required) && job.skills_required.length > 0}
              <div>
                <p
                  class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2"
                >
                  Required Skills
                  {#if getMatch(job.id)?.skill_match_percentage}
                    <span class="text-[var(--dash-info)] font-medium ml-2 normal-case">
                      {getMatch(job.id)!.skill_match_percentage}% match
                    </span>
                  {/if}
                </p>
                <div class="flex flex-wrap gap-1">
                  {#each job.skills_required.slice(0, 10) as skill}
                    {@const strength = getSkillMatchStrength(job.id, skill)}
                    {#if strength === "strong"}
                      <span
                        class="px-2 py-1 text-xs bg-[var(--dash-success-light)] text-[var(--dash-success)] rounded flex items-center gap-1"
                      >
                        <FontAwesomeIcon icon={faCheck} class="w-2.5 h-2.5" />
                        {skill}
                      </span>
                    {:else if strength === "weak"}
                      <span
                        class="px-2 py-1 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded flex items-center gap-1"
                      >
                        <FontAwesomeIcon icon={faCheck} class="w-2.5 h-2.5" />
                        {skill}
                      </span>
                    {:else}
                      <span
                        class="px-2 py-1 text-xs bg-[var(--dash-bg)] text-[var(--dash-text)] rounded"
                      >
                        {skill}
                      </span>
                    {/if}
                  {/each}
                  {#if job.skills_required.length > 10}
                    <span class="px-2 py-1 text-xs text-[var(--dash-text-muted)]">
                      +{job.skills_required.length - 10} more
                    </span>
                  {/if}
                </div>
              </div>
            {/if}

            {#if job.skills_preferred && Array.isArray(job.skills_preferred) && job.skills_preferred.length > 0}
              <div>
                <p
                  class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2"
                >
                  Preferred Skills
                </p>
                <div class="flex flex-wrap gap-1">
                  {#each job.skills_preferred.slice(0, 10) as skill}
                    {@const strength = getSkillMatchStrength(job.id, skill)}
                    {#if strength === "strong"}
                      <span
                        class="px-2 py-1 text-xs bg-[var(--dash-success-light)] text-[var(--dash-success)] rounded flex items-center gap-1"
                      >
                        <FontAwesomeIcon icon={faCheck} class="w-2.5 h-2.5" />
                        {skill}
                      </span>
                    {:else if strength === "weak"}
                      <span
                        class="px-2 py-1 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded flex items-center gap-1"
                      >
                        <FontAwesomeIcon icon={faCheck} class="w-2.5 h-2.5" />
                        {skill}
                      </span>
                    {:else}
                      <span
                        class="px-2 py-1 text-xs bg-[var(--dash-primary-light)] text-[var(--dash-primary)] rounded"
                      >
                        {skill}
                      </span>
                    {/if}
                  {/each}
                  {#if job.skills_preferred.length > 10}
                    <span class="px-2 py-1 text-xs text-[var(--dash-text-muted)]">
                      +{job.skills_preferred.length - 10} more
                    </span>
                  {/if}
                </div>
              </div>
            {/if}

            <!-- Description Preview -->
            {#if job.job_description}
              <div>
                <p
                  class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1"
                >
                  Description
                </p>
                <p class="text-sm text-[var(--dash-text)] whitespace-pre-wrap">
                  {truncate(job.job_description, 500)}
                </p>
              </div>
            {/if}

            <!-- Metadata -->
            <div
              class="pt-2 border-t border-[var(--dash-border)] flex items-center gap-x-4 gap-y-1 text-xs text-[var(--dash-text-muted)] flex-wrap"
            >
              <span>ID: {job.id}</span>
              {#if job.date_posted}
                <span>Posted: {formatDate(job.date_posted)}</span>
              {/if}
              {#if job.date}
                <span>Imported: {formatDate(job.date)}</span>
              {/if}
              {#if job.scrape_count}
                <span>Scraped {job.scrape_count}x</span>
              {/if}
            </div>
          {/snippet}
        </JobCard>
      {/each}
    </div>
  {/if}

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="flex items-center justify-center gap-2">
      <button
        type="button"
        onclick={() => goToPage(currentPage - 1)}
        disabled={currentPage <= 1}
        class="p-2 rounded-lg border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <FontAwesomeIcon icon={faChevronLeft} class="w-4 h-4" />
      </button>

      {#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
        // Show pages around current page
        let start = Math.max(1, currentPage - 2);
        let end = Math.min(totalPages, start + 4);
        if (end - start < 4) {
          start = Math.max(1, end - 4);
        }
        return start + i;
      }).filter((p) => p <= totalPages) as pageNum}
        <button
          type="button"
          onclick={() => goToPage(pageNum)}
          class="w-10 h-10 rounded-lg border transition-colors {pageNum ===
          currentPage
            ? 'bg-[var(--dash-primary)] text-white border-[var(--dash-primary)]'
            : 'border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)]'}"
        >
          {pageNum}
        </button>
      {/each}

      <button
        type="button"
        onclick={() => goToPage(currentPage + 1)}
        disabled={currentPage >= totalPages}
        class="p-2 rounded-lg border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <FontAwesomeIcon icon={faChevronRight} class="w-4 h-4" />
      </button>
    </div>
  {/if}
</div>
