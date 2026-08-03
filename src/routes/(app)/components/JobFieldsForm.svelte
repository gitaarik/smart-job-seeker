<script lang="ts" module>
  /**
   * The hand-editable fields of a job, as form strings.
   *
   * Kept as strings (rather than the column types) so they map straight onto
   * inputs and post back unchanged — the server does the coercion, in
   * `$lib/server/jobs/job-fields`. The three taxonomy fields are the exception:
   * checkbox groups need real arrays.
   */
  export type JobFields = {
    title: string;
    company: string;
    job_poster: string;
    office_location: string;
    source_url: string;
    date_posted: string;
    salary_min: string;
    salary_max: string;
    salary_currency: string;
    salary_period: string;
    work_location: string[];
    job_types: string[];
    experience_levels: string[];
  };

  export function emptyJobFields(): JobFields {
    return {
      title: "",
      company: "",
      job_poster: "",
      office_location: "",
      source_url: "",
      date_posted: "",
      salary_min: "",
      salary_max: "",
      salary_currency: "",
      salary_period: "",
      work_location: [],
      job_types: [],
      experience_levels: [],
    };
  }
</script>

<script lang="ts">
  import Card from "./Card.svelte";
  import {
    EXPERIENCE_LEVELS,
    JOB_TYPES,
    WORK_LOCATIONS,
  } from "$lib/data/job-taxonomy";

  /**
   * The job fields every hand-entry surface shares: the create form at
   * /applications/new and the header-card editor on /jobs/[id].
   *
   * Deliberately excludes the description. It is long-form, it is the input the
   * extractor re-reads, and both call sites give it its own box with its own
   * copy — folding it in here would couple two unrelated save semantics.
   *
   * Also excludes the parser-owned fields (skills, responsibilities, soft
   * skills, company description): those are extraction output, and a re-parse
   * overwrites them wholesale.
   */
  interface Props {
    fields: JobFields;
    /**
     * "cards" renders the three groups as sibling Cards (the create form's
     * full-page layout); "flat" renders them stacked inside whatever the caller
     * already has, separated by hairlines.
     */
    layout?: "cards" | "flat";
    /** Prefix for input ids, so two instances can coexist on one page. */
    idPrefix?: string;
    /** Render the title at heading size — for editing in place under an h1. */
    titleSize?: "normal" | "heading";
    /** Optional note under the date field, e.g. what an empty value falls back to. */
    datePostedHint?: string | null;
    disabled?: boolean;
  }

  let {
    fields = $bindable(),
    layout = "cards",
    idPrefix = "jf",
    titleSize = "normal",
    datePostedHint = null,
    disabled = false,
  }: Props = $props();

  const workLocationOptions = WORK_LOCATIONS.values.map((v) => ({
    value: v.canonical,
    label: v.label,
  }));
  const jobTypeOptions = JOB_TYPES.values.map((v) => ({
    value: v.canonical,
    label: v.label,
  }));
  const experienceLevelOptions = EXPERIENCE_LEVELS.values.map((v) => ({
    value: v.canonical,
    label: v.label,
  }));

  const inputClass =
    "w-full px-3 py-2 text-sm bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] disabled:opacity-60";
  const labelClass =
    "block text-xs font-medium text-[var(--dash-text-muted)] mb-1";
  const pillClass =
    "inline-block px-3 py-1.5 text-xs rounded-full border border-[var(--dash-border)] text-[var(--dash-text-secondary)] peer-checked:bg-[var(--dash-primary)] peer-checked:text-white peer-checked:border-[var(--dash-primary)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--dash-primary)] transition-colors";

  const titleInputClass = $derived(
    titleSize === "heading"
      ? "w-full px-3 py-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] disabled:opacity-60"
      : inputClass,
  );

  /** Separates the groups in "flat" layout without needing a wrapper per group. */
  const dividerClass = "border-t border-[var(--dash-border)] pt-5 mt-5";
</script>

