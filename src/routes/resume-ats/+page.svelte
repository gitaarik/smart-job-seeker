<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { resume } from "$lib/data/resume";
  import { formatDateRange } from "$lib/tools/date-utils";
  import {
    faEnvelope,
    faGlobe,
    faLocationDot,
    faPhone,
  } from "@fortawesome/free-solid-svg-icons";
</script>

<svelte:head>
  <title>{resume.basics.name}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta
    name="description"
    content={resume.basics.name}
  />
</svelte:head>

<div
  class="w-[700px] print:w-[initial] mx-auto py-8 print:py-0 bg-white text-black text-xs leading-relaxed"
>
  <!-- Header Section -->
  <header>
    <div class="w-120">
      <h1 class="text-2xl font-bold">{resume.basics.name}</h1>
      <h2 class="text-sm">{resume.basics.label}</h2>
    </div>

    <ul class="flex justify-between text-xs mt-2">
      <li>
        <FontAwesomeIcon icon={faEnvelope} class="w-3 mr-1" />
        <a
          href="mailto:{resume.basics.email}"
          class="underline"
        >{resume.basics.email}</a>
      </li>

      <li>
        <FontAwesomeIcon icon={faPhone} class="w-3 mr-1" />
        <a
          href="tel:{resume.basics.phone}"
          class="underline"
        >{resume.basics.phone}</a>
      </li>

      <li>
        <FontAwesomeIcon icon={faLocationDot} class="w-3 mr-1" />
        <a
          href={resume.basics.location.url}
          class="underline"
          target="_blank"
        >
          {resume.basics.location.address}
        </a>
      </li>

      <li>
        <FontAwesomeIcon icon={faGlobe} class="w-3 mr-1" />
        <a
          href={resume.basics.url}
          target="_blank"
          class="underline"
        >{resume.basics.url_label}</a>
      </li>

      {#each resume.basics.profiles as profile (profile)}
        <li class="flex items-center">
          <FontAwesomeIcon icon={profile.icon} class="w-3 mr-1" />
          <a
            href={profile.url}
            target="_blank"
            class="underline"
          >{profile.label}</a>
        </li>
      {/each}
    </ul>
  </header>

  <!-- Summary -->
  <div class="my-4">
    <h2 class="text-sm font-bold mb-3 border-b-2 border-black">
      SUMMARY
    </h2>
    <p class="mt-1 text-xs">{resume.basics.summary}</p>
  </div>

  <!-- Professional Experience -->
  <div class="my-4">
    <h2 class="text-sm font-bold mb-3 border-b-2 border-black">
      WORK EXPERIENCE
    </h2>

    {#each resume.work as job, index (index)}
      <div class="mb-3">
        <div class="flex justify-between mb-1">
          <div>
            <h3 class="font-bold text-sm">{job.position}</h3>
            <p>{job.name} ({job.description}) · {job.location}</p>
          </div>

          <div>
            {formatDateRange(job.startDate, job.endDate)}
          </div>
        </div>

        {#if job.note}
          <p class="text-sm italic"><strong>Note:</strong> {job.note}</p>
        {/if}

        {#if job.highlights && job.highlights.length > 0}
          <ul class="list-disc ml-4">
            {#each job.highlights as highlight, index (index)}
              <li>
                {highlight.description}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Technical Skills -->
  <div class="mb-6">
    <h2 class="text-sm font-bold mb-3 border-b-2 border-black">
      TECHNICAL SKILLS
    </h2>

    <ul class="list-disc ml-4 grid grid-cols-2 gap-x-8">
      {#each resume.skills as skillGroup, index (index)}
        <li class="mb-1">
          <h3 class="font-bold">{skillGroup.name}:</h3>
          <p class="text-xs">{skillGroup.keywords.join(", ")}</p>
        </li>
      {/each}
    </ul>
  </div>

  <!-- References -->
  <!-- <div class="mb-6"> -->
  <!--   <h2 class="text-sm font-bold mb-3 border-b-2 border-black"> -->
  <!--     REFERENCES -->
  <!--   </h2> -->
  <!--   {#each resume.references as reference, index (index)} -->
  <!--     <div class="mb-4"> -->
  <!--       <h3 class="font-bold">{reference.name}</h3> -->
  <!--       <p class="italic">"{reference.reference}"</p> -->
  <!--     </div> -->
  <!--   {/each} -->
  <!--   <p class="mt-4 font-semibold">{resume.referencesDescription}</p> -->
  <!-- </div> -->
</div>
