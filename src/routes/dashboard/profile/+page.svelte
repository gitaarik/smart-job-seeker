<script lang="ts">
  import type { PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowLeft,
    faArrowRight,
    faBriefcase,
    faCode,
    faGlobe,
    faGraduationCap,
    faLightbulb,
    faQuoteLeft,
    faUser,
  } from "@fortawesome/free-solid-svg-icons";

  let { data }: { data: PageData } = $props();

  const profile = $derived(data.profile);

  const sections = $derived([
    {
      title: "Basic Info",
      description: "Name, title, contact, location, and social profiles",
      href: "/dashboard/profile/edit",
      icon: faUser,
      count: profile?.name ? 1 : 0,
      countLabel: profile?.name ? "Complete" : "Incomplete",
    },
    {
      title: "Work Experience",
      description: "Companies, positions, achievements, and technologies",
      href: "/dashboard/profile/work-experience",
      icon: faBriefcase,
      count: profile?.work_experiences?.length || 0,
      countLabel: "entries",
    },
    {
      title: "Education",
      description: "Degrees, institutions, and academic achievements",
      href: "/dashboard/profile/education",
      icon: faGraduationCap,
      count: profile?.education?.length || 0,
      countLabel: "entries",
    },
    {
      title: "Skills",
      description: "Technical skills organized by category",
      href: "/dashboard/profile/skills",
      icon: faCode,
      count: profile?.tech_skill_categories?.length || 0,
      countLabel: "categories",
    },
    {
      title: "Side Projects",
      description: "Personal projects, open source, and experiments",
      href: "/dashboard/profile/side-projects",
      icon: faLightbulb,
      count: profile?.side_projects?.length || 0,
      countLabel: "projects",
    },
    {
      title: "Languages",
      description: "Languages you speak and proficiency levels",
      href: "/dashboard/profile/languages",
      icon: faGlobe,
      count: profile?.languages?.length || 0,
      countLabel: "languages",
    },
    {
      title: "References",
      description: "Professional references and recommendations",
      href: "/dashboard/profile/references",
      icon: faQuoteLeft,
      count: profile?.references?.length || 0,
      countLabel: "references",
    },
    {
      title: "Highlights",
      description: "Key achievements and career highlights",
      href: "/dashboard/profile/highlights",
      icon: faLightbulb,
      count: profile?.highlights?.length || 0,
      countLabel: "highlights",
    },
  ]);
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center gap-4">
    <a
      href="/dashboard"
      class="flex items-center gap-2 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors"
    >
      <FontAwesomeIcon icon={faArrowLeft} class="w-4 h-4" />
      <span class="text-sm">Back to Dashboard</span>
    </a>
  </div>

  <div>
    <h1 class="text-2xl font-bold text-[var(--dash-text)]">Edit Profile</h1>
    <p class="text-[var(--dash-text-secondary)] mt-1">
      Manage your professional profile information across all sections.
    </p>
  </div>

  <!-- Profile summary -->
  {#if profile}
    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-6">
      <div class="flex items-center gap-4">
        <div
          class="w-14 h-14 rounded-full bg-[var(--dash-primary)] flex items-center justify-center shrink-0"
        >
          <FontAwesomeIcon icon={faUser} class="w-7 h-7 text-white" />
        </div>
        <div class="flex-1">
          <h2 class="text-xl font-semibold text-[var(--dash-text)]">
            {profile.name || "Unnamed Profile"}
          </h2>
          <p class="text-[var(--dash-text-secondary)]">{profile.title || "No title set"}</p>
        </div>
        <a
          href="/p/{profile.slug}/portfolio"
          target="_blank"
          class="text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] transition-colors text-sm"
        >
          View public profile
        </a>
      </div>
    </div>
  {/if}

  <!-- Section cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    {#each sections as section}
      <a
        href={section.href}
        class="group bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-5 hover:border-[var(--dash-primary)] hover:shadow-md transition-all"
      >
        <div class="flex items-start gap-4">
          <div
            class="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-gray-100 transition-colors"
          >
            <FontAwesomeIcon
              icon={section.icon}
              class="w-6 h-6 text-[var(--dash-primary)]"
            />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <h3
                class="font-semibold text-[var(--dash-text)] group-hover:text-[var(--dash-primary)] transition-colors"
              >
                {section.title}
              </h3>
              <FontAwesomeIcon
                icon={faArrowRight}
                class="w-4 h-4 text-[var(--dash-text-secondary)] group-hover:text-[var(--dash-primary)] transition-colors"
              />
            </div>
            <p class="text-sm text-[var(--dash-text-secondary)] mt-1">{section.description}</p>
            <p class="text-sm font-medium text-[var(--dash-primary)] mt-2">
              {section.count}
              {section.countLabel}
            </p>
          </div>
        </div>
      </a>
    {/each}
  </div>
</div>
