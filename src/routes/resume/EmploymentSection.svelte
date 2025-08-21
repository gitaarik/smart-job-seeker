<script lang="ts">
  import TechTag from "./TechTag.svelte";
  import InfoBoxes from "./InfoBoxes.svelte";
  import SectionHeader from "./SectionHeader.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBuilding,
    faCalendar,
    faGlobe,
    faLink,
    faMapMarkerAlt,
    faUser,
  } from "@fortawesome/free-solid-svg-icons";

  export let name;
  export let position;
  export let description;
  export let url;
  export let period;
  export let location;
  export let logo;
  export let summary;
  export let note;
  export let highlights;
  export let keywords;
  export let isFirst: boolean;


  // Transform highlights for InfoBoxes component
  $: highlightItems = highlights.map((highlight) => ({
    title: highlight.title,
    details: highlight.description,
    icon: highlight.icon,
  }));

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
        <h3 class="text-2xl font-semibold text-ocean mb-2">{name}</h3>

        <div
          class="grid grid-cols-1 md:grid-cols-[max-content_1fr] print:grid-cols-[max-content_1fr] gap-4 md:gap-6 print:gap-4 text-sm"
        >
          <div class="space-y-2">
            <div class="flex items-center">
              <FontAwesomeIcon
                icon={faUser}
                class="mr-2 flex-shrink-0 w-3 h-3"
              />
              <span>{position}</span>
            </div>

            <div class="flex items-center">
              <FontAwesomeIcon
                icon={faBuilding}
                class="mr-2 flex-shrink-0 w-3 h-3"
              />
              <span>{description}</span>
            </div>

            {#if url}
              <div class="flex items-center">
                <FontAwesomeIcon
                  icon={faLink}
                  class="mr-2 flex-shrink-0 w-3 h-3"
                />
                <a
                  href={url}
                  target="_blank"
                  class="text-ocean hover:text-teal"
                >{
                  url.replace("https://", "").replace(
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
              <span>{period}</span>
            </div>

            <div class="flex items-center">
              <FontAwesomeIcon
                icon={faMapMarkerAlt}
                class="mr-2 flex-shrink-0 w-3 h-3"
              />
              <span>{location}</span>
            </div>
          </div>
        </div>
      </div>

      {#if logo}
        <div class="ml-4 flex-shrink-0">
          <img
            src={logo}
            alt="{name} Logo"
            class="h-22 w-auto border border-aqua rounded"
          />
        </div>
      {/if}
    </div>
  </header>

  <div class="space-y-4">
    <p class="leading-relaxed print:text-sm">{summary}</p>

    {#if note}
      <p class="text-sm italic"><strong>Note:</strong> {note}</p>
    {/if}

    {#if highlightItems.length > 0}
      <div>
        <h4 class="text-lg print:text-base font-semibold mb-3 print:mb-2">
          Key Achievements:
        </h4>
        <InfoBoxes items={highlightItems} />
      </div>
    {/if}

    {#if keywords.length > 0}
      <div>
        <h4 class="text-lg print:text-base font-semibold mb-3 print:mb-2">
          Technologies Used:
        </h4>
        <ul class="flex flex-wrap gap-2 print:gap-[5px]">
          {#each keywords as tech (tech)}
            <TechTag {tech} />
          {/each}
        </ul>
      </div>
    {/if}
  </div>
</section>
