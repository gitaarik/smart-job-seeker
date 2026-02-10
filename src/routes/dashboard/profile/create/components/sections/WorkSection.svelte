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

<div class="border border-light rounded-lg overflow-hidden">
  <button
    type="button"
    onclick={() => (isExpanded = !isExpanded)}
    class="w-full flex items-center justify-between p-4 bg-snow hover:bg-light/30 transition-colors"
  >
    <div class="flex items-center gap-3">
      <div
        class="w-8 h-8 rounded-full bg-ocean/10 flex items-center justify-center"
      >
        <FontAwesomeIcon icon={faBriefcase} class="w-4 h-4 text-ocean" />
      </div>
      <span class="font-medium text-slate">Work Experience</span>
      <span class="text-sm text-pearl">({work.length})</span>
    </div>
    <FontAwesomeIcon
      icon={isExpanded ? faChevronUp : faChevronDown}
      class="w-4 h-4 text-pearl"
    />
  </button>

  {#if isExpanded}
    <div class="border-t border-light divide-y divide-light">
      {#each work as job, index}
        <div class="bg-snow">
          <div
            class="flex items-center justify-between p-4 hover:bg-light/30 transition-colors"
          >
            <button
              type="button"
              onclick={() => toggleItem(index)}
              class="flex-1 text-left"
            >
              <div class="font-medium text-slate">
                {job.position || "Position"}
              </div>
              <div class="text-sm text-pearl">{job.name || "Company"}</div>
            </button>
            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick={() => removeItem(index)}
                class="p-1 rounded hover:bg-red-50 text-pearl hover:text-crimson transition-colors"
                aria-label="Remove"
              >
                <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
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
                  class="w-4 h-4 text-pearl"
                />
              </button>
            </div>
          </div>

          {#if expandedItems.has(index)}
            <div class="px-4 pb-4 space-y-4">
              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <label class="block text-sm font-medium text-slate mb-1">
                    Position
                  </label>
                  <input
                    type="text"
                    bind:value={work[index].position}
                    class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-slate mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    bind:value={work[index].name}
                    class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
                  />
                </div>
              </div>

              <div class="grid gap-4 md:grid-cols-3">
                <div>
                  <label class="block text-sm font-medium text-slate mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    bind:value={work[index].location}
                    class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-slate mb-1">
                    Start Date
                  </label>
                  <input
                    type="text"
                    bind:value={work[index].startDate}
                    placeholder="YYYY-MM-DD"
                    class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-slate mb-1">
                    End Date
                  </label>
                  <input
                    type="text"
                    bind:value={work[index].endDate}
                    placeholder="YYYY-MM-DD or Present"
                    class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
                  />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-slate mb-1">
                  Summary
                </label>
                <textarea
                  bind:value={work[index].summary}
                  rows="2"
                  class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate resize-none"
                ></textarea>
              </div>

              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="block text-sm font-medium text-slate">
                    Achievements
                  </label>
                  <button
                    type="button"
                    onclick={() => addAchievement(index)}
                    class="text-sm text-ocean hover:text-aqua flex items-center gap-1"
                  >
                    <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
                    Add
                  </button>
                </div>
                <div class="space-y-2">
                  {#each work[index].achievements || [] as _, achievementIndex}
                    <div class="flex gap-2">
                      <input
                        type="text"
                        bind:value={work[index].achievements![achievementIndex]}
                        class="flex-1 px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
                      />
                      <button
                        type="button"
                        onclick={() =>
                          removeAchievement(index, achievementIndex)}
                        class="p-2 text-pearl hover:text-crimson transition-colors"
                        aria-label="Remove achievement"
                      >
                        <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
                      </button>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
