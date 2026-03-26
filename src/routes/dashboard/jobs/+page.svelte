<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { navigating } from "$app/stores";
  import { tick } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBan,
    faBriefcase,
    faBookmark,
    faCalendarDays,
    faCheck,
    faChevronDown,
    faGauge,
    faGlobe,
    faListCheck,
    faChevronLeft,
    faChevronRight,
    faLocationDot,
    faMoneyBillWave,
    faSearch,
    faSitemap,
    faStar as faStarSolid,
    faSync,
    faTag,
    faTimes,
    faUser,
  } from "@fortawesome/free-solid-svg-icons";
  import { faStar as faStarRegular } from "@fortawesome/free-regular-svg-icons";
  import Spinner from "$lib/components/Spinner.svelte";
  import SectionHeader from "../profile/components/SectionHeader.svelte";
  import EmptyState from "../profile/components/EmptyState.svelte";
  import JobCard from "./components/JobCard.svelte";
  import ConfirmModal from "../profile/components/ConfirmModal.svelte";
  import { formatJobType, formatWorkLocation } from "$lib/format";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let isStaff = $derived(
    !!(data as any).user?.is_staff || !!(data as any).user?.is_admin
  );
  let isClearingMatches = $state(false);
  let clearMatchResult = $state<{ count: number } | null>(null);
  let showClearMatchConfirm = $state(false);
  let clearMatchFormEl: HTMLFormElement;

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
    Object.fromEntries(data.rejectedJobIds.map((id: number) => [id, true]))
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

  // Local state for form inputs — synced from server data on navigation
  let selectedStatuses = $state<Set<string>>(new Set());
  let searchInput = $state("");
  let selectedPlatforms = $state<Set<string>>(new Set());
  let selectedWorkLocations = $state<Set<string>>(new Set());
  let selectedJobTypes = $state<Set<string>>(new Set());
  let selectedImportedBy = $state<Set<string>>(new Set());
  let minScoreFilter = $state("");
  let datePostedFilter = $state("");
  let expandedId = $state<number | null>(null);
  let searchInputEl: HTMLInputElement;
  let openDropdown = $state<string | null>(null);

  // Re-sync local state when server filters change (e.g. sidebar navigation)
  $effect(() => {
    selectedStatuses = new Set(filters.status ? filters.status.split(",") : []);
    searchInput = filters.search;
    selectedPlatforms = new Set(filters.platform ? filters.platform.split(",") : []);
    selectedWorkLocations = new Set(filters.workLocation ? filters.workLocation.split(",") : []);
    selectedJobTypes = new Set(filters.jobType ? filters.jobType.split(",") : []);
    selectedImportedBy = new Set(filters.importedBy ? filters.importedBy.split(",") : []);
    minScoreFilter = filters.minScore;
    datePostedFilter = filters.datePosted;
  });

  let pageTitle = $derived(
    selectedStatuses.has("saved")
      ? "Saved Jobs"
      : minScoreFilter === "unmatched"
        ? "Not Yet Matched"
        : minScoreFilter === "0"
          ? "No Match"
          : minScoreFilter
            ? "Job Matches"
            : "All Jobs"
  );

  let pageIcon = $derived(
    selectedStatuses.has("saved")
      ? faBookmark
      : minScoreFilter && minScoreFilter !== "0"
        ? faListCheck
        : faBriefcase
  );

  let platformString = $derived([...selectedPlatforms].join(","));
  let workLocationString = $derived([...selectedWorkLocations].join(","));
  let jobTypeString = $derived([...selectedJobTypes].join(","));
  let statusString = $derived([...selectedStatuses].join(","));
  let importedByString = $derived([...selectedImportedBy].join(","));

  function buildUrl(overrides: Record<string, string | undefined> = {}) {
    const params = new URLSearchParams();
    const st = overrides.status ?? statusString;
    const q = overrides.search ?? searchInput;
    const p = overrides.platform ?? platformString;
    const wl = overrides.workLocation ?? workLocationString;
    const jt = overrides.jobType ?? jobTypeString;
    const ms = overrides.minScore ?? minScoreFilter;
    const dp = overrides.datePosted ?? datePostedFilter;
    const ib = overrides.importedBy ?? importedByString;
    const pg = overrides.page ?? "1";

    if (st) params.set("status", st);
    if (q) params.set("q", q);
    if (p) params.set("platform", p);
    if (wl) params.set("workLocation", wl);
    if (jt) params.set("jobType", jt);
    if (ms) params.set("minScore", ms);
    if (dp) params.set("datePosted", dp);
    if (ib) params.set("importedBy", ib);
    if (pg !== "1") params.set("page", pg);

    return `?${params.toString()}`;
  }

  function toggleStatus(value: string) {
    selectedStatuses = toggleSetValue(selectedStatuses, value);
    goto(buildUrl({ status: [...selectedStatuses].join(","), page: "1" }));
  }

  function applySearch() {
    goto(buildUrl({ page: "1" }));
  }

  function applyFilter(overrides: Record<string, string | undefined> = {}) {
    goto(buildUrl({ ...overrides, page: "1" }));
  }

  function toggleSetValue(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    return next;
  }

  function togglePlatform(platformId: string) {
    selectedPlatforms = toggleSetValue(selectedPlatforms, platformId);
    goto(buildUrl({ platform: [...selectedPlatforms].join(","), page: "1" }));
  }

  function toggleWorkLocation(value: string) {
    selectedWorkLocations = toggleSetValue(selectedWorkLocations, value);
    goto(buildUrl({ workLocation: [...selectedWorkLocations].join(","), page: "1" }));
  }

  function toggleJobType(value: string) {
    selectedJobTypes = toggleSetValue(selectedJobTypes, value);
    goto(buildUrl({ jobType: [...selectedJobTypes].join(","), page: "1" }));
  }

  function toggleImportedBy(value: string) {
    selectedImportedBy = toggleSetValue(selectedImportedBy, value);
    goto(buildUrl({ importedBy: [...selectedImportedBy].join(","), page: "1" }));
  }

  function setMinScore(value: string) {
    minScoreFilter = value;
    applyFilter({ minScore: value });
  }

  function setDatePosted(value: string) {
    datePostedFilter = value;
    applyFilter({ datePosted: value });
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

  function clearFilters() {
    selectedStatuses = new Set();
    searchInput = "";
    selectedPlatforms = new Set();
    selectedWorkLocations = new Set();
    selectedJobTypes = new Set();
    selectedImportedBy = new Set();
    minScoreFilter = "";
    datePostedFilter = "";
    goto(buildUrl({
      status: "",
      search: "",
      platform: "",
      workLocation: "",
      jobType: "",
      minScore: "",
      datePosted: "",
      importedBy: "",
      page: "1",
    }));
  }

  function goToPage(page: number) {
    goto(buildUrl({ page: page.toString() }));
  }

  async function toggleExpand(id: number) {
    // Capture clicked card's viewport offset before DOM changes
    const cardEl = document.querySelector(`[data-job-id="${id}"]`);
    const viewportOffset = cardEl?.getBoundingClientRect().top ?? null;

    expandedId = expandedId === id ? null : id;

    // After DOM updates, restore the card to the same viewport position
    if (viewportOffset !== null && expandedId !== null) {
      await tick();
      const updatedRect = cardEl?.getBoundingClientRect();
      if (updatedRect) {
        window.scrollBy(0, updatedRect.top - viewportOffset);
      }
    }
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
    filters.status || filters.search || filters.platform ||
    filters.workLocation || filters.jobType ||
    filters.minScore || filters.datePosted || filters.importedBy
  );

  // Empty state messages
  let emptyTitle = $derived(
    selectedStatuses.has("saved")
      ? "No saved jobs yet"
      : minScoreFilter
        ? "No job matches yet"
        : "No jobs found"
  );

  let emptyDescription = $derived(
    hasActiveFilters
      ? "Try adjusting your filters or search terms."
      : "No jobs have been imported yet. Set up job searches to start importing jobs."
  );
</script>

<svelte:window onclick={handleWindowClick} />

<div class="space-y-6">
  <SectionHeader title={pageTitle} icon={pageIcon} />

  {#if form?.error}
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  {#if clearMatchResult}
    <div
      class="bg-green-50 border border-green-400 rounded-lg p-4 dark:bg-green-900/20 dark:border-green-600 flex items-center justify-between"
    >
      <p class="text-green-700 text-sm dark:text-green-400">
        Cleared match data for {clearMatchResult.count} job{clearMatchResult.count === 1 ? "" : "s"}. They will be re-scored on next match run.
      </p>
      <button
        type="button"
        onclick={() => (clearMatchResult = null)}
        class="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
      >
        <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
      </button>
    </div>
  {/if}

  <!-- Filters -->
  <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg p-3 sm:p-4">
    <div class="inline-flex flex-col gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <!-- Min Score dropdown -->
      <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border bg-[var(--dash-bg)] border-[var(--dash-border)]">
        <FontAwesomeIcon icon={faGauge} class="w-3 h-3 text-[var(--dash-text-muted)] shrink-0" />
        <select
          value={minScoreFilter}
          onchange={(e) => setMinScore(e.currentTarget.value)}
          class="text-xs bg-transparent text-[var(--dash-text)] focus:outline-none"
        >
          <option value="">All jobs</option>
          <option value="90">Score 90+</option>
          <option value="80">Score 80+</option>
          <option value="70">Score 70+</option>
          <option value="60">Score 60+</option>
          <option value="50">Score 50+</option>
          <option value="1-49">Score &lt; 50</option>
          <option value="1">Score &gt; 0</option>
          <option value="0">No match</option>
          <option value="unmatched">Not yet matched</option>
        </select>
      </div>

      <!-- Status multi-select -->
      <div class="relative" data-dropdown="status">
        <button
          type="button"
          onclick={() => toggleDropdown("status")}
          class="px-2.5 py-1.5 text-xs rounded-md border transition-colors flex items-center gap-1.5 {selectedStatuses.size > 0
            ? 'bg-[var(--dash-primary)]/10 border-[var(--dash-primary)]/30 text-[var(--dash-primary)]'
            : 'bg-[var(--dash-bg)] border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}"
        >
          <FontAwesomeIcon icon={faTag} class="w-3 h-3 opacity-60" />
          Marked as
          {#if selectedStatuses.size > 0}
            <span class="bg-[var(--dash-primary)] text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] leading-none">{selectedStatuses.size}</span>
          {:else}
            <FontAwesomeIcon icon={faChevronDown} class="w-2.5 h-2.5 opacity-50" />
          {/if}
        </button>
        {#if openDropdown === "status"}
          <div class="absolute top-full left-0 mt-1 z-20 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg shadow-lg py-1 min-w-[140px]">
            {#each [{ value: "saved", label: "Saved" }, { value: "rejected", label: "Not Interested" }] as opt}
              <button
                type="button"
                onclick={() => toggleStatus(opt.value)}
                class="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors"
              >
                <span class="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 {selectedStatuses.has(opt.value)
                  ? 'bg-[var(--dash-primary)] border-[var(--dash-primary)]'
                  : 'border-[var(--dash-border)]'}">
                  {#if selectedStatuses.has(opt.value)}
                    <FontAwesomeIcon icon={faCheck} class="w-2 h-2 text-white" />
                  {/if}
                </span>
                <span class="text-[var(--dash-text)]">{opt.label}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Date Posted dropdown -->
      <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border bg-[var(--dash-bg)] border-[var(--dash-border)]">
        <FontAwesomeIcon icon={faCalendarDays} class="w-3 h-3 text-[var(--dash-text-muted)] shrink-0" />
        <select
          value={datePostedFilter}
          onchange={(e) => setDatePosted(e.currentTarget.value)}
          class="text-xs bg-transparent text-[var(--dash-text)] focus:outline-none"
        >
          <option value="">Date posted</option>
          <option value="1">Last 24h</option>
          <option value="3">Last 3 days</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 3 months</option>
        </select>
      </div>

      <!-- Job Type multi-select -->
      <div class="relative" data-dropdown="jobType">
        <button
          type="button"
          onclick={() => toggleDropdown("jobType")}
          class="px-2.5 py-1.5 text-xs rounded-md border transition-colors flex items-center gap-1.5 {selectedJobTypes.size > 0
            ? 'bg-[var(--dash-primary)]/10 border-[var(--dash-primary)]/30 text-[var(--dash-primary)]'
            : 'bg-[var(--dash-bg)] border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}"
        >
          <FontAwesomeIcon icon={faSitemap} class="w-3 h-3 opacity-60" />
          Job type
          {#if selectedJobTypes.size > 0}
            <span class="bg-[var(--dash-primary)] text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] leading-none">{selectedJobTypes.size}</span>
          {:else}
            <FontAwesomeIcon icon={faChevronDown} class="w-2.5 h-2.5 opacity-50" />
          {/if}
        </button>
        {#if openDropdown === "jobType"}
          <div class="absolute top-full left-0 mt-1 z-20 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg shadow-lg py-1 min-w-[140px]">
            {#each [{ value: "full_time", label: "Full-time" }, { value: "contract", label: "Contract" }, { value: "part_time", label: "Part-time" }, { value: "freelance", label: "Freelance" }] as opt}
              <button
                type="button"
                onclick={() => toggleJobType(opt.value)}
                class="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors"
              >
                <span class="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 {selectedJobTypes.has(opt.value)
                  ? 'bg-[var(--dash-primary)] border-[var(--dash-primary)]'
                  : 'border-[var(--dash-border)]'}">
                  {#if selectedJobTypes.has(opt.value)}
                    <FontAwesomeIcon icon={faCheck} class="w-2 h-2 text-white" />
                  {/if}
                </span>
                <span class="text-[var(--dash-text)]">{opt.label}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Work Location multi-select -->
      <div class="relative" data-dropdown="workLocation">
        <button
          type="button"
          onclick={() => toggleDropdown("workLocation")}
          class="px-2.5 py-1.5 text-xs rounded-md border transition-colors flex items-center gap-1.5 {selectedWorkLocations.size > 0
            ? 'bg-[var(--dash-primary)]/10 border-[var(--dash-primary)]/30 text-[var(--dash-primary)]'
            : 'bg-[var(--dash-bg)] border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}"
        >
          <FontAwesomeIcon icon={faLocationDot} class="w-3 h-3 opacity-60" />
          Work location
          {#if selectedWorkLocations.size > 0}
            <span class="bg-[var(--dash-primary)] text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] leading-none">{selectedWorkLocations.size}</span>
          {:else}
            <FontAwesomeIcon icon={faChevronDown} class="w-2.5 h-2.5 opacity-50" />
          {/if}
        </button>
        {#if openDropdown === "workLocation"}
          <div class="absolute top-full left-0 mt-1 z-20 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg shadow-lg py-1 min-w-[140px]">
            {#each [{ value: "remote", label: "Remote" }, { value: "hybrid", label: "Hybrid" }, { value: "onsite", label: "On-site" }] as opt}
              <button
                type="button"
                onclick={() => toggleWorkLocation(opt.value)}
                class="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors"
              >
                <span class="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 {selectedWorkLocations.has(opt.value)
                  ? 'bg-[var(--dash-primary)] border-[var(--dash-primary)]'
                  : 'border-[var(--dash-border)]'}">
                  {#if selectedWorkLocations.has(opt.value)}
                    <FontAwesomeIcon icon={faCheck} class="w-2 h-2 text-white" />
                  {/if}
                </span>
                <span class="text-[var(--dash-text)]">{opt.label}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Platform multi-select -->
      {#if platforms.length > 0}
        <div class="relative" data-dropdown="platform">
          <button
            type="button"
            onclick={() => toggleDropdown("platform")}
            class="px-2.5 py-1.5 text-xs rounded-md border transition-colors flex items-center gap-1.5 {selectedPlatforms.size > 0
              ? 'bg-[var(--dash-primary)]/10 border-[var(--dash-primary)]/30 text-[var(--dash-primary)]'
              : 'bg-[var(--dash-bg)] border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}"
          >
            <FontAwesomeIcon icon={faGlobe} class="w-3 h-3 opacity-60" />
            Platform
            {#if selectedPlatforms.size > 0}
              <span class="bg-[var(--dash-primary)] text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] leading-none">{selectedPlatforms.size}</span>
            {:else}
              <FontAwesomeIcon icon={faChevronDown} class="w-2.5 h-2.5 opacity-50" />
            {/if}
          </button>
          {#if openDropdown === "platform"}
            <div class="absolute top-full left-0 mt-1 z-20 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg shadow-lg py-1 min-w-[140px]">
              {#each platforms as platform}
                <button
                  type="button"
                  onclick={() => togglePlatform(platform.id.toString())}
                  class="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors"
                >
                  <span class="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 {selectedPlatforms.has(platform.id.toString())
                    ? 'bg-[var(--dash-primary)] border-[var(--dash-primary)]'
                    : 'border-[var(--dash-border)]'}">
                    {#if selectedPlatforms.has(platform.id.toString())}
                      <FontAwesomeIcon icon={faCheck} class="w-2 h-2 text-white" />
                    {/if}
                  </span>
                  <span class="text-[var(--dash-text)]">{platform.name}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Imported by multi-select -->
      <div class="relative" data-dropdown="importedBy">
        <button
          type="button"
          onclick={() => toggleDropdown("importedBy")}
          class="px-2.5 py-1.5 text-xs rounded-md border transition-colors flex items-center gap-1.5 {selectedImportedBy.size > 0
            ? 'bg-[var(--dash-primary)]/10 border-[var(--dash-primary)]/30 text-[var(--dash-primary)]'
            : 'bg-[var(--dash-bg)] border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-border)]'}"
        >
          <FontAwesomeIcon icon={faUser} class="w-3 h-3 opacity-60" />
          Imported by
          {#if selectedImportedBy.size > 0}
            <span class="bg-[var(--dash-primary)] text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] leading-none">{selectedImportedBy.size}</span>
          {:else}
            <FontAwesomeIcon icon={faChevronDown} class="w-2.5 h-2.5 opacity-50" />
          {/if}
        </button>
        {#if openDropdown === "importedBy"}
          <div class="absolute top-full left-0 mt-1 z-20 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg shadow-lg py-1 min-w-[140px]">
            {#each [{ value: "me", label: "Me" }, { value: "others", label: "Others" }] as opt}
              <button
                type="button"
                onclick={() => toggleImportedBy(opt.value)}
                class="w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors"
              >
                <span class="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 {selectedImportedBy.has(opt.value)
                  ? 'bg-[var(--dash-primary)] border-[var(--dash-primary)]'
                  : 'border-[var(--dash-border)]'}">
                  {#if selectedImportedBy.has(opt.value)}
                    <FontAwesomeIcon icon={faCheck} class="w-2 h-2 text-white" />
                  {/if}
                </span>
                <span class="text-[var(--dash-text)]">{opt.label}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

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

      {#if isStaff}
        <form
          bind:this={clearMatchFormEl}
          method="POST"
          action="?/clearMatchData"
          use:enhance={() => {
            isClearingMatches = true;
            clearMatchResult = null;
            return async ({ result, update }) => {
              isClearingMatches = false;
              if (result.type === "success" && result.data) {
                clearMatchResult = { count: (result.data as any).clearedCount ?? 0 };
              }
              await update();
            };
          }}
          class="hidden"
        >
        </form>
        <button
          type="button"
          disabled={isClearingMatches}
          onclick={() => (showClearMatchConfirm = true)}
          class="px-2.5 py-1.5 text-xs rounded-md border border-orange-500/30 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 transition-colors flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
          title="Clear match scoring data for jobs matching current filters, so they get re-scored"
        >
          {#if isClearingMatches}
            <Spinner size="w-3 h-3" />
            Clearing...
          {:else}
            <FontAwesomeIcon icon={faSync} class="w-3 h-3" />
            Clear match data
          {/if}
        </button>
      {/if}
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
          placeholder="Search..."
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

  <!-- Results Count -->
  <div class="text-sm text-[var(--dash-text-secondary)]">
    {#if $navigating}
      <span class="flex items-center gap-2">
        <Spinner size="w-4 h-4" />
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
    {#if $navigating}
      <div class="flex items-center justify-center">
        <Spinner size="w-4 h-4" />
      </div>
    {/if}
  {/if}
</div>

<ConfirmModal
  isOpen={showClearMatchConfirm}
  title="Clear Match Data"
  message="This will delete all match data for jobs matching your current filters. They will be re-scored on the next match run."
  confirmLabel="Clear Match Data"
  onCancel={() => (showClearMatchConfirm = false)}
  onConfirm={() => {
    showClearMatchConfirm = false;
    clearMatchFormEl?.requestSubmit();
  }}
/>
