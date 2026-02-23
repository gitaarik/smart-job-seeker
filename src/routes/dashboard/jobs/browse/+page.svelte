<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBookmark as faBookmarkSolid,
    faBriefcase,
    faBuilding,
    faCalendar,
    faChevronDown,
    faChevronLeft,
    faChevronRight,
    faChevronUp,
    faExternalLinkAlt,
    faEye,
    faFilter,
    faMapMarkerAlt,
    faMoneyBillWave,
    faSearch,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";
  import { faBookmark as faBookmarkRegular } from "@fortawesome/free-regular-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let jobs = $derived(data.jobs);
  let platforms = $derived(data.platforms);
  let totalCount = $derived(data.totalCount);
  let currentPage = $derived(data.currentPage);
  let totalPages = $derived(data.totalPages);
  let filters = $derived(data.filters);
  let savedJobIds = $state(new Set(data.savedJobIds));

  // Update savedJobIds when form action completes
  $effect(() => {
    if (form?.success && form?.jobId) {
      if (form.action === "saved") {
        savedJobIds = new Set([...savedJobIds, form.jobId]);
      } else if (form.action === "unsaved") {
        const newSet = new Set(savedJobIds);
        newSet.delete(form.jobId);
        savedJobIds = newSet;
      }
    }
  });

  // Local state for form inputs
  let searchInput = $state(filters.search);
  let platformFilter = $state(filters.platform);
  let statusFilter = $state(filters.status);
  let sortBy = $state(filters.sortBy);
  let sortOrder = $state(filters.sortOrder);
  let showFilters = $state(false);
  let expandedId = $state<number | null>(null);
  let savingJobId = $state<number | null>(null);

  const statusOptions = [
    { value: "", label: "All Statuses" },
    { value: "draft", label: "Draft" },
    { value: "published", label: "Published" },
    { value: "archived", label: "Archived" },
  ];

  const sortOptions = [
    { value: "date_created", label: "Date Added" },
    { value: "date_updated", label: "Last Updated" },
    { value: "title", label: "Title" },
    { value: "company", label: "Company" },
  ];

  function applyFilters() {
    const params = new URLSearchParams();
    if (searchInput) params.set("q", searchInput);
    if (platformFilter) params.set("platform", platformFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (sortBy !== "date_created") params.set("sort", sortBy);
    if (sortOrder !== "desc") params.set("order", sortOrder);
    goto(`?${params.toString()}`);
  }

  function clearFilters() {
    searchInput = "";
    platformFilter = "";
    statusFilter = "";
    sortBy = "date_created";
    sortOrder = "desc";
    goto("?");
  }

  function goToPage(page: number) {
    const params = new URLSearchParams();
    if (searchInput) params.set("q", searchInput);
    if (platformFilter) params.set("platform", platformFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (sortBy !== "date_created") params.set("sort", sortBy);
    if (sortOrder !== "desc") params.set("order", sortOrder);
    if (page > 1) params.set("page", page.toString());
    goto(`?${params.toString()}`);
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

  // Check if any filters are active
  let hasActiveFilters = $derived(
    filters.search || filters.platform || filters.status ||
    filters.sortBy !== "date_created" || filters.sortOrder !== "desc"
  );
</script>

<div class="space-y-6">
  <SectionHeader
    title="Browse All Jobs"
    icon={faBriefcase}
  />

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
    <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg p-4 space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <!-- Platform Filter -->
        <div>
          <label class="block text-sm text-[var(--dash-text-secondary)] mb-1">Platform</label>
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

        <!-- Status Filter -->
        <div>
          <label class="block text-sm text-[var(--dash-text-secondary)] mb-1">Status</label>
          <select
            bind:value={statusFilter}
            class="w-full px-3 py-2 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]"
          >
            {#each statusOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </div>

        <!-- Sort By -->
        <div>
          <label class="block text-sm text-[var(--dash-text-secondary)] mb-1">Sort By</label>
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
          <label class="block text-sm text-[var(--dash-text-secondary)] mb-1">Order</label>
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
    <EmptyState
      icon={faBriefcase}
      title="No jobs found"
      description={hasActiveFilters
        ? "Try adjusting your filters or search terms."
        : "No jobs have been imported yet. Set up job searches to start importing jobs."}
    />
  {:else}
    <div class="space-y-3">
      {#each jobs as job (job.id)}
        {@const isSaved = savedJobIds.has(job.id)}
        <div
          class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden"
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-4 hover:bg-[var(--dash-bg)] transition-colors">
            <!-- Clickable area for expand/collapse -->
            <button
              type="button"
              onclick={() => toggleExpand(job.id)}
              class="flex-1 min-w-0 text-left"
            >
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-medium text-[var(--dash-text)]">
                  {job.title || "Untitled Job"}
                </h3>
                <span
                  class="text-xs px-2 py-0.5 rounded-full {job.status === 'published' ? 'bg-[var(--dash-success-light)] text-[var(--dash-success)]' : 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}"
                >
                  {job.status}
                </span>
                {#if isSaved}
                  <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-primary-light)] text-[var(--dash-primary)]">
                    Saved
                  </span>
                {/if}
              </div>
              <div class="flex items-center gap-3 mt-1 text-sm text-[var(--dash-text-secondary)] flex-wrap">
                {#if job.company}
                  <span class="flex items-center gap-1">
                    <FontAwesomeIcon icon={faBuilding} class="w-3 h-3" />
                    {job.company}
                  </span>
                {/if}
                {#if job.office_location}
                  <span class="flex items-center gap-1">
                    <FontAwesomeIcon icon={faMapMarkerAlt} class="w-3 h-3" />
                    {job.office_location}
                  </span>
                {/if}
                {#if job.job_platforms}
                  <span class="text-[var(--dash-text-muted)]">
                    {job.job_platforms.name}
                  </span>
                {/if}
                {#if job.date_created}
                  <span class="flex items-center gap-1 text-[var(--dash-text-muted)]">
                    <FontAwesomeIcon icon={faCalendar} class="w-3 h-3" />
                    {formatDate(job.date_created)}
                  </span>
                {/if}
              </div>
            </button>

            <!-- Action buttons (outside the expand button) -->
            <div class="flex items-center gap-2 ml-4">
              <!-- Save/Unsave Button -->
              <form
                method="POST"
                action={isSaved ? "?/unsaveJob" : "?/saveJob"}
                use:enhance={() => {
                  savingJobId = job.id;
                  return async ({ update }) => {
                    await update();
                    savingJobId = null;
                  };
                }}
                class="inline"
              >
                <input type="hidden" name="jobId" value={job.id} />
                <button
                  type="submit"
                  disabled={savingJobId === job.id}
                  class="p-2 transition-colors {isSaved ? 'text-[var(--dash-primary)]' : 'text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)]'} disabled:opacity-50"
                  aria-label={isSaved ? "Unsave job" : "Save job"}
                  title={isSaved ? "Unsave job" : "Save job"}
                >
                  <FontAwesomeIcon
                    icon={isSaved ? faBookmarkSolid : faBookmarkRegular}
                    class="w-4 h-4"
                  />
                </button>
              </form>

              <!-- View Details Link -->
              <a
                href="/dashboard/jobs/{job.id}"
                class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                aria-label="View job details"
                title="View full details"
              >
                <FontAwesomeIcon icon={faEye} class="w-4 h-4" />
              </a>

              <!-- External Link -->
              {#if job.source_url}
                <a
                  href={job.source_url}
                  target="_blank"
                  rel="noopener"
                  class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                  aria-label="View job posting"
                  title="Open original posting"
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} class="w-4 h-4" />
                </a>
              {/if}

              <!-- Expand/Collapse toggle -->
              <button
                type="button"
                onclick={() => toggleExpand(job.id)}
                class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                aria-label={expandedId === job.id ? "Collapse" : "Expand"}
              >
                <FontAwesomeIcon
                  icon={expandedId === job.id ? faChevronUp : faChevronDown}
                  class="w-4 h-4"
                />
              </button>
            </div>
          </div>

          <!-- Expanded Content -->
          {#if expandedId === job.id}
            <div class="border-t border-[var(--dash-border)] p-4 space-y-4">
              <!-- Job Info Grid -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                {#if job.salary_min || job.salary_max}
                  <div>
                    <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">
                      Salary
                    </p>
                    <p class="font-medium text-[var(--dash-text)] flex items-center gap-1">
                      <FontAwesomeIcon icon={faMoneyBillWave} class="w-4 h-4 text-[var(--dash-success)]" />
                      {formatSalary(job.salary_min, job.salary_max, job.salary_currency, job.salary_period)}
                    </p>
                  </div>
                {/if}
                {#if job.job_types && Array.isArray(job.job_types) && job.job_types.length > 0}
                  <div>
                    <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">
                      Job Type
                    </p>
                    <p class="font-medium text-[var(--dash-text)]">
                      {job.job_types.join(", ")}
                    </p>
                  </div>
                {/if}
                {#if job.work_location && Array.isArray(job.work_location) && job.work_location.length > 0}
                  <div>
                    <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">
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
                  <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2">
                    Required Skills
                  </p>
                  <div class="flex flex-wrap gap-1">
                    {#each job.skills_required.slice(0, 10) as skill}
                      <span class="px-2 py-1 text-xs bg-[var(--dash-bg)] text-[var(--dash-text)] rounded">
                        {skill}
                      </span>
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
                  <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2">
                    Preferred Skills
                  </p>
                  <div class="flex flex-wrap gap-1">
                    {#each job.skills_preferred.slice(0, 10) as skill}
                      <span class="px-2 py-1 text-xs bg-[var(--dash-primary-light)] text-[var(--dash-primary)] rounded">
                        {skill}
                      </span>
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
                  <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">
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

              <!-- Metadata -->
              <div class="pt-2 border-t border-[var(--dash-border)] flex items-center gap-4 text-xs text-[var(--dash-text-muted)]">
                <span>ID: {job.id}</span>
                {#if job.date_posted}
                  <span>Posted: {formatDate(job.date_posted)}</span>
                {/if}
                {#if job.last_scraped}
                  <span>Last scraped: {formatDate(job.last_scraped)}</span>
                {/if}
                {#if job.scrape_count}
                  <span>Scraped {job.scrape_count}x</span>
                {/if}
              </div>
            </div>
          {/if}
        </div>
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
      }).filter(p => p <= totalPages) as pageNum}
        <button
          type="button"
          onclick={() => goToPage(pageNum)}
          class="w-10 h-10 rounded-lg border transition-colors {pageNum === currentPage
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
