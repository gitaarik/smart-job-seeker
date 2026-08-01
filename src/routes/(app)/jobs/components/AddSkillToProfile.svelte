<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faCircleNotch,
    faEyeSlash,
    faPlus,
  } from "@fortawesome/free-solid-svg-icons";
  import SkillPill from "./SkillPill.svelte";
  import { SKILL_LEVELS } from "$lib/data/field-labels";
  import { clickOutside, keepInView } from "$lib/actions/popover";

  /**
   * A job skill pill that, when it doesn't match the profile, doubles as an
   * "I actually have this" affordance.
   *
   * The point of capture matters: a skill you'd defend in an interview but
   * wouldn't headline on your CV is exactly what you spot while reading a job.
   * So "Show on CV" defaults to off — the skill starts counting for matching
   * immediately and only reaches a document if you say so. Adding does *not*
   * re-score this job (matching is an LLM pass the worker runs); the copy says
   * so rather than implying the number moved.
   *
   * Two different questions decide what a pill looks like, and conflating them
   * is what makes this component fiddly: whether the *match* counted the skill
   * (`strength`, from the matcher's stored output) and whether the *profile*
   * has it (`inProfile`/`profileOnlyId`, read live from the profile). They
   * disagree often — the matcher ran at a moment in time, and it is an LLM. So
   * both are props, resolved before the first paint. An earlier version asked
   * the server only after the popover had opened, which let the answer arrive
   * mid-interaction and swap the branch out from under the open popover: it
   * appeared to open and close itself.
   */

  type Strength = "strong" | "weak" | null;

  interface Props {
    skill: string;
    strength?: Strength;
    variant?: "required" | "preferred";
    /** Set when this skill matches but is held back from documents. */
    profileOnlyId?: number | null;
    /** Whether the profile lists the skill, regardless of what the match says. */
    inProfile?: boolean;
  }

  let {
    skill,
    strength = null,
    variant = "required",
    profileOnlyId = null,
    inProfile = false,
  }: Props = $props();

  /**
   * Skill names make bad ids — ".NET", "C++" and "Machine Learning" all appear
   * in job listings, and the last one isn't a conforming id at all, which
   * breaks the label/control pairing. A job can also require and prefer the
   * same skill, which would emit the id twice.
   */
  const uid = $props.id();

  let open = $state(false);
  let loaded = $state(false);
  let saving = $state(false);
  let error = $state<string | null>(null);

  let categories = $state<Array<{ id: number; name: string | null }>>([]);
  /** Set once this pill has actually written the skill to the profile. */
  let added = $state(false);
  let addedProfileOnly = $state(true);
  /**
   * A profile the page didn't know about at load. Only reachable when the same
   * skill is listed twice on one job, or when another tab got there first —
   * `inProfile` covers the ordinary case before any click.
   */
  let discovered = $state(false);

  let known = $derived(inProfile || discovered);

  let level = $state("");
  let showOnCv = $state(false);

  /**
   * Sentinel for the category select. Skills arrive from jobs in whatever order
   * the jobs come, so the one you want to file a skill under is regularly one
   * the profile doesn't have yet — and being sent to the skills page to make it
   * first would lose the job you were reading. Bound as a string so the "new"
   * option and the ids share one type.
   */
  const NEW_CATEGORY = "new";
  let categoryChoice = $state<string>("");
  let newCategoryName = $state("");

  // "Held back" branch: the profile has it, but no document prints it. Worth
  // saying whether or not the match counted it — the applicant has the skill
  // either way, and the reason it's invisible is a choice they can revisit.
  let heldBack = $derived(profileOnlyId !== null);
  let versionsOpen = $state(false);
  let versionSlugs = $state<string[]>([]);
  let versionsLoaded = $state(false);
  let lifted = $state<string | null>(null);

  async function loadVersions() {
    if (versionsLoaded) return;
    versionsLoaded = true;
    try {
      const res = await fetch("/api/profile-versions");
      if (res.ok) versionSlugs = await res.json();
    } catch {
      // The "all documents" action works without them.
    }
  }

  async function showOn(target: string) {
    if (saving || profileOnlyId === null) return;
    saving = true;
    error = null;
    try {
      const res = await fetch("/api/profile-skills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: profileOnlyId, show_on: target }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't update the skill.");
      lifted = target;
      versionsOpen = false;
    } catch (e) {
      error = e instanceof Error ? e.message : "Couldn't update the skill.";
    } finally {
      saving = false;
    }
  }

  async function loadCategories() {
    if (loaded) return;
    try {
      const res = await fetch("/api/profile-skills");
      if (!res.ok) throw new Error();
      const data = await res.json();
      categories = data.categories ?? [];
      categoryChoice = categories[0] ? String(categories[0].id) : NEW_CATEGORY;
      discovered = (data.skills ?? []).some(
        (n: string) => n?.trim().toLowerCase() === skill.trim().toLowerCase(),
      );
      loaded = true;
    } catch {
      error = "Couldn't load your skill categories.";
    }
  }

  function toggle() {
    open = !open;
    if (open) loadCategories();
  }

  async function add() {
    if (saving) return;

    const creating = categoryChoice === NEW_CATEGORY;
    if (creating && !newCategoryName.trim()) {
      error = "Name the new category.";
      return;
    }

    saving = true;
    error = null;
    try {
      const res = await fetch("/api/profile-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: skill,
          level: level || null,
          category_id: creating ? null : Number(categoryChoice),
          category_name: creating ? newCategoryName.trim() : null,
          profile_only: !showOnCv,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't add the skill.");

      if (data.duplicate) {
        discovered = true;
      } else {
        addedProfileOnly = !showOnCv;
        added = true;
      }
      open = false;
    } catch (e) {
      error = e instanceof Error ? e.message : "Couldn't add the skill.";
    } finally {
      saving = false;
    }
  }
</script>

{#if heldBack}
  <!-- The profile has it, but no document prints it. Say so where the
       applicant is weighing themselves against the job, and offer the way out. -->
  <span class="relative inline-block">
    <button
      type="button"
      onclick={() => {
        versionsOpen = !versionsOpen;
        if (versionsOpen) loadVersions();
      }}
      title={lifted
        ? "Now shown on your CV"
        : "In your profile, but kept off your CV — click to add it"}
      class="
        inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-sm transition-colors {lifted
        ? 'border-[var(--dash-success)]/30 bg-[var(--dash-success-light)] text-[var(--dash-success)]'
        : 'border-dashed border-[var(--dash-success)]/40 bg-[var(--dash-success-light)]/50 text-[var(--dash-success)]'}
      "
    >
      <FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
      {skill}
      {#if !lifted}
        <FontAwesomeIcon icon={faEyeSlash} class="h-3 w-3 opacity-70" />
      {/if}
    </button>

    {#if versionsOpen}
      <div class="fixed inset-0 z-40 bg-black/30 sm:hidden"></div>
      <div
        use:clickOutside={() => (versionsOpen = false)}
        use:keepInView
        class="absolute top-full left-0 z-50 mt-1 w-64 space-y-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-3 text-left shadow-lg"
      >
        <p class="text-sm font-medium text-[var(--dash-text)]">
          “{skill}” is profile-only
        </p>
        <p class="text-[10px] leading-snug text-[var(--dash-text-muted)]">
          It counts for matching but doesn't print on your resume / CV. Put it
          on:
        </p>
        <div class="flex flex-wrap gap-1.5">
          <button
            type="button"
            onclick={() => showOn("all")}
            disabled={saving}
            class="rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary)] disabled:opacity-70"
          >
            All documents
          </button>
          {#each versionSlugs as slug}
            <button
              type="button"
              onclick={() => showOn(slug)}
              disabled={saving}
              class="rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary)] disabled:opacity-70"
            >
              {slug}
            </button>
          {/each}
        </div>
        {#if strength === null}
          <p class="text-[10px] leading-snug text-[var(--dash-text-muted)]">
            This job's match doesn't count it yet — that catches up the next
            time the job is matched.
          </p>
        {/if}
        {#if error}
          <p class="text-[10px] text-[var(--dash-error)]">{error}</p>
        {/if}
      </div>
    {/if}
  </span>
{:else if strength !== null}
  <SkillPill {skill} {strength} {variant} size="md" />
{:else}
  <!-- One wrapper for both pill states so that learning the profile already
       has the skill restyles the trigger without tearing down an open
       popover. -->
  <span class="relative inline-block">
    {#if added || known}
      <span
        class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-success)]/30 bg-[var(--dash-success-light)] px-3 py-1 text-sm text-[var(--dash-success)]"
        title={added
          ? addedProfileOnly
            ? "Added to your profile — counts for matching from the next match on, and stays off your resume/CV"
            : "Added to your profile — counts for matching from the next match on"
          : "Already in your profile — this job's match doesn't count it yet"}
      >
        <FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
        {skill}
        {#if added && addedProfileOnly}
          <FontAwesomeIcon icon={faEyeSlash} class="h-3 w-3 opacity-70" />
        {/if}
      </span>
    {:else}
      <button
        type="button"
        onclick={toggle}
        title="I have this skill — add it to my profile"
        class="
          inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-sm transition-colors {variant ===
        'preferred'
          ? 'border-[var(--dash-primary)]/30 bg-[var(--dash-primary-light)] text-[var(--dash-primary)]'
          : 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)]'} hover:border-[var(--dash-primary)]/60
        "
      >
        {skill}
        <FontAwesomeIcon icon={faPlus} class="h-2.5 w-2.5 opacity-50" />
      </button>
    {/if}

    {#if open}
      <!-- Mobile backdrop -->
      <div class="fixed inset-0 z-40 bg-black/30 sm:hidden"></div>
      <div
        use:clickOutside={() => (open = false)}
        use:keepInView
        class="absolute top-full left-0 z-50 mt-1 w-64 space-y-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-3 text-left shadow-lg"
      >
        {#if known}
          <!-- Reached only when the profile changed under us mid-click. -->
          <p class="text-sm font-medium text-[var(--dash-text)]">
            “{skill}” is already in your profile
          </p>
          <p class="text-[10px] leading-snug text-[var(--dash-text-muted)]">
            This job's match doesn't count it yet — that catches up the next
            time the job is matched.
          </p>
          <div class="flex justify-end pt-1">
            <button
              type="button"
              onclick={() => (open = false)}
              class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 text-xs text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
            >
              Close
            </button>
          </div>
        {:else}
          <p class="text-sm font-medium text-[var(--dash-text)]">
            Add “{skill}” to your profile
          </p>

          <div>
            <label
              for="add-skill-level-{uid}"
              class="mb-1 block text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase"
            >Level</label>
            <select
              id="add-skill-level-{uid}"
              bind:value={level}
              class="w-full cursor-pointer rounded border border-[var(--dash-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--dash-text)] focus:ring-1 focus:ring-[var(--dash-primary)] focus:outline-none"
            >
              <option value="">--</option>
              {#each SKILL_LEVELS as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>

          <div>
            <label
              for="add-skill-category-{uid}"
              class="mb-1 block text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase"
            >Category</label>
            <select
              id="add-skill-category-{uid}"
              bind:value={categoryChoice}
              class="w-full cursor-pointer rounded border border-[var(--dash-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--dash-text)] focus:ring-1 focus:ring-[var(--dash-primary)] focus:outline-none"
            >
              {#each categories as cat}
                <option value={String(cat.id)}>{cat.name}</option>
              {/each}
              <option value={NEW_CATEGORY}>+ New category…</option>
            </select>
            {#if categoryChoice === NEW_CATEGORY}
              <input
                type="text"
                bind:value={newCategoryName}
                placeholder="Category name"
                aria-label="New category name"
                class="mt-1 w-full rounded border border-[var(--dash-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--dash-text)] focus:ring-1 focus:ring-[var(--dash-primary)] focus:outline-none"
              />
            {/if}
          </div>

          <div>
            <button
              type="button"
              onclick={() => (showOnCv = !showOnCv)}
              aria-pressed={showOnCv}
              class="flex w-full items-center justify-between gap-2 text-left"
            >
              <span
                class="text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase"
              >
                Show on CV
              </span>
              <span
                class="
                  relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors {showOnCv
                  ? 'bg-emerald-500'
                  : 'bg-[var(--dash-border)]'}
                "
              >
                <span
                  class="
                    absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all {showOnCv
                    ? 'left-3.5'
                    : 'left-0.5'}
                  "
                ></span>
              </span>
            </button>
            <p class="mt-0.5 text-[10px] leading-snug text-[var(--dash-text-muted)]">
              {#if showOnCv}
                Shown on your resume / CV, and counts for job matching.
              {:else}
                Counts for job matching. Stays off your resume / CV until you
                turn this on.
              {/if}
            </p>
          </div>

          {#if error}
            <p class="text-[10px] text-[var(--dash-error)]">{error}</p>
          {/if}

          <div class="flex justify-end gap-1.5 pt-1">
            <button
              type="button"
              onclick={() => (open = false)}
              class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 text-xs text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onclick={add}
              disabled={saving}
              class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-70"
            >
              {#if saving}
                <FontAwesomeIcon icon={faCircleNotch} spin class="h-3 w-3" />
              {/if}
              Add
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </span>
{/if}
