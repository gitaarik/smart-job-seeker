<script lang="ts">
  import { page } from "$app/state";
  import {
    formatDateRangeCompact,
    formatDateRangeYear,
  } from "$lib/tools/date-utils";
  import { formatProjectUrl } from "$lib/tools/url-utils";
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
        tags: string[];
      }>;
      tags: string[];
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
      tags: string[];
    }>;
  }

  export let profile: Profile;
  export let type: string | null = null;
  const version = page.url.searchParams.get("version");

  function filterOnTags<T extends { tags?: string[] }>(objList: T[]): T[] {
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
          if (!(tags.length && version)) return true;
          return tags.includes(version);
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

    <ul
      class="text-xs mt-3 grid grid-cols-2 grid-cols-[210px_150px] gap-x-2 auto-rows-[22px]"
    >
      <li>
        <!-- <FontAwesomeIcon icon={faEnvelope} class="w-3 mr-1" title="Email" /> -->

        <span class="inline-block w-14 text-right font-bold">
          Email:
        </span>

        <a
          href="mailto:{profile.email_address}"
          class="underline"
        >{profile.email_address}</a>
      </li>

      <li>
        <!-- <FontAwesomeIcon icon={faPhone} class="w-3 mr-1" title="Phone" /> -->

        <span class="inline-block w-13 text-right font-bold">
          Phone:
        </span>

        <a
          href="tel:{profile.phone_number}"
          class="underline"
        >{profile.phone_number}</a>
      </li>

      <li>
        <!-- <FontAwesomeIcon -->
        <!--   icon={faLocationDot} -->
        <!--   class="w-3 mr-1" -->
        <!--   title="Location" -->
        <!-- /> -->

        <span class="inline-block w-14 text-right font-bold">
          Location:
        </span>

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
        <!-- <FontAwesomeIcon icon={faGlobe} class="w-3 mr-1" title="Website" /> -->

        <span class="inline-block w-13 text-right font-bold">
          Website:
        </span>

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
        <!-- <FontAwesomeIcon -->
        <!--   icon={faLinkedin} -->
        <!--   class="w-3 mr-1" -->
        <!--   title="LinkedIn" -->
        <!-- /> -->

        <span class="inline-block w-14 text-right font-bold">
          LinkedIn:
        </span>

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
        <!-- <FontAwesomeIcon -->
        <!--   icon={faGithub} -->
        <!--   class="w-3 mr-1" -->
        <!--   title="GitHub" -->
        <!-- /> -->

        <span class="inline-block w-13 text-right font-bold">
          GitHub:
        </span>

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
    <h2 class="text-sm font-bold">
      SUMMARY
    </h2>

    <hr class="mt-1 mb-2" />

    <p class="mt-1 text-xs">{profile.summary}</p>
  </div>

  <!-- Work Experience -->
  <div class="my-4">
    <h2 class="text-sm font-bold">
      WORK EXPERIENCE
    </h2>

    <hr class="mt-1 mb-2" />

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
    <h2 class="text-sm font-bold">
      SKILLS
    </h2>

    <hr class="mt-1 mb-2" />

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
    <h2 class="text-sm font-bold">
      SIDE PROJECTS
    </h2>

    <hr class="mt-1 mb-2" />

    {#each filterOnTags(profile.side_projects) as project (project.name)}
      {@const { isGithub, displayLabel } = formatProjectUrl(project.url)}
      <div class="mb-2">
        <div class="text-xs font-bold mb-1">
          {project.name} |
          <a
            href={project.url}
            target="_blank"
            class="hover:text-white/70"
          >
            {#if isGithub}
              <FontAwesomeIcon icon={faGithub} class="w-3" title="GitHub" />
            {/if}

            <span class="underline">
              {displayLabel}
            </span>

            {#if isGithub}
              <FontAwesomeIcon icon={faStar} title="Stars" class="w-3" />
              {project.stars}
            {/if}
          </a>
        </div>

        <div class="text-xs">
          {project.summary}
        </div>
      </div>
    {/each}
  </div>

  <!-- Education -->
  <div class="my-3 break-inside-avoid">
    <h2 class="text-sm font-bold">
      EDUCATION
    </h2>

    <hr class="mt-1 mb-2" />

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
    {/each}
  </div>

  {#if type === "cv"}
    <div class="mb-6">
      <h2 class="text-sm font-bold">
        REFERENCES
      </h2>

      <hr class="mt-1 mb-2" />

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
