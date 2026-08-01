<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBan,
    faCheck,
    faChevronDown,
    faChevronRight,
    faCircleNotch,
    faEyeSlash,
    faGripVertical,
    faPlus,
    faTags,
    faTimes,
    faTrash,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";
  import { dndzone } from "svelte-dnd-action";
  import { flip } from "svelte/animate";
  import { clickOutside, keepInView } from "$lib/actions/popover";
  import {
    BASE_TEMPLATE_TAGS,
    isNegated,
    isProfileOnly,
    setProfileOnly,
    tagSlug,
  } from "$lib/profile-visibility";

  export interface SkillItem {
    name: string;
    level?: string;
    yearsExperience?: number;
    tags?: string[] | null;
  }

  export interface LevelOption {
    value: string;
    label: string;
  }

  const defaultLevelOptions: LevelOption[] = [
    { value: "expert", label: "Expert" },
    { value: "proficient", label: "Proficient" },
    { value: "intermediate", label: "Intermediate" },
    { value: "beginner", label: "Beginner" },
  ];

  interface Props {
    skills: SkillItem[];
    levelOptions?: LevelOption[];
    versionSlugs?: string[];
    hasAnyLevel?: boolean;
    hasAnyExperience?: boolean;
    hasAnyVersionTags?: boolean;
    showLevel?: boolean;
    showExperience?: boolean;
    showVersionTags?: boolean;
    reorderMode?: boolean;
    onupdate?: (skill: SkillItem) => void;
    oncreate?: (skill: SkillItem) => void;
    onremove?: (skill: SkillItem) => void;
    onreorder?: (skills: SkillItem[]) => void;
  }

  let {
    skills = $bindable(),
    levelOptions: _levelOptions = defaultLevelOptions,
    versionSlugs = [],
    hasAnyLevel,
    hasAnyExperience,
    hasAnyVersionTags,
    showLevel = $bindable(false),
    showExperience = $bindable(false),
    showVersionTags = $bindable(false),
    reorderMode = $bindable(false),
    onupdate,
    oncreate,
    onremove,
    onreorder,
  }: Props = $props();

  let levelOptions = $derived(_levelOptions.length > 0 ? _levelOptions : defaultLevelOptions);

  // When used standalone (without parent), derive visibility from local skills
  let showLevelToggle = $derived(hasAnyLevel ?? skills.some((s) => s.level));
  let showExperienceToggle = $derived(hasAnyExperience ?? skills.some((s) => s.yearsExperience));
  let showVersionTagsToggle = $derived(hasAnyVersionTags ?? versionSlugs.length > 0);

  let editingIndex = $state<number | null>(null);
  let editingSnapshot = $state<SkillItem | null>(null);
  let editingIsNew = $state(false);
  let showVersionTags_popup = $state(false);

  let reorderSnapshot = $state<SkillItem[] | null>(null);
  let reorderSaving = $state(false);

  // When reorderMode is toggled externally (from another category), take/restore snapshot
  let prevReorderMode = $state(false);
  $effect(() => {
    if (reorderMode && !prevReorderMode) {
      // Entering reorder mode — take snapshot if we don't have one yet
      if (!reorderSnapshot) {
        if (editingIndex !== null) confirmEditing();
        reorderSnapshot = skills.map((s) => ({ ...s }));
      }
    } else if (!reorderMode && prevReorderMode) {
      // Exiting reorder mode — restore from snapshot if not yet confirmed/cancelled
      if (reorderSnapshot) {
        skills = reorderSnapshot;
        reorderSnapshot = null;
      }
    }
    prevReorderMode = reorderMode;
  });

  // Version tag editing state
  const builtinTags = BASE_TEMPLATE_TAGS;

  /** The `!resume`/`!cv` pair the "Show on CV" switch owns, not free-form tags. */
  function isBaseExclusion(tag: string): boolean {
    return isNegated(tag) && builtinTags.includes(tagSlug(tag));
  }

  let editingSkillTags = $derived(
    editingIndex === null ? [] : skills[editingIndex]?.tags ?? [],
  );
  let editingProfileOnly = $derived(isProfileOnly(editingSkillTags));

  // Chips list the version tags. While profile-only is on, its exclusion pair
  // is represented by the switch above, so don't also show it as chips.
  let editingTags = $derived(
    editingProfileOnly
      ? editingSkillTags.filter((t) => !isBaseExclusion(t))
      : editingSkillTags,
  );

  let allSuggestions = $derived.by(() => {
    // Suggest from the stored tags, not the displayed chips: a version already
    // decided in either form (include or exclude) shouldn't be offered again.
    const used = new Set(editingSkillTags.map(tagSlug));
    const all = [...builtinTags, ...versionSlugs.filter((v) => !builtinTags.includes(v.toLowerCase()))];
    return all.filter((s) => !used.has(s.toLowerCase()));
  });

  function toggleProfileOnly() {
    if (editingIndex === null) return;
    const next = setProfileOnly(editingSkillTags, !editingProfileOnly);
    skills[editingIndex].tags = next.length > 0 ? next : null;
  }

  /** Version tags worth badging on the pill — the switch covers the rest. */
  function versionTagCount(tags: string[] | null | undefined): number {
    if (!Array.isArray(tags)) return 0;
    return isProfileOnly(tags)
      ? tags.filter((t) => !isBaseExclusion(t)).length
      : tags.length;
  }

  function addSkillTag(tag: string) {
    if (editingIndex === null) return;
    const trimmed = tag.trim();
    if (!trimmed) return;
    const slug = tagSlug(trimmed);
    const current = skills[editingIndex].tags ?? [];
    // Skip if this version is already tagged in either include or exclude form.
    if (current.some((t) => tagSlug(t) === slug)) return;
    skills[editingIndex].tags = [...current, trimmed];
  }

  function removeSkillTag(tag: string) {
    if (editingIndex === null) return;
    skills[editingIndex].tags = (skills[editingIndex].tags ?? []).filter((t) => t !== tag);
    if (skills[editingIndex].tags!.length === 0) skills[editingIndex].tags = null;
  }

  interface DndSkillItem extends SkillItem {
    _dndId: string;
    [key: string]: unknown;
  }

  let dndItems = $derived<DndSkillItem[]>(
    skills.map((s, i) => ({
      ...s,
      _dndId: (s as unknown as Record<string, unknown>).id
        ? String((s as unknown as Record<string, unknown>).id)
        : `new-${i}`,
    })),
  );

  // Reactive wrapper for dndzone (needs id field)
  let dndWrapped = $state<
    { id: string; skill: SkillItem; index: number }[]
  >(
    [],
  );
  $effect(() => {
    dndWrapped = dndItems.map((s, i) => ({
      id: s._dndId,
      skill: s,
      index: i,
    }));
  });

  const flipDurationMs = 150;

  function handleDndConsider(
    e: CustomEvent<{ items: typeof dndWrapped }>,
  ) {
    dndWrapped = e.detail.items;
  }

  function handleDndFinalize(
    e: CustomEvent<{ items: typeof dndWrapped }>,
  ) {
    dndWrapped = e.detail.items;
    // Map back to skills array (don't save yet — wait for confirm)
    skills = dndWrapped.map((w) => w.skill);
  }

  function getLevelLabel(value: string): string {
    return levelOptions.find((o) => o.value === value)?.label || value;
  }

  const levelColors: Record<string, string> = {
    expert: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    proficient: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    intermediate: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    beginner: "bg-gray-500/15 text-gray-600 border-gray-500/30",
  };

  // Track whether we pushed a history entry for the current popup
  let historyPushed = $state(false);

  function pushEditHistory() {
    history.pushState({ skillEdit: true }, "");
    historyPushed = true;
  }

  function popEditHistory() {
    if (historyPushed) {
      historyPushed = false;
      history.back();
    }
  }

  function handlePopState(e: PopStateEvent) {
    if (editingIndex !== null) {
      historyPushed = false; // Already popped by the browser
      confirmEditing();
    }
  }

  $effect(() => {
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  });

  function startEditing(index: number) {
    if (reorderMode) return;
    editingSnapshot = { ...skills[index], tags: skills[index].tags ? [...skills[index].tags] : null };
    editingIsNew = false;
    editingIndex = index;
    // Auto-expand only for tags the section actually lists — a profile-only
    // skill's exclusion pair lives on the switch, not in here.
    showVersionTags_popup = versionTagCount(skills[index].tags) > 0;
    pushEditHistory();
  }

  function addSkill() {
    skills = [...skills, { name: "" }];
    editingIndex = skills.length - 1;
    editingSnapshot = null;
    editingIsNew = true;
    showVersionTags_popup = false;
    pushEditHistory();
  }

  function confirmEditing() {
    if (editingIndex === null) return;
    const s = skills[editingIndex];
    if (!s.name.trim()) {
      skills = skills.filter((_, i) => i !== editingIndex);
    } else if (editingIsNew) {
      oncreate?.(s);
    } else {
      onupdate?.(s);
    }
    editingIndex = null;
    editingSnapshot = null;
    popEditHistory();
  }

  function cancelEditing() {
    if (editingIndex === null) return;
    if (editingIsNew) {
      skills = skills.filter((_, i) => i !== editingIndex);
    } else if (editingSnapshot) {
      skills[editingIndex] = { ...editingSnapshot };
    }
    editingIndex = null;
    editingSnapshot = null;
    popEditHistory();
  }

  function removeSkill(index: number) {
    if (!confirm("Remove this skill?")) return;
    const removed = skills[index];
    skills = skills.filter((_, i) => i !== index);
    if (editingIndex === index) {
      editingIndex = null;
      popEditHistory();
    }
    onremove?.(removed);
  }

