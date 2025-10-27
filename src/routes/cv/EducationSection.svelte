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
  import { getImg } from "$lib/tools/get-img";

  let props = $props();
  const profile = props.profile;
</script>

<InfoSection title="Education" icon={faGraduationCap}>
  <div>
    {#each profile.education as edu, index (index)}
      <div class="break-inside-avoid {index === 0 ? 'mt-12 print:mt-0' : ''}">
        <header class="mb-6 print:mb-4">
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

            {#if edu.logo}
              <div class="ml-4 flex-shrink-0">
                <img
                  src={getImg(edu.logo)}
                  alt="{edu.institution} Logo"
                  class="h-22 w-auto border border-aqua rounded"
                />
              </div>
            {/if}
          </div>
        </header>

        {#if edu.summary}
          <div class="space-y-3 print:space-y-2">
            <p class="leading-relaxed print:text-sm">{edu.summary}</p>
          </div>
        {/if}
      </div>
      {#if index < profile.education.length - 1}
        <hr class="border-cloud my-12" />
      {/if}
    {/each}
  </div>
</InfoSection>
