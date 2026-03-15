<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faChevronDown,
    faChevronUp,
    faGraduationCap,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import type { Education } from "$lib/server/resume/types";

  interface Props {
    education: Education[];
  }

  let { education = $bindable() }: Props = $props();

  let isExpanded = $state(false);
  let expandedItems = $state<Set<number>>(new Set());

  function toggleItem(index: number) {
    if (expandedItems.has(index)) {
      expandedItems.delete(index);
    } else {
      expandedItems.add(index);
    }
    expandedItems = new Set(expandedItems);
  }

  function removeItem(index: number) {
    education = education.filter((_, i) => i !== index);
  }
</script>

<div
  class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden"
>
  <button
    type="button"
    onclick={() => (isExpanded = !isExpanded)}
    class="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-[var(--dash-bg)] transition-colors"
  >
    <div class="flex items-center gap-3">
      <div
        class="w-10 h-10 rounded-lg bg-[var(--dash-primary)]/10 flex items-center justify-center"
      >
        <FontAwesomeIcon
          icon={faGraduationCap}
          class="w-5 h-5 text-[var(--dash-primary)]"
        />
      </div>
      <span class="font-semibold text-base text-[var(--dash-text)]">Education</span>
      <span class="text-sm text-[var(--dash-text-secondary)]"
        >({education.length})</span
      >
    </div>
    <FontAwesomeIcon
      icon={isExpanded ? faChevronUp : faChevronDown}
      class="w-4 h-4 text-[var(--dash-text-muted)]"
    />
  </button>

  {#if isExpanded}
    <div
      class="border-t border-[var(--dash-border)] divide-y divide-[var(--dash-border)]"
    >
      {#each education as edu, index}
        <div
          class={expandedItems.has(index)
            ? "border-l-2 border-l-[var(--dash-primary)]"
            : ""}
        >
          <div
            class="flex items-center justify-between p-3 sm:p-4 hover:bg-[var(--dash-bg)] transition-colors"
          >
            <button
              type="button"
              onclick={() => toggleItem(index)}
              class="flex-1 text-left"
            >
              <div class="font-semibold text-[var(--dash-text)] text-sm">
                {edu.studyType || "Degree"}
                {edu.area ? `in ${edu.area}` : ""}
              </div>
              <div class="text-xs sm:text-sm text-[var(--dash-text-secondary)]">
                {edu.institution || "Institution"}
                {#if edu.startDate || edu.endDate}
                  <span class="text-[var(--dash-text-muted)]">
                    &middot; {edu.startDate || "?"} – {edu.endDate || "Present"}
                  </span>
                {/if}
              </div>
            </button>
            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick={() => removeItem(index)}
                class="px-3 py-1.5 text-xs bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 transition-colors flex items-center gap-1.5"
                aria-label="Remove"
              >
                <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
                <span class="hidden sm:inline">Remove</span>
              </button>
              <button
                type="button"
                onclick={() => toggleItem(index)}
                class="p-1"
                aria-label={expandedItems.has(index) ? "Collapse" : "Expand"}
              >
                <FontAwesomeIcon
                  icon={expandedItems.has(index)
                    ? faChevronUp
                    : faChevronDown}
                  class="w-4 h-4 text-[var(--dash-text-muted)]"
                />
              </button>
            </div>
          </div>

          {#if expandedItems.has(index)}
            <div class="px-3 sm:px-4 pb-4 space-y-4">
              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                  >
                    Institution
                  </label>
                  <input
                    type="text"
                    bind:value={education[index].institution}
                    class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  />
                </div>

                <div>
                  <label
                    class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                  >
                    Degree Type
                  </label>
                  <input
                    type="text"
                    bind:value={education[index].studyType}
                    placeholder="Bachelor's, Master's, etc."
                    class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  />
                </div>
              </div>

              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                  >
                    Field of Study
                  </label>
                  <input
                    type="text"
                    bind:value={education[index].area}
                    class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  />
                </div>

                <div>
                  <label
                    class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                  >
                    Location
                  </label>
                  <input
                    type="text"
                    bind:value={education[index].location}
                    class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  />
                </div>
              </div>

              <div class="grid gap-4 md:grid-cols-3">
                <div>
                  <label
                    class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                  >
                    Start Date
                  </label>
                  <input
                    type="text"
                    bind:value={education[index].startDate}
                    placeholder="YYYY-MM-DD"
                    class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  />
                </div>

                <div>
                  <label
                    class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                  >
                    End Date
                  </label>
                  <input
                    type="text"
                    bind:value={education[index].endDate}
                    placeholder="YYYY-MM-DD"
                    class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  />
                </div>

                <div>
                  <label
                    class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                  >
                    Graduation Year
                  </label>
                  <input
                    type="number"
                    bind:value={education[index].graduationYear}
                    class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
