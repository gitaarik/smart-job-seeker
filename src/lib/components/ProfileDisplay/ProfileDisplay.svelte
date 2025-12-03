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
  import ContactItem from "./ContactItem.svelte";

  interface Profile {
    name: string | null;
    title: string | null;
    subtitle: string | null;
    email_address: string | null;
    phone_number: string | null;
    location: string | null;
    location_url: string | null;
    location_timezone?: string | null;
    personal_website: string | null;
    linkedin_profile: string | null;
    github_profile: string | null;
    summary: string | null;
    work_experiences: Array<{
      name: string | null;
      location: string | null;
      position: string | null;
      start_date: Date | null;
      end_date?: Date | null;
      note?: string | null;
      work_experience_achievements?: Array<{
        description: string | null;
        tags: string[] | unknown;
      }>;
      tags: string[];
    }>;
    education: Array<{
      area: string | null;
      study_type: string | null;
      institution: string | null;
      location: string | null;
      summary: string | null;
      start_date: Date | null;
      end_date?: Date | null;
      graduation_year?: string | null;
      tags?: string[];
    }>;
    languages: Array<{
      name: string;
      language_code: string;
      proficiency: string;
    }>;
    nationality?: string;
    references: Array<{
      author: string;
      text: string;
    }>;
    tech_skill_categories: Array<{
      name: string;
      tech_skills: Array<{ name: string }>;
    }>;
    side_projects: Array<{
      name: string;
      url: string;
      url_label: string;
      stars: string;
      start_date: Date;
      end_date?: Date;
      summary: string;
      tags: string[];
    }>;
    highlights: Array<{
      title: string;
      description: string;
      tags?: string[];
    }>;
    profile_versions: Array<{
      id: number;
      name: string;
      toggles: string[];
      extends_from: number;
    }>;
  }

  export let profile: Profile;
  export let type: string | null = null;

  function getVersion(idx: string | number) {
    if (typeof idx === "number") {
      return profile.profile_versions.find((v) => v.id === idx);
    } else {
      return profile.profile_versions.find((v) => v.name === idx);
    }
  }

  const version: string = page.url.searchParams.get("version") || "";
  let versionObj = getVersion(version);
  const versionObjs = [versionObj];

  while (versionObj && versionObj.extends_from) {
    versionObj = getVersion(versionObj.extends_from);
    versionObjs.push(versionObj);
  }

  const versionNames = versionObjs.map((v) => v?.name).filter(
    Boolean,
  ) as string[];

  function filterOnTags<
    T extends { tags?: string[] | null } & Record<string, any>,
  >(objList: T[]): T[] {
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
          if (!(tags.length && versionNames.length)) return true;

          return versionNames.some((versionName) => {
            return tags.includes(versionName);
          });
        }
      }

      return true;
    });
  }

  const work_experiences = filterOnTags(profile.work_experiences);

  let toggles: string[] = [];

  versionObjs.forEach((versionObj) => {
    if (versionObj?.toggles?.length) {
      versionObj.toggles.forEach((toggle) => {
        toggles.push(toggle);
      });
    }
  });
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
    <div>
      <h1 class="text-2xl font-bold h-9">{profile.name}<br><br></h1>
      <h2 class="text-sm h-5">{profile.title}<br><br></h2>
      <h2 class="text-xs mt-1 h-5">{profile.subtitle}<br><br></h2>
    </div>

    <ul
      class="text-xs mt-3 grid grid-cols-2 grid-cols-[220px_150px] gap-x-2 auto-rows-[22px]"
    >
      <ContactItem
        label="Email"
        href={profile.email_address}
        content={profile.email_address}
        type="email"
      />

      <ContactItem
        label="Phone"
        href={profile.phone_number}
        content={profile.phone_number}
        type="phone"
      />

      <ContactItem
        label="Location"
        href={profile.location_url}
        content={profile.location}
      >
        {#if profile.location_timezone}
          ({profile.location_timezone})
        {/if}
      </ContactItem>

      <ContactItem
        label="Website"
        href={profile.personal_website}
        content={profile.personal_website
          ? profile.personal_website
            .replace(/^https?:\/\/(www.)?/, "")
            .replace(/\/$/, "")
          : null}
      />

      <ContactItem
        label="LinkedIn"
        href={profile.linkedin_profile}
        content={profile.linkedin_profile
          ? profile.linkedin_profile.replace(
            /^https?:\/\/(www.)?linkedin.com\/in\//,
            "",
          )
          : null}
      />

      <ContactItem
        label="GitHub"
        href={profile.github_profile}
        content={profile.github_profile
          ? profile.github_profile.replace(
            /^https?:\/\/(www.)?github.com\//,
            "",
          )
          : null}
      />
    </ul>
    <br>
  </header>

  <!-- Summary -->
  <div class="my-4">
    <h2 class="text-sm font-bold">SUMMARY</h2>

    <hr class="mt-1 mb-2" />

    <p class="mt-1 text-xs mb-[-30px]">{profile.summary}<br><br><br></p>
  </div>

  <!-- Work Experience -->
  <div class="my-4 mb-[-20px]">
    <h2 class="text-sm font-bold h-5">WORK EXPERIENCE<br><br></h2>

    <hr class="mt-1 mb-2" />

    {#each work_experiences as job, index (index)}
      <div class="mb-[-10px]">
        <div class="text-xs font-bold mb-1">
          {job.name} |
          {job.location} |
          {job.position} |
          {formatDateRangeCompact(job.start_date, job.end_date)}
        </div>

        {#if job.note}
          <p class="text-sm italic"><strong>Note:</strong> {job.note}</p>
        {/if}

        {#if         job.work_experience_achievements &&
          job.work_experience_achievements.length > 0}
          {@const         filteredHighlights = filterOnTags(
          job.work_experience_achievements,
        )}
          {#if filteredHighlights.length > 0}
            <ul class="list-disc ml-3 print:ml-4">
              {#each filteredHighlights as highlight, index (index)}
                <li class="print:indent-[-6px] whitespace-nowrap">
                  <span class="inline-block w-0 opacity-0">-&nbsp;</span>{
                    highlight.description
                  }
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
        <br>
      </div>
    {/each}
  </div>

  <!-- Skills -->
  <div class="my-4 break-inside-avoid mb-[-20px]">
    <h2 class="text-sm font-bold">SKILLS</h2>

    <hr class="mt-1 mb-2" />

    <ul class="list-disc ml-3 print:ml-4">
      {#each profile.tech_skill_categories as skillGroup, index (index)}
        <li class="print:indent-[-6px]">
          <span class="inline-flex items-center h-2 whitespace-nowrap">
            <span class="w-0 opacity-0">-&nbsp;</span>
            <span class="font-bold mr-1 print:mr-[10px]">{
                skillGroup.name
              }:</span>
            <span class="text-xs">
              {
                skillGroup.tech_skills.map(
                  (s: { name: string }) => s.name,
                ).join(" | ")
              }
            </span>
            <br>
          </span>
        </li>
      {/each}
    </ul>
    <br>
  </div>

  <!-- Side Projects -->
  <div class="my-4 break-inside-avoid">
    <h2 class="text-sm font-bold h-5">SIDE PROJECTS<br><br></h2>

    <hr class="mt-1 mb-2" />

    {#each filterOnTags(profile.side_projects) as project (project.name)}
      {@const       { isGithub, displayLabel } = formatProjectUrl(
        project.url,
        project.url_label,
      )}
      <div class="mb-2">
        <div class="flex items-center gap-1 text-xs font-bold mb-1">
          <span class="order-1 after:content-['|'] after:ml-1">
            {project.name}
          </span>

          <span class="order-3">
            | {
              formatDateRangeCompact(
                project.start_date,
                project.end_date,
              )
            }
          </span>

          <a
            href={project.url}
            target="_blank"
            class="inline-flex gap-1 order-2 whitespace-nowrap hover:text-slate-600"
          >
            {#if isGithub}
              <span>
                <FontAwesomeIcon
                  icon={faGithub}
                  class="w-3"
                  title="GitHub"
                />
              </span>
            {/if}

            <span
              class="inline-flex underline"
              style="--display-label: '{displayLabel}'"
            >
              <span class="inline-block w-0 opacity-0">{project.url}</span>

              <span
                class="inline-block after:content-[var(--display-label)] after:underline"
              >
              </span>

              <!-- {displayLabel} -->
            </span>

            {#if isGithub && parseInt(project.stars) >= 50}
              <FontAwesomeIcon icon={faStar} title="Stars" class="w-3" />
              {project.stars}
              <span class="inline-block w-0 opacity-0">GitHub stars</span>
            {/if}
          </a>
        </div>

        <div class="text-xs mb-[-31px]">{project.summary}<br><br><br></div>
      </div>
    {/each}
  </div>

  <!-- Education -->
  <div class="my-3 break-inside-avoid mb-[-45px]">
    <h2 class="text-sm font-bold h-5">EDUCATION<br><br></h2>

    <hr class="mt-1 mb-2" />

    {#each filterOnTags(profile.education) as education (education.area)}
      <div class="mb-2">
        <div class="font-bold">
          {education.area}, {education.study_type}{#if type === "cv"},

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
          {/if} |
          {education.institution}, {education.location}
        </div>

        <div>
          {education.summary}
        </div>
      </div>
    {/each}
    <br><br>
  </div>

  <!-- Languages -->
  <div class="my-3 break-inside-avoid">
    <h2 class="text-sm font-bold h-5">LANGUAGES<br><br></h2>

    <hr class="mt-1 mb-2" />

    {#each profile.languages as language (language.language_code)}
      <div>
        {language.name}: {
          language.proficiency.substr(0, 1).toUpperCase() +
            language.proficiency.substr(1)
        }
      </div>
    {/each}
  </div>

  {#if toggles.includes("nationality")}
    <!-- Nationality -->
    <div class="my-3 break-inside-avoid">
      <h2 class="text-sm font-bold">
        NATIONALITY
      </h2>

      <hr class="mt-1 mb-2" />

      <div>
        {profile.nationality}
      </div>
    </div>
  {/if}

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
