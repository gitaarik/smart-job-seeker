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
  import { formatProjectUrl } from "$lib/tools/url-utils";
  import InfoBoxes from "./InfoBoxes.svelte";
  import TechTag from "./TechTag.svelte";

  let props = $props();
  const profile = props.profile;
</script>

<InfoSection title="Side Projects" icon={faCode}>
  <div>
    {#each profile.side_projects as project, index (project.name)}
      <div class="break-inside-avoid {index === 0 ? 'mt-10' : ''}">
        <header class="mb-4">
          <h3 class="text-2xl font-semibold text-ocean">
            {project.name}
          </h3>
        </header>

        <p class="leading-relaxed print:text-sm">{project.summary}</p>

        {#if project.url}
          {@const { isGithub, displayLabel } = formatProjectUrl(
            project.url,
            project.url_label,
          )}
          <div class="flex justify-start mt-6">
            <a
              href={project.url}
              target="_blank"
              class="inline-flex items-center gap-2 px-5 py-3 bg-ocean text-white rounded-lg hover:bg-ocean/85 transition-all"
            >
              <FontAwesomeIcon
                icon={isGithub ? faGithub : faExternalLinkAlt}
                size="lg"
              />

              <span class="font-medium nowrap">
                {displayLabel}
              </span>

              {#if project.stars && isGithub}
                <span
                  class="flex items-center gap-1 ml-2 pl-2 border-l border-white/30"
                >
                  <FontAwesomeIcon
                    icon={faStar}
                    size="md"
                    class="text-yellow-500"
                  />
                  <span>{project.stars}</span>
                </span>
              {/if}
            </a>
          </div>
        {/if}

        {#if project.side_project_achievements.length}
          <h4 class="text-lg font-semibold mt-6 mb-3">
            Highlights:
          </h4>
          <InfoBoxes items={project.side_project_achievements} />
        {/if}

        {#if project.side_project_technologies.length}
          <div class="mt-4">
            <h4 class="text-lg print:text-base font-semibold mb-3 print:mb-2">
              Technologies Used:
            </h4>
            <ul class="flex flex-wrap gap-2 print:gap-[5px]">
              {#each project.side_project_technologies as tech (tech.name)}
                <TechTag tech={tech.name} />
              {/each}
            </ul>
          </div>
        {/if}
      </div>

      {#if index < profile.side_projects.length - 1}
        <hr class="border-cloud my-12" />
      {/if}
    {/each}
  </div>
</InfoSection>
