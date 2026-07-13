<script lang="ts">
  import { page } from "$app/state";
  import { formatDateRangeCompact } from "$lib/tools/date-utils";
  import { createProfileFilter } from "../ProfileDisplay/profile-filter";

  interface WorkExperience {
    name: string | null;
    location: string | null;
    position: string | null;
    start_date: string | null;
    end_date?: string | null;
    headline?: string | null;
    tags: string[] | unknown;
    work_experience_achievements?: Array<
      { description: string | null; tags: string[] | unknown }
    >;
    work_experience_technologies?: Array<{ name: string | null }>;
  }
  interface SkillCategory {
    name: string | null;
    tags?: string[] | unknown;
    tech_skills: Array<{ name: string | null }>;
  }
  interface Education {
    area: string | null;
    study_type: string | null;
    institution: string | null;
    location: string | null;
    tags?: string[] | unknown;
  }
  interface Profile {
    name: string | null;
    title: string | null;
    email_address: string | null;
    phone_number: string | null;
    location: string | null;
    location_timezone?: string | null;
    personal_website: string | null;
    linkedin_profile: string | null;
    github_profile: string | null;
    summary: string | null;
    work_experiences: WorkExperience[];
    educations: Education[];
    tech_skill_categories: SkillCategory[];
    profile_versions: any[];
  }

  interface Props {
    profile: Profile;
    type?: string | null;
    versionId?: number | null;
  }
  let { profile, type = null, versionId = null }: Props = $props();

  const versionFromUrl = page.url.searchParams.get("version") || "";
  const { filterOnTags } = createProfileFilter(
    profile.profile_versions,
    type,
    versionId,
    versionFromUrl,
  );

  const skills = filterOnTags(profile.tech_skill_categories ?? []);
  const work = filterOnTags(profile.work_experiences ?? []);
  const education = filterOnTags(profile.educations ?? []);

  // Citrus-specific: the stored headline holds only the base text; the job
  // location is appended here ("… in {location}.").
  function lead(job: WorkExperience): string {
    if (!job.headline) return "";
    const loc = (job.location ?? "").trim();
    return job.headline + (loc ? ` in ${loc}` : "") + ".";
  }
  function tech(job: WorkExperience): string {
    return (job.work_experience_technologies ?? [])
      .map((t) => t.name ?? "")
      .filter(Boolean)
      .join(", ");
  }
  function eduLine(e: Education): string {
    const head = [e.area, e.study_type].filter(Boolean).join(", ");
    const tail = [e.institution, e.location].filter(Boolean).join(", ");
    return [head, tail].filter(Boolean).join(" – ");
  }

  const contactLocation = [
    profile.location,
    profile.location_timezone ? `(${profile.location_timezone})` : "",
  ].filter(Boolean).join(" ");

  const contacts = [
    { icon: "mail", text: profile.email_address },
    { icon: "phone", text: profile.phone_number },
    { icon: "pin", text: contactLocation || null },
    { icon: "globe", text: profile.personal_website },
    { icon: "linkedin", text: profile.linkedin_profile },
    { icon: "github", text: profile.github_profile },
  ].filter((c) => !!c.text);
</script>