{#snippet basics()}
  <div class="space-y-4">
    <div>
      <label for="{idPrefix}-title" class={labelClass}>Job title</label>
      <input
        id="{idPrefix}-title"
        name="title"
        type="text"
        maxlength="255"
        {disabled}
        bind:value={fields.title}
        placeholder="e.g. Senior Frontend Engineer"
        class={titleInputClass}
      />
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label for="{idPrefix}-company" class={labelClass}>Company</label>
        <input
          id="{idPrefix}-company"
          name="company"
          type="text"
          {disabled}
          bind:value={fields.company}
          placeholder="e.g. Acme Inc."
          class={inputClass}
        />
      </div>
      <div>
        <label for="{idPrefix}-poster" class={labelClass}>
          Recruiter <span class="font-normal">(if not the company)</span>
        </label>
        <input
          id="{idPrefix}-poster"
          name="job_poster"
          type="text"
          {disabled}
          bind:value={fields.job_poster}
          placeholder="e.g. Acme Recruitment"
          class={inputClass}
        />
      </div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label for="{idPrefix}-location" class={labelClass}>Office location</label>
        <input
          id="{idPrefix}-location"
          name="office_location"
          type="text"
          {disabled}
          bind:value={fields.office_location}
          placeholder="e.g. Amsterdam"
          class={inputClass}
        />
      </div>
      <div>
        <label for="{idPrefix}-posted" class={labelClass}>Date posted</label>
        <input
          id="{idPrefix}-posted"
          name="date_posted"
          type="date"
          {disabled}
          bind:value={fields.date_posted}
          class={inputClass}
        />
        {#if datePostedHint}
          <p class="text-xs text-[var(--dash-text-muted)] mt-1">{datePostedHint}</p>
        {/if}
      </div>
    </div>
    <div>
      <label for="{idPrefix}-url" class={labelClass}>Job URL</label>
      <input
        id="{idPrefix}-url"
        name="source_url"
        type="url"
        {disabled}
        bind:value={fields.source_url}
        placeholder="https://…"
        class={inputClass}
      />
      <p class="text-xs text-[var(--dash-text-muted)] mt-1">
        If it's from a known job platform, we'll link it automatically.
      </p>
    </div>
  </div>
{/snippet}

{#snippet taxonomy()}
  <div class="space-y-4">
    <fieldset>
      <legend class="{labelClass} mb-2">Work arrangement</legend>
      <div class="flex flex-wrap gap-2">
        {#each workLocationOptions as opt}
          <label class="cursor-pointer">
            <input
              type="checkbox"
              name="work_location"
              value={opt.value}
              {disabled}
              bind:group={fields.work_location}
              class="peer sr-only"
            />
            <span class={pillClass}>{opt.label}</span>
          </label>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend class="{labelClass} mb-2">Employment type</legend>
      <div class="flex flex-wrap gap-2">
        {#each jobTypeOptions as opt}
          <label class="cursor-pointer">
            <input
              type="checkbox"
              name="job_types"
              value={opt.value}
              {disabled}
              bind:group={fields.job_types}
              class="peer sr-only"
            />
            <span class={pillClass}>{opt.label}</span>
          </label>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend class="{labelClass} mb-2">Experience level</legend>
      <div class="flex flex-wrap gap-2">
        {#each experienceLevelOptions as opt}
          <label class="cursor-pointer">
            <input
              type="checkbox"
              name="experience_levels"
              value={opt.value}
              {disabled}
              bind:group={fields.experience_levels}
              class="peer sr-only"
            />
            <span class={pillClass}>{opt.label}</span>
          </label>
        {/each}
      </div>
    </fieldset>
  </div>
{/snippet}

{#snippet salary()}
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
    <div>
      <label for="{idPrefix}-salmin" class={labelClass}>Salary min</label>
      <input
        id="{idPrefix}-salmin"
        name="salary_min"
        type="number"
        inputmode="numeric"
        {disabled}
        bind:value={fields.salary_min}
        placeholder="0"
        class={inputClass}
      />
    </div>
    <div>
      <label for="{idPrefix}-salmax" class={labelClass}>Salary max</label>
      <input
        id="{idPrefix}-salmax"
        name="salary_max"
        type="number"
        inputmode="numeric"
        {disabled}
        bind:value={fields.salary_max}
        placeholder="0"
        class={inputClass}
      />
    </div>
    <div>
      <label for="{idPrefix}-cur" class={labelClass}>Currency</label>
      <input
        id="{idPrefix}-cur"
        name="salary_currency"
        type="text"
        {disabled}
        bind:value={fields.salary_currency}
        placeholder="EUR"
        class={inputClass}
      />
    </div>
    <div>
      <label for="{idPrefix}-per" class={labelClass}>Period</label>
      <select
        id="{idPrefix}-per"
        name="salary_period"
        {disabled}
        bind:value={fields.salary_period}
        class={inputClass}
      >
        <option value="">—</option>
        <option value="year">year</option>
        <option value="month">month</option>
        <option value="week">week</option>
        <option value="day">day</option>
        <option value="hour">hour</option>
        <option value="project">project</option>
      </select>
    </div>
  </div>
{/snippet}

{#if layout === "cards"}
  <Card padding="responsive">{@render basics()}</Card>
  <Card padding="responsive">{@render taxonomy()}</Card>
  <Card padding="responsive">{@render salary()}</Card>
{:else}
  {@render basics()}
  <div class={dividerClass}>{@render taxonomy()}</div>
  <div class={dividerClass}>{@render salary()}</div>
{/if}
