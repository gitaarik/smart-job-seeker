<script lang="ts">
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
  class="max-w-xl print:max-w-auto mx-auto py-8 print:p-0 bg-white text-black text-xs leading-relaxed"
>
  <!-- Header Section -->
  <div class="mb-6">
    <header>
      <h1 class="text-xl font-bold mb-2">{resume.basics.name}</h1>
      <h2 class="text-base mb-4">{resume.basics.label}</h2>
    </header>

    <div class="mb-4">
      <p>
        Email: <a
          href="mailto:{resume.basics.email}"
          class="underline text-blue-600"
        >{resume.basics.email}</a>
      </p>

      <p>
        Phone: <a
          href="tel:{resume.basics.phone}"
          class="underline text-blue-600"
        >{resume.basics.phone}</a>
      </p>

      <p>
        Languages:
        {#each resume.languages as language, index (index)}
          {#if index > 0},{/if}
          {language.language}: {language.fluency}
        {/each}
      </p>

      <p>Location: {resume.basics.location.address}</p>

      <p>
        Website: <a
          href={resume.basics.url}
          target="_blank"
          rel="noopener norefeprrer"
          class="underline text-blue-600"
        >{resume.basics.url}</a>
      </p>

      {#each resume.basics.profiles as profile (profile)}
        <p>
          {profile.network}: <a
            href={profile.url}
            target="_blank"
            rel="noopener noreferrer"
            class="underline text-blue-600"
          >{profile.url}</a>
        </p>
      {/each}
    </div>
  </div>

  <!-- Professional Summary -->
  <div class="mb-6">
    <h2 class="text-sm font-bold mb-3 border-b-2 border-black">
      PROFESSIONAL SUMMARY
    </h2>
    <p class="mb-4">{resume.basics.summary}</p>
  </div>

  <!-- Technical Highlights -->
  <div class="mb-6">
    <h2 class="text-sm font-bold mb-3 border-b-2 border-black">
      TECHNICAL HIGHLIGHTS
    </h2>
    <ul class="list-none">
      {#each resume.basics.highlights as highlight, index (index)}
        <li class="mb-1">• {@html highlight.description}</li>
      {/each}
    </ul>
  </div>

  <!-- Technical Skills -->
  <div class="mb-6">
    <h2 class="text-sm font-bold mb-3 border-b-2 border-black">
      TECHNICAL SKILLS
    </h2>
    {#each resume.skills as skillGroup, index (index)}
      <div class="mb-2">
        <h3 class="font-bold">{skillGroup.name}</h3>
        <p>{skillGroup.keywords.join(", ")}</p>
      </div>
    {/each}
  </div>

  <!-- Professional Experience -->
  <div class="mb-6">
    <h2 class="text-sm font-bold mb-3 border-b-2 border-black">
      PROFESSIONAL EXPERIENCE
    </h2>
    {#each resume.work as job, index (index)}
      <div class="mb-10">
        <div class="mb-2">
          <h3 class="font-bold">Role: {job.position}</h3>
          <p class="font-bold">Company: {job.name} | Location: {job.location}</p>
          <p>Time: {formatDateRange(job.startDate, job.endDate)}</p>
          {#if job.description}
            <p class="italic">{job.description}</p>
          {/if}
        </div>

        {#if job.highlights && job.highlights.length > 0}
          <div class="mb-3">
            <ul class="list-none">
              {#each job.highlights as highlight, index (index)}
                <li class="mb-2">
                  • <strong>{highlight.title}:</strong> {highlight.description}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- References -->
  <div class="mb-6">
    <h2 class="text-sm font-bold mb-3 border-b-2 border-black">
      REFERENCES
    </h2>
    {#each resume.references as reference, index (index)}
      <div class="mb-4">
        <h3 class="font-bold">{reference.name}</h3>
        <p class="italic">"{reference.reference}"</p>
      </div>
    {/each}
    <p class="mt-4 font-semibold">{resume.referencesDescription}</p>
  </div>
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
