<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faGripVertical,
    faPlus,
    faTrash,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";
  import { dndzone } from "svelte-dnd-action";
  import { flip } from "svelte/animate";

  export interface SkillItem {
    name: string;
    level?: string;
    yearsExperience?: number;
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
    onupdate?: (skill: SkillItem) => void;
    oncreate?: (skill: SkillItem) => void;
    onremove?: (skill: SkillItem) => void;
    onreorder?: (skills: SkillItem[]) => void;
  }

  let {
    skills = $bindable(),
    levelOptions = defaultLevelOptions,
    onupdate,
    oncreate,
    onremove,
    onreorder,
  }: Props = $props();

  let editingIndex = $state<number | null>(null);
  let editingSnapshot = $state<SkillItem | null>(null);
  let editingIsNew = $state(false);

  let showLevel = $state(false);
  let showExperience = $state(false);
  let reorderMode = $state(false);

  interface DndSkillItem extends SkillItem {
    _dndId: string;
    [key: string]: unknown;
  }

  let dndItems = $derived<DndSkillItem[]>(
    skills.map((s, i) => ({
      ...s,
      _dndId: (s as Record<string, unknown>).id
        ? String((s as Record<string, unknown>).id)
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
    // Map back to skills array
    skills = dndWrapped.map((w) => w.skill);
    onreorder?.(skills);
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

  function startEditing(index: number) {
    if (reorderMode) return;
    editingSnapshot = { ...skills[index] };
    editingIsNew = false;
    editingIndex = index;
  }

  function addSkill() {
    skills = [...skills, { name: "" }];
    editingIndex = skills.length - 1;
    editingSnapshot = null;
    editingIsNew = true;
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
  }

  function removeSkill(index: number) {
    if (!confirm("Remove this skill?")) return;
    const removed = skills[index];
    skills = skills.filter((_, i) => i !== index);
    if (editingIndex === index) {
      editingIndex = null;
    }
    onremove?.(removed);
  }

  function keepInView(node: HTMLElement) {
    function reposition() {
      const rect = node.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        node.style.left = "auto";
        node.style.right = "0";
      }
    }
    reposition();
    return { destroy() {} };
  }

  function clickOutside(node: HTMLElement) {
    function onClick(event: MouseEvent) {
      if (!node.contains(event.target as Node)) {
        confirmEditing();
      }
    }
    // Use setTimeout so the opening click doesn't immediately close
    const timer = setTimeout(() => {
      document.addEventListener("click", onClick, true);
    }, 0);
    return {
      destroy() {
        clearTimeout(timer);
        document.removeEventListener("click", onClick, true);
      },
    };
  }
</script>

<!-- Legend bar -->
<div class="flex items-center gap-1.5 mb-2">
  <button
    type="button"
    onclick={() => (showLevel = !showLevel)}
    class="
      px-2 py-0.5 text-[10px] font-medium rounded border transition-colors {showLevel
      ? 'bg-blue-500/15 text-blue-700 border-blue-500/30'
      : 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)] border-[var(--dash-border)]'}
    "
  >
    Level
  </button>
  <button
    type="button"
    onclick={() => (showExperience = !showExperience)}
    class="
      px-2 py-0.5 text-[10px] font-medium rounded border transition-colors {showExperience
      ? 'bg-purple-500/15 text-purple-700 border-purple-500/30'
      : 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)] border-[var(--dash-border)]'}
    "
  >
    Experience
  </button>
  <button
    type="button"
    onclick={() => {
      reorderMode = !reorderMode;
      if (reorderMode && editingIndex !== null) confirmEditing();
    }}
    class="
      px-2 py-0.5 text-[10px] font-medium rounded border transition-colors {reorderMode
      ? 'bg-amber-500/15 text-amber-700 border-amber-500/30'
      : 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)] border-[var(--dash-border)]'}
    "
  >
    Reorder
  </button>
</div>

{#if reorderMode}
  <div
    class="flex flex-wrap gap-2"
    use:dndzone={{ items: dndWrapped, flipDurationMs, type: "skills" }}
    onconsider={handleDndConsider}
    onfinalize={handleDndFinalize}
  >
    {#each dndWrapped as item (item.id)}
      <div animate:flip={{ duration: flipDurationMs }}>
        <div
          class="flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--dash-primary)]/5 border border-[var(--dash-primary)]/20 rounded-lg text-sm cursor-grab active:cursor-grabbing"
        >
          <FontAwesomeIcon
            icon={faGripVertical}
            class="w-3 h-3 text-[var(--dash-text-muted)]"
          />
          <span class="text-[var(--dash-text)]">{
            item.skill.name || "new skill"
          }</span>
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
        </div>
      </div>
    {/each}
  </div>
{:else}
  <div class="flex flex-wrap gap-2">
    {#each skills as skill, index}
      <div class="relative">
        <button
          type="button"
          onclick={() => startEditing(index)}
          class="flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--dash-primary)]/5 border border-[var(--dash-primary)]/20 rounded-lg text-sm hover:border-[var(--dash-primary)]/40 transition-colors"
        >
          <span class="text-[var(--dash-text)]">{
            skill.name || "new skill"
          }</span>
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
        </button>

        {#if editingIndex === index}
          <div
            use:clickOutside
            use:keepInView
            class="absolute top-full left-0 mt-1 z-10 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg shadow-lg p-3 space-y-2 w-56"
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
            <div class="flex items-center justify-between pt-1">
              <button
                type="button"
                onclick={() => removeSkill(index)}
                class="p-1.5 text-[var(--dash-text-muted)] hover:text-[var(--dash-error)] hover:bg-red-500/10 rounded transition-colors"
                aria-label="Delete skill"
              >
                <FontAwesomeIcon icon={faTrash} class="w-3.5 h-3.5" />
              </button>
              <div class="flex gap-1">
                <button
                  type="button"
                  onclick={() => cancelEditing()}
                  class="p-1.5 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] hover:bg-[var(--dash-bg)] rounded transition-colors"
                  aria-label="Cancel"
                >
                  <FontAwesomeIcon icon={faXmark} class="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onclick={() => confirmEditing()}
                  class="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 rounded transition-colors"
                  aria-label="Confirm"
                >
                  <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
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
