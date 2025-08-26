<script lang="ts">
  import ResumeSection from "./ResumeSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faExternalLinkAlt,
    faGraduationCap,
    faMapMarkerAlt,
  } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";
</script>

<ResumeSection title="Education" icon={faGraduationCap}>
  <div class="space-y-6">
    {#each resume.education as edu, index (index)}
      <div class="border-l-2 border-ocean pl-4 pb-4">
        <div class="flex items-start justify-between mb-2">
          <div>
            <h3 class="font-semibold text-slate">
              {#if edu.url}
                <a
                  href={edu.url}
                  target="_blank"
                  class="hover:text-teal underline"
                >
                  {edu.institution}
                  <FontAwesomeIcon
                    icon={faExternalLinkAlt}
                    class="w-3 h-3 ml-1 inline"
                  />
                </a>
              {:else}
                {edu.institution}
              {/if}
            </h3>
            <p class="text-sm text-slate/80 flex items-center">
              <FontAwesomeIcon icon={faMapMarkerAlt} class="w-3 h-3 mr-1" />
              {edu.location}
            </p>
          </div>
          <div class="text-right text-sm text-slate/70">
            {edu.startDate.substring(0, 4)} - {edu.endDate.substring(0, 4)}
          </div>
        </div>

        <div class="mb-1">
          <p class="text-slate font-medium">{edu.area}</p>
          <p class="text-sm text-slate/80">{edu.studyType}</p>
        </div>
      </div>
    {/each}
  </div>
</ResumeSection>

