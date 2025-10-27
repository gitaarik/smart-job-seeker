<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faGithub } from "@fortawesome/free-brands-svg-icons";
  import { faCode, faExternalLinkAlt, faStar } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";

  let props = $props();
  const profile = props.profile;
</script>

<InfoSection title="Side Projects" icon={faCode}>
  <div class="space-y-8">
    {#each resume.projects as project, index (project.name)}
      <div class="border-l-2 border-ocean pl-4 pb-6">
        <div class="flex items-start justify-between mb-3">
          <div>
            <h3 class="font-semibold text-slate text-lg">
              {#if project.url}
                <a
                  href={project.url}
                  target="_blank"
                  class="hover:text-teal underline"
                >
                  {project.name}
                  <FontAwesomeIcon
                    icon={faExternalLinkAlt}
                    class="w-3 h-3 ml-1 inline"
                  />
                </a>
              {:else}
                {project.name}
              {/if}
            </h3>
            <div class="flex items-center mt-1">
              <span class="text-sm text-slate/80">
                {project.startDate.substring(5, 7)}/{project.startDate.substring(0, 4)} - {project.endDate.substring(5, 7)}/{project.endDate.substring(0, 4)}
              </span>
              {#if project.stars}
                <div class="flex items-center ml-4 text-sm text-slate/70">
                  <FontAwesomeIcon icon={faStar} class="w-3 h-3 mr-1 text-yellow-500" />
                  <span>{project.stars} stars</span>
                </div>
              {/if}
            </div>
          </div>
        </div>

        <p class="text-slate mb-4 leading-relaxed">{project.description}</p>

        <div class="space-y-2">
          {#each project.highlights as highlight}
            <div class="flex items-start">
              <div class="mr-2 flex-shrink-0 mt-1">
                <div class="w-1.5 h-1.5 bg-ocean rounded-full"></div>
              </div>
              <p class="text-slate/80 text-sm leading-relaxed">{highlight}</p>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</InfoSection>