</script>

<!-- Legend bar -->
<div class="flex items-center gap-1.5 mb-2">
  {#if showLevelToggle}
    <button
      type="button"
      onclick={() => (showLevel = !showLevel)}
      class="
        inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border transition-colors {showLevel
        ? 'bg-blue-500/15 text-blue-700 border-blue-500/30'
        : 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)] border-[var(--dash-border)]'}
      "
    >
      <span class="inline-block w-1.5 h-1.5 rounded-full transition-colors {showLevel ? 'bg-blue-500' : 'bg-[var(--dash-text-muted)]/30'}"></span>
      Level
    </button>
  {/if}
  {#if showExperienceToggle}
    <button
      type="button"
      onclick={() => (showExperience = !showExperience)}
      class="
        inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border transition-colors {showExperience
        ? 'bg-purple-500/15 text-purple-700 border-purple-500/30'
        : 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)] border-[var(--dash-border)]'}
      "
    >
      <span class="inline-block w-1.5 h-1.5 rounded-full transition-colors {showExperience ? 'bg-purple-500' : 'bg-[var(--dash-text-muted)]/30'}"></span>
      Experience
    </button>
  {/if}
  {#if showVersionTagsToggle}
    <button
      type="button"
      onclick={() => (showVersionTags = !showVersionTags)}
      class="
        inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border transition-colors {showVersionTags
        ? 'bg-teal-500/15 text-teal-700 border-teal-500/30'
        : 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)] border-[var(--dash-border)]'}
      "
    >
      <span class="inline-block w-1.5 h-1.5 rounded-full transition-colors {showVersionTags ? 'bg-teal-500' : 'bg-[var(--dash-text-muted)]/30'}"></span>
      Versions
    </button>
  {/if}
  {#if skills.length > 1}
    <button
      type="button"
      onclick={() => {
        if (!reorderMode) {
          if (editingIndex !== null) confirmEditing();
          reorderSnapshot = skills.map((s) => ({ ...s }));
          reorderMode = true;
        } else {
          // Clicking the toggle again = cancel all reordering
          reorderMode = false;
        }
      }}
      class="
        inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border transition-colors {reorderMode
        ? 'bg-amber-500/15 text-amber-700 border-amber-500/30'
        : 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)] border-[var(--dash-border)]'}
      "
    >
      <span class="inline-block w-1.5 h-1.5 rounded-full transition-colors {reorderMode ? 'bg-amber-500' : 'bg-[var(--dash-text-muted)]/30'}"></span>
      Reorder
    </button>
  {/if}
