<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faExternalLinkAlt,
    faGraduationCap,
    faMapMarkerAlt,
    faCalendar,
    faBook,
    faLink,
  } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";

  import { formatDateRangeVerbose } from "$lib/tools/date-utils";

  let props = $props();
  const profile = props.profile;
</script>

<InfoSection title="Education" icon={faGraduationCap}>
  <div class="space-y-6 print:space-y-4">
    {#each profile.education as edu, index (index)}
      <div class="break-inside-avoid">
        <header class="mb-4 print:mb-2">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <h3 class="text-2xl font-semibold text-ocean mb-2">
                {edu.institution}
              </h3>

              <div
                class="grid grid-cols-1 md:grid-cols-[max-content_1fr] print:grid-cols-[max-content_1fr] gap-4 md:gap-6 print:gap-4 text-sm"
              >
                <div class="space-y-2">
                  <div class="flex items-center">
                    <FontAwesomeIcon
                      icon={faBook}
                      class="mr-2 flex-shrink-0 w-3 h-3"
                    />
                    <span>{edu.area}</span>
                  </div>

                  <div class="flex items-center">
                    <FontAwesomeIcon
                      icon={faGraduationCap}
                      class="mr-2 flex-shrink-0 w-3 h-3"
                    />
                    <span>{edu.studyType}</span>
                  </div>

                  {#if edu.url}
                    <div class="flex items-center">
                      <FontAwesomeIcon
                        icon={faLink}
                        class="mr-2 flex-shrink-0 w-3 h-3"
                      />
                      <a
                        href={edu.url}
                        target="_blank"
                        class="text-ocean hover:text-teal"
                      >{
                        edu.url.replace("https://", "").replace(
                          "www.",
                          "",
                        )
                      }</a>
                    </div>
                  {/if}
                </div>

                <div class="space-y-2">
                  <div class="flex items-center">
                    <FontAwesomeIcon
                      icon={faCalendar}
                      class="mr-2 flex-shrink-0 w-3 h-3"
                    />
                    <span>{
                      formatDateRangeVerbose(
                        edu.start_date,
                        edu.end_date,
                      )
                    }</span>
                  </div>

                  <div class="flex items-center">
                    <FontAwesomeIcon
                      icon={faMapMarkerAlt}
                      class="mr-2 flex-shrink-0 w-3 h-3"
                    />
                    <span>{edu.location}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {#if edu.summary}
          <div class="space-y-3 print:space-y-2">
            <p class="leading-relaxed print:text-sm">{edu.summary}</p>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</InfoSection>
