<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faGithub } from "@fortawesome/free-brands-svg-icons";
  import { faCode, faExternalLinkAlt, faStar, faCalendar } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";
  import { formatDateRangeVerbose } from "$lib/tools/date-utils";
	import InfoBoxes from "./InfoBoxes.svelte";

  let props = $props();
  const profile = props.profile;
</script>

<InfoSection title="Side Projects" icon={faCode}>
  <div>
    {#each profile.side_projects as project, index (project.name)}
      <div class="break-inside-avoid {index === 0 ? 'mt-12 print:mt-0' : ''}">
        <header class="mb-6 print:mb-4">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <h3 class="text-2xl font-semibold text-ocean mb-2">
                {project.name}
              </h3>

              <ul
                class="flex gap-8 text-sm p-0"
              >
                <li class="flex items-center">
                  <FontAwesomeIcon
                    icon={faCalendar}
                    class="mr-1 flex-shrink-0 w-3 h-3"
                  />
                  <span>{
                    formatDateRangeVerbose(
                      project.start_date,
                      project.end_date,
                    )
                  }</span>
                </li>

                {#if project.url}
                  <li class="flex items-center">
                    <FontAwesomeIcon
                      icon={faExternalLinkAlt}
                      class="mr-1 flex-shrink-0 w-3 h-3"
                    />
                    <a
                      href={project.url}
                      target="_blank"
                      class="text-ocean hover:text-teal"
                    >{
                      project.url.replace("https://", "").replace(
                        "www.",
                        "",
                      )
                    }</a>
                  </li>
                {/if}

                {#if project.stars}
                  <li class="flex items-center">
                    <FontAwesomeIcon
                      icon={faStar}
                      class="mr-1 flex-shrink-0 w-3 h-3 text-yellow-500"
                    />
                    <span>{project.stars}</span>
                  </li>
                {/if}
              </ul>
            </div>
          </div>
        </header>

        <div class="space-y-4">
          <p class="leading-relaxed print:text-sm">{project.summary}</p>

          {#if project.side_project_achievements.length > 0}
            <h4 class="text-lg print:text-base font-semibold mb-3 print:mb-2">
              Highlights:
            </h4>
            <InfoBoxes items={project.side_project_achievements} />
          {/if}
        </div>
      </div>
      {#if index < profile.side_projects.length - 1}
        <hr class="border-cloud my-12" />
      {/if}
    {/each}
  </div>
</InfoSection>
