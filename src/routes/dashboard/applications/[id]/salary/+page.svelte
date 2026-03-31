<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowDown,
    faArrowRight,
    faArrowUp,
    faCheck,
    faEquals,
    faExternalLinkAlt,
    faFilter,
    faInfoCircle,
    faMagicWandSparkles,
    faMoneyBillWave,
    faPencil,
    faPlus,
    faStar,
    faSpinner,
    faTimes,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../../components/Card.svelte";
  import {
    JOB_TYPES,
    WORK_LOCATIONS,
    buildNormalizeMap,
    getPatterns,
  } from "$lib/data/job-taxonomy";

  const jobTypeNormalize = buildNormalizeMap(JOB_TYPES);
  const workLocNormalize = buildNormalizeMap(WORK_LOCATIONS);
  const workLocPatterns = getPatterns(WORK_LOCATIONS);

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let app = $derived(data.application);
  let job = $derived(app.jobs);
  let salaryExpectations = $derived(data.salaryExpectations);

  let editing = $state(false);

  let editAmount = $state("");
  let editCurrency = $state("EUR");
  let editPeriod = $state("month");

  /** Normalize a work location string to a salary work_arrangement value using the taxonomy */
  function toSalaryWorkArrangement(loc: string): string {
    const lower = loc.toLowerCase().trim();
    // Exact alias match
    const canonical = workLocNormalize.get(lower);
    if (canonical) return canonical;
    // Pattern match (includes/startsWith)
    for (const p of workLocPatterns) {
      if (p.mode === "includes" && lower.includes(p.pattern)) return p.canonical;
      if (p.mode === "startsWith" && lower.startsWith(p.pattern)) return p.canonical;
    }
    return lower;
  }

  /** Map a job type string to a salary employment type using the taxonomy */
  function toSalaryEmploymentType(jobType: string): string {
    return jobTypeNormalize.get(jobType.toLowerCase()) ?? jobType.toLowerCase();
  }

  /** Infer a single default filter value from a job's array field.
   *  Returns the value if exactly one unique mapping, otherwise "all". */
  function inferSingleValue(
    values: unknown[] | null | undefined,
    mapper: (v: string) => string,
  ): string {
    if (!values || !Array.isArray(values) || values.length === 0) return "all";
    const mapped = new Set<string>();
    for (const v of values as string[]) {
      mapped.add(mapper(v));
    }
    if (mapped.size === 1) return Array.from(mapped)[0];
    return "all";
  }

  const currencies = [
    { value: "EUR", label: "EUR", symbol: "\u20AC" },
    { value: "USD", label: "USD", symbol: "$" },
    { value: "GBP", label: "GBP", symbol: "\u00A3" },
  ];

  // Filter states — default from job data when possible
  let filterWorkArrangement = $state(
    inferSingleValue(
      Array.isArray(app.jobs?.work_location) ? app.jobs.work_location as string[] : null,
      toSalaryWorkArrangement,
    ),
  );
  let filterEmploymentType = $state(
    inferSingleValue(
      Array.isArray(app.jobs?.job_types) ? app.jobs.job_types as string[] : null,
      toSalaryEmploymentType,
    ),
  );
  let filterCompanyType = $state("all");
  let filterCurrency = $state(
    job?.salary_currency && currencies.some((c) => c.value === job.salary_currency)
      ? job.salary_currency
      : "all",
  );
  let filterRegion = $state("all");
  let customRegionInput = $state(false);
  let showFilters = $state(false);

  const periods = [
    { value: "hour", label: "Hour" },
    { value: "day", label: "Day" },
    { value: "month", label: "Month" },
    { value: "year", label: "Year" },
  ];

  const companyTypeLabels: Record<string, string> = {
    startup: "Startup",
    scaleup: "Scale-up",
    corporate: "Corporate",
    agency: "Agency",
    consultancy: "Consultancy",
  };

  const employmentTypeLabels: Record<string, string> = {
    any: "Any",
    full_time: "Full-time",
    part_time: "Part-time",
    contract: "Contract",
    temporary: "Temporary",
    freelance: "Freelance",
    internship: "Internship",
  };

  const workArrangementLabels: Record<string, string> = {
    remote: "Remote",
    hybrid: "Hybrid",
    onsite: "On-site",
  };

  function formatCurrency(
    amount: number | null | undefined,
    currency: string | null | undefined,
  ): string {
    if (amount == null) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(amount);
  }

  function formatCurrencyInt(
    amount: number | null | undefined,
    currency: string | null | undefined,
  ): string {
    if (amount == null) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function getPeriodLabel(period: string | null | undefined): string {
    if (!period) return "";
    return periods.find((p) => p.value === period)?.label || period;
  }

  function startEdit() {
    editAmount = app.salary_expectation
      ? String(app.salary_expectation)
      : "";
    editCurrency = app.salary_currency || "EUR";
    editPeriod = app.salary_period || "month";
    editing = true;
  }

  function cancelEdit() {
    editing = false;
  }

  function handleSubmit() {
    return async ({
      result,
      update,
    }: {
      result: { type: string };
      update: () => Promise<void>;
    }) => {
      await update();
      if (result.type === "success") {
        editing = false;
      }
    };
  }

  // Infer job properties for auto-matching
  let jobWorkLocations = $derived.by((): string[] => {
    if (!job?.work_location) return [];
    const raw = Array.isArray(job.work_location) ? job.work_location : [];
    return (raw as string[]).map(toSalaryWorkArrangement);
  });

  let jobEmploymentTypes = $derived.by((): string[] => {
    if (!job?.job_types) return [];
    const raw = Array.isArray(job.job_types) ? job.job_types : [];
    // Map job_types to salary expectation employment_types using taxonomy
    const mapped = new Set<string>();
    for (const jt of raw as string[]) {
      mapped.add(toSalaryEmploymentType(jt));
    }
    return Array.from(mapped);
  });

  // Score each salary expectation based on how well it matches the job
  type ScoredExpectation = (typeof salaryExpectations)[0] & {
    matchScore: number;
    matchReasons: string[];
  };

  let scoredExpectations = $derived.by((): ScoredExpectation[] => {
    return salaryExpectations.map((exp) => {
      let score = 0;
      const reasons: string[] = [];

      // Work arrangement match
      if (jobWorkLocations.length > 0) {
        if (jobWorkLocations.includes(exp.work_arrangement)) {
          score += 3;
          reasons.push(workArrangementLabels[exp.work_arrangement] || exp.work_arrangement);
        }
      }

      // Employment type match
      if (jobEmploymentTypes.length > 0) {
        if (jobEmploymentTypes.includes(exp.employment_type)) {
          score += 3;
          reasons.push(employmentTypeLabels[exp.employment_type] || exp.employment_type);
        }
      }

      // Region / location match (fuzzy: check if job office_location contains the expectation region or vice versa)
      if (job?.office_location && exp.region) {
        const jobLoc = job.office_location.toLowerCase();
        const expRegion = exp.region.toLowerCase();
        if (jobLoc.includes(expRegion) || expRegion.includes(jobLoc)) {
          score += 2;
          reasons.push(exp.region);
        }
        // Also check country-level: if region is "Netherlands" and location has "Amsterdam"
        // This is a loose heuristic
      }

      // Job title match (fuzzy: check if words overlap)
      if (job?.title && exp.job_title) {
        const jobWords = new Set(job.title.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
        const expWords = exp.job_title.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
        const overlap = expWords.filter((w) => jobWords.has(w)).length;
        if (overlap > 0) {
          score += Math.min(overlap, 2);
          reasons.push(exp.job_title);
        }
      }

      return { ...exp, matchScore: score, matchReasons: reasons };
    });
  });

  // Apply manual filters, then sort by match score
  let filteredExpectations = $derived.by((): ScoredExpectation[] => {
    let filtered = scoredExpectations;

    if (filterWorkArrangement !== "all") {
      filtered = filtered.filter((e) => e.work_arrangement === filterWorkArrangement);
    }

    if (filterEmploymentType !== "all") {
      filtered = filtered.filter((e) => e.employment_type === filterEmploymentType);
    }

    if (filterCompanyType !== "all") {
      filtered = filtered.filter((e) => e.company_type === filterCompanyType);
    }

    if (filterCurrency !== "all") {
      filtered = filtered.filter((e) => e.currency === filterCurrency);
    }

    if (filterRegion !== "all") {
      filtered = filtered.filter((e) => e.region === filterRegion);
    }

    return filtered.sort((a, b) => b.matchScore - a.matchScore);
  });

  // Apply an expectation's values to the current application salary
  function useExpectation(exp: ScoredExpectation) {
    // Pick the most relevant rate based on the job's salary period, or fall back to the biggest one
    const jobPeriod = job?.salary_period?.toLowerCase() || "";
    let amount: number | null = null;
    let period = "month";

    if (jobPeriod === "hour" && exp.hourly_rate) {
      amount = exp.hourly_rate;
      period = "hour";
    } else if (jobPeriod === "day" && exp.daily_rate) {
      amount = exp.daily_rate;
      period = "day";
    } else if (jobPeriod === "year" && exp.year_salary) {
      amount = exp.year_salary;
      period = "year";
    } else if (jobPeriod === "month" && exp.month_salary) {
      amount = exp.month_salary;
      period = "month";
    } else if (exp.year_salary) {
      amount = exp.year_salary;
      period = "year";
    } else if (exp.month_salary) {
      amount = exp.month_salary;
      period = "month";
    } else if (exp.daily_rate) {
      amount = exp.daily_rate;
      period = "day";
    } else if (exp.hourly_rate) {
      amount = exp.hourly_rate;
      period = "hour";
    }

    editAmount = amount ? String(amount) : "";
    editCurrency = exp.currency || "EUR";
    editPeriod = period;
    editing = true;
  }

  // Comparison logic
  type CompareResult = "within" | "above" | "below" | "unknown";

  let jobHasSalary = $derived(
    job && (job.salary_min != null || job.salary_max != null),
  );

  let salaryComparison = $derived.by((): CompareResult => {
    if (!app.salary_expectation || !job) return "unknown";
    if (job.salary_min == null && job.salary_max == null) return "unknown";

    const ask = Number(app.salary_expectation);
    const jobCurrency = job.salary_currency || "EUR";
    const appCurrency = app.salary_currency || "EUR";
    const jobPeriod = job.salary_period || "year";
    const appPeriod = app.salary_period || "month";

    if (jobCurrency !== appCurrency || jobPeriod !== appPeriod) {
      return "unknown";
    }

    if (job.salary_min != null && job.salary_max != null) {
      if (ask < job.salary_min) return "below";
      if (ask > job.salary_max) return "above";
      return "within";
    }

    if (job.salary_min != null) {
      if (ask < job.salary_min) return "below";
      return "within";
    }

    if (job.salary_max != null) {
      if (ask > job.salary_max) return "above";
      return "within";
    }

    return "unknown";
  });

  // All possible filter values (show all options, not just existing ones)
  const allWorkArrangements = Object.keys(workArrangementLabels);
  const allEmploymentTypes = Object.keys(employmentTypeLabels);
  const allCompanyTypes = Object.keys(companyTypeLabels);
  const allCurrencies = currencies.map((c) => c.value);
  // Regions are free text, so we can only show existing ones
  let availableRegions = $derived(
    [...new Set(salaryExpectations.map((e) => e.region).filter(Boolean))].sort(),
  );

  // Estimation state
  let estimating = $state(false);
  let estimate: {
    hourly_rate: number | null;
    daily_rate: number | null;
    month_salary: number | null;
    year_salary: number | null;
    confidence: string;
    reasoning: string;
  } | null = $state(null);
  let estimateError = $state("");

  // Editable estimate values (for user adjustment before saving)
  let editHourly = $state("");
  let editDaily = $state("");
  let editMonthly = $state("");
  let editYearly = $state("");
  let saving = $state(false);

  function applyEstimate(est: typeof estimate) {
    if (!est) return;
    editHourly = est.hourly_rate != null ? String(est.hourly_rate) : "";
    editDaily = est.daily_rate != null ? String(est.daily_rate) : "";
    editMonthly = est.month_salary != null ? String(est.month_salary) : "";
    editYearly = est.year_salary != null ? String(est.year_salary) : "";
  }

  // Reset estimate when filters change
  $effect(() => {
    // Access filter values to track them
    filterWorkArrangement;
    filterEmploymentType;
    filterCompanyType;
    filterCurrency;
    filterRegion;
    // Reset
    estimate = null;
    estimateError = "";
    editHourly = "";
    editDaily = "";
    editMonthly = "";
    editYearly = "";
  });
</script>

<div class="space-y-6">
  {#if form?.error}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  <!-- Section 1: Your Ask for This Application -->
  <div>
    <div class="flex items-center gap-2 mb-3">
      <FontAwesomeIcon icon={faMoneyBillWave} class="w-5 h-5 text-[var(--dash-primary)]" />
      <h2 class="text-lg font-semibold text-[var(--dash-text)]">
        Your Ask for This Application
      </h2>
    </div>

    <Card padding="lg">
      {#if editing}
        <form method="POST" action="?/updateSalary" use:enhance={handleSubmit}>
          <div class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label for="salary-amount" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
                  Amount <span class="text-[var(--dash-error)]">*</span>
                </label>
                <input
                  type="number"
                  id="salary-amount"
                  name="salary_expectation"
                  bind:value={editAmount}
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                />
              </div>
              <div>
                <label for="salary-currency" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
                  Currency <span class="text-[var(--dash-error)]">*</span>
                </label>
                <select
                  id="salary-currency"
                  name="salary_currency"
                  bind:value={editCurrency}
                  required
                  class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                >
                  {#each currencies as curr}
                    <option value={curr.value}>{curr.label} ({curr.symbol})</option>
                  {/each}
                </select>
              </div>
              <div>
                <label for="salary-period" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
                  Period <span class="text-[var(--dash-error)]">*</span>
                </label>
                <select
                  id="salary-period"
                  name="salary_period"
                  bind:value={editPeriod}
                  required
                  class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                >
                  {#each periods as period}
                    <option value={period.value}>{period.label}</option>
                  {/each}
                </select>
              </div>
            </div>

            <div class="flex justify-end gap-2">
              <button
                type="button"
                onclick={cancelEdit}
                class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      {:else if app.salary_expectation}
        <div class="flex items-center justify-between">
          <div>
            <p class="text-3xl font-bold text-[var(--dash-text)]">
              {formatCurrency(Number(app.salary_expectation), app.salary_currency)}
            </p>
            <p class="text-sm text-[var(--dash-text-secondary)] mt-1">
              per {getPeriodLabel(app.salary_period)?.toLowerCase() || "month"}
              <span class="mx-1">&middot;</span>
              {app.salary_currency || "EUR"}
            </p>
          </div>
          <button
            type="button"
            onclick={startEdit}
            class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
            aria-label="Edit salary"
          >
            <FontAwesomeIcon icon={faPencil} class="w-4 h-4" />
          </button>
        </div>
      {:else}
        <div class="text-center py-4">
          <div class="w-12 h-12 rounded-full bg-[var(--dash-bg)] flex items-center justify-center mx-auto mb-3">
            <FontAwesomeIcon icon={faMoneyBillWave} class="w-6 h-6 text-[var(--dash-text-muted)]" />
          </div>
          <p class="text-[var(--dash-text-secondary)] mb-3">
            No salary expectation set yet. Pick one of your presets below or set it manually.
          </p>
          <button
            type="button"
            onclick={startEdit}
            class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
          >
            Set Manually
          </button>
        </div>
      {/if}
    </Card>
  </div>

  <!-- Section 2: Job's Salary Range -->
  {#if jobHasSalary}
    <div>
      <div class="flex items-center gap-2 mb-3">
        <FontAwesomeIcon icon={faInfoCircle} class="w-5 h-5 text-[var(--dash-primary)]" />
        <h2 class="text-lg font-semibold text-[var(--dash-text)]">
          Job's Salary Range
        </h2>
      </div>

      <Card padding="lg">
        <div class="flex flex-col sm:flex-row sm:items-center gap-4">
          <div class="flex-1">
            <div class="flex items-baseline gap-2 flex-wrap">
              {#if job?.salary_min != null && job?.salary_max != null}
                <p class="text-2xl font-bold text-[var(--dash-text)]">
                  {formatCurrencyInt(job.salary_min, job.salary_currency)} &ndash; {formatCurrencyInt(job.salary_max, job.salary_currency)}
                </p>
              {:else if job?.salary_min != null}
                <p class="text-2xl font-bold text-[var(--dash-text)]">
                  From {formatCurrencyInt(job.salary_min, job.salary_currency)}
                </p>
              {:else if job?.salary_max != null}
                <p class="text-2xl font-bold text-[var(--dash-text)]">
                  Up to {formatCurrencyInt(job.salary_max, job.salary_currency)}
                </p>
              {/if}
            </div>
            <p class="text-sm text-[var(--dash-text-secondary)] mt-1">
              {#if job?.salary_period}
                per {getPeriodLabel(job.salary_period)?.toLowerCase()}
              {/if}
              {#if job?.salary_currency}
                <span class="mx-1">&middot;</span>
                {job.salary_currency}
              {/if}
            </p>
          </div>

          {#if app.salary_expectation && salaryComparison !== "unknown"}
            <div class="flex-shrink-0">
              {#if salaryComparison === "within"}
                <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--dash-success-light)] text-[var(--dash-success)]">
                  <FontAwesomeIcon icon={faEquals} class="w-4 h-4" />
                  <span class="text-sm font-medium">Your ask is within range</span>
                </div>
              {:else if salaryComparison === "above"}
                <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--dash-error-light)] text-[var(--dash-error)]">
                  <FontAwesomeIcon icon={faArrowUp} class="w-4 h-4" />
                  <span class="text-sm font-medium">Your ask is above range</span>
                </div>
              {:else if salaryComparison === "below"}
                <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--dash-warning-light)] text-[var(--dash-warning)]">
                  <FontAwesomeIcon icon={faArrowDown} class="w-4 h-4" />
                  <span class="text-sm font-medium">Your ask is below range</span>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        {#if app.salary_expectation && salaryComparison === "unknown" && (app.salary_currency !== job?.salary_currency || app.salary_period !== job?.salary_period)}
          <p class="text-xs text-[var(--dash-text-muted)] mt-3">
            Cannot compare: different currency or period between your ask and the job's range.
          </p>
        {/if}
      </Card>
    </div>
  {/if}

  <!-- Section 3: Pick from Your Salary Expectations -->
  <div>
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <FontAwesomeIcon icon={faStar} class="w-5 h-5 text-[var(--dash-primary)]" />
        <h2 class="text-lg font-semibold text-[var(--dash-text)]">
          Your Salary Presets
        </h2>
      </div>
      <div class="flex items-center gap-2">
        {#if salaryExpectations.length <= 3}
          <button
            type="button"
            onclick={() => (showFilters = !showFilters)}
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)] transition-colors {showFilters ? 'bg-[var(--dash-bg)]' : ''}"
          >
            <FontAwesomeIcon icon={faFilter} class="w-3 h-3" />
            Filter
          </button>
        {/if}
        <a
          href="/dashboard/applications/salary"
          class="flex items-center gap-1 text-sm text-[var(--dash-primary)] hover:underline"
        >
          Manage
          <FontAwesomeIcon icon={faExternalLinkAlt} class="w-3 h-3" />
        </a>
      </div>
    </div>

      <!-- Auto-match info -->
      {#if salaryExpectations.length > 0 && job && (jobWorkLocations.length > 0 || jobEmploymentTypes.length > 0)}
        <div class="text-sm text-[var(--dash-text-secondary)] mb-3 flex items-center gap-2">
          <FontAwesomeIcon icon={faInfoCircle} class="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            Sorted by relevance to this job
            {#if jobWorkLocations.length > 0}
              ({jobWorkLocations.map((l) => workArrangementLabels[l] || l).join(", ")}
            {/if}
            {#if jobEmploymentTypes.length > 0}
              {#if jobWorkLocations.length > 0}, {/if}{jobEmploymentTypes.map((t) => employmentTypeLabels[t] || t).join(", ")}
            {/if}
            {#if job.office_location}
              {#if jobWorkLocations.length > 0 || jobEmploymentTypes.length > 0}, {/if}{job.office_location}
            {/if})
          </span>
        </div>
      {/if}

      <!-- Manual Filters -->
      {#if showFilters || salaryExpectations.length > 3}
        <div class="mb-4">
        <Card padding="md">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label for="filter-currency" class="block text-xs text-[var(--dash-text-secondary)] mb-1">Currency</label>
              <select
                id="filter-currency"
                bind:value={filterCurrency}
                class="w-full px-3 py-2 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
              >
                <option value="all">All</option>
                {#each allCurrencies as cur}
                  <option value={cur}>{cur}</option>
                {/each}
              </select>
            </div>
            <div>
              <label for="filter-work" class="block text-xs text-[var(--dash-text-secondary)] mb-1">Work Arrangement</label>
              <select
                id="filter-work"
                bind:value={filterWorkArrangement}
                class="w-full px-3 py-2 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
              >
                <option value="all">All</option>
                {#each allWorkArrangements as wa}
                  <option value={wa}>{workArrangementLabels[wa] || wa}</option>
                {/each}
              </select>
            </div>
            <div>
              <label for="filter-employment" class="block text-xs text-[var(--dash-text-secondary)] mb-1">Employment Type</label>
              <select
                id="filter-employment"
                bind:value={filterEmploymentType}
                class="w-full px-3 py-2 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
              >
                <option value="all">All</option>
                {#each allEmploymentTypes as et}
                  <option value={et}>{employmentTypeLabels[et] || et}</option>
                {/each}
              </select>
            </div>
            <div>
              <label for="filter-company" class="block text-xs text-[var(--dash-text-secondary)] mb-1">Company Type</label>
              <select
                id="filter-company"
                bind:value={filterCompanyType}
                class="w-full px-3 py-2 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
              >
                <option value="all">All</option>
                {#each allCompanyTypes as ct}
                  <option value={ct}>{companyTypeLabels[ct] || ct}</option>
                {/each}
              </select>
            </div>
            <div>
              <label for="filter-region" class="block text-xs text-[var(--dash-text-secondary)] mb-1">Region</label>
              {#if customRegionInput}
                <div class="flex gap-1">
                  <input
                    type="text"
                    bind:value={filterRegion}
                    placeholder="e.g. Netherlands"
                    class="flex-1 min-w-0 px-3 py-2 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  />
                  {#if availableRegions.length > 0}
                    <button
                      type="button"
                      onclick={() => { customRegionInput = false; filterRegion = "all"; }}
                      class="px-2 py-2 text-sm text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors"
                      title="Back to list"
                    >
                      <FontAwesomeIcon icon={faTimes} class="w-3 h-3" />
                    </button>
                  {/if}
                </div>
              {:else}
                <div class="flex gap-1">
                  <select
                    id="filter-region"
                    bind:value={filterRegion}
                    class="flex-1 min-w-0 px-3 py-2 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  >
                    <option value="all">All</option>
                    {#each availableRegions as region}
                      <option value={region}>{region}</option>
                    {/each}
                  </select>
                  <button
                    type="button"
                    onclick={() => { customRegionInput = true; filterRegion = ""; }}
                    class="px-2 py-2 text-sm text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] transition-colors"
                    title="Enter custom region"
                  >
                    <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
                  </button>
                </div>
              {/if}
            </div>
          </div>
        </Card>
        </div>
      {/if}

      <!-- Expectation Cards -->
      {#if filteredExpectations.length === 0 && filterWorkArrangement !== "all" && filterEmploymentType !== "all" && filterCompanyType !== "all" && filterCurrency !== "all" && filterRegion !== "all" && filterRegion !== ""}
        <!-- All filters are set but no preset exists — show creation widget -->
        <Card padding="lg">
          <div class="space-y-4">
            <div class="text-center">
              <p class="text-sm text-[var(--dash-text-secondary)] mb-1">
                No preset for <strong>{employmentTypeLabels[filterEmploymentType]}</strong>, <strong>{workArrangementLabels[filterWorkArrangement]}</strong>, <strong>{companyTypeLabels[filterCompanyType]}</strong>, <strong>{filterCurrency}</strong>, <strong>{filterRegion}</strong>
              </p>
            </div>

            {#if !estimate}
              <!-- Estimate button -->
              <div class="flex items-center justify-center">
                <form
                  method="POST"
                  action="?/estimateSalary"
                  use:enhance={() => {
                    estimating = true;
                    estimateError = "";
                    return async ({ result, update }) => {
                      estimating = false;
                      if (result.type === "success" && result.data?.estimate) {
                        estimate = result.data.estimate as typeof estimate;
                        applyEstimate(estimate);
                      } else if (result.type === "failure") {
                        estimateError = (result.data as { error?: string })?.error || "Estimation failed";
                      }
                      // Don't call update() — we handle state manually
                    };
                  }}
                >
                  <input type="hidden" name="employment_type" value={filterEmploymentType} />
                  <input type="hidden" name="work_arrangement" value={filterWorkArrangement} />
                  <input type="hidden" name="company_type" value={filterCompanyType} />
                  <input type="hidden" name="region" value={filterRegion} />
                  <input type="hidden" name="currency" value={filterCurrency} />
                  <button
                    type="submit"
                    disabled={estimating}
                    class="flex items-center gap-2 px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50"
                  >
                    {#if estimating}
                      <FontAwesomeIcon icon={faSpinner} class="w-4 h-4 animate-spin" />
                      Estimating...
                    {:else}
                      <FontAwesomeIcon icon={faMagicWandSparkles} class="w-4 h-4" />
                      Estimate with AI
                    {/if}
                  </button>
                </form>
              </div>
              {#if estimateError}
                <p class="text-sm text-[var(--dash-error)] text-center">{estimateError}</p>
              {/if}
            {:else}
              <!-- Estimate received — show editable values -->
              <div class="border border-[var(--dash-border)] rounded-lg p-4 space-y-4">
                <div class="flex items-center gap-2 text-sm">
                  <FontAwesomeIcon icon={faMagicWandSparkles} class="w-4 h-4 text-[var(--dash-primary)]" />
                  <span class="text-[var(--dash-text-secondary)]">
                    AI estimate
                    {#if estimate.confidence === "high"}
                      <span class="text-[var(--dash-success)]">(high confidence)</span>
                    {:else if estimate.confidence === "medium"}
                      <span class="text-[var(--dash-warning)]">(medium confidence)</span>
                    {:else}
                      <span class="text-[var(--dash-text-muted)]">(low confidence)</span>
                    {/if}
                  </span>
                </div>

                {#if estimate.reasoning}
                  <p class="text-xs text-[var(--dash-text-muted)]">{estimate.reasoning}</p>
                {/if}

                <form
                  method="POST"
                  action="?/createFromEstimate"
                  use:enhance={() => {
                    saving = true;
                    return async ({ result, update }) => {
                      saving = false;
                      if (result.type === "success") {
                        estimate = null;
                        await update();
                      }
                    };
                  }}
                >
                  <input type="hidden" name="employment_type" value={filterEmploymentType} />
                  <input type="hidden" name="work_arrangement" value={filterWorkArrangement} />
                  <input type="hidden" name="company_type" value={filterCompanyType} />
                  <input type="hidden" name="region" value={filterRegion} />
                  <input type="hidden" name="currency" value={filterCurrency} />

                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label for="est-hourly" class="block text-xs text-[var(--dash-text-secondary)] mb-1">Hourly</label>
                      <input
                        type="number"
                        id="est-hourly"
                        name="hourly_rate"
                        bind:value={editHourly}
                        placeholder="-"
                        min="0"
                        class="w-full px-3 py-2 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label for="est-daily" class="block text-xs text-[var(--dash-text-secondary)] mb-1">Daily</label>
                      <input
                        type="number"
                        id="est-daily"
                        name="daily_rate"
                        bind:value={editDaily}
                        placeholder="-"
                        min="0"
                        class="w-full px-3 py-2 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label for="est-monthly" class="block text-xs text-[var(--dash-text-secondary)] mb-1">Monthly</label>
                      <input
                        type="number"
                        id="est-monthly"
                        name="month_salary"
                        bind:value={editMonthly}
                        placeholder="-"
                        min="0"
                        class="w-full px-3 py-2 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label for="est-yearly" class="block text-xs text-[var(--dash-text-secondary)] mb-1">Yearly</label>
                      <input
                        type="number"
                        id="est-yearly"
                        name="year_salary"
                        bind:value={editYearly}
                        placeholder="-"
                        min="0"
                        class="w-full px-3 py-2 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div class="flex items-center justify-end gap-2 mt-4">
                    <button
                      type="button"
                      onclick={() => { estimate = null; }}
                      class="px-4 py-2 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)] transition-colors"
                    >
                      Discard
                    </button>
                    <button
                      type="submit"
                      disabled={saving || (!editHourly && !editDaily && !editMonthly && !editYearly)}
                      class="flex items-center gap-2 px-4 py-2 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50"
                    >
                      {#if saving}
                        <FontAwesomeIcon icon={faSpinner} class="w-3 h-3 animate-spin" />
                      {:else}
                        <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
                      {/if}
                      Save Preset
                    </button>
                  </div>
                </form>
              </div>
            {/if}
          </div>
        </Card>
      {:else if filteredExpectations.length === 0}
        <Card padding="md">
          <p class="text-sm text-[var(--dash-text-muted)] text-center py-4">
            No salary presets match the current filters. Select specific values for all filters to create one with AI estimation.
          </p>
        </Card>
      {:else}
        <div class="space-y-3">
          {#each filteredExpectations as exp (exp.id)}
            <Card padding="md">
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 rounded-full bg-[var(--dash-bg)] flex items-center justify-center flex-shrink-0">
                  {#if exp.matchScore >= 4}
                    <FontAwesomeIcon icon={faStar} class="w-5 h-5 text-[var(--dash-success)]" />
                  {:else if exp.matchScore >= 2}
                    <FontAwesomeIcon icon={faMoneyBillWave} class="w-5 h-5 text-[var(--dash-warning)]" />
                  {:else}
                    <FontAwesomeIcon icon={faMoneyBillWave} class="w-5 h-5 text-[var(--dash-text-muted)]" />
                  {/if}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <h3 class="font-medium text-[var(--dash-text)]">
                          {exp.job_title || "Any Position"}
                        </h3>
                        {#if exp.matchScore >= 4}
                          <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--dash-success-light)] text-[var(--dash-success)]">Best match</span>
                        {/if}
                      </div>
                      <p class="text-sm mt-0.5 flex flex-wrap items-center gap-x-1">
                        {#snippet prop(label: string, matches: boolean)}
                          {#if matches}
                            <span class="text-[var(--dash-primary)] font-medium">{label}</span>
                          {:else}
                            <span class="text-[var(--dash-text-secondary)]">{label}</span>
                          {/if}
                        {/snippet}
                        {@render prop(companyTypeLabels[exp.company_type] || exp.company_type, exp.matchReasons.includes(companyTypeLabels[exp.company_type] || exp.company_type))}
                        <span class="text-[var(--dash-text-muted)]">&middot;</span>
                        {@render prop(employmentTypeLabels[exp.employment_type] || exp.employment_type, exp.matchReasons.includes(employmentTypeLabels[exp.employment_type] || exp.employment_type))}
                        <span class="text-[var(--dash-text-muted)]">&middot;</span>
                        {@render prop(workArrangementLabels[exp.work_arrangement] || exp.work_arrangement, exp.matchReasons.includes(workArrangementLabels[exp.work_arrangement] || exp.work_arrangement))}
                        <span class="text-[var(--dash-text-muted)]">&middot;</span>
                        {@render prop(exp.region, exp.matchReasons.includes(exp.region))}
                      </p>
                      <div class="flex flex-wrap gap-3 mt-2 text-sm">
                        {#if exp.hourly_rate}
                          <span class="text-[var(--dash-text)]">
                            {formatCurrencyInt(exp.hourly_rate, exp.currency)}/hr
                          </span>
                        {/if}
                        {#if exp.daily_rate}
                          <span class="text-[var(--dash-text)]">
                            {formatCurrencyInt(exp.daily_rate, exp.currency)}/day
                          </span>
                        {/if}
                        {#if exp.month_salary}
                          <span class="text-[var(--dash-text)]">
                            {formatCurrencyInt(exp.month_salary, exp.currency)}/mo
                          </span>
                        {/if}
                        {#if exp.year_salary}
                          <span class="text-[var(--dash-text)]">
                            {formatCurrencyInt(exp.year_salary, exp.currency)}/yr
                          </span>
                        {/if}
                      </div>
                    </div>
                    <button
                      type="button"
                      onclick={() => useExpectation(exp)}
                      class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-hover)] transition-colors whitespace-nowrap flex-shrink-0"
                    >
                      <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                      Use this
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          {/each}
        </div>
      {/if}
  </div>
</div>