</div>

{#if reorderMode}
  <div
    class="flex flex-wrap gap-2"
    use:dndzone={{ items: dndWrapped, flipDurationMs, type: "skills" }}
    onconsider={handleDndConsider}
    onfinalize={handleDndFinalize}
  >
    {#each dndWrapped as item (item.id)}
      {@const profileOnly = isProfileOnly(item.skill.tags)}
      <div animate:flip={{ duration: flipDurationMs }}>
        <div
          class="
            flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--dash-primary)]/5 border border-[var(--dash-primary)]/20 rounded-lg text-sm cursor-grab active:cursor-grabbing {profileOnly
            ? 'opacity-60'
            : ''}
          "
        >
          <FontAwesomeIcon
            icon={faGripVertical}
            class="w-3 h-3 text-[var(--dash-text-muted)]"
          />
          <span class="text-[var(--dash-text)]">{
            item.skill.name || "new skill"
          }</span>
          {#if profileOnly}
            <span title="Profile-only — counts for matching, not shown on documents">
              <FontAwesomeIcon icon={faEyeSlash} class="w-2.5 h-2.5 text-[var(--dash-text-muted)]" />
            </span>
          {/if}
          {#if showLevel && item.skill.level}
            <span
              class="
                px-1.5 py-0.5 text-[10px] font-medium rounded border {levelColors[
                item.skill.level
                ]}
              "
            >{getLevelLabel(item.skill.level)}</span>
          {/if}
          {#if showExperience && item.skill.yearsExperience}
            <span
              class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-500/15 text-purple-600 border border-purple-500/30"
            >{item.skill.yearsExperience}y</span>
          {/if}
          {#if showVersionTags && versionTagCount(item.skill.tags) > 0}
            <span
              class="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-teal-500/15 text-teal-600 border border-teal-500/30"
              title={item.skill.tags!.join(", ")}
            ><FontAwesomeIcon icon={faTags} class="w-2 h-2" /> {versionTagCount(item.skill.tags)}</span>
          {/if}
        </div>
      </div>
    {/each}
  </div>
  <div class="flex items-center justify-end gap-2 mt-2">
    <span class="text-xs text-[var(--dash-text-muted)]">Reorder Skills</span>
    <button
      type="button"
      onclick={() => {
        if (reorderSnapshot) skills = reorderSnapshot;
        reorderSnapshot = null;
        reorderMode = false;
      }}
      class="px-3 py-1 border border-[var(--dash-border)] text-[var(--dash-text)] rounded-lg hover:bg-[var(--dash-bg)] transition-colors text-xs"
    >
      Cancel
    </button>
    <button
      type="button"
      onclick={() => {
        reorderSaving = true;
        onreorder?.(skills);
        reorderSnapshot = null;
        reorderSaving = false;
      }}
      disabled={reorderSaving}
      class="px-3 py-1 bg-[var(--dash-success)] text-white rounded-lg hover:opacity-90 transition-colors text-xs inline-flex items-center gap-1.5 disabled:opacity-70"
    >
      {#if reorderSaving}<FontAwesomeIcon icon={faCircleNotch} spin class="w-3 h-3" />{/if}
      Save
    </button>
  </div>
{:else}
  <div class="flex flex-wrap gap-2">
    {#each skills as skill, index}
      {@const profileOnly = isProfileOnly(skill.tags)}
      <div class="relative">
        <button
          type="button"
          onclick={() => startEditing(index)}
          class="
            flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--dash-primary)]/5 border border-[var(--dash-primary)]/20 rounded-lg text-sm hover:border-[var(--dash-primary)]/40 transition-colors {profileOnly
            ? 'opacity-60'
            : ''}
          "
        >
          <span class="text-[var(--dash-text)]">{
            skill.name || "new skill"
          }</span>
          {#if profileOnly}
            <span title="Profile-only — counts for matching, not shown on documents">
              <FontAwesomeIcon icon={faEyeSlash} class="w-2.5 h-2.5 text-[var(--dash-text-muted)]" />
            </span>
          {/if}
          {#if showLevel && skill.level}
            <span
              class="
                px-1.5 py-0.5 text-[10px] font-medium rounded border {levelColors[
                skill.level
                ]}
              "
            >{getLevelLabel(skill.level)}</span>
          {/if}
          {#if showExperience && skill.yearsExperience}
            <span
              class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-500/15 text-purple-600 border border-purple-500/30"
            >{skill.yearsExperience}y</span>
          {/if}
          {#if showVersionTags && versionTagCount(skill.tags) > 0}
            <span
              class="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-teal-500/15 text-teal-600 border border-teal-500/30"
              title={skill.tags!.join(", ")}
            ><FontAwesomeIcon icon={faTags} class="w-2 h-2" /> {versionTagCount(skill.tags)}</span>
          {/if}
        </button>

        {#if editingIndex === index}
          <!-- Mobile backdrop -->
          <div class="fixed inset-0 bg-black/30 z-40 sm:hidden"></div>
          <div
            use:clickOutside={confirmEditing}
            use:keepInView
            class="absolute top-full left-0 mt-1 z-50 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg shadow-lg p-3 space-y-2 w-64"
          >
            <div>
              <label
                class="block text-[10px] uppercase tracking-wide text-[var(--dash-text-muted)] mb-1"
              >Name</label>
              <input
                type="text"
                bind:value={skills[index].name}
                placeholder="Skill name"
                class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--dash-primary)] bg-transparent text-[var(--dash-text)]"
                onkeydown={(e) => {
                  if (e.key === "Enter") confirmEditing();
                  if (e.key === "Escape") cancelEditing();
                }}
              />
            </div>
            <div>
              <label
                class="block text-[10px] uppercase tracking-wide text-[var(--dash-text-muted)] mb-1"
              >Level</label>
              <select
                bind:value={skills[index].level}
                class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-transparent text-[var(--dash-text)] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--dash-primary)]"
              >
                <option value={undefined}>--</option>
                {#each levelOptions as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            </div>
            <div>
              <label
                class="block text-[10px] uppercase tracking-wide text-[var(--dash-text-muted)] mb-1"
              >Years of experience</label>
              <input
                type="number"
                bind:value={skills[index].yearsExperience}
                placeholder="-"
                min="0"
                max="50"
                class="w-full px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded bg-transparent text-[var(--dash-text)] focus:outline-none focus:ring-1 focus:ring-[var(--dash-primary)]"
              />
            </div>
            <!-- Document visibility. Matching always uses every skill; this
                 only controls whether the skill prints on a resume/CV. -->
            <div>
              <button
                type="button"
                onclick={() => toggleProfileOnly()}
                aria-pressed={!editingProfileOnly}
                class="w-full flex items-center justify-between gap-2 text-left"
              >
                <span class="text-[10px] uppercase tracking-wide text-[var(--dash-text-muted)]">
                  Show on CV
                </span>
                <span
                  class="
                    relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors {editingProfileOnly
                    ? 'bg-[var(--dash-border)]'
                    : 'bg-emerald-500'}
                  "
                >
                  <span
                    class="
                      absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all {editingProfileOnly
                      ? 'left-0.5'
                      : 'left-3.5'}
                    "
                  ></span>
                </span>
              </button>
              <p class="text-[10px] text-[var(--dash-text-muted)] mt-0.5 leading-snug">
                {#if editingProfileOnly}
                  Profile-only: counts for job matching, stays off your resume /
                  CV.
                {:else}
                  Shown on your resume / CV, and counts for job matching.
                {/if}
              </p>
            </div>

            <!-- Version Tags (collapsible) -->
            {#if versionSlugs.length > 0}
              <div>
                <button
                  type="button"
                  onclick={() => (showVersionTags_popup = !showVersionTags_popup)}
                  class="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)] transition-colors mb-1"
                >
                  <FontAwesomeIcon icon={showVersionTags_popup ? faChevronDown : faChevronRight} class="w-2 h-2" />
                  <FontAwesomeIcon icon={faTags} class="w-2.5 h-2.5" />
                  Resume / CV Versions
                  {#if !showVersionTags_popup && editingTags.length > 0}
                    <span class="normal-case text-[var(--dash-primary)]">({editingTags.length})</span>
                  {/if}
                </button>
                {#if showVersionTags_popup}
                  {#if editingTags.length > 0}
                    <div class="flex flex-wrap gap-1.5 mb-1.5">
                      {#each editingTags as tag}
                        {@const isNeg = tag.startsWith("!")}
                        <button
                          type="button"
                          onclick={() => removeSkillTag(tag)}
                          class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors cursor-pointer border hover:bg-red-500/15 hover:text-red-500 hover:border-red-500/30 {isNeg
                            ? 'bg-red-500/10 text-red-600 border-red-500/25'
                            : 'bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] border-[var(--dash-primary)]/20'}"
                        >
                          {#if isNeg}
                            <FontAwesomeIcon icon={faBan} class="w-2.5 h-2.5" />
                          {/if}
                          {isNeg ? tag.slice(1) : tag}
                          <FontAwesomeIcon icon={faTimes} class="w-2.5 h-2.5" />
                        </button>
                      {/each}
                    </div>
                  {:else}
                    <p class="text-[10px] text-[var(--dash-text-muted)] italic mb-1.5">
                      {editingProfileOnly ? "No document" : "All versions"}
                    </p>
                  {/if}
                  {#if allSuggestions.length > 0}
                    <p class="text-[10px] uppercase tracking-wide text-[var(--dash-text-muted)] mb-1">
                      {editingProfileOnly ? "Show anyway on" : "Show only on"}
                    </p>
                    <div class="flex flex-wrap gap-1.5 mb-2">
                      {#each allSuggestions as suggestion}
                        <button
                          type="button"
                          onclick={() => addSkillTag(suggestion)}
                          class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] border border-[var(--dash-border)] hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary)] transition-colors"
                        >
                          <FontAwesomeIcon icon={faPlus} class="w-2.5 h-2.5" />
                          {suggestion}
                        </button>
                      {/each}
                    </div>
                    <p class="text-[10px] uppercase tracking-wide text-[var(--dash-text-muted)] mb-1">Exclude from</p>
                    <div class="flex flex-wrap gap-1.5">
                      {#each allSuggestions as suggestion}
                        <button
                          type="button"
                          onclick={() => addSkillTag("!" + suggestion)}
                          class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] border border-[var(--dash-border)] hover:border-red-500/40 hover:text-red-500 transition-colors"
                        >
                          <FontAwesomeIcon icon={faBan} class="w-2.5 h-2.5" />
                          {suggestion}
                        </button>
                      {/each}
                    </div>
                  {/if}
                {/if}
              </div>
            {/if}

            <div class="flex items-center justify-between pt-1">
              <button
                type="button"
                onclick={() => removeSkill(index)}
                class="mr-2 px-3 py-1.5 text-xs bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-600 transition-colors flex items-center gap-1.5"
                aria-label="Delete skill"
              >
                <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
                Delete
              </button>
              <div class="flex gap-1.5">
                <button
                  type="button"
                  onclick={() => cancelEditing()}
                  class="px-3 py-1.5 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)] hover:border-[var(--dash-text-muted)] transition-colors flex items-center gap-1.5"
                  aria-label="Cancel"
                >
                  <FontAwesomeIcon icon={faXmark} class="w-3 h-3" />
                  Cancel
                </button>
                <button
                  type="button"
                  onclick={() => confirmEditing()}
                  class="px-3 py-1.5 text-xs bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-600 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-700 transition-colors flex items-center gap-1.5"
                  aria-label="Confirm"
                >
                  <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                  Save
                </button>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/each}
    <button
      type="button"
      onclick={() => addSkill()}
      class="flex items-center gap-1 px-3 py-1 border border-dashed border-[var(--dash-border)] rounded-lg text-sm text-[var(--dash-primary)] hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary-hover)] transition-colors"
    >
      <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
      Add
    </button>
  </div>
{/if}
