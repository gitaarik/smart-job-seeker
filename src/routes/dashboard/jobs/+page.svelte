<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { goto } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBriefcase,
    faBookmark,
    faCheck,
    faListCheck,
    faChevronLeft,
    faChevronRight,
    faFilter,
    faMoneyBillWave,
    faSearch,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../profile/components/SectionHeader.svelte";
  import EmptyState from "../profile/components/EmptyState.svelte";
  import JobCard from "./components/JobCard.svelte";

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

  // Store match data by job ID
  let matchesByJobId = $derived(data.matchesByJobId);

  function isSaved(jobId: number): boolean {
    return savedJobIds[jobId] === true;
  }

  function toggleSaved(jobId: number, save: boolean) {
    if (save) {
      savedJobIds[jobId] = true;
    } else {
      delete savedJobIds[jobId];
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

  function isSkillMatched(jobId: number, skill: string): boolean {
    const match = getMatch(jobId);
    if (!match?.matched_skills) return false;
    return match.matched_skills.includes(skill);
  }

  // Local state for form inputs
  let filterType = $state(filters.filter);
  let searchInput = $state(filters.search);
  let platformFilter = $state(filters.platform);
  let matchStatusFilter = $state(filters.matchStatus);
  let sortBy = $state(filters.sortBy);
  let sortOrder = $state(filters.sortOrder);
  let showFilters = $state(false);
  let expandedId = $state<number | null>(null);

  // Filter type options (tabs)
  const filterTabs = [
    { value: "all", label: "All Jobs", icon: faBriefcase },
    { value: "matches", label: "Matches", icon: faListCheck },
    { value: "saved", label: "Saved", icon: faBookmark },
  ];

  // Match status options (for matches filter)
  const matchStatusOptions = [
    { value: "", label: "All Statuses" },
    { value: "new", label: "New" },
    { value: "viewed", label: "Viewed" },
    { value: "applied", label: "Applied" },
    { value: "rejected", label: "Not Interested" },
  ];

  const sortOptions = [
    { value: "date_created", label: "Date Added" },
    { value: "date_updated", label: "Last Updated" },
    { value: "title", label: "Title" },
    { value: "company", label: "Company" },
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
    const ms = overrides.matchStatus ?? matchStatusFilter;
    const s = overrides.sortBy ?? sortBy;
    const o = overrides.sortOrder ?? sortOrder;
    const pg = overrides.page ?? "1";

    if (f !== "all") params.set("filter", f);
    if (q) params.set("q", q);
    if (p) params.set("platform", p);
    if (ms && f === "matches") params.set("matchStatus", ms);
    if (s !== "date_created") params.set("sort", s);
    if (o !== "desc") params.set("order", o);
    if (pg !== "1") params.set("page", pg);

    return `?${params.toString()}`;
  }

  function switchFilter(filter: string) {
    filterType = filter;
    // Reset match status when switching away from matches
    if (filter !== "matches") {
      matchStatusFilter = "";
    }
    goto(buildUrl({ filter, page: "1" }));
  }

  function applyFilters() {
    goto(buildUrl({ page: "1" }));
  }

  function clearFilters() {
    searchInput = "";
    platformFilter = "";
    matchStatusFilter = "";
    sortBy = "date_created";
    sortOrder = "desc";
    goto(buildUrl({
      search: "",
      platform: "",
      matchStatus: "",
      sortBy: "date_created",
      sortOrder: "desc",
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
    filters.search ||
      filters.platform ||
      filters.matchStatus ||
      filters.sortBy !== "date_created" ||
      filters.sortOrder !== "desc"
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
        class="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 {filterType ===
        tab.value
          ? 'bg-[var(--dash-primary)] text-white'
          : 'bg-[var(--dash-card)] border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)]'}"
      >
        <FontAwesomeIcon icon={tab.icon} class="w-4 h-4" />
        {tab.label}
      </button>
    {/each}
  </div>

  <!-- Search Bar -->
  <div class="flex gap-2">
    <div class="relative flex-1">
      <FontAwesomeIcon
        icon={faSearch}
        class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--dash-text-muted)]"
      />
      <input
        type="text"
        bind:value={searchInput}
        onkeydown={(e) => e.key === "Enter" && applyFilters()}
        placeholder="Search jobs by title, company, location..."
        class="w-full pl-10 pr-4 py-2 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
      />
    </div>
    <button
      type="button"
      onclick={applyFilters}
      class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
    >
      Search
    </button>
    <button
      type="button"
      onclick={() => (showFilters = !showFilters)}
      class="px-4 py-2 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors flex items-center gap-2"
    >
      <FontAwesomeIcon icon={faFilter} class="w-4 h-4" />
      Filters
      {#if hasActiveFilters}
        <span class="w-2 h-2 bg-[var(--dash-primary)] rounded-full"></span>
      {/if}
    </button>
  </div>

  <!-- Filters Panel -->
  {#if showFilters}
    <div
      class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg p-4 space-y-4"
    >
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <!-- Platform Filter -->
        <div>
          <label class="block text-sm text-[var(--dash-text-secondary)] mb-1"
            >Platform</label
          >
          <select
            bind:value={platformFilter}
            class="w-full px-3 py-2 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]"
          >
            <option value="">All Platforms</option>
            {#each platforms as platform}
              <option value={platform.id.toString()}>{platform.name}</option>
            {/each}
          </select>
        </div>

        <!-- Match Status Filter (only for matches) -->
        {#if filterType === "matches"}
          <div>
            <label class="block text-sm text-[var(--dash-text-secondary)] mb-1"
              >Match Status</label
            >
            <select
              bind:value={matchStatusFilter}
              class="w-full px-3 py-2 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]"
            >
              {#each matchStatusOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </div>
        {/if}

        <!-- Sort By -->
        <div>
          <label class="block text-sm text-[var(--dash-text-secondary)] mb-1"
            >Sort By</label
          >
          <select
            bind:value={sortBy}
            class="w-full px-3 py-2 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]"
          >
            {#each sortOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </div>

        <!-- Sort Order -->
        <div>
          <label class="block text-sm text-[var(--dash-text-secondary)] mb-1"
            >Order</label
          >
          <select
            bind:value={sortOrder}
            class="w-full px-3 py-2 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]"
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>
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
    {#if totalCount === 0}
      No jobs found
    {:else if totalCount === 1}
      1 job found
    {:else}
      {totalCount.toLocaleString()} jobs found
    {/if}
    {#if currentPage > 1 || totalPages > 1}
      <span class="mx-1">•</span>
      Page {currentPage} of {totalPages}
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
          isSaved={isSaved(job.id)}
          isExpanded={expandedId === job.id}
          onToggleExpand={() => toggleExpand(job.id)}
          onToggleSaved={(saved) => toggleSaved(job.id, saved)}
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
                    {job.job_types.join(", ")}
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
                    {job.work_location.join(", ")}
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
                    <span class="text-[var(--dash-success)] font-medium ml-2">
                      {getMatch(job.id)!.skill_match_percentage}% match
                    </span>
                  {/if}
                </p>
                <div class="flex flex-wrap gap-1">
                  {#each job.skills_required.slice(0, 10) as skill}
                    {#if isSkillMatched(job.id, skill)}
                      <span
                        class="px-2 py-1 text-xs bg-[var(--dash-success-light)] text-[var(--dash-success)] rounded flex items-center gap-1"
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
                    {#if isSkillMatched(job.id, skill)}
                      <span
                        class="px-2 py-1 text-xs bg-[var(--dash-success-light)] text-[var(--dash-success)] rounded flex items-center gap-1"
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
                {#if job.job_description.length > 500}
                  <a
                    href="/dashboard/jobs/{job.id}"
                    class="text-sm text-[var(--dash-primary)] hover:underline mt-2 inline-block"
                  >
                    View full description →
                  </a>
                {/if}
              </div>
            {/if}

            <!-- Match Summary -->
            {#if getMatch(job.id)?.match_summary}
              <div>
                <p
                  class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1"
                >
                  Match Analysis
                </p>
                <p class="text-sm text-[var(--dash-text)]">
                  {getMatch(job.id)!.match_summary}
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
              {#if job.date_created}
                <span>Imported: {formatDate(job.date_created)}</span>
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
