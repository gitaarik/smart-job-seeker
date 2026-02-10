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
        <FontAwesomeIcon icon={faGraduationCap} class="w-4 h-4 text-ocean" />
      </div>
      <span class="font-medium text-slate">Education</span>
      <span class="text-sm text-pearl">({education.length})</span>
    </div>
    <FontAwesomeIcon
      icon={isExpanded ? faChevronUp : faChevronDown}
      class="w-4 h-4 text-pearl"
    />
  </button>

  {#if isExpanded}
    <div class="border-t border-light divide-y divide-light">
      {#each education as edu, index}
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
                {edu.studyType || "Degree"} {edu.area ? `in ${edu.area}` : ""}
              </div>
              <div class="text-sm text-pearl">
                {edu.institution || "Institution"}
              </div>
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
                    Institution
                  </label>
                  <input
                    type="text"
                    bind:value={education[index].institution}
                    class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-slate mb-1">
                    Degree Type
                  </label>
                  <input
                    type="text"
                    bind:value={education[index].studyType}
                    placeholder="Bachelor's, Master's, etc."
                    class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
                  />
                </div>
              </div>

              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <label class="block text-sm font-medium text-slate mb-1">
                    Field of Study
                  </label>
                  <input
                    type="text"
                    bind:value={education[index].area}
                    class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-slate mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    bind:value={education[index].location}
                    class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
                  />
                </div>
              </div>

              <div class="grid gap-4 md:grid-cols-3">
                <div>
                  <label class="block text-sm font-medium text-slate mb-1">
                    Start Date
                  </label>
                  <input
                    type="text"
                    bind:value={education[index].startDate}
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
                    bind:value={education[index].endDate}
                    placeholder="YYYY-MM-DD"
                    class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-slate mb-1">
                    Graduation Year
                  </label>
                  <input
                    type="number"
                    bind:value={education[index].graduationYear}
                    class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
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