{#snippet icon(name: string)}
  {#if name === "mail"}
    <svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z" fill="none" stroke="#fff" stroke-width="2"/><path d="M4 7l8 6 8-6" fill="none" stroke="#fff" stroke-width="2"/></svg>
  {:else if name === "phone"}
    <svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C11 21 3 13 3 3c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1L6.6 10.8z" fill="#fff"/></svg>
  {:else if name === "pin"}
    <svg viewBox="0 0 24 24"><path d="M12 22s7-6.1 7-12a7 7 0 10-14 0c0 5.9 7 12 7 12z" fill="#fff"/><circle cx="12" cy="10" r="2.4" fill="#141414"/></svg>
  {:else if name === "globe"}
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="2"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" fill="none" stroke="#fff" stroke-width="2"/></svg>
  {:else if name === "linkedin"}
    <svg viewBox="0 0 24 24" fill="#fff"><path d="M4.98 3.5A2.5 2.5 0 002.5 6 2.5 2.5 0 005 8.5 2.5 2.5 0 007.5 6 2.5 2.5 0 004.98 3.5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.1c.5-.9 1.8-1.9 3.6-1.9 3.9 0 4.6 2.5 4.6 5.8V21h-4v-4.9c0-1.2 0-2.7-1.7-2.7s-1.9 1.3-1.9 2.6V21h-4z"/></svg>
  {:else if name === "github"}
    <svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2C6.5 2 2 6.6 2 12.2c0 4.5 2.9 8.3 6.8 9.6.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.4-3.4-1.4-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1 .8-.2 1.6-.3 2.5-.3s1.7.1 2.5.3c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5 3.9-1.3 6.8-5.1 6.8-9.6C22 6.6 17.5 2 12 2z"/></svg>
  {/if}
{/snippet}

<div class="citrus">
  <div class="bg"><img src="/citrus/bg.png" alt="" /></div>
  <table class="page">
    <!-- thead/tfoot repeat per printed page and reserve space so content clears
         the badge (top) and the footer bar (bottom), both of which are painted
         by the full-page fixed background above. -->
    <thead>
      <tr><td class="hspace-top"></td></tr>
    </thead>
    <tfoot>
      <tr><td class="hspace-bottom"></td></tr>
    </tfoot>
    <tbody>
      <tr>
        <td>
          <h1>{profile.name}</h1>
          {#if profile.title}<div class="subtitle">{profile.title}</div>{/if}
          <div class="wave"><img src="/citrus/wave.png" alt="" /></div>

          {#if profile.summary}
            <p class="summary">{profile.summary}</p>
          {/if}

          {#if skills.length > 0}
            <h2>Skills</h2>
            <div class="skills">
              {#each skills as cat (cat.name)}
                <div class="skill">
                  <h3>{cat.name}</h3>
                  <p>{cat.tech_skills.map((s) => s.name ?? "").filter(Boolean).join(", ")}</p>
                </div>
              {/each}
            </div>
          {/if}

          <div class="exp">
            <aside class="sidebar">
              {#if contacts.length > 0}
                <div class="block">
                  <h2>Contact details</h2>
                  {#each contacts as c (c.icon)}
                    <div class="contact-row">
                      <span class="ci">{@render icon(c.icon)}</span>
                      <span>{c.text}</span>
                    </div>
                  {/each}
                </div>
              {/if}
              {#if education.length > 0}
                <div class="block">
                  <h2>Education</h2>
                  {#each education as e (eduLine(e))}
                    <div class="edu-item">
                      <span class="tl"><span class="ydot"></span><span class="tline"></span></span>
                      <p>{eduLine(e)}</p>
                    </div>
                  {/each}
                </div>
              {/if}
            </aside>

            {#if work.length > 0}
              <h2>Work experience</h2>
              {#each work as job, i (i)}
                {@const achievements = filterOnTags(job.work_experience_achievements ?? [])}
                {@const techLine = tech(job)}
                <div class="job">
                  <div class="job-meta">
                    <div class="job-title">{job.position}</div>
                    <div class="job-co">{job.name}</div>
                    <div class="job-date">{formatDateRangeCompact(job.start_date, job.end_date)}</div>
                  </div>
                  <div class="job-body">
                    {#if lead(job)}<p class="lead">{lead(job)}</p>{/if}
                    {#if achievements.length > 0}
                      <ul>
                        {#each achievements as a, ai (ai)}
                          <li>{a.description}</li>
                        {/each}
                      </ul>
                    {/if}
                    {#if techLine}
                      <p class="tech"><span>TECH:</span> {techLine}</p>
                    {/if}
                  </div>
                </div>
                {#if i < work.length - 1}<hr class="jdiv" />{/if}
              {/each}
            {/if}
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</div>

<style>
  @font-face {
    font-family: "Poppins";
    font-style: normal;
    font-weight: 800;
    font-display: block;
    src: url("/citrus/fonts/poppins-extrabold.woff2") format("woff2");
  }
  @font-face {
    font-family: "Carlito";
    font-style: normal;
    font-weight: 400;
    font-display: block;
    src: url("/citrus/fonts/carlito-regular.woff2") format("woff2");
  }
  @font-face {
    font-family: "Carlito";
    font-style: normal;
    font-weight: 700;
    font-display: block;
    src: url("/citrus/fonts/carlito-bold.woff2") format("woff2");
  }

  /* White canvas (dark-mode safe) on <html>; body stays transparent so it
     doesn't paint over the fixed background layer below. */
  :global(html) { background: #fff !important; margin: 0; }
  :global(body) { background: transparent !important; margin: 0; }
  @media print {
    @page { size: A4; margin: 0; }
  }

  .citrus {
    font-family: "Carlito", "Calibri", sans-serif;
    color: #3a3a3a;
    font-size: 9.1pt;
    line-height: 1.45;
    letter-spacing: 0.2px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .citrus * { box-sizing: border-box; }

  /* circles + footer bar: full-page fixed layer, repeats on every printed page.
     z-index:0 keeps it above the white canvas; content sits above via z-index:1
     (avoids the negative-z-index-behind-body-background gotcha). */
  .bg { position: fixed; inset: 0; z-index: 0; }
  .bg img { width: 100%; height: 100%; }

  /* thead/tfoot repeat as running header/footer on every page and reserve space */
  .page { position: relative; z-index: 1; width: 100%; border-collapse: collapse; }
  .hspace-top { height: 30mm; padding: 0; }
  .hspace-bottom { height: 16mm; padding: 0; }
  tbody td { padding: 0 15mm; vertical-align: top; }

  h1 {
    font-family: "Poppins", sans-serif;
    font-weight: 800;
    font-size: 31pt;
    color: #111;
    letter-spacing: -0.5px;
    line-height: 1;
    margin: 0;
  }
  .subtitle { font-weight: 700; font-size: 12pt; color: #111; margin-top: 2px; letter-spacing: 0.5px; }
  .wave { margin: 5px 0 12px; }
  .wave img { width: 48mm; height: 2.4mm; object-fit: fill; }
  .summary { margin-bottom: 18px; text-align: left; }
  h2 { font-weight: 700; font-size: 14pt; color: #111; margin: 0 0 9px; }
  .skills { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 30px; margin-bottom: 20px; }
  .skill h3 { font-weight: 700; font-size: 9.9pt; color: #111; margin: 0 0 1px; }
  .skill p { font-size: 9.1pt; color: #444; margin: 0; }
  .exp { overflow: hidden; }
  .sidebar { float: right; width: 33%; padding-left: 20px; }
  .sidebar .block { margin-bottom: 15px; }
  .contact-row { display: flex; align-items: center; gap: 10px; margin-bottom: 9px; font-size: 9.1pt; }
  .ci { flex: 0 0 20px; width: 20px; height: 20px; background: #141414; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; }
  .ci :global(svg) { width: 12px; height: 12px; }
  .edu-item { display: flex; gap: 11px; align-items: stretch; min-height: 15mm; }
  .tl { flex: 0 0 10px; display: flex; flex-direction: column; align-items: center; }
  .ydot { width: 10px; height: 10px; border-radius: 50%; background: #ffd400; margin-top: 2px; flex: 0 0 auto; }
  .tline { width: 1.5px; flex: 1 1 auto; background: #dcdcdc; margin-top: 3px; }
  .edu-item p { font-size: 9.1pt; margin: 0; }
  .job { display: flex; gap: 16px; }
  .job-meta { flex: 0 0 118px; }
  .job-title { font-weight: 700; font-size: 9.7pt; color: #111; line-height: 1.2; }
  .job-co { font-weight: 400; color: #444; margin-top: 1px; }
  .job-date { font-weight: 700; font-size: 9.1pt; color: #111; margin-top: 8px; }
  .job-body .lead { margin-bottom: 4px; }
  .job-body ul { list-style: none; margin: 0; padding: 0; }
  .job-body li { position: relative; padding-left: 14px; margin-bottom: 3px; }
  .job-body li::before { content: ""; position: absolute; left: 0; top: 5px; width: 5px; height: 5px; border-radius: 50%; background: #555; }
  .tech { margin-top: 5px; font-size: 8.5pt; color: #3a3a3a; }
  .tech span { font-weight: 700; color: #111; }
  .jdiv { border: 0; border-top: 1px solid #d9d9d9; margin: 13px 0; clear: both; }
</style>
