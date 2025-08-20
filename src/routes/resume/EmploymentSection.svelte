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

  export let company;
  export let role;
  export let industry;
  export let website;
  export let period;
  export let location;
  export let logo;
  export let description;
  export let note;
  export let achievements;
  export let impact;
  export let technologies;
  export let isFirst: boolean;
  export let isCompact: boolean = false;

  // Limit achievements in compact mode
  $: displayedAchievements = isCompact
    ? achievements.slice(0, 3) // Show only first 3 achievements
    : achievements;

  // Transform achievements for InfoBoxes component
  $: achievementItems = displayedAchievements.map((achievement) => ({
    title: achievement.title,
    details: achievement.description,
    icon: achievement.icon,
  }));

  // Limit technologies in compact mode
  $: displayedTechnologies = isCompact
    ? technologies.slice(0, 8) // Show only first 8 technologies
    : technologies;
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
        <h3 class="text-2xl font-semibold text-ocean mb-2">{company}</h3>

        <div
          class="grid grid-cols-1 md:grid-cols-[max-content_1fr] print:grid-cols-[max-content_1fr] gap-4 md:gap-6 print:gap-4 text-sm"
        >
          <div class="space-y-2">
            <div class="flex items-center">
              <FontAwesomeIcon
                icon={faUser}
                class="mr-2 flex-shrink-0 w-3 h-3"
              />
              <span>{role}</span>
            </div>

            <div class="flex items-center">
              <FontAwesomeIcon
                icon={faBuilding}
                class="mr-2 flex-shrink-0 w-3 h-3"
              />
              <span>{industry}</span>
            </div>

            {#if website}
              <div class="flex items-center">
                <FontAwesomeIcon
                  icon={faLink}
                  class="mr-2 flex-shrink-0 w-3 h-3"
                />
                <a
                  href={website}
                  target="_blank"
                  class="text-ocean hover:text-teal"
                >{
                  website.replace("https://", "").replace(
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
            alt="{company} Logo"
            class="h-22 w-auto border border-aqua rounded"
          />
        </div>
      {/if}
    </div>
  </header>

  <div class="space-y-4">
    <p class="leading-relaxed print:text-sm">{description}</p>

    {#if note}
      <p class="text-sm italic"><strong>Note:</strong> {note}</p>
    {/if}

    {#if achievementItems.length > 0}
      <div>
        <h4 class="text-lg print:text-base font-semibold mb-3 print:mb-2">
          Key Achievements:
        </h4>
        <InfoBoxes items={achievementItems} />
      </div>
    {/if}

    <div>
      <h4 class="text-lg print:text-base font-semibold mb-3 print:mb-2">
        Impact:
      </h4>
      <p class="leading-relaxed print:text-sm">{impact}</p>
    </div>

    {#if displayedTechnologies.length > 0}
      <div>
        <h4 class="text-lg print:text-base font-semibold mb-3 print:mb-2">
          Technologies Used:
        </h4>
        <div class="flex flex-wrap gap-2 print:gap-[5px]">
          {#each displayedTechnologies as tech (tech)}
            <TechTag {tech} />
          {/each}
          {#if           isCompact &&
            technologies.length > displayedTechnologies.length}
            <span class="px-2 py-1 text-sm text-slate italic"
            >+{technologies.length - displayedTechnologies.length} more</span>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</section>
