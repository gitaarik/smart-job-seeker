<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import type { IconDefinition } from "@fortawesome/fontawesome-common-types";
  import {
    faCheck,
    faMoneyBillWave,
    faPencil,
    faTimes,
    faTrash,
    // Employment types
    faBriefcase,
    faHourglass,
    faFileContract,
    faClockRotateLeft,
    faLaptop,
    faGraduationCap,
    // Work arrangements
    faHouseLaptop,
    faBuilding,
    // Experience levels
    faSeedling,
    faLayerGroup,
    faUserTie,
    faSitemap,
    faCrown,
    // Company types
    faRocket,
    faChartLine,
    faCity,
    faUsers,
    faCompass,
    // Regions
    faGlobe,
    faEarthAmericas,
    faEarthEurope,
    faEarthAsia,
    faEarthAfrica,
    faEarthOceania,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../components/Card.svelte";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import ConfirmModal from "../../profile/components/ConfirmModal.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let salaryExpectations = $derived(data.salaryExpectations);
  let editingId = $state<number | null>(null);
  let showAddForm = $state(false);
  let deleteId = $state<number | null>(null);

  // --- Option definitions ---

  const employmentTypes = [
    { value: "any", label: "Any", icon: faBriefcase },
    { value: "full_time", label: "Full-time", icon: faBriefcase },
    { value: "part_time", label: "Part-time", icon: faHourglass },
    { value: "contract", label: "Contract", icon: faFileContract },
    { value: "temporary", label: "Temporary", icon: faClockRotateLeft },
    { value: "freelance", label: "Freelance", icon: faLaptop },
    { value: "internship", label: "Internship", icon: faGraduationCap },
  ];

  const workArrangements = [
    { value: "any", label: "Any", icon: faHouseLaptop },
    { value: "remote", label: "Remote", icon: faHouseLaptop },
    { value: "hybrid", label: "Hybrid", icon: faBuilding },
    { value: "onsite", label: "On-site", icon: faCity },
  ];

  const experienceLevels = [
    { value: "any", label: "Any", icon: faLayerGroup },
    { value: "junior", label: "Junior", icon: faSeedling },
    { value: "mid", label: "Mid", icon: faLayerGroup },
    { value: "senior", label: "Senior", icon: faUserTie },
    { value: "lead", label: "Lead", icon: faSitemap },
    { value: "principal", label: "Principal", icon: faCrown },
  ];

  const companyTypes = [
    { value: "any", label: "Any", icon: faBuilding },
    { value: "startup", label: "Startup", icon: faRocket },
    { value: "scaleup", label: "Scale-up", icon: faChartLine },
    { value: "corporate", label: "Corporate", icon: faCity },
    { value: "agency", label: "Agency", icon: faUsers },
    { value: "consultancy", label: "Consultancy", icon: faCompass },
  ];

  const regions = [
    { value: "Global", label: "Global", icon: faGlobe },
    { value: "US", label: "US", icon: faEarthAmericas },
    { value: "UK", label: "UK", icon: faEarthEurope },
    { value: "Western Europe", label: "Western Europe", icon: faEarthEurope },
    { value: "Eastern Europe", label: "Eastern Europe", icon: faEarthEurope },
    { value: "Middle East", label: "Middle East", icon: faEarthAsia },
    { value: "Asia Pacific", label: "Asia Pacific", icon: faEarthOceania },
    { value: "Latin America", label: "Latin America", icon: faEarthAmericas },
    { value: "Africa", label: "Africa", icon: faEarthAfrica },
  ];

  const currencies = [
    { value: "EUR", label: "EUR (€)" },
    { value: "USD", label: "USD ($)" },
    { value: "GBP", label: "GBP (£)" },
  ];

  // --- Multi-select toggle logic ---

  type OptionDef = { value: string; label: string; icon: IconDefinition };

  /** The "all" value is always the first option in each list */
  let flashField = $state<string | null>(null);

  function toggleOption(
    set: Set<string>,
    value: string,
    options: OptionDef[],
    fieldName?: string,
  ): Set<string> {
    const allValue = options[0].value;
    const specificOptions = options.slice(1);

    // Clicking the "all" option
    if (value === allValue) {
      return set.has(allValue) ? new Set() : new Set([allValue]);
    }

    // Clicking a specific option — remove "all"
    set.delete(allValue);
    if (set.has(value)) {
      set.delete(value);
    } else {
      set.add(value);
    }

    // All specific options checked → collapse to "all"
    if (set.size === specificOptions.length && specificOptions.every((o) => set.has(o.value))) {
      if (fieldName) {
        flashField = fieldName;
        setTimeout(() => (flashField = null), 700);
      }
      return new Set([allValue]);
    }
    return new Set(set);
  }

  function serializeSet(set: Set<string>): string {
    return [...set].join(", ");
  }

  function deserializeSet(value: string | null | undefined, fallback: string): Set<string> {
    if (!value) return new Set([fallback]);
    return new Set(value.split(", ").filter(Boolean));
  }

  function getLabels(
    set: Set<string>,
    options: OptionDef[],
  ): string {
    return [...set].map((v) => options.find((o) => o.value === v)?.label || v).join(", ");
  }

  // --- Tag color classes (consistent with JobCard.svelte) ---

  const tagColors: Record<string, string> = {
    employment_type: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
    work_arrangement: "border-[var(--dash-primary)]/20 bg-[var(--dash-primary-light)] text-[var(--dash-primary)]",
    experience_level: "border-purple-500/20 bg-purple-500/10 text-purple-700",
    company_type: "border-amber-500/20 bg-amber-500/10 text-amber-700",
    region: "border-sky-500/20 bg-sky-500/10 text-sky-700",
  };

  // --- Form states ---

  let newEmploymentType = $state<Set<string>>(new Set(["any"]));
  let newWorkArrangement = $state<Set<string>>(new Set(["any"]));
  let newExperienceLevel = $state<Set<string>>(new Set(["any"]));
  let newCompanyType = $state<Set<string>>(new Set(["any"]));
  let newRegions = $state<Set<string>>(new Set(["Global"]));
  let newCurrency = $state("EUR");
  let newHourlyRate = $state("");
  let newDailyRate = $state("");
  let newMonthSalary = $state("");
  let newYearSalary = $state("");

  let editEmploymentType = $state<Set<string>>(new Set());
  let editWorkArrangement = $state<Set<string>>(new Set());
  let editExperienceLevel = $state<Set<string>>(new Set());
  let editCompanyType = $state<Set<string>>(new Set());
  let editRegions = $state<Set<string>>(new Set());
  let editCurrency = $state("");
  let editHourlyRate = $state("");
  let editDailyRate = $state("");
  let editMonthSalary = $state("");
  let editYearSalary = $state("");

  function formatCurrency(amount: number | null, currency: string): string {
    if (!amount) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function startEdit(exp: (typeof salaryExpectations)[0]) {
    editingId = exp.id;
    editEmploymentType = deserializeSet(exp.employment_type, "any");
    editWorkArrangement = deserializeSet(exp.work_arrangement, "any");
    editExperienceLevel = deserializeSet(exp.experience_level, "any");
    editCompanyType = deserializeSet(exp.company_type, "any");
    editRegions = deserializeSet(exp.region, "Global");
    editCurrency = exp.currency || "EUR";
    editHourlyRate = exp.hourly_rate?.toString() || "";
    editDailyRate = exp.daily_rate?.toString() || "";
    editMonthSalary = exp.month_salary?.toString() || "";
    editYearSalary = exp.year_salary?.toString() || "";
  }

  function cancelEdit() {
    editingId = null;
  }

  function resetAddForm() {
    showAddForm = false;
    newEmploymentType = new Set(["any"]);
    newWorkArrangement = new Set(["any"]);
    newExperienceLevel = new Set(["any"]);
    newCompanyType = new Set(["any"]);
    newRegions = new Set(["Global"]);
    newCurrency = "EUR";
    newHourlyRate = "";
    newDailyRate = "";
    newMonthSalary = "";
    newYearSalary = "";
  }

  function handleAddSubmit() {
    return async ({
      result,
      update,
    }: {
      result: { type: string };
      update: () => Promise<void>;
    }) => {
      await update();
      if (result.type === "success") {
        resetAddForm();
      }
    };
  }

  function handleEditSubmit() {
    return async ({
      result,
      update,
    }: {
      result: { type: string };
      update: () => Promise<void>;
    }) => {
      await update();
      if (result.type === "success") {
        editingId = null;
      }
    };
  }
</script>

{#snippet checkboxChips(
  name: string,
  options: OptionDef[],
  selected: Set<string>,
  onToggle: (value: string) => void,
)}
  <div class="flex flex-wrap gap-2">
    {#each options as opt, i}
      <button
        type="button"
        onclick={() => onToggle(opt.value)}
        class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-colors {selected.has(opt.value)
          ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
          : 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'} {i === 0 && flashField === name ? 'chip-flash' : ''}"
      >
        <span class="w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 {selected.has(opt.value)
          ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]'
          : 'border-[var(--dash-border)]'}">
          {#if selected.has(opt.value)}
            <FontAwesomeIcon icon={faCheck} class="w-2.5 h-2.5 text-white" />
          {/if}
        </span>
        <FontAwesomeIcon icon={opt.icon} class="w-3 h-3 opacity-70" />
        {opt.label}
      </button>
    {/each}
  </div>
{/snippet}

{#snippet chipField(
  label: string,
  name: string,
  options: OptionDef[],
  selected: Set<string>,
  onToggle: (value: string) => void,
  required?: boolean,
)}
  <div>
    <label class="block text-sm font-medium text-[var(--dash-text)] mb-2">
      {label} {#if required}<span class="text-[var(--dash-error)]">*</span>{/if}
    </label>
    <input type="hidden" {name} value={serializeSet(selected)} />
    {@render checkboxChips(name, options, selected, onToggle)}
  </div>
{/snippet}

{#snippet viewTags(
  raw: string | null | undefined,
  options: OptionDef[],
  fieldName: string,
)}
  {#each [...deserializeSet(raw, options[0].value)].filter((v) => v !== options[0].value) as value}
    {@const opt = options.find((o) => o.value === value)}
    <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border {tagColors[fieldName]}">
      {#if opt?.icon}<FontAwesomeIcon icon={opt.icon} class="w-2.5 h-2.5" />{/if}
      {opt?.label || value}
    </span>
  {/each}
{/snippet}

<div class="space-y-6">
  <SectionHeader
    title="Salary Expectations"
    icon={faMoneyBillWave}
    showAddButton={!showAddForm && salaryExpectations.length > 0}
    addLabel="Add Expectation"
    onAdd={() => (showAddForm = true)}
  />

  {#if form?.error}
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  <!-- Add Form -->
  {#if showAddForm}
    <form
      method="POST"
      action="?/create"
      use:enhance={handleAddSubmit}
      class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-primary)] p-4"
    >
      <h3 class="font-medium text-[var(--dash-text)] mb-4">
        Add Salary Expectation
      </h3>
      <div class="space-y-4">
        {@render chipField("Employment Type", "employment_type", employmentTypes, newEmploymentType,
          (v) => (newEmploymentType = toggleOption(newEmploymentType, v, employmentTypes, "employment_type")), true)}

        {@render chipField("Work Arrangement", "work_arrangement", workArrangements, newWorkArrangement,
          (v) => (newWorkArrangement = toggleOption(newWorkArrangement, v, workArrangements, "work_arrangement")), true)}

        {@render chipField("Experience Level", "experience_level", experienceLevels, newExperienceLevel,
          (v) => (newExperienceLevel = toggleOption(newExperienceLevel, v, experienceLevels, "experience_level")))}

        {@render chipField("Company Type", "company_type", companyTypes, newCompanyType,
          (v) => (newCompanyType = toggleOption(newCompanyType, v, companyTypes, "company_type")), true)}

        {@render chipField("Region", "region", regions, newRegions,
          (v) => (newRegions = toggleOption(newRegions, v, regions, "region")), true)}

        <!-- Rates -->
        <div class="border-t border-[var(--dash-border)] pt-4 mt-4">
          <h4 class="text-base font-semibold text-[var(--dash-text)] mb-3">Rate/Salary</h4>
          <div class="mb-3">
            <label class="block text-sm font-medium text-[var(--dash-text)] mb-2">Currency</label>
            <input type="hidden" name="currency" value={newCurrency} />
            <div class="inline-flex rounded-lg border border-[var(--dash-border)] overflow-hidden">
              {#each currencies as opt, i}
                <button
                  type="button"
                  onclick={() => (newCurrency = opt.value)}
                  class="px-3 py-1.5 text-sm transition-colors {newCurrency === opt.value
                    ? 'bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] font-medium'
                    : 'text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)]'} {i > 0 ? 'border-l border-[var(--dash-border)]' : ''}"
                >
                  {opt.label}
                </button>
              {/each}
            </div>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label for="new-hourly-rate" class="block text-sm text-[var(--dash-text-secondary)] mb-1">Hourly Rate</label>
              <input type="number" id="new-hourly-rate" name="hourly_rate" bind:value={newHourlyRate} placeholder="0"
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent" />
            </div>
            <div>
              <label for="new-daily-rate" class="block text-sm text-[var(--dash-text-secondary)] mb-1">Daily Rate</label>
              <input type="number" id="new-daily-rate" name="daily_rate" bind:value={newDailyRate} placeholder="0"
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent" />
            </div>
            <div>
              <label for="new-month-salary" class="block text-sm text-[var(--dash-text-secondary)] mb-1">Monthly Salary</label>
              <input type="number" id="new-month-salary" name="month_salary" bind:value={newMonthSalary} placeholder="0"
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent" />
            </div>
            <div>
              <label for="new-year-salary" class="block text-sm text-[var(--dash-text-secondary)] mb-1">Annual Salary</label>
              <input type="number" id="new-year-salary" name="year_salary" bind:value={newYearSalary} placeholder="0"
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent" />
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onclick={resetAddForm}
          class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors text-sm"
        >
          Add Expectation
        </button>
      </div>
    </form>
  {/if}

  <!-- Salary Expectations List -->
  {#if salaryExpectations.length === 0 && !showAddForm}
    <EmptyState
      icon={faMoneyBillWave}
      title="No salary expectations yet"
      description="Define your salary expectations for different job types, regions, and work arrangements."
      actionLabel="Add First Expectation"
      onAction={() => (showAddForm = true)}
    />
  {:else}
    <div class="space-y-3">
      {#each salaryExpectations as exp (exp.id)}
        <Card padding="md">
          {#if editingId === exp.id}
            <!-- Edit Mode -->
            <form
              method="POST"
              action="?/update"
              use:enhance={handleEditSubmit}
            >
              <input type="hidden" name="id" value={exp.id} />
              <div class="space-y-4">
                {@render chipField("Employment Type", "employment_type", employmentTypes, editEmploymentType,
                  (v) => (editEmploymentType = toggleOption(editEmploymentType, v, employmentTypes, "employment_type")))}

                {@render chipField("Work Arrangement", "work_arrangement", workArrangements, editWorkArrangement,
                  (v) => (editWorkArrangement = toggleOption(editWorkArrangement, v, workArrangements, "work_arrangement")))}

                {@render chipField("Experience Level", "experience_level", experienceLevels, editExperienceLevel,
                  (v) => (editExperienceLevel = toggleOption(editExperienceLevel, v, experienceLevels, "experience_level")))}

                {@render chipField("Company Type", "company_type", companyTypes, editCompanyType,
                  (v) => (editCompanyType = toggleOption(editCompanyType, v, companyTypes, "company_type")))}

                {@render chipField("Region", "region", regions, editRegions,
                  (v) => (editRegions = toggleOption(editRegions, v, regions, "region")))}

                <!-- Rates -->
                <div class="border-t border-[var(--dash-border)] pt-4 mt-4">
                  <h4 class="text-base font-semibold text-[var(--dash-text)] mb-3">Rate/Salary</h4>
                  <div class="mb-3">
                    <label class="block text-sm font-medium text-[var(--dash-text)] mb-2">Currency</label>
                    <input type="hidden" name="currency" value={editCurrency} />
                    <div class="inline-flex rounded-lg border border-[var(--dash-border)] overflow-hidden">
                      {#each currencies as opt, i}
                        <button
                          type="button"
                          onclick={() => (editCurrency = opt.value)}
                          class="px-3 py-1.5 text-sm transition-colors {editCurrency === opt.value
                            ? 'bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] font-medium'
                            : 'text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)]'} {i > 0 ? 'border-l border-[var(--dash-border)]' : ''}"
                        >
                          {opt.label}
                        </button>
                      {/each}
                    </div>
                  </div>
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label for="edit-hourly-{exp.id}" class="block text-sm text-[var(--dash-text-secondary)] mb-1">Hourly Rate</label>
                      <input type="number" id="edit-hourly-{exp.id}" name="hourly_rate" bind:value={editHourlyRate}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent" />
                    </div>
                    <div>
                      <label for="edit-daily-{exp.id}" class="block text-sm text-[var(--dash-text-secondary)] mb-1">Daily Rate</label>
                      <input type="number" id="edit-daily-{exp.id}" name="daily_rate" bind:value={editDailyRate}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent" />
                    </div>
                    <div>
                      <label for="edit-monthly-{exp.id}" class="block text-sm text-[var(--dash-text-secondary)] mb-1">Monthly Salary</label>
                      <input type="number" id="edit-monthly-{exp.id}" name="month_salary" bind:value={editMonthSalary}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent" />
                    </div>
                    <div>
                      <label for="edit-yearly-{exp.id}" class="block text-sm text-[var(--dash-text-secondary)] mb-1">Annual Salary</label>
                      <input type="number" id="edit-yearly-{exp.id}" name="year_salary" bind:value={editYearSalary}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent" />
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onclick={cancelEdit}
                  class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] transition-colors"
                  aria-label="Cancel"
                >
                  <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  class="p-2 text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] transition-colors"
                  aria-label="Save"
                >
                  <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
                </button>
              </div>
            </form>
          {:else}
            <!-- View Mode -->
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  {@render viewTags(exp.employment_type, employmentTypes, "employment_type")}
                  {@render viewTags(exp.work_arrangement, workArrangements, "work_arrangement")}
                  {@render viewTags(exp.experience_level, experienceLevels, "experience_level")}
                  {@render viewTags(exp.company_type, companyTypes, "company_type")}
                  {@render viewTags(exp.region, regions, "region")}
                </div>
                <div class="flex flex-wrap gap-3 mt-2 text-sm">
                  {#if exp.hourly_rate}
                    <span class="text-[var(--dash-text)]">
                      {formatCurrency(exp.hourly_rate, exp.currency || "EUR")}/hr
                    </span>
                  {/if}
                  {#if exp.daily_rate}
                    <span class="text-[var(--dash-text)]">
                      {formatCurrency(exp.daily_rate, exp.currency || "EUR")}/day
                    </span>
                  {/if}
                  {#if exp.month_salary}
                    <span class="text-[var(--dash-text)]">
                      {formatCurrency(exp.month_salary, exp.currency || "EUR")}/mo
                    </span>
                  {/if}
                  {#if exp.year_salary}
                    <span class="text-[var(--dash-text)]">
                      {formatCurrency(exp.year_salary, exp.currency || "EUR")}/yr
                    </span>
                  {/if}
                </div>
              </div>

              <div class="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onclick={() => startEdit(exp)}
                  class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
                  aria-label="Edit"
                >
                  <FontAwesomeIcon icon={faPencil} class="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onclick={() => (deleteId = exp.id)}
                  class="p-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
                  aria-label="Delete"
                >
                  <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
                </button>
              </div>
            </div>
          {/if}
        </Card>
      {/each}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
  isOpen={deleteId !== null}
  title="Delete Salary Expectation"
  message="Are you sure you want to delete this salary expectation? This action cannot be undone."
  onCancel={() => (deleteId = null)}
  onConfirm={() => {
    if (deleteId !== null) {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "?/delete";
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "id";
      input.value = String(deleteId);
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    }
  }}
/>

<style>
  :global(.chip-flash) {
    animation: chip-highlight 700ms ease-out;
  }

  @keyframes chip-highlight {
    0% { box-shadow: 0 0 0 0 var(--dash-primary); }
    30% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--dash-primary) 40%, transparent); }
    100% { box-shadow: 0 0 0 0 transparent; }
  }
</style>
