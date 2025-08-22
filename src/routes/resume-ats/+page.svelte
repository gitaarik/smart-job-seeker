<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { resume } from "$lib/data/resume";
  import { formatDateRange } from "$lib/tools/date-utils";
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
  class="max-w-xl print:max-w-[initial] mx-auto py-8 print:py-0 bg-white text-black text-xs leading-relaxed"
>
  <!-- Header Section -->
  <div class="mb-6">
    <header>
      <h1 class="text-xl font-bold mb-2">{resume.basics.name}</h1>
      <h2 class="text-base mb-4">{resume.basics.label}</h2>
    </header>

    <ul class="mb-4">
      <li>
        <a
          href="mailto:{resume.basics.email}"
          class="underline"
        >{resume.basics.email}</a>
      </li>

      <li>
        <a
          href="tel:{resume.basics.phone}"
          class="underline"
        >{resume.basics.phone}</a>
      </li>

      <li>{resume.basics.location.address}</li>

      <li>
        <a
          href={resume.basics.url}
          target="_blank"
          rel="noopener norefeprrer"
          class="underline"
        >{resume.basics.url}</a>
      </li>

      {#each resume.basics.profiles as profile (profile)}
        <li class="flex items-center">
          <FontAwesomeIcon icon={profile.icon} class="max-w-3 mr-1" />
          <a
            href={profile.url}
            target="_blank"
            rel="noopener noreferrer"
            class="underline"
          >{profile.url}</a>
        </li>
      {/each}
    </ul>

    <p>{resume.basics.summary}</p>
  </div>

  <!-- Professional Experience -->
  <div class="mb-6 break-before-page">
    <h2 class="text-sm font-bold mb-3 border-b-2 border-black">
      PROFESSIONAL EXPERIENCE
    </h2>
    {#each resume.work as job, index (index)}
      <div class="mb-10">
        <div class="mb-2">
          <h3 class="font-bold text-sm mb-2">{job.name}</h3>
          <p><strong>Role:</strong> {job.position}</p>
          <p><strong>Location:</strong> {job.location}</p>
          <p>
            <strong>Time:</strong> {formatDateRange(job.startDate, job.endDate)}
          </p>
        </div>

        {#if job.highlights && job.highlights.length > 0}
          <div class="mb-3">
            <ul class="list-disc ml-4">
              {#each job.highlights as highlight, index (index)}
                <li class="mb-1">
                  {highlight.description}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Technical Skills -->
  <div class="mb-6">
    <h2 class="text-sm font-bold mb-3 border-b-2 border-black">
      TECHNICAL SKILLS
    </h2>
    <ul class="list-disc ml-4">
      {#each resume.skills as skillGroup, index (index)}
        <li class="mb-2">
          <h3 class="font-bold">{skillGroup.name}:</h3>
          <p>{skillGroup.keywords.join(", ")}</p>
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

<style>
  /* Ensure high contrast and clean formatting for ATS systems */
  :global(body) {
    background: white;
    color: black;
  }

  /* Print-friendly styles */
  @media print {
    .max-w-4xl {
      max-width: none;
      margin: 0;
      padding: 0;
    }
  }
</style>
