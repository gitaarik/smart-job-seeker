<script lang="ts">
  import { page } from "$app/state";
  import {
    formatDateRangeCompact,
    formatDateRangeYear,
  } from "$lib/tools/date-utils";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faEnvelope,
    faGlobe,
    faLocationDot,
    faPhone,
    faStar,
  } from "@fortawesome/free-solid-svg-icons";
  import { faGithub, faLinkedin } from "@fortawesome/free-brands-svg-icons";

  interface Profile {
    name: string;
    title: string;
    subtitle: string;
    email_address: string;
    phone_number: string;
    location: string;
    location_url: string;
    location_timezone?: string;
    personal_website: string;
    linkedin_profile: string;
    github_profile: string;
    summary: string;
    work_experiences: Array<{
      name: string;
      location: string;
      position: string;
      start_date: Date;
      end_date?: Date;
      note?: string;
      achievements?: Array<{
        description: string;
        tags?: string;
      }>;
      tags?: string;
    }>;
    tech_skill_categories: Array<{
      name: string;
      tech_skills: Array<{ name: string }>;
    }>;
    side_projects: Array<{
      name: string;
      url: string;
      stars: string;
      start_date: Date;
      end_date?: Date;
      summary: string;
      tags?: string;
    }>;
  }

  export let profile: Profile;
  export let type: string | null = null;
  const version = page.url.searchParams.get("version");

  function filterOnTags<T extends { tags?: string }>(objList: T[]): T[] {
    return objList.filter((obj) => {
      if ("tags" in obj && obj.tags && obj.tags.length) {
        if (
          !obj.tags.includes(type || "resume") &&
          obj.tags.includes(type === "resume" ? "cv" : "resume")
        ) {
          // If the opposite of `type` is in `obj.tags`, but `type` itself not
          // For example, when `type` is "cv" and `obj.tags` contains "resume"
          // but not "cv", then this obj should be hidden.
          return false;
        } else {
          const tags = obj.tags.filter((item) =>
            !(["resume", "cv"].includes(item))
          );
          return version ? tags.includes(version) : true;
        }
      }

      return true;
    });
  }

  const work_experiences = filterOnTags(profile.work_experiences);
</script>

<svelte:head>
  <title>{profile.name}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content={profile.name} />
</svelte:head>

<div
  class="w-[699px] print:w-[initial] mx-auto py-8 print:py-0 bg-white text-black text-xs leading-relaxed"
>
  <!-- Header Section -->
  <header class="flex justify-between">
    <div class="w-120">
      <h1 class="text-2xl font-bold">{profile.name}</h1>
      <h2 class="text-sm">{profile.title}</h2>
      <h2 class="text-xs mt-1">{profile.subtitle}</h2>
    </div>

    <ul class="text-xs mt-2 grid grid-cols-2 grid-cols-[170px_110px] gap-x-8">
      <li>
        <FontAwesomeIcon icon={faEnvelope} class="w-3 mr-1" title="Email" />
        <a
          href="mailto:{profile.email_address}"
          class="underline"
        >{profile.email_address}</a>
      </li>

      <li>
        <FontAwesomeIcon icon={faPhone} class="w-3 mr-1" title="Phone" />
        <a
          href="tel:{profile.phone_number}"
          class="underline"
        >{profile.phone_number}</a>
      </li>

      <li>
        <FontAwesomeIcon
          icon={faLocationDot}
          class="w-3 mr-1"
          title="Location"
        />
        <a
          href={profile.location_url}
          class="underline"
          target="_blank"
        >
          {profile.location}
        </a>
        {#if profile.location_timezone}
          ({profile.location_timezone})
        {/if}
      </li>

      <li>
        <FontAwesomeIcon icon={faGlobe} class="w-3 mr-1" title="Website" />
        <a
          href={profile.personal_website}
          target="_blank"
          class="underline"
        >{
          profile.personal_website.replace(
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
          href={profile.linkedin_profile}
          target="_blank"
          class="underline"
        >{
          profile.linkedin_profile.replace(
            /^https?:\/\/(www.)?linkedin.com\/in\//,
            "",
          )
        }</a>
      </li>

      <li>
        <FontAwesomeIcon
          icon={faGithub}
          class="w-3 mr-1"
          title="GitHub"
        />
        <a
          href={profile.github_profile}
          target="_blank"
          class="underline"
        >{
          profile.github_profile.replace(
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
    <p class="mt-1 text-xs">{profile.summary}</p>
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
      {#each profile.tech_skill_categories as skillGroup, index (index)}
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

  <!-- Side Projects -->
  <div class="my-4 break-inside-avoid">
    <h2 class="text-sm font-bold mb-2 border-b-2 border-black">
      SIDE PROJECTS
    </h2>

    {#each filterOnTags(profile.side_projects) as project (project.name)}
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

  <!-- Education -->
  <div class="my-3 break-inside-avoid">
    <h2 class="text-sm font-bold mb-2 border-b-2 border-black">
      EDUCATION
    </h2>

    <!-- <p> -->
    <!--   Mainly self-thaught because of interests, with a relevant background in -->
    <!--   Network Engineering (Dutch secondary vocational education @ Nova College -->
    <!--   in Hoofddorp) and a half year internship as a PHP & MySQL developer at -->
    <!--   Festivalinfo.nl -->
    <!-- </p> -->

    {#each filterOnTags(profile.education) as education (education.area)}
      <div class="mb-2">
        <div class="font-bold">
          {education.area}, {education.study_type},
          {#if education.graduation_year}
            Graduation Year {education.graduation_year}
          {:else}
            {
              formatDateRangeCompact(
                education.start_date,
                education.end_date,
              )
            }
          {/if}
        </div>

        <div>
          {education.institution}, {education.location}
        </div>
      </div>

      <!-- <div class="flex justify-between mb-3"> -->
      <!--   <div> -->
      <!--     <h3 class="font-bold text-sm">{education.area}</h3> -->
      <!--     <p> -->
      <!--       <strong>{education.institution}</strong> ({education.studyType}) -->
      <!--     </p> -->
      <!--   </div> -->
      <!---->
      <!--   <div> -->
      <!--     { -->
      <!--       formatDateRangeCompact( -->
      <!--         education.start_date, -->
      <!--         education.end_date, -->
      <!--       ) -->
      <!--     } -->
      <!--   </div> -->
      <!-- </div> -->
    {/each}
  </div>

  {#if type === "cv"}
    <div class="mb-6">
      <h2 class="text-sm font-bold mb-2 border-b-2 border-black">
        REFERENCES
      </h2>
      {#each profile.references as reference, index (index)}
        <div class="mb-2">
          <h3 class="font-bold">{reference.author}</h3>
          <p class="italic">"{reference.text}"</p>
        </div>
      {/each}
      <p class="mt-2 font-semibold">Contact details available upon request</p>
    </div>
  {/if}
</div>
