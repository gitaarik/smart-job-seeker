<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faMoneyBillWave,
    faPencil,
    faTimes,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import DeleteConfirmModal from "../../profile/components/DeleteConfirmModal.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let salaryExpectations = $derived(data.salaryExpectations);
  let editingId = $state<number | null>(null);
  let showAddForm = $state(false);
  let deleteId = $state<number | null>(null);

  const companyTypes = [
    { value: "startup", label: "Startup" },
    { value: "scaleup", label: "Scale-up" },
    { value: "corporate", label: "Corporate" },
    { value: "agency", label: "Agency" },
    { value: "consultancy", label: "Consultancy" },
  ];

  const employmentTypes = [
    { value: "employee", label: "Employee" },
    { value: "freelance", label: "Freelance" },
    { value: "contract", label: "Contract" },
  ];

  const workArrangements = [
    { value: "remote", label: "Remote" },
    { value: "hybrid", label: "Hybrid" },
    { value: "onsite", label: "On-site" },
  ];

  const currencies = [
    { value: "EUR", label: "EUR (€)" },
    { value: "USD", label: "USD ($)" },
    { value: "GBP", label: "GBP (£)" },
  ];

  // Form states for new entry
  let newJobTitle = $state("");
  let newCompanyType = $state("startup");
  let newEmploymentType = $state("employee");
  let newWorkArrangement = $state("remote");
  let newRegion = $state("");
  let newCurrency = $state("EUR");
  let newHourlyRate = $state("");
  let newDailyRate = $state("");
  let newMonthSalary = $state("");
  let newYearSalary = $state("");

  // Form states for editing
  let editJobTitle = $state("");
  let editCompanyType = $state("");
  let editEmploymentType = $state("");
  let editWorkArrangement = $state("");
  let editRegion = $state("");
  let editCurrency = $state("");
  let editHourlyRate = $state("");
  let editDailyRate = $state("");
  let editMonthSalary = $state("");
  let editYearSalary = $state("");

  function getLabel(
    value: string,
    options: { value: string; label: string }[],
  ): string {
    return options.find((o) => o.value === value)?.label || value;
  }

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
    editJobTitle = exp.job_title || "";
    editCompanyType = exp.company_type || "startup";
    editEmploymentType = exp.employment_type || "employee";
    editWorkArrangement = exp.work_arrangement || "remote";
    editRegion = exp.region || "";
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
    newJobTitle = "";
    newCompanyType = "startup";
    newEmploymentType = "employee";
    newWorkArrangement = "remote";
    newRegion = "";
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
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              for="new-job-title"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Job Title
            </label>
            <input
              type="text"
              id="new-job-title"
              name="job_title"
              bind:value={newJobTitle}
              placeholder="e.g., Senior Frontend Developer"
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="new-region"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Region <span class="text-[var(--dash-error)]">*</span>
            </label>
            <input
              type="text"
              id="new-region"
              name="region"
              bind:value={newRegion}
              placeholder="e.g., Netherlands, Europe, Global"
              required
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>

          <div>
            <label
              for="new-company-type"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Company Type <span class="text-[var(--dash-error)]">*</span>
            </label>
            <select
              id="new-company-type"
              name="company_type"
              bind:value={newCompanyType}
              required
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            >
              {#each companyTypes as type}
                <option value={type.value}>{type.label}</option>
              {/each}
            </select>
          </div>

          <div>
            <label
              for="new-employment-type"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Employment Type <span class="text-[var(--dash-error)]">*</span>
            </label>
            <select
              id="new-employment-type"
              name="employment_type"
              bind:value={newEmploymentType}
              required
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            >
              {#each employmentTypes as type}
                <option value={type.value}>{type.label}</option>
              {/each}
            </select>
          </div>

          <div>
            <label
              for="new-work-arrangement"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Work Arrangement <span class="text-[var(--dash-error)]">*</span>
            </label>
            <select
              id="new-work-arrangement"
              name="work_arrangement"
              bind:value={newWorkArrangement}
              required
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            >
              {#each workArrangements as arr}
                <option value={arr.value}>{arr.label}</option>
              {/each}
            </select>
          </div>

          <div>
            <label
              for="new-currency"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Currency
            </label>
            <select
              id="new-currency"
              name="currency"
              bind:value={newCurrency}
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            >
              {#each currencies as curr}
                <option value={curr.value}>{curr.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="border-t border-[var(--dash-border)] pt-4 mt-4">
          <p class="text-sm font-medium text-[var(--dash-text)] mb-3">
            Rate/Salary (fill in at least one)
          </p>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label
                for="new-hourly-rate"
                class="block text-sm text-[var(--dash-text-secondary)] mb-1"
              >
                Hourly Rate
              </label>
              <input
                type="number"
                id="new-hourly-rate"
                name="hourly_rate"
                bind:value={newHourlyRate}
                placeholder="0"
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
              />
            </div>
            <div>
              <label
                for="new-daily-rate"
                class="block text-sm text-[var(--dash-text-secondary)] mb-1"
              >
                Daily Rate
              </label>
              <input
                type="number"
                id="new-daily-rate"
                name="daily_rate"
                bind:value={newDailyRate}
                placeholder="0"
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
              />
            </div>
            <div>
              <label
                for="new-month-salary"
                class="block text-sm text-[var(--dash-text-secondary)] mb-1"
              >
                Monthly Salary
              </label>
              <input
                type="number"
                id="new-month-salary"
                name="month_salary"
                bind:value={newMonthSalary}
                placeholder="0"
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
              />
            </div>
            <div>
              <label
                for="new-year-salary"
                class="block text-sm text-[var(--dash-text-secondary)] mb-1"
              >
                Annual Salary
              </label>
              <input
                type="number"
                id="new-year-salary"
                name="year_salary"
                bind:value={newYearSalary}
                placeholder="0"
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onclick={resetAddForm}
          class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
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
        <div
          class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4"
        >
          {#if editingId === exp.id}
            <!-- Edit Mode -->
            <form
              method="POST"
              action="?/update"
              use:enhance={handleEditSubmit}
            >
              <input type="hidden" name="id" value={exp.id} />
              <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      for="edit-job-title-{exp.id}"
                      class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                    >
                      Job Title
                    </label>
                    <input
                      type="text"
                      id="edit-job-title-{exp.id}"
                      name="job_title"
                      bind:value={editJobTitle}
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label
                      for="edit-region-{exp.id}"
                      class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                    >
                      Region <span class="text-[var(--dash-error)]">*</span>
                    </label>
                    <input
                      type="text"
                      id="edit-region-{exp.id}"
                      name="region"
                      bind:value={editRegion}
                      required
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label
                      for="edit-company-type-{exp.id}"
                      class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                    >
                      Company Type
                    </label>
                    <select
                      id="edit-company-type-{exp.id}"
                      name="company_type"
                      bind:value={editCompanyType}
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                    >
                      {#each companyTypes as type}
                        <option value={type.value}>{type.label}</option>
                      {/each}
                    </select>
                  </div>

                  <div>
                    <label
                      for="edit-employment-type-{exp.id}"
                      class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                    >
                      Employment Type
                    </label>
                    <select
                      id="edit-employment-type-{exp.id}"
                      name="employment_type"
                      bind:value={editEmploymentType}
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                    >
                      {#each employmentTypes as type}
                        <option value={type.value}>{type.label}</option>
                      {/each}
                    </select>
                  </div>

                  <div>
                    <label
                      for="edit-work-arrangement-{exp.id}"
                      class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                    >
                      Work Arrangement
                    </label>
                    <select
                      id="edit-work-arrangement-{exp.id}"
                      name="work_arrangement"
                      bind:value={editWorkArrangement}
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                    >
                      {#each workArrangements as arr}
                        <option value={arr.value}>{arr.label}</option>
                      {/each}
                    </select>
                  </div>

                  <div>
                    <label
                      for="edit-currency-{exp.id}"
                      class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                    >
                      Currency
                    </label>
                    <select
                      id="edit-currency-{exp.id}"
                      name="currency"
                      bind:value={editCurrency}
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                    >
                      {#each currencies as curr}
                        <option value={curr.value}>{curr.label}</option>
                      {/each}
                    </select>
                  </div>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label
                      for="edit-hourly-{exp.id}"
                      class="block text-sm text-[var(--dash-text-secondary)] mb-1"
                    >
                      Hourly Rate
                    </label>
                    <input
                      type="number"
                      id="edit-hourly-{exp.id}"
                      name="hourly_rate"
                      bind:value={editHourlyRate}
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label
                      for="edit-daily-{exp.id}"
                      class="block text-sm text-[var(--dash-text-secondary)] mb-1"
                    >
                      Daily Rate
                    </label>
                    <input
                      type="number"
                      id="edit-daily-{exp.id}"
                      name="daily_rate"
                      bind:value={editDailyRate}
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label
                      for="edit-monthly-{exp.id}"
                      class="block text-sm text-[var(--dash-text-secondary)] mb-1"
                    >
                      Monthly Salary
                    </label>
                    <input
                      type="number"
                      id="edit-monthly-{exp.id}"
                      name="month_salary"
                      bind:value={editMonthSalary}
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label
                      for="edit-yearly-{exp.id}"
                      class="block text-sm text-[var(--dash-text-secondary)] mb-1"
                    >
                      Annual Salary
                    </label>
                    <input
                      type="number"
                      id="edit-yearly-{exp.id}"
                      name="year_salary"
                      bind:value={editYearSalary}
                      class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                    />
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
            <div class="flex items-start justify-between">
              <div class="flex items-start gap-4">
                <div
                  class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"
                >
                  <FontAwesomeIcon
                    icon={faMoneyBillWave}
                    class="w-5 h-5 text-green-600"
                  />
                </div>
                <div>
                  <h3 class="font-medium text-[var(--dash-text)]">
                    {exp.job_title || "Any Position"}
                  </h3>
                  <p class="text-sm text-[var(--dash-text-secondary)]">
                    {getLabel(exp.company_type, companyTypes)} •
                    {getLabel(exp.employment_type, employmentTypes)} •
                    {
                      getLabel(
                        exp.work_arrangement,
                        workArrangements,
                      )
                    } •
                    {exp.region}
                  </p>
                  <div class="flex flex-wrap gap-3 mt-2 text-sm">
                    {#if exp.hourly_rate}
                      <span class="text-[var(--dash-text)]">
                        {
                          formatCurrency(
                            exp.hourly_rate,
                            exp.currency || "EUR",
                          )
                        }/hr
                      </span>
                    {/if}
                    {#if exp.daily_rate}
                      <span class="text-[var(--dash-text)]">
                        {
                          formatCurrency(
                            exp.daily_rate,
                            exp.currency || "EUR",
                          )
                        }/day
                      </span>
                    {/if}
                    {#if exp.month_salary}
                      <span class="text-[var(--dash-text)]">
                        {
                          formatCurrency(
                            exp.month_salary,
                            exp.currency || "EUR",
                          )
                        }/mo
                      </span>
                    {/if}
                    {#if exp.year_salary}
                      <span class="text-[var(--dash-text)]">
                        {
                          formatCurrency(
                            exp.year_salary,
                            exp.currency || "EUR",
                          )
                        }/yr
                      </span>
                    {/if}
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-2">
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
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<DeleteConfirmModal
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
