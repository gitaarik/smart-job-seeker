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
import InfoBoxes from "../components/InfoBoxes.svelte";
import TechTag from "../components/TechTag.svelte";

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

        {#if project.url || project.repo_url}
          <div class="flex flex-wrap items-center gap-3 justify-start mt-6">
            {#if project.url}
              {@const { isGithub, displayLabel } = formatProjectUrl(project.url)}
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

                {#if project.stars && isGithub && !project.repo_url}
                  <span
                    class="flex items-center gap-1 ml-2 pl-2 border-l border-white/30"
                  >
                    <FontAwesomeIcon
                      icon={faStar}
                      class="text-yellow-500"
                    />
                    <span>{project.stars}</span>
                  </span>
                {/if}
              </a>
            {/if}

            {#if project.repo_url}
              {@const repo = formatProjectUrl(project.repo_url)}
              <a
                href={project.repo_url}
                target="_blank"
                class="inline-flex items-center gap-2 px-5 py-3 border border-ocean text-ocean rounded-lg hover:bg-ocean/10 transition-all"
              >
                <FontAwesomeIcon icon={faGithub} size="lg" />

                <span class="font-medium nowrap">
                  {repo.displayLabel}
                </span>

                {#if project.stars}
                  <span
                    class="flex items-center gap-1 ml-2 pl-2 border-l border-ocean/30"
                  >
                    <FontAwesomeIcon
                      icon={faStar}
                      class="text-yellow-500"
                    />
                    <span>{project.stars}</span>
                  </span>
                {/if}
              </a>
            {/if}
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
