<script lang="ts">
  import { page } from "$app/state";
  import { formatDateRangeCompact } from "$lib/tools/date-utils";
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
      // Drizzle `date()` columns return strings; `timestamp()` returns Date.
      // The relevant columns are `date()`, so the wire type is string.
      start_date: string | null;
      end_date?: string | null;
      note?: string | null;
      work_experience_achievements?: Array<{
        description: string | null;
        tags: string[] | unknown;
      }>;
      // Drizzle `json()` columns surface as `unknown` until validated; the
      // template uses filterOnTags() which accepts both shapes.
      tags: string[] | unknown;
    }>;
    // Drizzle relation is `educations` (plural); singular was a stale name.
    educations: Array<{
      area: string | null;
      study_type: string | null;
      institution: string | null;
      location: string | null;
      summary: string | null;
      // Drizzle `date()` columns return strings; `timestamp()` returns Date.
      // The relevant columns are `date()`, so the wire type is string.
      start_date: string | null;
      end_date?: string | null;
      graduation_year?: string | null;
      tags?: string[] | unknown;
    }>;
    languages: Array<{
      name: string;
      language_code: string;
      proficiency: string;
    }>;
    nationality?: string;
    certificates: Array<{
      name: string;
      issuer: string | null;
      date: string | null;
      url: string | null;
    }>;
    references: Array<{
      author: string;
      text: string;
    }>;
    tech_skill_categories: Array<{
      name: string;
      tech_skills: Array<{ name: string }>;
    }>;
    side_projects: Array<{
      name: string | null;
      url: string | null;
      url_label: string | null;
      stars: number | null;
      start_date: string | null;
      end_date?: string | null;
      summary: string | null;
      tags: string[] | unknown;
    }>;
    highlights: Array<{
      title: string;
      description: string;
      tags?: string[];
    }>;
    profile_versions: Array<{
      id: number;
      slug: string;
      toggles: string[];
      // Drizzle relation rows from `profile_version_extensions` keyed on
      // extender_id. Each junction row has the extended_id (the parent
      // version this version extends).
      profile_version_extensions_extender_id: Array<{
        id: number;
        extended_id: number | null;
        extender_id: number | null;
      }>;
    }>;
  }

  interface Props {
    profile: Profile;
    type?: string | null;
    versionId?: number | null;
  }

  let { profile, type = null, versionId = null }: Props = $props();

  function getVersion(idx: string | number) {
    if (!profile.profile_versions) return undefined;
    if (typeof idx === "number") {
      return profile.profile_versions.find((v) => v.id === idx);
    } else {
      return profile.profile_versions.find((v) => v.slug === idx);
    }
  }

  // Use versionId prop if provided, otherwise fall back to URL query param
  const versionFromUrl: string = page.url.searchParams.get("version") || "";
  let versionObj = versionId ? getVersion(versionId) : getVersion(versionFromUrl);

  type VersionObj = Profile["profile_versions"][number];

  function getAllVersionObjs(versionObj: VersionObj | undefined) {
    const versionObjs = [versionObj];

    const addVersionObjs = (versionObj: VersionObj | undefined) => {
      if (
        versionObj &&
        versionObj
          .profile_version_extensions_extender_id
      ) {
        for (
          const junctionObj of versionObj
            .profile_version_extensions_extender_id
        ) {
          if (junctionObj.extended_id == null) continue;
          const extObj = getVersion(junctionObj.extended_id);
          versionObjs.push(extObj);
          addVersionObjs(extObj);
        }
      }
    };

    addVersionObjs(versionObj);

    return versionObjs;
  }

  const versionObjs = getAllVersionObjs(versionObj);

  // while (versionObj && versionObj.extends_from) {
  //   versionObj = getVersion(versionObj.extends_from);
  //   versionObjs.push(versionObj);
  // }

  const versionSlugs = versionObjs.map((v) => v?.slug).filter(
    Boolean,
  ) as string[];

  function filterOnTags<
    // Drizzle `json()` columns surface as `unknown`; we narrow at the call
    // site below before treating it as a string array.
    T extends { tags?: string[] | unknown } & Record<string, any>,
  >(objList: T[]): T[] {
    return objList.filter((obj) => {
      if ("tags" in obj && Array.isArray(obj.tags) && obj.tags.length) {
        const tagsArr = obj.tags as string[];
        if (
          !tagsArr.includes(type || "resume") &&
          tagsArr.includes(type === "resume" ? "cv" : "resume")
        ) {
          // If the opposite of `type` is in `obj.tags`, but `type` itself not
          // For example, when `type` is "cv" and `obj.tags` contains "resume"
          // but not "cv", then this obj should be hidden.
          return false;
        } else {
          const tags = tagsArr.filter((item: string) =>
            !(["resume", "cv"].includes(item))
          );
          if (!(tags.length && versionSlugs.length)) return true;

          return versionSlugs.some((versionSlug) => {
            return tags.includes(versionSlug);
          });
        }
      }

      return true;
    });
  }

  const work_experiences = filterOnTags(profile.work_experiences);

  let toggles: string[] = [];

  versionObjs.forEach((versionObj: VersionObj | undefined) => {
    if (versionObj?.toggles?.length) {
      versionObj.toggles.forEach((toggle: string) => {
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

<article
  class="w-[699px] print:w-[initial] mx-auto px-8 print:px-0 py-8 print:py-0 bg-white text-black text-xs leading-relaxed"
>
  <!-- Header Section -->
  <header>
    <h1 class="text-2xl font-bold h-9">{profile.name}<br><br></h1>
    <h2 class="text-sm h-5">{profile.title}<br><br></h2>
    <h2 class="text-xs mt-1 h-5">{profile.subtitle}<br><br></h2>
  </header>

  <!-- Contact Details -->
  {#if profile.email_address || profile.phone_number || profile.location || profile.personal_website || profile.linkedin_profile || profile.github_profile}
    <section class="mt-1 mb-[-15px]">
      <ul class="list-disc ml-3 print:ml-4">
        {#if profile.email_address}
          <li class="print:indent-[-3px]">
            <ContactItem
              label="Email"
              href={profile.email_address}
              content={profile.email_address}
              type="email"
            />
          </li>
        {/if}

        {#if profile.phone_number}
          <li class="print:indent-[-3px]">
            <ContactItem
              label="Phone"
              href={profile.phone_number}
              content={profile.phone_number}
              type="phone"
            />
          </li>
        {/if}

        {#if profile.location}
          <li class="print:indent-[-3px]">
            <ContactItem
              label="Location"
              href={profile.location_url}
              content={profile.location}
            >
              {#if profile.location_timezone}
                ({profile.location_timezone})
              {/if}
            </ContactItem>
          </li>
        {/if}

        {#if profile.personal_website}
          <li class="print:indent-[-3px]">
            <ContactItem
              label="Website"
              href={profile.personal_website}
              content={profile.personal_website}
            />
          </li>
        {/if}

        {#if profile.linkedin_profile}
          <li class="print:indent-[-3px]">
            <ContactItem
              label="LinkedIn"
              href={profile.linkedin_profile}
              content={profile.linkedin_profile}
            />
          </li>
        {/if}

        {#if profile.github_profile}
          <li class="print:indent-[-3px]">
            <ContactItem
              label="GitHub"
              href={profile.github_profile}
              content={profile.github_profile}
            />
          </li>
        {/if}
      </ul>
      <br>
    </section>
  {/if}

  <!-- Summary -->
  {#if profile.summary}
    <section class="my-4">
      <h2 class="text-sm font-bold">SUMMARY</h2>

      <hr class="mt-1 mb-2" />

      <p class="mt-1 text-xs mb-[-30px]">{profile.summary}<br><br><br></p>
    </section>
  {/if}

  <!-- Work Experience -->
  {#if work_experiences.length > 0}
    <section class="my-4 mb-[-20px]">
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
    </section>
  {/if}

  <!-- Skills -->
  {#if profile.tech_skill_categories && profile.tech_skill_categories.length > 0}
    <section class="my-4 break-inside-avoid mb-[-20px]">
      <h2 class="text-sm font-bold">SKILLS</h2>

      <hr class="mt-1 mb-2" />

      <ul class="list-disc ml-3 print:ml-4">
        {#each profile.tech_skill_categories as skillGroup, index (index)}
          <li class="print:indent-[-2px]">
            <span class="inline-flex items-center h-2 whitespace-nowrap">
              <span class="w-0 opacity-0">-&nbsp;</span>
              <span class="font-bold mr-1 print:mr-[6px]">{
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
    </section>
  {/if}

  <!-- Side Projects -->
  {#if filterOnTags(profile.side_projects).length > 0}
    <section class="my-4 break-inside-avoid">
      <h2 class="text-sm font-bold h-5">SIDE PROJECTS<br><br></h2>

      <hr class="mt-1 mb-2" />

      {#each filterOnTags(profile.side_projects) as project, index (index)}
        <div class="mb-3">
          <div class="text-xs font-bold mb-0">
            {project.name} | {
              formatDateRangeCompact(
                project.start_date,
                project.end_date,
              )
            }
          </div>

          <div>
            <a
              href={project.url}
              target="_blank"
              class="underline whitespace-nowrap hover:text-slate-600"
            >
              {project.url}
            </a>
          </div>

          <div class="text-xs mb-[-31px]">{project.summary}<br><br><br></div>
        </div>
      {/each}
    </section>
  {/if}

  <!-- Education -->
  {#if filterOnTags(profile.educations).length > 0}
    <section class="my-3 break-inside-avoid mb-[-45px]">
      <h2 class="text-sm font-bold h-5">EDUCATION<br><br></h2>

      <hr class="mt-1 mb-2" />

      {#each filterOnTags(profile.educations) as education, index (index)}
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
    </section>
  {/if}

  {#if profile.certificates && profile.certificates.length > 0}
    <!-- Certificates -->
    <section class="my-3 break-inside-avoid">
      <h2 class="text-sm font-bold h-5">CERTIFICATES<br><br></h2>

      <hr class="mt-1 mb-2" />

      {#each profile.certificates as cert, index (index)}
        <div>
          <span class="font-bold">{cert.name}</span>{#if cert.issuer} — {cert.issuer}{/if}{#if cert.date}, {new Date(cert.date).getFullYear()}{/if}
        </div>
      {/each}
    </section>
  {/if}

  <!-- Languages -->
  {#if profile.languages && profile.languages.length > 0}
    <section class="my-3 break-inside-avoid">
      <h2 class="text-sm font-bold h-5">LANGUAGES<br><br></h2>

      <hr class="mt-1 mb-2" />

      {#each profile.languages as language, index (index)}
        <div>
          {language.name}: {
            language.proficiency.substr(0, 1).toUpperCase() +
              language.proficiency.substr(1)
          }
        </div>
      {/each}
    </section>
  {/if}

  {#if toggles.includes("nationality")}
    <!-- Nationality -->
    <section class="my-3 break-inside-avoid">
      <h2 class="text-sm font-bold">
        NATIONALITY
      </h2>

      <hr class="mt-1 mb-2" />

      <div>
        {profile.nationality}
      </div>
    </section>
  {/if}

  {#if type === "cv" && profile.references && profile.references.length > 0}
    <section class="mb-6">
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
    </section>
  {/if}
</article>
