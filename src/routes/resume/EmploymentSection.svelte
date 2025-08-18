<script lang="ts">
  import TechTag from "./TechTag.svelte";
  import CircleList from "./CircleList.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBuilding,
    faCalendar,
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
</script>

<section class="break-inside-avoid {isFirst ? 'mt-12 print:mt-0' : ''}">
  <header class="mb-6 print:mb-4">
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <h3 class="text-2xl font-semibold text-ocean mb-2">{company}</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-4 print:gap-2 text-sm">
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
            class="h-22 w-auto border border-cloud rounded print:border-0 print:mt-2"
          />
        </div>
      {/if}
    </div>
  </header>

  <div class="space-y-4 print:space-y-3">
    <p class="leading-relaxed">{description}</p>

    {#if note}
      <p class="text-sm italic"><strong>Note:</strong> {note}</p>
    {/if}

    {#if achievements.length > 0}
      <div>
        <h4 class="text-lg font-semibold mb-3 print:mb-2">Key Achievements:</h4>
        <CircleList class="ml-8">
          {#each achievements as achievement (achievement)}
            <li>
              <strong>{achievement.title}:</strong> {achievement.description}
            </li>
          {/each}
        </CircleList>
      </div>
    {/if}

    <div>
      <h4 class="text-lg font-semibold mb-3 print:mb-2">
        {#if company === "TravelBird"}
          Industry Impact:
        {:else if company === "SWIS"}
          Client Impact:
        {:else if company === "Gamepoint"}
          Platform Impact:
        {:else}
          Technical Impact:
        {/if}
      </h4>
      <p class="leading-relaxed">{impact}</p>
    </div>

    {#if technologies.length > 0}
      <div>
        <h4 class="text-lg font-semibold mb-3 print:mb-2">Technologies Used:</h4>
        <div class="flex flex-wrap gap-2 print:gap-[4px]">
          {#each technologies as tech (tech)}
            <TechTag {tech} />
          {/each}
        </div>
      </div>
    {/if}
  </div>
</section>
