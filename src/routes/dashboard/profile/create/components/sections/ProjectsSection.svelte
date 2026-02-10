<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faChevronDown,
    faChevronUp,
    faLaptopCode,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import type { SideProject } from "$lib/server/resume/types";

  interface Props {
    projects: SideProject[];
  }

  let { projects = $bindable() }: Props = $props();

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
    projects = projects.filter((_, i) => i !== index);
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
        <FontAwesomeIcon icon={faLaptopCode} class="w-4 h-4 text-ocean" />
      </div>
      <span class="font-medium text-slate">Projects</span>
      <span class="text-sm text-pearl">({projects.length})</span>
    </div>
    <FontAwesomeIcon
      icon={isExpanded ? faChevronUp : faChevronDown}
      class="w-4 h-4 text-pearl"
    />
  </button>

  {#if isExpanded}
    <div class="border-t border-light divide-y divide-light">
      {#each projects as project, index}
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
                {project.name || "Project"}
              </div>
              {#if project.url}
                <div class="text-sm text-pearl truncate max-w-xs">
                  {project.url}
                </div>
              {/if}
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
                    Project Name
                  </label>
                  <input
                    type="text"
                    bind:value={projects[index].name}
                    class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-slate mb-1">
                    URL
                  </label>
                  <input
                    type="url"
                    bind:value={projects[index].url}
                    class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
                  />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-slate mb-1">
                  Summary
                </label>
                <textarea
                  bind:value={projects[index].summary}
                  rows="2"
                  class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate resize-none"
                ></textarea>
              </div>

              {#if           projects[index].technologies &&
            projects[index].technologies.length > 0}
                <div>
                  <label class="block text-sm font-medium text-slate mb-2">
                    Technologies
                  </label>
                  <div class="flex flex-wrap gap-2">
                    {#each projects[index].technologies || [] as tech}
                      <span
                        class="px-2 py-1 bg-ocean/10 rounded text-sm text-slate"
                      >
                        {tech}
                      </span>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
