<script lang="ts">
  import type { PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  // import { resume } from "$lib/data/resume";
  import {
    formatDateRangeCompact,
    formatDateRangeYear,
  } from "$lib/tools/date-utils";
  import {
    faEnvelope,
    faGlobe,
    faLocationDot,
    faPhone,
    faStar,
  } from "@fortawesome/free-solid-svg-icons";
  import { faGithub, faLinkedin } from "@fortawesome/free-brands-svg-icons";
  import { page } from "$app/state";

  const type = page.url.searchParams.get("type");

  function filterOnTags(objList: { tags: string }[]) {
    return objList.filter((obj) => {
      if ("tags" in obj && obj.tags && obj.tags.length) {
        if (!(obj.tags.includes("resume"))) {
          if (obj.tags.includes("cv")) {
            // If the obj has the "cv" tag but not the "resume" tag
            return false;
          } else {
            return type ? obj.tags.includes(type) : true;
          }
        } else {
          return type ? obj.tags.includes(type) : true;
        }
      }

      return true;
    });
  }

  export let data: PageData;

  const resume = data.profile;
  const work_experiences = filterOnTags(resume.work_experiences);
</script>

<svelte:head>
  <title>{resume.name}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta
    name="description"
    content={resume.name}
  />
</svelte:head>

<div
  class="w-[699px] print:w-[initial] mx-auto py-8 print:py-0 bg-white text-black text-xs leading-relaxed"
>
  <!-- Header Section -->
  <header class="flex justify-between">
    <div class="w-120">
      <h1 class="text-2xl font-bold">{resume.name}</h1>
      <h2 class="text-sm">{resume.title}</h2>
      <h2 class="text-xs mt-1">{resume.subtitle}</h2>
    </div>

    <ul class="text-xs mt-2 grid grid-cols-2 grid-cols-[170px_110px] gap-x-8">
      <li>
        <FontAwesomeIcon icon={faEnvelope} class="w-3 mr-1" title="Email" />
        <a
          href="mailto:{resume.email_address}"
          class="underline"
        >{resume.email_address}</a>
      </li>

      <li>
        <FontAwesomeIcon icon={faPhone} class="w-3 mr-1" title="Phone" />
        <a
          href="tel:{resume.phone_number}"
          class="underline"
        >{resume.phone_number}</a>
      </li>

      <li>
        <FontAwesomeIcon
          icon={faLocationDot}
          class="w-3 mr-1"
          title="Location"
        />
        <a
          href={resume.location_url}
          class="underline"
          target="_blank"
        >
          {resume.location}
        </a>
        {#if resume.location_timezone}
          ({resume.location_timezone})
        {/if}
      </li>

      <li>
        <FontAwesomeIcon icon={faGlobe} class="w-3 mr-1" title="Website" />
        <a
          href={resume.personal_website}
          target="_blank"
          class="underline"
        >{
          resume.personal_website.replace(
            /^https?:\/\/(www.)?/,
            "",
          ).replace(/\/$/, "")
        }</a>
      </li>

      <li>
        <FontAwesomeIcon
          icon={faLinkedin}
          class="w-3 mr-1"
          title="LinkedIn"
        />
        <a
          href={resume.linkedin_profile}
          target="_blank"
          class="underline"
        >{
          resume.linkedin_profile.replace(
            /^https?:\/\/(www.)?linkedin.com\/in\//,
            "",
          )
        }</a>
      </li>

      <li>
        <FontAwesomeIcon
          icon={faGithub}
          class="w-3 mr-1"
          title="LinkedIn"
        />
        <a
          href={resume.github_profile}
          target="_blank"
          class="underline"
        >{
          resume.github_profile.replace(
            /^https?:\/\/(www.)?github.com\//,
            "",
          )
        }</a>
      </li>
    </ul>
  </header>

  <!-- Summary -->
  <div class="my-4">
    <h2 class="text-sm font-bold mb-2 border-b-2 border-black">
      SUMMARY
    </h2>
    <p class="mt-1 text-xs">{resume.summary}</p>
  </div>

  <!-- Work Experience -->
  <div class="my-4">
    <h2 class="text-sm font-bold mb-2 border-b-2 border-black">
      WORK EXPERIENCE
    </h2>

    {#each work_experiences as job, index (index)}
      <div class="mb-2">
        <div class="text-xs font-bold mb-1">
          {job.name} |
          {job.location} |
          {job.position} |
          {formatDateRangeCompact(job.start_date, job.end_date)}
        </div>

        {#if job.note}
          <p class="text-sm italic"><strong>Note:</strong> {job.note}</p>
        {/if}

        {#if job.achievements && job.achievements.length > 0}
          {@const filteredHighlights = filterOnTags(job.achievements)}
          {#if filteredHighlights.length > 0}
            <ul class="list-disc ml-3 print:ml-4">
              {#each filteredHighlights as highlight, index (index)}
                <li class="print:indent-[-6px]">
                  {highlight.description}
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      </div>
    {/each}
  </div>

  <!-- Skills -->
  <div class="my-4 break-inside-avoid">
    <h2 class="text-sm font-bold mb-2 border-b-2 border-black">
      SKILLS
    </h2>

    <ul class="list-disc ml-3 print:ml-4">
      {#each resume.tech_skill_categories as skillGroup, index (index)}
        <li class="print:indent-[-6px]">
          <div class="flex items-center">
            <h3 class="font-bold mr-1 print:mr-[10px]">{skillGroup.name}:</h3>
            <p class="text-xs">
              {
                skillGroup.tech_skills.map(
                  (s: { name: string }) => s.name,
                ).join(" | ")
              }
            </p>
          </div>
        </li>
      {/each}
    </ul>
  </div>

  <!-- Education -->
  <!-- <div class="my-3 break-inside-avoid"> -->
  <!--   <h2 class="text-sm font-bold mb-2 border-b-2 border-black"> -->
  <!--     EDUCATION -->
  <!--   </h2> -->

  <!-- <p> -->
  <!--   Mainly self-thaught because of interests, with a relevant background in -->
  <!--   Network Engineering (Dutch secondary vocational education @ Nova College -->
  <!--   in Hoofddorp) and a half year internship as a PHP & MySQL developer at -->
  <!--   Festivalinfo.nl -->
  <!-- </p> -->

  <!-- {#each resume.education as education (education.area)} -->
  <!--   <div class="mb-2"> -->
  <!--     <div class="font-bold"> -->
  <!--       {education.area}, {education.studyType}, -->
  <!--       {#if education.graduationYear} -->
  <!--         Graduation Year {education.graduationYear} -->
  <!--       {:else} -->
  <!--         { -->
  <!--           formatDateRangeCompact( -->
  <!--             education.startDate, -->
  <!--             education.endDate, -->
  <!--           ) -->
  <!--         } -->
  <!--       {/if} -->
  <!--     </div> -->
  <!---->
  <!--     <div> -->
  <!--       {education.institution}, {education.location} -->
  <!--     </div> -->
  <!--   </div> -->

  <!-- <div class="flex justify-between mb-3"> -->
  <!--   <div> -->
  <!--     <h3 class="font-bold text-sm">{education.area}</h3> -->
  <!--     <p> -->
  <!--       <strong>{education.institution}</strong> ({education.studyType}) -->
  <!--     </p> -->
  <!--   </div> -->
  <!---->
  <!--   <div> -->
  <!--     {formatDateRangeCompact(education.startDate, education.endDate)} -->
  <!--   </div> -->
  <!-- </div> -->
  <!--   {/each} -->
  <!-- </div> -->

  <!-- Side Projects -->
  <div class="my-4 break-inside-avoid">
    <h2 class="text-sm font-bold mb-2 border-b-2 border-black">
      SIDE PROJECTS
    </h2>

    {#each filterOnTags(resume.side_projects) as project (project.name)}
      <div class="mb-2">
        <div class="text-xs font-bold mb-1">
          {project.name} | <a
            href={project.url}
            target="_blank"
          ><FontAwesomeIcon icon={faGithub} class="w-3" title="GitHub" />
            <FontAwesomeIcon icon={faStar} title="Stars" class="w-3" /> <span
              class="underline"
            >{project.stars}</span></a> | {
            formatDateRangeYear(project.start_date, project.end_date)
          }
        </div>

        <div class="text-xs">
          {project.summary}
        </div>
      </div>
    {/each}
  </div>

  <!-- <div class="mb-6"> -->
  <!--   <h2 class="text-sm font-bold mb-2 border-b-2 border-black"> -->
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
