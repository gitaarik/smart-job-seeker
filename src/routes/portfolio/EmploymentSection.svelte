<script lang="ts">
  import TechTag from "./TechTag.svelte";
  import InfoBoxes from "./InfoBoxes.svelte";
  import SectionHeader from "./SectionHeader.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBuilding,
    faCalendarAlt,
    faGlobe,
    faLink,
    faMapMarkerAlt,
    faUserTie,
  } from "@fortawesome/free-solid-svg-icons";
  import { formatDateRangeVerbose } from "$lib/tools/date-utils";
  import { getImg } from "$lib/tools/get-img";

  export let data;
  export let isFirst = false;
</script>

<section class="break-inside-avoid {isFirst ? 'mt-12 print:mt-0' : ''}">
  {#if !isFirst}
    <!-- Professional Experience header for print version -->
    <div class="hidden print:block print:mt-10 print:mb-4">
      <SectionHeader title="Professional Experience" icon={faGlobe} />
    </div>
  {/if}

  <header class="mb-6 print:mb-4">
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <h3 class="text-2xl font-semibold text-ocean mb-2">{data.name}</h3>

        <div
          class="grid grid-cols-1 md:grid-cols-[max-content_1fr] print:grid-cols-[max-content_1fr] gap-4 md:gap-6 print:gap-4 text-sm"
        >
          <div class="space-y-2">
            <div class="flex items-center">
              <FontAwesomeIcon
                icon={faUserTie}
                class="mr-2 flex-shrink-0 w-3 h-3"
              />
              <span>{data.position}</span>
            </div>

            <div class="flex items-center">
              <FontAwesomeIcon
                icon={faBuilding}
                class="mr-2 flex-shrink-0 w-3 h-3"
              />
              <span>{data.description}</span>
            </div>

            {#if data.website}
              <div class="flex items-center">
                <FontAwesomeIcon
                  icon={faLink}
                  class="mr-2 flex-shrink-0 w-3 h-3"
                />
                <a
                  href={data.website}
                  target="_blank"
                  class="text-ocean hover:text-teal"
                >{
                  data.website.replace("https://", "").replace(
                    "www.",
                    "",
                  ).replace(/\/$/, "")
                }</a>
              </div>
            {/if}
          </div>

          <div class="space-y-2">
            <div class="flex items-center">
              <FontAwesomeIcon
                icon={faCalendarAlt}
                class="mr-2 flex-shrink-0 w-3 h-3"
              />
              <span>{
                formatDateRangeVerbose(
                  data.start_date,
                  data.end_date,
                )
              }</span>
            </div>

            <div class="flex items-center">
              <FontAwesomeIcon
                icon={faMapMarkerAlt}
                class="mr-2 flex-shrink-0 w-3 h-3"
              />
              <span>{data.location}</span>
            </div>
          </div>
        </div>
      </div>

      {#if data.logo}
        <div class="ml-4 flex-shrink-0">
          <img
            src={getImg(data.logo)}
            alt="{data.name} Logo"
            class="h-22 w-auto border border-aqua rounded"
          />
        </div>
      {/if}
    </div>
  </header>

  <div class="space-y-4">
    <p class="leading-relaxed print:text-sm">{data.summary}</p>

    {#if data.note}
      <p class="text-sm italic"><strong>Note:</strong> {data.note}</p>
    {/if}

    {#if data.work_experience_achievements.length > 0}
      <div>
        <h4 class="text-lg print:text-base font-semibold mb-3 print:mb-2">
          Key Achievements:
        </h4>
        <InfoBoxes items={data.work_experience_achievements} />
      </div>
    {/if}

    {#if data.work_experience_technologies.length > 0}
      <div>
        <h4 class="text-lg print:text-base font-semibold mb-3 print:mb-2">
          Technologies Used:
        </h4>
        <ul class="flex flex-wrap gap-2 print:gap-[5px]">
          {#each data.work_experience_technologies as tech (tech.name)}
            <TechTag tech={tech.name} />
          {/each}
        </ul>
      </div>
    {/if}
  </div>
</section>
