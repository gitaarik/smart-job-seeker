<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBriefcase,
    faChevronDown,
    faChevronUp,
    faPlus,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import type { WorkExperience } from "$lib/server/resume/types";
  import Card from "../../../../components/Card.svelte";

  interface Props {
    work: WorkExperience[];
  }

  let { work = $bindable() }: Props = $props();

  let isExpanded = $state(true);
  let expandedItems = $state<Set<number>>(new Set([0]));

  function toggleItem(index: number) {
    if (expandedItems.has(index)) {
      expandedItems.delete(index);
    } else {
      expandedItems.add(index);
    }
    expandedItems = new Set(expandedItems);
  }

  function removeItem(index: number) {
    if (!confirm("Remove this work experience?")) return;
    work = work.filter((_, i) => i !== index);
  }

  function removeAchievement(workIndex: number, achievementIndex: number) {
    if (work[workIndex].achievements) {
      work[workIndex].achievements = work[workIndex].achievements!.filter(
        (_, i) => i !== achievementIndex,
      );
    }
  }

  function addAchievement(workIndex: number) {
    if (!work[workIndex].achievements) {
      work[workIndex].achievements = [];
    }
    work[workIndex].achievements = [...work[workIndex].achievements!, ""];
  }
</script>

<Card class="overflow-hidden">
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
          icon={faBriefcase}
          class="w-5 h-5 text-[var(--dash-primary)]"
        />
      </div>
      <span class="font-semibold text-base text-[var(--dash-text)]">Work Experience</span>
      <span class="text-sm text-[var(--dash-text-secondary)]"
        >({work.length})</span
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
      {#each work as job, index}
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
                {job.position || "Position"}
              </div>
              <div class="text-xs sm:text-sm text-[var(--dash-text-secondary)]">
                {job.name || "Company"}
                {#if job.startDate || job.endDate}
                  <span class="text-[var(--dash-text-muted)]">
                    &middot; {job.startDate || "?"} – {job.endDate || "Present"}
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
                    Position
                  </label>
                  <input
                    type="text"
                    bind:value={work[index].position}
                    class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  />
                </div>

                <div>
                  <label
                    class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                  >
                    Company
                  </label>
                  <input
                    type="text"
                    bind:value={work[index].name}
                    class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  />
                </div>
              </div>

              <div class="grid gap-4 md:grid-cols-3">
                <div>
                  <label
                    class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                  >
                    Location
                  </label>
                  <input
                    type="text"
                    bind:value={work[index].location}
                    class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  />
                </div>

                <div>
                  <label
                    class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                  >
                    Start Date
                  </label>
                  <input
                    type="text"
                    bind:value={work[index].startDate}
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
                    bind:value={work[index].endDate}
                    placeholder="YYYY-MM-DD or Present"
                    class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label
                  class="block text-sm font-medium text-[var(--dash-text)] mb-1"
                >
                  Summary
                </label>
                <textarea
                  bind:value={work[index].summary}
                  rows="3"
                  class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-none"
                ></textarea>
              </div>

              <div>
                <label
                  class="block text-sm font-medium text-[var(--dash-text)] mb-2"
                >
                  Achievements
                </label>
                <div class="space-y-2">
                  {#each work[index].achievements || [] as _, achievementIndex}
                    <div class="flex gap-2">
                      <input
                        type="text"
                        bind:value={work[index].achievements![achievementIndex]}
                        class="flex-1 px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
                      />
                      <button
                        type="button"
                        onclick={() =>
                          removeAchievement(index, achievementIndex)}
                        class="p-2 text-[var(--dash-text-muted)] hover:text-[var(--dash-error)] transition-colors"
                        aria-label="Remove achievement"
                      >
                        <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
                      </button>
                    </div>
                  {/each}
                </div>
                <button
                  type="button"
                  onclick={() => addAchievement(index)}
                  class="mt-2 text-sm text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] flex items-center gap-1"
                >
                  <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
                  Add
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</Card>
