<script lang="ts">
  import TechTag from "./TechTag.svelte";
  import BulletList from "./BulletList.svelte";
  import BulletItem from "./BulletItem.svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faUser, faBuilding, faLink, faCalendar, faMapMarkerAlt } from "@fortawesome/free-solid-svg-icons";

  export let company;
  export let role;
  export let industry;
  export let website;
  export let period;
  export let location;
  export let logo;
  export let description;
  export let note;
  export let achievements = [];
  export let impact;
  export let technologies = [];
</script>

<section class="mb-12 break-inside-avoid">
  <header class="mb-6">
    <div class="flex items-start justify-between mb-4">
      <div class="flex-1">
        <h3 class="text-2xl font-semibold text-cyan-700 mb-2">{company}</h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <div class="flex items-center">
              <FontAwesomeIcon icon={faUser} class="mr-2 flex-shrink-0 w-3 h-3" />
              <span>{role}</span>
            </div>

            <div class="flex items-center">
              <FontAwesomeIcon icon={faBuilding} class="mr-2 flex-shrink-0 w-3 h-3" />
              <span>{industry}</span>
            </div>

            {#if website}
              <div class="flex items-center">
                <FontAwesomeIcon icon={faLink} class="mr-2 flex-shrink-0 w-3 h-3" />
                <a
                  href={website}
                  target="_blank"
                  class="text-cyan-700 hover:text-cyan-600"
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
              <FontAwesomeIcon icon={faCalendar} class="mr-2 flex-shrink-0 w-3 h-3" />
              <span>{period}</span>
            </div>

            <div class="flex items-center">
              <FontAwesomeIcon icon={faMapMarkerAlt} class="mr-2 flex-shrink-0 w-3 h-3" />
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
            class="h-20 w-auto border border-gray-400 rounded"
          />
        </div>
      {/if}
    </div>
  </header>

  <div class="space-y-4">
    <p class="leading-relaxed">{description}</p>

    {#if note}
      <p class="text-sm italic text-gray-700"><strong>Note:</strong> {note}</p>
    {/if}

    {#if achievements.length > 0}
      <div>
        <h4 class="text-lg font-semibold mb-3">Key Achievements:</h4>
        <BulletList>
          {#each achievements as achievement}
            <BulletItem>
              <strong>{achievement.title}:</strong> {achievement.description}
            </BulletItem>
          {/each}
        </BulletList>
      </div>
    {/if}

    <div>
      <h4 class="text-lg font-semibold mb-3">
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
      <p class="text-sm leading-relaxed">{impact}</p>
    </div>

    {#if technologies.length > 0}
      <div>
        <h4 class="text-lg font-semibold mb-3">Technologies Used:</h4>
        <div class="flex flex-wrap gap-2">
          {#each technologies as tech}
            <TechTag>{tech}</TechTag>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</section>
