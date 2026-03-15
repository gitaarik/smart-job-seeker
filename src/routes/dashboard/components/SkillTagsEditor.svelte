<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faPlus,
    faTrash,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";

  export interface SkillItem {
    name: string;
    level?: string;
    yearsExperience?: number;
  }

  interface Props {
    skills: SkillItem[];
    onupdate?: (skill: SkillItem) => void;
    oncreate?: (skill: SkillItem) => void;
    onremove?: (skill: SkillItem) => void;
  }

  let { skills = $bindable(), onupdate, oncreate, onremove }: Props =
    $props();

  let editingIndex = $state<number | null>(null);
  let editingSnapshot = $state<SkillItem | null>(null);
  let editingIsNew = $state(false);

  const levels = ["expert", "proficient", "intermediate", "beginner"];

  const levelColors: Record<string, string> = {
    expert: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    proficient: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    intermediate: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    beginner: "bg-gray-500/15 text-gray-600 border-gray-500/30",
  };

  function startEditing(index: number) {
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

<div class="flex flex-wrap gap-2">
  {#each skills as skill, index}
    <div class="relative">
      <button
        type="button"
        onclick={() => startEditing(index)}
        class="flex items-center gap-1.5 px-3 py-1 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-sm hover:border-[var(--dash-primary)]/40 transition-colors cursor-pointer"
      >
        <span class="text-[var(--dash-text)]">{skill.name || "new skill"}</span>
        {#if skill.level}
          <span
            class="
              px-1.5 py-0.5 text-[10px] font-medium rounded border {levelColors[
              skill.level
              ]}
            "
          >{skill.level}</span>
        {/if}
        {#if skill.yearsExperience}
          <span
            class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-500/15 text-purple-700 border border-purple-500/30"
          >{skill.yearsExperience}y</span>
        {/if}
      </button>

      {#if editingIndex === index}
        <div
          use:clickOutside
          class="absolute top-full left-0 mt-1 z-10 bg-[var(--dash-surface,#fff)] border border-[var(--dash-border)] rounded-lg shadow-lg p-3 space-y-2 w-56"
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
              {#each levels as lvl}
                <option value={lvl}>{lvl}</option>
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
