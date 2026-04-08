<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowDown,
    faArrowUp,
    faCheck,
    faEquals,
    faExternalLinkAlt,
    faInfoCircle,
    faMoneyBillWave,
    faPencil,
  } from "@fortawesome/free-solid-svg-icons";
  import {
    hourlyToRate,
    formatCurrency,
    formatSalaryPeriod,
    normalizeSalaryPeriod,
    projectToHourly,
    getEffectiveRate,
    compareSalary,
    type SalaryPeriod,
    type SalaryAdjustments,
    type SalaryRegionOverrides,
  } from "$lib/salary/conversion";
  import { isSalarySingleValue } from "$lib/format";
  import {
    JOB_TYPES,
    WORK_LOCATIONS,
    REGIONS,
    buildNormalizeMap,
    buildDisplayMap,
    getPatterns,
  } from "$lib/data/job-taxonomy";

  const jobTypeNormalize = buildNormalizeMap(JOB_TYPES);
  const workLocNormalize = buildNormalizeMap(WORK_LOCATIONS);
  const workLocPatterns = getPatterns(WORK_LOCATIONS);
  const regionDisplayMap = buildDisplayMap(REGIONS);

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let app = $derived(data.application);
  let job = $derived(app.jobs);
  let salarySettings = $derived(data.salarySettings);

  let editing = $state(false);
  let editAmount = $state("");
  let editCurrency = $state("EUR");
  let editPeriod = $state("month");

  function toSalaryWorkArrangement(loc: string): string {
    const lower = loc.toLowerCase().trim();
    const canonical = workLocNormalize.get(lower);
    if (canonical) return canonical;
    for (const p of workLocPatterns) {
      if (p.mode === "includes" && lower.includes(p.pattern)) return p.canonical;
      if (p.mode === "startsWith" && lower.startsWith(p.pattern)) return p.canonical;
    }
    return lower;
  }

  function toSalaryEmploymentType(jobType: string): string {
    return jobTypeNormalize.get(jobType.toLowerCase()) ?? jobType.toLowerCase();
  }

  const currencies = [
    { value: "EUR", label: "EUR", symbol: "\u20AC" },
    { value: "USD", label: "USD", symbol: "$" },
    { value: "GBP", label: "GBP", symbol: "\u00A3" },
  ];

  const periods = [
    { value: "hour", label: "Hour" },
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
    { value: "year", label: "Year" },
  ];

  const employmentTypeLabels: Record<string, string> = {
    any: "Any", full_time: "Full-time", part_time: "Part-time",
    contract: "Contract", temporary: "Temporary", freelance: "Freelance", internship: "Internship",
  };

  const workArrangementLabels: Record<string, string> = {
    remote: "Remote", hybrid: "Hybrid", onsite: "On-site",
  };

  const companyTypeLabels: Record<string, string> = {
    startup: "Startup", scaleup: "Scale-up", corporate: "Corporate",
    agency: "Agency", consultancy: "Consultancy",
  };

  function getPeriodLabel(period: string | null | undefined): string {
    if (!period) return "";
    const formatted = formatSalaryPeriod(period);
    return formatted || period;
  }

  function startEdit() {
    editAmount = app.salary_expectation ? String(app.salary_expectation) : "";
    editCurrency = app.salary_currency || suggestedRates?.currency || "EUR";
    editPeriod = app.salary_period || "month";
    editing = true;
  }

  function cancelEdit() {
    editing = false;
  }

  function handleSubmit() {
    return async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
      await update();
      if (result.type === "success") editing = false;
    };
  }

  // Infer job context for salary calculation
  let jobContext = $derived.by(() => {
    const ctx: {
      employment_type?: string;
      work_arrangement?: string;
      company_type?: string;
      region?: string;
    } = {};

    if (job?.job_types && Array.isArray(job.job_types) && (job.job_types as string[]).length > 0) {
      ctx.employment_type = toSalaryEmploymentType((job.job_types as string[])[0]);
    }

    if (job?.work_location && Array.isArray(job.work_location) && (job.work_location as string[]).length > 0) {
      ctx.work_arrangement = toSalaryWorkArrangement((job.work_location as string[])[0]);
    }

    if (job?.region) {
      ctx.region = job.region;
    }

    return ctx;
  });

  // Calculate effective rate for this job using salary settings
  let effective = $derived.by(() => {
    if (!salarySettings.baseRate) return null;
    return getEffectiveRate(
      salarySettings.baseRate,
      salarySettings.currency || "EUR",
      salarySettings.adjustments as SalaryAdjustments,
      salarySettings.regionOverrides as SalaryRegionOverrides,
      jobContext,
    );
  });

  let suggestedRates = $derived.by(() => {
    if (!effective) return null;
    return {
      hourly: effective.rate,
      daily: hourlyToRate(effective.rate, "day"),
      monthly: hourlyToRate(effective.rate, "month"),
      yearly: hourlyToRate(effective.rate, "year"),
      currency: effective.currency,
    };
  });

  // Apply suggested rate to the salary form
  function useSuggested(period: SalaryPeriod) {
    if (!suggestedRates) return;
    const rateMap: Record<string, number> = {
      hour: suggestedRates.hourly,
      day: suggestedRates.daily,
      month: suggestedRates.monthly,
      year: suggestedRates.yearly,
    };
    editAmount = String(rateMap[period]);
    editCurrency = suggestedRates.currency;
    editPeriod = period;
    editing = true;
  }

  // Salary comparison
  let jobHasSalary = $derived(job && (job.salary_min != null || job.salary_max != null));

  let salaryComparison = $derived.by(() => {
    if (!app.salary_expectation || !job) return "unknown" as const;
    if (job.salary_min == null && job.salary_max == null) return "unknown" as const;
    return compareSalary(
      Number(app.salary_expectation),
      app.salary_currency || "EUR",
      (app.salary_period || "month") as SalaryPeriod,
      job.salary_min,
      job.salary_max,
      job.salary_currency,
      job.salary_period,
      job.salary_duration_weeks,
    );
  });

  // Explain what adjustments are active for this job
  let activeAdjustments = $derived.by(() => {
    const parts: string[] = [];

    if (jobContext.region && (salarySettings.regionOverrides as SalaryRegionOverrides)?.[jobContext.region] != null) {
      const regionLabel = regionDisplayMap.get(jobContext.region) || jobContext.region;
      const override = (salarySettings.regionOverrides as SalaryRegionOverrides)[jobContext.region];
      parts.push(`${regionLabel} region: ${formatCurrency(override.rate, override.currency)}/hr base`);
    }

    const adj = salarySettings.adjustments as SalaryAdjustments | null;
    if (!adj) return parts;

    if (jobContext.employment_type && adj.employment_type?.[jobContext.employment_type] != null) {
      const pct = adj.employment_type[jobContext.employment_type];
      parts.push(`${employmentTypeLabels[jobContext.employment_type] || jobContext.employment_type}: ${pct >= 0 ? "+" : ""}${pct}%`);
    }
    if (jobContext.work_arrangement && adj.work_arrangement?.[jobContext.work_arrangement] != null) {
      const pct = adj.work_arrangement[jobContext.work_arrangement];
      parts.push(`${workArrangementLabels[jobContext.work_arrangement] || jobContext.work_arrangement}: ${pct >= 0 ? "+" : ""}${pct}%`);
    }
    if (jobContext.company_type && adj.company_type?.[jobContext.company_type] != null) {
      const pct = adj.company_type[jobContext.company_type];
      parts.push(`${companyTypeLabels[jobContext.company_type] || jobContext.company_type}: ${pct >= 0 ? "+" : ""}${pct}%`);
    }
    return parts;
  });
