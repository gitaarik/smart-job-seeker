<script lang="ts">
  import type { PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faMoneyBillWave,
    faPlus,
    faTrash,
    faGlobe,
    faChevronDown,
    faChevronUp,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../components/Card.svelte";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import SectionSaveButton from "$lib/components/SectionSaveButton.svelte";
  import {
    hourlyToRate,
    formatCurrency,
    getEffectiveRate,
    REGION_CURRENCIES,
    type SalaryAdjustments,
    type SalaryRegionOverrides,
  } from "$lib/salary/conversion";
  import { REGIONS } from "$lib/data/job-taxonomy";

  type SaveState = "idle" | "saving" | "saved" | "error";

  let { data }: { data: PageData } = $props();

  let settings = $derived(data.salarySettings);

  // Editable state — initialize from server data
  let baseRate = $state(settings.baseRate?.toString() ?? "");
  let currency = $state(settings.currency ?? "EUR");
  let adjustments = $state<SalaryAdjustments>(
    settings.adjustments && Object.keys(settings.adjustments).length > 0
      ? settings.adjustments as SalaryAdjustments
      : { employment_type: {}, work_arrangement: {}, company_type: {} },
  );
  let regionOverrides = $state<SalaryRegionOverrides>(
    settings.regionOverrides && Object.keys(settings.regionOverrides).length > 0
      ? settings.regionOverrides as SalaryRegionOverrides
      : {},
  );

  // Save states per section
  let regionRatesState = $state<SaveState>("idle");
  let adjustmentsState = $state<SaveState>("idle");

  async function saveRegionRates() {
    regionRatesState = "saving";
    try {
      const formData = new FormData();
      formData.set("base_rate", baseRate);
      formData.set("currency", currency);
      formData.set("region_overrides", JSON.stringify(regionOverrides));

      const response = await fetch("?/saveRegionRates", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        regionRatesState = "error";
        setTimeout(() => (regionRatesState = "idle"), 2000);
        return;
      }

      regionRatesState = "saved";
      setTimeout(() => (regionRatesState = "idle"), 2000);
    } catch {
      regionRatesState = "error";
      setTimeout(() => (regionRatesState = "idle"), 2000);
    }
  }

  async function saveAdjustments() {
    adjustmentsState = "saving";
    try {
      const formData = new FormData();
      formData.set("adjustments", JSON.stringify(adjustments));

      const response = await fetch("?/saveAdjustments", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        adjustmentsState = "error";
        setTimeout(() => (adjustmentsState = "idle"), 2000);
        return;
      }

      adjustmentsState = "saved";
      setTimeout(() => (adjustmentsState = "idle"), 2000);
    } catch {
      adjustmentsState = "error";
      setTimeout(() => (adjustmentsState = "idle"), 2000);
    }
  }

  const currencies = [
    { value: "EUR", label: "EUR", symbol: "\u20AC" },
    { value: "USD", label: "USD", symbol: "$" },
    { value: "GBP", label: "GBP", symbol: "\u00A3" },
  ];

  const predefinedRegions = REGIONS.values.map((v) => ({ value: v.canonical, label: v.label }));

  // Common adjustments shown by default
  const commonAdjustments: { key: keyof SalaryAdjustments; value: string; label: string }[] = [
    { key: "employment_type", value: "contract", label: "Contract / Freelance" },
    { key: "work_arrangement", value: "onsite", label: "On-site" },
    { key: "work_arrangement", value: "hybrid", label: "Hybrid" },
  ];

  // Advanced adjustments behind toggle
  const advancedAdjustments: { key: keyof SalaryAdjustments; value: string; label: string }[] = [
    { key: "employment_type", value: "part_time", label: "Part-time" },
    { key: "employment_type", value: "temporary", label: "Temporary" },
    { key: "employment_type", value: "internship", label: "Internship" },
    { key: "company_type", value: "startup", label: "Startup" },
    { key: "company_type", value: "corporate", label: "Corporate" },
    { key: "company_type", value: "agency", label: "Agency / Consultancy" },
  ];

  let showAdvanced = $state(false);

  // Auto-expand if any advanced adjustment has a value
  $effect(() => {
    const hasAdvancedValues = advancedAdjustments.some(
      (a) => adjustments[a.key]?.[a.value] != null,
    );
    if (hasAdvancedValues) showAdvanced = true;
  });

  let newRegionKey = $state("");

  function addRegionOverride() {
    if (!newRegionKey) return;
    const defaultCurrency = REGION_CURRENCIES[newRegionKey] || "EUR";
    regionOverrides = { ...regionOverrides, [newRegionKey]: { rate: 0, currency: defaultCurrency } };
    newRegionKey = "";
  }

  function removeRegionOverride(region: string) {
    const { [region]: _, ...rest } = regionOverrides;
    regionOverrides = rest;
  }

  function updateRegionRate(region: string, value: string) {
    const rate = parseInt(value) || 0;
    regionOverrides = { ...regionOverrides, [region]: { ...regionOverrides[region], rate } };
  }

  function updateRegionCurrency(region: string, curr: string) {
    regionOverrides = { ...regionOverrides, [region]: { ...regionOverrides[region], currency: curr } };
  }

  // Linked options: setting one sets the others too
  const linkedOptions: Record<string, { key: keyof SalaryAdjustments; values: string[] }> = {
    "employment_type:contract": { key: "employment_type", values: ["contract", "freelance"] },
  };

  function setAdjustment(category: keyof SalaryAdjustments, option: string, value: string) {
    const numVal = parseInt(value);
    const cat = { ...(adjustments[category] ?? {}) };

    // Check for linked options
    const linked = linkedOptions[`${category}:${option}`];
    const targets = linked ? linked.values : [option];

    for (const target of targets) {
      if (value === "" || isNaN(numVal)) {
        delete cat[target];
      } else {
        cat[target] = numVal;
      }
    }
    adjustments = { ...adjustments, [category]: cat };
  }

  // Also link agency ↔ consultancy
  function setAgencyAdjustment(value: string) {
    const numVal = parseInt(value);
    const cat = { ...(adjustments.company_type ?? {}) };
    if (value === "" || isNaN(numVal)) {
      delete cat["agency"];
      delete cat["consultancy"];
    } else {
      cat["agency"] = numVal;
      cat["consultancy"] = numVal;
    }
    adjustments = { ...adjustments, company_type: cat };
  }

  function getAdjustmentValue(category: keyof SalaryAdjustments, option: string): string {
    const val = adjustments[category]?.[option];
    return val != null ? String(val) : "";
  }

  // Preview calculation
  let baseRateNum = $derived(parseInt(baseRate) || 0);

  // Available regions not yet added
  let availableRegions = $derived(
    predefinedRegions.filter((r) => !(r.value in regionOverrides)),
  );

  // Example scenarios for preview
  let exampleScenarios = $derived.by(() => {
    if (baseRateNum <= 0) return [];
    const scenarios: { label: string; rate: number; currency: string; detail: string }[] = [];

    // Global default
    scenarios.push({
      label: "Global (default)",
      rate: baseRateNum,
      currency,
      detail: "Base rate",
    });

    // Region overrides
    for (const [region, override] of Object.entries(regionOverrides)) {
      if (override.rate > 0) {
        const regionLabel = predefinedRegions.find((r) => r.value === region)?.label ?? region;
        scenarios.push({
          label: regionLabel,
          rate: override.rate,
          currency: override.currency,
          detail: `${formatCurrency(override.rate, override.currency)}/hr`,
        });
      }
    }

    // Contract/Freelance if adjustment exists
    const contractAdj = adjustments.employment_type?.contract;
    if (contractAdj != null) {
      const effective = getEffectiveRate(baseRateNum, currency, adjustments, regionOverrides, { employment_type: "contract" });
      scenarios.push({
        label: "Contract / Freelance",
        rate: effective.rate,
        currency: effective.currency,
        detail: `${contractAdj >= 0 ? "+" : ""}${contractAdj}% adjustment`,
      });
    }

    // Onsite if adjustment exists
    const onsiteAdj = adjustments.work_arrangement?.onsite;
    if (onsiteAdj != null) {
      const effective = getEffectiveRate(baseRateNum, currency, adjustments, regionOverrides, { work_arrangement: "onsite" });
      scenarios.push({
        label: "On-site",
        rate: effective.rate,
        currency: effective.currency,
        detail: `${onsiteAdj >= 0 ? "+" : ""}${onsiteAdj}% adjustment`,
      });
    }

    return scenarios;
  });
</script>

<svelte:head>
  <title>Salary Prep - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
  <SectionHeader
    title="Salary Prep"
    icon={faMoneyBillWave}
  />

  <!-- Section 1: Region Rates -->
  <Card padding="lg">
    <h3 class="text-base font-semibold text-[var(--dash-text)] mb-1">Region Rates</h3>
    <p class="text-sm text-[var(--dash-text-secondary)] mb-4">
      Set your hourly rate per region. The global rate is the default for jobs that don't match a specific region. Percentage adjustments (below) apply on top.
    </p>

    <div class="space-y-3">
      <!-- Global (default) row -->
      <div class="py-3 px-4 bg-[var(--dash-primary)]/5 border border-[var(--dash-primary)]/20 rounded-lg space-y-2">
        <div class="flex items-center gap-2">
          <FontAwesomeIcon icon={faGlobe} class="w-4 h-4 text-[var(--dash-primary)]" />
          <span class="text-sm font-medium text-[var(--dash-text)]">Global</span>
          <span class="text-xs text-[var(--dash-text-muted)]">(default)</span>
        </div>
        <div class="flex items-center gap-2">
          <input
            type="number"
            bind:value={baseRate}
            min="0"
            required
            placeholder="e.g. 85"
            class="w-24 px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
          <span class="text-sm text-[var(--dash-text-secondary)]">/hr</span>
          <div class="inline-flex rounded-md border border-[var(--dash-border)] overflow-hidden ml-2">
            {#each currencies as opt, i}
              <button
                type="button"
                onclick={() => (currency = opt.value)}
                class="px-2 py-1 text-xs transition-colors {currency === opt.value
                  ? 'bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] font-medium'
                  : 'text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)]'} {i > 0 ? 'border-l border-[var(--dash-border)]' : ''}"
              >
                {opt.symbol}
              </button>
            {/each}
          </div>
        </div>
        {#if baseRateNum > 0}
          <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--dash-text-muted)]">
            <span>{formatCurrency(hourlyToRate(baseRateNum, "day"), currency)}/day</span>
            <span>{formatCurrency(hourlyToRate(baseRateNum, "month"), currency)}/mo</span>
            <span>{formatCurrency(hourlyToRate(baseRateNum, "year"), currency)}/yr</span>
          </div>
        {/if}
      </div>

      <!-- Region override rows -->
      {#each Object.entries(regionOverrides) as [region, override]}
        {@const regionLabel = predefinedRegions.find((r) => r.value === region)?.label ?? region}
        <div class="py-3 px-4 bg-[var(--dash-bg)] rounded-lg space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-[var(--dash-text)]">{regionLabel}</span>
            <button
              type="button"
              onclick={() => removeRegionOverride(region)}
              class="p-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-error)] transition-colors"
              aria-label="Remove"
            >
              <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
            </button>
          </div>
          <div class="flex items-center gap-2">
            <input
              type="number"
              value={override.rate || ""}
              oninput={(e) => updateRegionRate(region, (e.target as HTMLInputElement).value)}
              min="0"
              placeholder="0"
              class="w-24 px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
            <span class="text-sm text-[var(--dash-text-secondary)]">/hr</span>
            <div class="inline-flex rounded-md border border-[var(--dash-border)] overflow-hidden ml-2">
              {#each currencies as opt, i}
                <button
                  type="button"
                  onclick={() => updateRegionCurrency(region, opt.value)}
                  class="px-2 py-1 text-xs transition-colors {override.currency === opt.value
                    ? 'bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] font-medium'
                    : 'text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)]'} {i > 0 ? 'border-l border-[var(--dash-border)]' : ''}"
                >
                  {opt.symbol}
                </button>
              {/each}
            </div>
          </div>
          {#if override.rate > 0}
            <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--dash-text-muted)]">
              <span>{formatCurrency(hourlyToRate(override.rate, "day"), override.currency)}/day</span>
              <span>{formatCurrency(hourlyToRate(override.rate, "month"), override.currency)}/mo</span>
              <span>{formatCurrency(hourlyToRate(override.rate, "year"), override.currency)}/yr</span>
            </div>
          {/if}
        </div>
      {/each}

      <!-- Add region -->
      {#if availableRegions.length > 0}
        <div class="flex items-center gap-2 pt-1">
          <select
            bind:value={newRegionKey}
            class="flex-1 max-w-[200px] px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent text-[var(--dash-text-secondary)]"
          >
            <option value="">Add region...</option>
            {#each availableRegions as region}
              <option value={region.value}>{region.label}</option>
            {/each}
          </select>
          <button
            type="button"
            onclick={addRegionOverride}
            disabled={!newRegionKey}
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--dash-primary)] hover:bg-[var(--dash-primary)]/5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
            Add
          </button>
        </div>
      {/if}
    </div>

    <div class="flex justify-end mt-4">
      <SectionSaveButton
        state={regionRatesState}
        onClick={saveRegionRates}
        disabled={!baseRate || parseInt(baseRate) <= 0}
      />
    </div>
  </Card>

  <!-- Section 2: Adjustments -->
  <Card padding="lg">
    <h3 class="text-base font-semibold text-[var(--dash-text)] mb-1">Rate Adjustments</h3>
    <p class="text-sm text-[var(--dash-text-secondary)] mb-4">
      Adjust your rate for different job types. Adjustments stack when multiple apply.
    </p>

    <div class="space-y-2">
      {#each commonAdjustments as adj}
        {@const isAgency = adj.key === "company_type" && adj.value === "agency"}
        {@const val = getAdjustmentValue(adj.key, adj.value)}
        {@const numVal = val !== "" ? parseInt(val) : null}
        <div class="flex items-center gap-3 py-2 px-3 rounded-lg bg-[var(--dash-bg)]">
          <span class="text-sm text-[var(--dash-text)] w-36 flex-shrink-0">{adj.label}</span>
          <div class="relative w-20 flex-shrink-0">
            <input
              type="number"
              value={val}
              oninput={(e) => isAgency
                ? setAgencyAdjustment((e.target as HTMLInputElement).value)
                : setAdjustment(adj.key, adj.value, (e.target as HTMLInputElement).value)}
              placeholder="0"
              class="w-full px-2 py-1.5 pr-6 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent {numVal != null && numVal > 0
                ? 'text-[var(--dash-success)]'
                : numVal != null && numVal < 0
                ? 'text-[var(--dash-error)]'
                : ''}"
            />
            <span class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--dash-text-muted)]">%</span>
          </div>
          {#if numVal != null && baseRateNum > 0}
            <span class="text-xs text-[var(--dash-text-muted)] hidden sm:inline">
              = {formatCurrency(Math.round(baseRateNum * (1 + numVal / 100)), currency)}/hr
            </span>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Advanced toggle -->
    <button
      type="button"
      onclick={() => (showAdvanced = !showAdvanced)}
      class="flex items-center gap-1.5 mt-3 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)] transition-colors"
    >
      <FontAwesomeIcon icon={showAdvanced ? faChevronUp : faChevronDown} class="w-3 h-3" />
      {showAdvanced ? "Hide" : "More"} adjustments
    </button>

    {#if showAdvanced}
      <div class="space-y-2 mt-2">
        {#each advancedAdjustments as adj}
          {@const isAgency = adj.key === "company_type" && adj.value === "agency"}
          {@const val = getAdjustmentValue(adj.key, adj.value)}
          {@const numVal = val !== "" ? parseInt(val) : null}
          <div class="flex items-center gap-3 py-2 px-3 rounded-lg bg-[var(--dash-bg)]">
            <span class="text-sm text-[var(--dash-text)] w-36 flex-shrink-0">{adj.label}</span>
            <div class="relative w-20 flex-shrink-0">
              <input
                type="number"
                value={val}
                oninput={(e) => isAgency
                  ? setAgencyAdjustment((e.target as HTMLInputElement).value)
                  : setAdjustment(adj.key, adj.value, (e.target as HTMLInputElement).value)}
                placeholder="0"
                class="w-full px-2 py-1.5 pr-6 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent {numVal != null && numVal > 0
                  ? 'text-[var(--dash-success)]'
                  : numVal != null && numVal < 0
                  ? 'text-[var(--dash-error)]'
                  : ''}"
              />
              <span class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--dash-text-muted)]">%</span>
            </div>
            {#if numVal != null && baseRateNum > 0}
              <span class="text-xs text-[var(--dash-text-muted)] hidden sm:inline">
                = {formatCurrency(Math.round(baseRateNum * (1 + numVal / 100)), currency)}/hr
              </span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <div class="flex justify-end mt-4">
      <SectionSaveButton state={adjustmentsState} onClick={saveAdjustments} />
    </div>
  </Card>

  <!-- Section 3: Preview -->
  {#if exampleScenarios.length > 0}
    <Card padding="lg">
      <h3 class="text-base font-semibold text-[var(--dash-text)] mb-1">Rate Preview</h3>
      <p class="text-sm text-[var(--dash-text-secondary)] mb-4">
        Examples of how your rate adjusts for different scenarios.
      </p>

      <div class="space-y-2">
        {#each exampleScenarios as scenario}
          <div class="flex items-center justify-between py-2 px-3 bg-[var(--dash-bg)] rounded-lg">
            <div>
              <span class="text-sm font-medium text-[var(--dash-text)]">{scenario.label}</span>
              <span class="text-xs text-[var(--dash-text-muted)] ml-2">{scenario.detail}</span>
            </div>
            <div class="text-right flex-shrink-0">
              <span class="text-sm font-medium text-[var(--dash-text)]">{formatCurrency(scenario.rate, scenario.currency)}/hr</span>
              <span class="text-xs text-[var(--dash-text-muted)] ml-2">
                {formatCurrency(hourlyToRate(scenario.rate, "year"), scenario.currency)}/yr
              </span>
            </div>
          </div>
        {/each}
      </div>
    </Card>
  {/if}
</div>
