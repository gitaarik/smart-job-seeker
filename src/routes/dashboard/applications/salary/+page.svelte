<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faMoneyBillWave,
    faPlus,
    faTimes,
    faTrash,
    faInfoCircle,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../components/Card.svelte";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import {
    hourlyToRate,
    formatCurrency,
    getEffectiveRate,
    type SalaryAdjustments,
    type SalaryRegionOverrides,
  } from "$lib/salary/conversion";

  let { data, form }: { data: PageData; form: ActionData } = $props();

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

  const currencies = [
    { value: "EUR", label: "EUR", symbol: "\u20AC" },
    { value: "USD", label: "USD", symbol: "$" },
    { value: "GBP", label: "GBP", symbol: "\u00A3" },
  ];

  // Adjustment categories with their options
  const adjustmentCategories = [
    {
      key: "employment_type" as const,
      label: "Employment Type",
      description: "Adjust rate based on employment type",
      options: [
        { value: "contract", label: "Contract" },
        { value: "freelance", label: "Freelance" },
        { value: "part_time", label: "Part-time" },
        { value: "temporary", label: "Temporary" },
        { value: "internship", label: "Internship" },
      ],
    },
    {
      key: "work_arrangement" as const,
      label: "Work Arrangement",
      description: "Adjust rate based on work arrangement",
      options: [
        { value: "onsite", label: "On-site" },
        { value: "hybrid", label: "Hybrid" },
      ],
    },
    {
      key: "company_type" as const,
      label: "Company Type",
      description: "Adjust rate based on company type",
      options: [
        { value: "startup", label: "Startup" },
        { value: "scaleup", label: "Scale-up" },
        { value: "corporate", label: "Corporate" },
        { value: "agency", label: "Agency" },
        { value: "consultancy", label: "Consultancy" },
      ],
    },
  ];

  // Predefined regions for quick add
  const predefinedRegions = [
    "US", "UK", "Western Europe", "Eastern Europe",
    "Middle East", "Asia Pacific", "Latin America", "Africa",
  ];

  let newRegionName = $state("");
  let newRegionRate = $state("");

  function addRegionOverride() {
    const name = newRegionName.trim();
    const rate = parseInt(newRegionRate);
    if (!name || isNaN(rate) || rate < 0) return;
    regionOverrides = { ...regionOverrides, [name]: rate };
    newRegionName = "";
    newRegionRate = "";
  }

  function removeRegionOverride(region: string) {
    const { [region]: _, ...rest } = regionOverrides;
    regionOverrides = rest;
  }

  function setAdjustment(category: keyof SalaryAdjustments, option: string, value: string) {
    const numVal = parseInt(value);
    const cat = { ...(adjustments[category] ?? {}) };
    if (value === "" || isNaN(numVal)) {
      delete cat[option];
    } else {
      cat[option] = numVal;
    }
    adjustments = { ...adjustments, [category]: cat };
  }

  function getAdjustmentValue(category: keyof SalaryAdjustments, option: string): string {
    const val = adjustments[category]?.[option];
    return val != null ? String(val) : "";
  }

  // Preview calculation
  let baseRateNum = $derived(parseInt(baseRate) || 0);

  let previewRates = $derived(
    baseRateNum > 0
      ? {
          hourly: baseRateNum,
          daily: hourlyToRate(baseRateNum, "day"),
          monthly: hourlyToRate(baseRateNum, "month"),
          yearly: hourlyToRate(baseRateNum, "year"),
        }
      : null,
  );

  // Example scenarios for preview
  let exampleScenarios = $derived.by(() => {
    if (baseRateNum <= 0) return [];
    const scenarios: { label: string; rate: number; detail: string }[] = [];

    // Full-time remote (default)
    scenarios.push({
      label: "Full-time, Remote",
      rate: baseRateNum,
      detail: "Base rate (no adjustments)",
    });

    // Contract if adjustment exists
    const contractAdj = adjustments.employment_type?.contract;
    if (contractAdj != null) {
      const rate = getEffectiveRate(baseRateNum, adjustments, regionOverrides, { employment_type: "contract" });
      scenarios.push({
        label: "Contract",
        rate,
        detail: `${contractAdj >= 0 ? "+" : ""}${contractAdj}% adjustment`,
      });
    }

    // Onsite if adjustment exists
    const onsiteAdj = adjustments.work_arrangement?.onsite;
    if (onsiteAdj != null) {
      const rate = getEffectiveRate(baseRateNum, adjustments, regionOverrides, { work_arrangement: "onsite" });
      scenarios.push({
        label: "On-site",
        rate,
        detail: `${onsiteAdj >= 0 ? "+" : ""}${onsiteAdj}% adjustment`,
      });
    }

    // Region overrides
    for (const [region, rate] of Object.entries(regionOverrides)) {
      scenarios.push({
        label: region,
        rate,
        detail: `Region override (${formatCurrency(rate, currency)}/hr)`,
      });
    }

    return scenarios;
  });

  let saving = $state(false);