</script>

<div class="space-y-6">
  {#if form?.error}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  <!-- Section 1: Job's Salary Info -->
  {#if jobHasSalary}
    <div>
      <div class="flex items-center gap-2 mb-3">
        <FontAwesomeIcon icon={faInfoCircle} class="w-5 h-5 text-[var(--dash-primary)]" />
        <h2 class="text-lg font-semibold text-[var(--dash-text)]">
          {isSalarySingleValue(job?.salary_min ?? null, job?.salary_max ?? null) ? "Salary Indication" : "Job's Salary Range"}
        </h2>
      </div>

      <div class="sm:bg-[var(--dash-card)] sm:rounded-lg sm:border sm:border-[var(--dash-border)] sm:p-6">
        <div class="flex flex-col sm:flex-row sm:items-center gap-4">
          <div class="flex-1">
            <div class="flex items-baseline gap-2 flex-wrap">
              {#if job?.salary_min != null && job?.salary_max != null && job.salary_min === job.salary_max}
                <p class="text-2xl font-bold text-[var(--dash-text)]">
                  {formatCurrency(job.salary_min, job.salary_currency || "EUR")}
                </p>
              {:else if job?.salary_min != null && job?.salary_max != null}
                <p class="text-2xl font-bold text-[var(--dash-text)]">
                  {formatCurrency(job.salary_min, job.salary_currency || "EUR")} &ndash; {formatCurrency(job.salary_max, job.salary_currency || "EUR")}
                </p>
              {:else if job?.salary_min != null}
                <p class="text-2xl font-bold text-[var(--dash-text)]">
                  From {formatCurrency(job.salary_min, job.salary_currency || "EUR")}
                </p>
              {:else if job?.salary_max != null}
                <p class="text-2xl font-bold text-[var(--dash-text)]">
                  Up to {formatCurrency(job.salary_max, job.salary_currency || "EUR")}
                </p>
              {/if}
            </div>
            <p class="text-sm text-[var(--dash-text-secondary)] mt-1">
              {#if job?.salary_period}
                {normalizeSalaryPeriod(job.salary_period) === "project" ? "fixed price" : `per ${getPeriodLabel(job.salary_period)?.toLowerCase()}`}
              {/if}
              {#if job?.salary_duration_weeks}
                <span class="mx-1">&middot;</span>
                {job.salary_duration_weeks} week{job.salary_duration_weeks === 1 ? "" : "s"}
              {/if}
              {#if job?.salary_currency}
                <span class="mx-1">&middot;</span>
                {job.salary_currency}
              {/if}
            </p>
            {#if normalizeSalaryPeriod(job?.salary_period) === "project" && job?.salary_duration_weeks && job?.salary_min}
              {@const equivHourly = projectToHourly(job.salary_min, job.salary_duration_weeks)}
              <p class="text-xs text-[var(--dash-text-muted)] mt-1">
                ≈ {formatCurrency(Math.round(equivHourly), job.salary_currency || "EUR")}/hr equivalent
              </p>
            {/if}
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
      </div>
    </div>
  {/if}

  <hr class="border-[var(--dash-border)] sm:hidden" />

  <!-- Section 2: Your Ask -->
  <div>
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <FontAwesomeIcon icon={faMoneyBillWave} class="w-5 h-5 text-[var(--dash-primary)]" />
        <h2 class="text-lg font-semibold text-[var(--dash-text)]">Your Ask</h2>
      </div>
      {#if suggestedRates}
        <a
          href="/dashboard/applications/salary"
          class="flex items-center gap-1 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] transition-colors"
        >
          Salary settings
          <FontAwesomeIcon icon={faExternalLinkAlt} class="w-2.5 h-2.5" />
        </a>
      {/if}
    </div>

    <div class="sm:bg-[var(--dash-card)] sm:rounded-lg sm:border sm:border-[var(--dash-border)] sm:p-6">
      {#if editing}
        <!-- Edit form -->
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

            {#if suggestedRates}
              <div class="pt-2 border-t border-[var(--dash-border)]">
                <p class="text-xs text-[var(--dash-text-muted)] mb-2">Use calculated rate:</p>
                <div class="flex flex-wrap gap-2">
                  {#each [
                    { period: "hour" as SalaryPeriod, label: "Hourly", amount: suggestedRates.hourly },
                    { period: "day" as SalaryPeriod, label: "Daily", amount: suggestedRates.daily },
                    { period: "month" as SalaryPeriod, label: "Monthly", amount: suggestedRates.monthly },
                    { period: "year" as SalaryPeriod, label: "Yearly", amount: suggestedRates.yearly },
                  ] as rate}
                    <button
                      type="button"
                      onclick={() => useSuggested(rate.period)}
                      class="px-3 py-1.5 text-xs rounded-md border border-[var(--dash-border)] hover:border-[var(--dash-primary)] hover:text-[var(--dash-primary)] transition-colors {editPeriod === rate.period && editAmount === String(rate.amount) ? 'border-[var(--dash-primary)] text-[var(--dash-primary)] bg-[var(--dash-primary)]/5' : 'text-[var(--dash-text-secondary)]'}"
                    >
                      {rate.label}: {formatCurrency(rate.amount, suggestedRates.currency)}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

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
        <!-- Display current ask -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-3xl font-bold text-[var(--dash-text)]">
              {formatCurrency(Number(app.salary_expectation), app.salary_currency || "EUR")}
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
        <!-- Empty state: show calculated rates to pick from, or prompt to set manually -->
        {#if suggestedRates}
          <div class="space-y-3">
            <p class="text-sm text-[var(--dash-text-secondary)]">
              Choose a calculated rate or <button type="button" onclick={startEdit} class="text-[var(--dash-primary)] hover:underline">enter a custom amount</button>.
            </p>
            {#if activeAdjustments.length > 0}
              <p class="text-xs text-[var(--dash-text-muted)]">
                Base {formatCurrency(salarySettings.baseRate!, salarySettings.currency || "EUR")}/hr
                adjusted: {activeAdjustments.join(", ")}
              </p>
            {/if}
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {#each [
                { period: "hour" as SalaryPeriod, label: "Hourly", amount: suggestedRates.hourly },
                { period: "day" as SalaryPeriod, label: "Daily", amount: suggestedRates.daily },
                { period: "month" as SalaryPeriod, label: "Monthly", amount: suggestedRates.monthly },
                { period: "year" as SalaryPeriod, label: "Yearly", amount: suggestedRates.yearly },
              ] as rate}
                <button
                  type="button"
                  onclick={() => useSuggested(rate.period)}
                  class="p-3 rounded-lg border border-[var(--dash-border)] hover:border-[var(--dash-primary)] hover:bg-[var(--dash-primary)]/5 transition-colors text-left group"
                >
                  <p class="text-xs text-[var(--dash-text-muted)] mb-1">{rate.label}</p>
                  <p class="text-lg font-semibold text-[var(--dash-text)] group-hover:text-[var(--dash-primary)]">
                    {formatCurrency(rate.amount, suggestedRates.currency)}
                  </p>
                </button>
              {/each}
            </div>
          </div>
        {:else}
          <div class="text-center py-4">
            <div class="w-12 h-12 rounded-full bg-[var(--dash-bg)] flex items-center justify-center mx-auto mb-3">
              <FontAwesomeIcon icon={faMoneyBillWave} class="w-6 h-6 text-[var(--dash-text-muted)]" />
            </div>
            <p class="text-[var(--dash-text-secondary)] mb-3">
              No salary expectation set yet.
              <a href="/dashboard/applications/salary" class="text-[var(--dash-primary)] hover:underline">Configure your salary settings</a> to get calculated rates, or set it manually.
            </p>
            <button
              type="button"
              onclick={startEdit}
              class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
            >
              Set
            </button>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>
