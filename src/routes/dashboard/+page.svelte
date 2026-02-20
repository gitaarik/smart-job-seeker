<script lang="ts">
  import type { PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBriefcase,
    faCode,
    faEdit,
    faExternalLinkAlt,
    faFileAlt,
    faGraduationCap,
    faPaperPlane,
    faSearch,
    faUser,
  } from "@fortawesome/free-solid-svg-icons";

  let { data }: { data: PageData } = $props();

  const profile = $derived(data.fullProfile);
</script>

<div class="space-y-5">
  <!-- Page header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 class="text-lg font-semibold text-[var(--dash-text)]">Dashboard</h1>
      <p class="text-[var(--dash-text-secondary)] mt-1">
        Welcome back! Here's an overview of your profile.
      </p>
    </div>
    {#if profile?.slug}
      <a
        href="/p/{profile.slug}/portfolio"
        target="_blank"
        class="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
      >
        <span>View Public Profile</span>
        <FontAwesomeIcon icon={faExternalLinkAlt} class="w-4 h-4" />
      </a>
    {/if}
  </div>

  <!-- Profile summary card -->
  <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4">
    <div class="flex items-start gap-3">
      <div
        class="w-12 h-12 rounded-full bg-[var(--dash-primary)] flex items-center justify-center shrink-0"
      >
        <FontAwesomeIcon icon={faUser} class="w-6 h-6 text-white" />
      </div>
      <div class="flex-1 min-w-0">
        <h2 class="text-base font-semibold text-[var(--dash-text)]">
          {profile?.name || "Unnamed Profile"}
        </h2>
        <p class="text-[var(--dash-text-secondary)]">{profile?.title || "No title set"}</p>
        {#if profile?.headline}
          <p class="text-sm text-[var(--dash-text-secondary)] mt-2 line-clamp-2">{profile.headline}</p>
        {/if}
      </div>
    </div>
  </div>

  <!-- Quick stats -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-3">
      <div class="flex items-center gap-2.5">
        <div
          class="w-8 h-8 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center shrink-0"
        >
          <FontAwesomeIcon icon={faBriefcase} class="w-4 h-4 text-[var(--dash-text-muted)]" />
        </div>
        <div class="min-w-0">
          <p class="text-lg font-semibold text-[var(--dash-text)]">
            {profile?.work_experiences?.length || 0}
          </p>
          <p class="text-xs text-[var(--dash-text-secondary)] truncate">Work Experiences</p>
        </div>
      </div>
    </div>

    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-3">
      <div class="flex items-center gap-2.5">
        <div
          class="w-8 h-8 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center shrink-0"
        >
          <FontAwesomeIcon icon={faGraduationCap} class="w-4 h-4 text-[var(--dash-text-muted)]" />
        </div>
        <div class="min-w-0">
          <p class="text-lg font-semibold text-[var(--dash-text)]">
            {profile?.education?.length || 0}
          </p>
          <p class="text-xs text-[var(--dash-text-secondary)] truncate">Education</p>
        </div>
      </div>
    </div>

    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-3">
      <div class="flex items-center gap-2.5">
        <div
          class="w-8 h-8 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center shrink-0"
        >
          <FontAwesomeIcon icon={faCode} class="w-4 h-4 text-[var(--dash-text-muted)]" />
        </div>
        <div class="min-w-0">
          <p class="text-lg font-semibold text-[var(--dash-text)]">
            {profile?.side_projects?.length || 0}
          </p>
          <p class="text-xs text-[var(--dash-text-secondary)] truncate">Side Projects</p>
        </div>
      </div>
    </div>

    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-3">
      <div class="flex items-center gap-2.5">
        <div
          class="w-8 h-8 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center shrink-0"
        >
          <FontAwesomeIcon icon={faEdit} class="w-4 h-4 text-[var(--dash-text-muted)]" />
        </div>
        <div class="min-w-0">
          <p class="text-lg font-semibold text-[var(--dash-text)]">
            {profile?.tech_skill_categories?.length || 0}
          </p>
          <p class="text-xs text-[var(--dash-text-secondary)] truncate">Skill Categories</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Quick links (placeholders for future features) -->
  <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] p-4">
    <h3 class="text-base font-semibold text-[var(--dash-text)] mb-3">Quick Actions</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <a
        href="/dashboard/profile"
        class="p-3 rounded-lg border border-[var(--dash-border)] hover:border-[var(--dash-primary)] hover:bg-[var(--dash-bg)] transition-colors text-center"
      >
        <FontAwesomeIcon
          icon={faFileAlt}
          class="w-5 h-5 text-[var(--dash-primary)] mx-auto mb-1.5"
        />
        <p class="font-medium text-[var(--dash-text)]">Edit Profile</p>
        <p class="text-sm text-[var(--dash-text-secondary)]">Update your information</p>
      </a>
      <a
        href="/dashboard/jobs"
        class="p-3 rounded-lg border border-[var(--dash-border)] hover:border-[var(--dash-primary)] hover:bg-[var(--dash-bg)] transition-colors text-center"
      >
        <FontAwesomeIcon
          icon={faSearch}
          class="w-5 h-5 text-[var(--dash-primary)] mx-auto mb-1.5"
        />
        <p class="font-medium text-[var(--dash-text)]">Job Matches</p>
        <p class="text-sm text-[var(--dash-text-secondary)]">View matched jobs</p>
      </a>
      <a
        href="/dashboard/applications"
        class="p-3 rounded-lg border border-[var(--dash-border)] hover:border-[var(--dash-primary)] hover:bg-[var(--dash-bg)] transition-colors text-center"
      >
        <FontAwesomeIcon
          icon={faPaperPlane}
          class="w-5 h-5 text-[var(--dash-primary)] mx-auto mb-1.5"
        />
        <p class="font-medium text-[var(--dash-text)]">Applications</p>
        <p class="text-sm text-[var(--dash-text-secondary)]">Track your applications</p>
      </a>
    </div>
  </div>
</div>
