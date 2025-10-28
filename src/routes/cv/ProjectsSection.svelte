<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faGithub } from "@fortawesome/free-brands-svg-icons";
  import {
    faCalendar,
    faCode,
    faExternalLinkAlt,
    faStar,
  } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";
  import { formatDateRangeVerbose } from "$lib/tools/date-utils";
  import InfoBoxes from "./InfoBoxes.svelte";

  let props = $props();
  const profile = props.profile;
</script>

<InfoSection title="Side Projects" icon={faCode}>
  <div>
    {#each profile.side_projects as project, index (project.name)}
      <div class="break-inside-avoid {index === 0 ? 'mt-12' : ''}">
        <header class="mb-2">
          <h3 class="text-2xl font-semibold text-ocean">
            {project.name}
          </h3>
        </header>

        <div class="space-y-4">
          <p class="leading-relaxed print:text-sm">{project.summary}</p>

          {#if project.url && project.url.includes("github.com")}
            <a
              href={project.url}
              target="_blank"
              class="inline-flex items-center gap-2 px-5 py-3 bg-ocean text-white rounded-lg hover:bg-teal transition-colors duration-200"
            >
              <FontAwesomeIcon
                icon={faGithub}
                class="w-4 h-4"
              />
              <span class="text-sm font-medium">View on GitHub</span>
              {#if project.stars}
                <span
                  class="flex items-center gap-1 ml-2 pl-2 border-l border-white/30"
                >
                  <FontAwesomeIcon
                    icon={faStar}
                    class="w-3 h-3 text-yellow-500"
                  />
                  <span class="text-sm">{project.stars}</span>
                </span>
              {/if}
            </a>
          {/if}

          {#if project.side_project_achievements.length > 0}
            <h4 class="text-lg font-semibold mb-3">
              Highlights:
            </h4>
            <InfoBoxes items={project.side_project_achievements} />
          {/if}
        </div>

        {#if project.technologies}
          <h4
            class="text-lg mt-6 font-semibold mb-3"
          >
            Technologies:
          </h4>

          {project.technologies}
        {/if}
      </div>

      {#if index < profile.side_projects.length - 1}
        <hr class="border-cloud my-12" />
      {/if}
    {/each}
  </div>
</InfoSection>