</script>

<div class="space-y-6">
  <SectionHeader
    title="Salary Settings"
    icon={faMoneyBillWave}
  />

  {#if form?.error}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  {#if form?.success}
    <div class="bg-[var(--dash-success-light)] border border-[var(--dash-success)] rounded-lg p-4">
      <p class="text-[var(--dash-success)] text-sm">Salary settings saved successfully.</p>
    </div>
  {/if}

  <form
    method="POST"
    action="?/save"
    use:enhance={() => {
      saving = true;
      return async ({ update }) => {
        saving = false;
        await update();
      };
    }}
  >
    <input type="hidden" name="adjustments" value={JSON.stringify(adjustments)} />
    <input type="hidden" name="region_overrides" value={JSON.stringify(regionOverrides)} />

    <div class="space-y-6">
      <!-- Section 1: Base Rate -->
      <Card padding="lg">
        <h3 class="text-base font-semibold text-[var(--dash-text)] mb-1">Base Hourly Rate</h3>
        <p class="text-sm text-[var(--dash-text-secondary)] mb-4">
          Your default hourly rate for full-time remote work. All other rates are calculated from this.
        </p>

        <div class="flex items-end gap-4">
          <div>
            <label for="base-rate" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
              Hourly Rate <span class="text-[var(--dash-error)]">*</span>
            </label>
            <input
              type="number"
              id="base-rate"
              name="base_rate"
              bind:value={baseRate}
              min="0"
              required
              placeholder="e.g. 85"
              class="w-32 px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>
          <div>
            <label for="currency" class="block text-sm font-medium text-[var(--dash-text)] mb-1">Currency</label>
            <input type="hidden" name="currency" value={currency} />
            <div class="inline-flex rounded-lg border border-[var(--dash-border)] overflow-hidden">
              {#each currencies as opt, i}
                <button
                  type="button"
                  onclick={() => (currency = opt.value)}
                  class="px-3 py-2 text-sm transition-colors {currency === opt.value
                    ? 'bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] font-medium'
                    : 'text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)]'} {i > 0 ? 'border-l border-[var(--dash-border)]' : ''}"
                >
                  {opt.label} ({opt.symbol})
                </button>
              {/each}
            </div>
          </div>
        </div>

        {#if previewRates}
          <div class="mt-4 p-3 bg-[var(--dash-bg)] rounded-lg">
            <p class="text-xs text-[var(--dash-text-muted)] mb-2">Equivalent rates:</p>
            <div class="flex flex-wrap gap-4 text-sm">
              <span class="text-[var(--dash-text)] font-medium">{formatCurrency(previewRates.hourly, currency)}/hr</span>
              <span class="text-[var(--dash-text-secondary)]">{formatCurrency(previewRates.daily, currency)}/day</span>
              <span class="text-[var(--dash-text-secondary)]">{formatCurrency(previewRates.monthly, currency)}/mo</span>
              <span class="text-[var(--dash-text-secondary)]">{formatCurrency(previewRates.yearly, currency)}/yr</span>
            </div>
          </div>
        {/if}
      </Card>

      <!-- Section 2: Adjustments -->
      <Card padding="lg">
        <h3 class="text-base font-semibold text-[var(--dash-text)] mb-1">Rate Adjustments</h3>
        <p class="text-sm text-[var(--dash-text-secondary)] mb-4">
          Define percentage adjustments to your base rate for different scenarios. Leave empty for no adjustment. Adjustments stack additively.
        </p>

        <div class="space-y-6">
          {#each adjustmentCategories as cat}
            <div>
              <h4 class="text-sm font-medium text-[var(--dash-text)] mb-2">{cat.label}</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {#each cat.options as opt}
                  {@const val = getAdjustmentValue(cat.key, opt.value)}
                  {@const numVal = val !== "" ? parseInt(val) : null}
                  <div class="flex items-center gap-2">
                    <span class="text-sm text-[var(--dash-text-secondary)] w-24 flex-shrink-0">{opt.label}</span>
                    <div class="relative flex-1 max-w-[120px]">
                      <input
                        type="number"
                        value={val}
                        oninput={(e) => setAdjustment(cat.key, opt.value, (e.target as HTMLInputElement).value)}
                        placeholder="0"
                        class="w-full px-3 py-1.5 pr-7 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent {numVal != null && numVal > 0
                          ? 'text-[var(--dash-success)]'
                          : numVal != null && numVal < 0
                          ? 'text-[var(--dash-error)]'
                          : ''}"
                      />
                      <span class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--dash-text-muted)]">%</span>
                    </div>
                    {#if numVal != null && baseRateNum > 0}
                      <span class="text-xs text-[var(--dash-text-muted)]">
                        = {formatCurrency(Math.round(baseRateNum * (1 + numVal / 100)), currency)}/hr
                      </span>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </Card>

      <!-- Section 3: Region Overrides -->
      <Card padding="lg">
        <h3 class="text-base font-semibold text-[var(--dash-text)] mb-1">Region Rate Overrides</h3>
        <p class="text-sm text-[var(--dash-text-secondary)] mb-4">
          Set a different base hourly rate for specific regions. These replace the base rate entirely (percentage adjustments still apply on top).
        </p>

        {#if Object.keys(regionOverrides).length > 0}
          <div class="space-y-2 mb-4">
            {#each Object.entries(regionOverrides) as [region, rate]}
              <div class="flex items-center gap-3 py-2 px-3 bg-[var(--dash-bg)] rounded-lg">
                <span class="text-sm font-medium text-[var(--dash-text)] flex-1">{region}</span>
                <span class="text-sm text-[var(--dash-text-secondary)]">{formatCurrency(rate, currency)}/hr</span>
                <span class="text-xs text-[var(--dash-text-muted)]">
                  ({formatCurrency(hourlyToRate(rate, "year"), currency)}/yr)
                </span>
                <button
                  type="button"
                  onclick={() => removeRegionOverride(region)}
                  class="p-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-error)] transition-colors"
                  aria-label="Remove"
                >
                  <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
                </button>
              </div>
            {/each}
          </div>
        {/if}

        <div class="flex items-end gap-2">
          <div class="flex-1">
            <label for="new-region" class="block text-xs text-[var(--dash-text-secondary)] mb-1">Region</label>
            <div class="flex gap-1">
              <input
                type="text"
                id="new-region"
                bind:value={newRegionName}
                placeholder="e.g. US"
                list="region-suggestions"
                class="flex-1 min-w-0 px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
              />
              <datalist id="region-suggestions">
                {#each predefinedRegions.filter((r) => !(r in regionOverrides)) as region}
                  <option value={region} />
                {/each}
              </datalist>
            </div>
          </div>
          <div class="w-28">
            <label for="new-region-rate" class="block text-xs text-[var(--dash-text-secondary)] mb-1">Hourly Rate</label>
            <input
              type="number"
              id="new-region-rate"
              bind:value={newRegionRate}
              min="0"
              placeholder="0"
              class="w-full px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>
          <button
            type="button"
            onclick={addRegionOverride}
            disabled={!newRegionName.trim() || !newRegionRate || isNaN(parseInt(newRegionRate))}
            class="px-3 py-1.5 text-sm bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md hover:bg-[var(--dash-border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
          </button>
        </div>
      </Card>

      <!-- Section 4: Preview -->
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
                  <span class="text-sm font-medium text-[var(--dash-text)]">{formatCurrency(scenario.rate, currency)}/hr</span>
                  <span class="text-xs text-[var(--dash-text-muted)] ml-2">
                    {formatCurrency(hourlyToRate(scenario.rate, "year"), currency)}/yr
                  </span>
                </div>
              </div>
            {/each}
          </div>
        </Card>
      {/if}

      <!-- Save Button -->
      <div class="flex justify-end">
        <button
          type="submit"
          disabled={saving || !baseRate || parseInt(baseRate) <= 0}
          class="flex items-center gap-2 px-6 py-2.5 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if saving}
            Saving...
          {:else}
            <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
            Save Settings
          {/if}
        </button>
      </div>
    </div>
  </form>
</div>
