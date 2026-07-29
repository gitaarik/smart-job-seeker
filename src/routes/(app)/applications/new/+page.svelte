<script lang="ts">
  import type { ActionData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faCircleCheck,
    faExclamationTriangle,
    faListCheck,
    faPlus,
    faSpinner,
    faWandMagicSparkles,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../components/Card.svelte";
  import {
    EXPERIENCE_LEVELS,
    JOB_TYPES,
    WORK_LOCATIONS,
  } from "$lib/data/job-taxonomy";

  let { form }: { form: ActionData } = $props();

  // Two steps: paste a posting and let it be extracted, then review/correct
  // the extracted fields before the job is created. "Enter the details
  // manually" skips straight to the (blank) review step.

  type ParsedFields = {
    title: string | null;
    company: string | null;
    job_poster: string | null;
    office_location: string | null;
    work_location: string[];
    job_types: string[];
    experience_levels: string[];
    source_url: string | null;
    date_posted: string | null;
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string | null;
    salary_period: string | null;
  };

  type ParsedPreview = {
    company_description: string | null;
    skills_required: string[];
    skills_preferred: string[];
    responsibilities: string[];
    soft_skills: string[];
  };

  let step = $state<"paste" | "review">("paste");
  let parsing = $state(false);
  let parseWarning = $state<string | null>(null);
  let parseToken = $state("");
  let didParse = $state(false);
  let creating = $state(false);

  // Review-step form values. Kept as strings so they map straight onto inputs.
  let fTitle = $state("");
  let fCompany = $state("");
  let fJobPoster = $state("");
  let fLocation = $state("");
  let fSourceUrl = $state("");
  let fDatePosted = $state("");
  let fSalaryMin = $state("");
  let fSalaryMax = $state("");
  let fSalaryCurrency = $state("");
  let fSalaryPeriod = $state("");
  let fDescription = $state("");
  let fWorkLocation = $state<string[]>([]);
  let fJobTypes = $state<string[]>([]);
  let fExperienceLevels = $state<string[]>([]);
  let preview = $state<ParsedPreview | null>(null);

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

  let previewGroups = $derived(
    preview
      ? [
          { label: "Required skills", items: preview.skills_required },
          { label: "Preferred skills", items: preview.skills_preferred },
          { label: "Responsibilities", items: preview.responsibilities },
          { label: "Soft skills", items: preview.soft_skills },
        ].filter((g) => g.items.length > 0)
      : [],
  );

  async function runParse() {
    if (!fDescription.trim() || parsing) return;
    parsing = true;
    parseWarning = null;
    try {
      const res = await fetch("/api/jobs/parse-description", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description: fDescription,
          source_url: fSourceUrl || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (!body.ok) {
        // Extraction degraded (LLM error, no credits). Still let them through
        // to the review step and fill it in by hand.
        parseWarning = body.message ??
          "We couldn't read that posting automatically.";
      } else {
        applyParsedFields(body.fields as ParsedFields);
        preview = body.preview as ParsedPreview;
        parseToken = body.token;
        didParse = true;
      }
    } catch {
      parseWarning =
        "Extraction failed. You can still fill in the details yourself.";
    } finally {
      parsing = false;
      step = "review";
      window.scrollTo({ top: 0 });
    }
  }

  /**
   * Pre-fill the review form from a parse. Deliberately overwrites: a parse is
   * a fresh starting point the user then corrects, so going back and re-parsing
   * an edited description replaces the previous extraction rather than leaving
   * stale values behind. The one exception is a URL the user typed themselves,
   * which is more reliable than one recovered from the posting text.
   */
  function applyParsedFields(fields: ParsedFields) {
    const str = (v: string | number | null) => (v == null ? "" : String(v));
    fTitle = str(fields.title);
    fCompany = str(fields.company);
    fJobPoster = str(fields.job_poster);
    fLocation = str(fields.office_location);
    fSourceUrl ||= str(fields.source_url);
    fDatePosted = str(fields.date_posted);
    fSalaryMin = str(fields.salary_min);
    fSalaryMax = str(fields.salary_max);
    fSalaryCurrency = str(fields.salary_currency);
    fSalaryPeriod = str(fields.salary_period);
    fWorkLocation = fields.work_location;
    fJobTypes = fields.job_types;
    fExperienceLevels = fields.experience_levels;
  }

  const inputClass =
    "w-full px-3 py-2 text-sm bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]";
  const labelClass =
    "block text-xs font-medium text-[var(--dash-text-muted)] mb-1";
  const pillClass =
    "inline-block px-3 py-1.5 text-xs rounded-full border border-[var(--dash-border)] text-[var(--dash-text-secondary)] peer-checked:bg-[var(--dash-primary)] peer-checked:text-white peer-checked:border-[var(--dash-primary)] transition-colors";
</script>

<svelte:head>
  <title>New application — Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6 pb-8 max-w-3xl">
  <div>
    <a
      href="/applications/active"
      class="inline-flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors mb-2"
    >
      <FontAwesomeIcon icon={faArrowLeft} class="w-3 h-3" />
      Applications
    </a>
    <h1 class="text-xl font-semibold text-[var(--dash-text)]">
      {step === "paste" ? "New application" : "Check the details"}
    </h1>
    <p class="text-sm text-[var(--dash-text-muted)] mt-1">
      {#if step === "paste"}
        Paste the whole job posting and we'll pull out the title, company, salary,
        skills and more. You get to check everything before it's saved.
      {:else if didParse}
        Here's what we found. Correct anything that's off — nothing is saved yet.
      {:else}
        Fill in what you know. Everything is optional; you can complete it later.
      {/if}
    </p>
  </div>

  {#if form?.error}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  {#if step === "paste"}
    <Card padding="responsive">
      <div class="space-y-4">
        <div>
          <label for="na-paste" class={labelClass}>Job description</label>
          <!-- svelte-ignore a11y_autofocus -->
          <textarea
            id="na-paste"
            rows="16"
            autofocus
            bind:value={fDescription}
            placeholder="Paste the full posting here…"
            class="{inputClass} resize-y"
          ></textarea>
        </div>
        <div>
          <label for="na-paste-url" class={labelClass}>
            Job URL <span class="font-normal">(optional)</span>
          </label>
          <input
            id="na-paste-url"
            type="url"
            bind:value={fSourceUrl}
            placeholder="https://…"
            class={inputClass}
          />
          <p class="text-xs text-[var(--dash-text-muted)] mt-1">
            If it's from a known job platform, we'll link it automatically. We'll
            also try to find it in the posting itself.
          </p>
        </div>
      </div>
    </Card>

    <div class="flex items-center justify-between gap-3">
      <button
        type="button"
        onclick={() => (step = "review")}
        class="text-sm text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] underline transition-colors"
      >
        Enter the details manually
      </button>
      <div class="flex items-center gap-2">
        <a
          href="/applications/active"
          class="px-3 py-2 text-sm rounded-md border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
        >
          Cancel
        </a>
        <button
          type="button"
          onclick={runParse}
          disabled={parsing || !fDescription.trim()}
          class="flex items-center gap-2 px-4 py-2 text-sm bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-60"
        >
          <FontAwesomeIcon
            icon={parsing ? faSpinner : faWandMagicSparkles}
            class="w-3.5 h-3.5 {parsing ? 'animate-spin' : ''}"
          />
          {parsing ? "Reading…" : "Extract details"}
        </button>
      </div>
    </div>
  {:else}
    {#if parseWarning}
      <div class="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[var(--dash-warning-bg,rgba(234,179,8,0.12))] border border-yellow-500/40">
        <FontAwesomeIcon icon={faExclamationTriangle} class="w-4 h-4 mt-0.5 text-yellow-500 flex-shrink-0" />
        <p class="text-sm text-[var(--dash-text-secondary)]">{parseWarning}</p>
      </div>
    {:else if didParse}
      <div class="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[var(--dash-success-bg,rgba(34,197,94,0.1))] border border-green-500/30">
        <FontAwesomeIcon icon={faCircleCheck} class="w-4 h-4 mt-0.5 text-[var(--dash-success)] flex-shrink-0" />
        <p class="text-sm text-[var(--dash-text-secondary)]">
          Extracted from your paste. The description is stored exactly as you pasted it.
        </p>
      </div>
    {/if}

    <form
      method="POST"
      use:enhance={() => {
        creating = true;
        return async ({ update }) => {
          // Action redirects on success; only reached on failure.
          await update();
          creating = false;
        };
      }}
      class="space-y-6"
    >
      <!-- Proves this form was pre-filled from a parse of exactly this
           description, so the server treats the inputs as authoritative
           instead of gap-filling them. Editing the description below
           invalidates it and triggers a re-parse on save. -->
      <input type="hidden" name="parse_token" value={parseToken} />
      <!-- Extraction already ran and failed for this paste. Tells the server
           not to spend another LLM call retrying on submit — the user was told
           to fill it in by hand, so don't stall them. -->
      {#if parseWarning}
        <input type="hidden" name="parse_failed" value="1" />
      {/if}

      <Card padding="responsive">
        <div class="space-y-4">
          <div>
            <label for="na-title" class={labelClass}>Job title</label>
            <input id="na-title" name="title" type="text" bind:value={fTitle}
              placeholder="e.g. Senior Frontend Engineer" class={inputClass} />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="na-company" class={labelClass}>Company</label>
              <input id="na-company" name="company" type="text" bind:value={fCompany}
                placeholder="e.g. Acme Inc." class={inputClass} />
            </div>
            <div>
              <label for="na-poster" class={labelClass}>
                Recruiter <span class="font-normal">(if not the company)</span>
              </label>
              <input id="na-poster" name="job_poster" type="text" bind:value={fJobPoster}
                placeholder="e.g. Acme Recruitment" class={inputClass} />
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="na-location" class={labelClass}>Office location</label>
              <input id="na-location" name="office_location" type="text" bind:value={fLocation}
                placeholder="e.g. Amsterdam" class={inputClass} />
            </div>
            <div>
              <label for="na-posted" class={labelClass}>Date posted</label>
              <input id="na-posted" name="date_posted" type="date" bind:value={fDatePosted}
                class={inputClass} />
            </div>
          </div>
          <div>
            <label for="na-url" class={labelClass}>Job URL</label>
            <input id="na-url" name="source_url" type="url" bind:value={fSourceUrl}
              placeholder="https://…" class={inputClass} />
            <p class="text-xs text-[var(--dash-text-muted)] mt-1">
              If it's from a known job platform, we'll link it automatically.
            </p>
          </div>
        </div>
      </Card>

      <Card padding="responsive">
        <div class="space-y-4">
          <fieldset>
            <legend class="{labelClass} mb-2">Work arrangement</legend>
            <div class="flex flex-wrap gap-2">
              {#each workLocationOptions as opt}
                <label class="cursor-pointer">
                  <input type="checkbox" name="work_location" value={opt.value}
                    bind:group={fWorkLocation} class="peer sr-only" />
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
                  <input type="checkbox" name="job_types" value={opt.value}
                    bind:group={fJobTypes} class="peer sr-only" />
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
                  <input type="checkbox" name="experience_levels" value={opt.value}
                    bind:group={fExperienceLevels} class="peer sr-only" />
                  <span class={pillClass}>{opt.label}</span>
                </label>
              {/each}
            </div>
          </fieldset>
        </div>
      </Card>

      <Card padding="responsive">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label for="na-salmin" class={labelClass}>Salary min</label>
            <input id="na-salmin" name="salary_min" type="number" inputmode="numeric"
              bind:value={fSalaryMin} placeholder="0" class={inputClass} />
          </div>
          <div>
            <label for="na-salmax" class={labelClass}>Salary max</label>
            <input id="na-salmax" name="salary_max" type="number" inputmode="numeric"
              bind:value={fSalaryMax} placeholder="0" class={inputClass} />
          </div>
          <div>
            <label for="na-cur" class={labelClass}>Currency</label>
            <input id="na-cur" name="salary_currency" type="text"
              bind:value={fSalaryCurrency} placeholder="EUR" class={inputClass} />
          </div>
          <div>
            <label for="na-per" class={labelClass}>Period</label>
            <select id="na-per" name="salary_period" bind:value={fSalaryPeriod} class={inputClass}>
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
      </Card>

      <Card padding="responsive">
        <label for="na-desc" class={labelClass}>Description</label>
        <textarea id="na-desc" name="job_description" rows="10" bind:value={fDescription}
          placeholder="Paste the job description…" class="{inputClass} resize-y"></textarea>
        <p class="text-xs text-[var(--dash-text-muted)] mt-1">
          Stored exactly as pasted. Editing it here re-runs extraction when you save,
          which takes a few seconds.
        </p>
      </Card>

      {#if previewGroups.length > 0 || preview?.company_description}
        <Card padding="responsive">
          <p class="text-xs font-medium text-[var(--dash-text-muted)] mb-3 flex items-center gap-1.5">
            <FontAwesomeIcon icon={faListCheck} class="w-3 h-3" />
            Also extracted
          </p>
          <div class="space-y-3">
            {#each previewGroups as group}
              <div>
                <p class="text-[10px] uppercase tracking-wide text-[var(--dash-text-muted)] mb-1.5">{group.label}</p>
                <div class="flex flex-wrap gap-1.5">
                  {#each group.items as item}
                    <span class="px-2 py-0.5 text-xs rounded-full bg-[var(--dash-bg)] border border-[var(--dash-border)] text-[var(--dash-text-secondary)]">
                      {item}
                    </span>
                  {/each}
                </div>
              </div>
            {/each}
            {#if preview?.company_description}
              <div>
                <p class="text-[10px] uppercase tracking-wide text-[var(--dash-text-muted)] mb-1.5">About the company</p>
                <p class="text-xs text-[var(--dash-text-secondary)]">{preview.company_description}</p>
              </div>
            {/if}
          </div>
          <p class="text-xs text-[var(--dash-text-muted)] pt-3">
            Saved with the job — edit these on the job page afterwards.
          </p>
        </Card>
      {/if}

      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          onclick={() => (step = "paste")}
          class="flex items-center gap-1.5 text-sm text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors"
        >
          <FontAwesomeIcon icon={faArrowLeft} class="w-3 h-3" />
          Back to paste
        </button>
        <div class="flex items-center gap-2">
          <a
            href="/applications/active"
            class="px-3 py-2 text-sm rounded-md border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
          >
            Cancel
          </a>
          <button
            type="submit"
            disabled={creating}
            class="flex items-center gap-2 px-4 py-2 text-sm bg-[var(--dash-primary)] text-white rounded-md hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-60"
          >
            <FontAwesomeIcon icon={faPlus} class="w-3.5 h-3.5" />
            {creating ? "Creating…" : "Create application"}
          </button>
        </div>
      </div>
    </form>
  {/if}
</div>
