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

<div class="space-y-8">
  <!-- Page header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold text-slate">Dashboard</h1>
      <p class="text-pearl mt-1">
        Welcome back! Here's an overview of your profile.
      </p>
    </div>
    {#if profile?.slug}
      <a
        href="/p/{profile.slug}/portfolio"
        target="_blank"
        class="flex items-center justify-center gap-2 px-4 py-2 bg-ocean text-pearl rounded-lg hover:bg-aqua transition-colors"
      >
        <span>View Public Profile</span>
        <FontAwesomeIcon icon={faExternalLinkAlt} class="w-4 h-4" />
      </a>
    {/if}
  </div>

  <!-- Profile summary card -->
  <div class="bg-snow rounded-lg border border-light p-6">
    <div class="flex items-start gap-4">
      <div
        class="w-16 h-16 rounded-full bg-ocean flex items-center justify-center shrink-0"
      >
        <FontAwesomeIcon icon={faUser} class="w-8 h-8 text-pearl" />
      </div>
      <div class="flex-1 min-w-0">
        <h2 class="text-xl font-semibold text-slate">
          {profile?.name || "Unnamed Profile"}
        </h2>
        <p class="text-pearl">{profile?.title || "No title set"}</p>
        {#if profile?.headline}
          <p class="text-sm text-pearl mt-2 line-clamp-2">{profile.headline}</p>
        {/if}
      </div>
    </div>
  </div>

  <!-- Quick stats -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="bg-snow rounded-lg border border-light p-4">
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-lg bg-ice flex items-center justify-center shrink-0"
        >
          <FontAwesomeIcon icon={faBriefcase} class="w-5 h-5 text-ocean" />
        </div>
        <div class="min-w-0">
          <p class="text-2xl font-semibold text-slate">
            {profile?.work_experiences?.length || 0}
          </p>
          <p class="text-sm text-pearl truncate">Work Experiences</p>
        </div>
      </div>
    </div>

    <div class="bg-snow rounded-lg border border-light p-4">
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-lg bg-ice flex items-center justify-center shrink-0"
        >
          <FontAwesomeIcon icon={faGraduationCap} class="w-5 h-5 text-ocean" />
        </div>
        <div class="min-w-0">
          <p class="text-2xl font-semibold text-slate">
            {profile?.education?.length || 0}
          </p>
          <p class="text-sm text-pearl truncate">Education</p>
        </div>
      </div>
    </div>

    <div class="bg-snow rounded-lg border border-light p-4">
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-lg bg-ice flex items-center justify-center shrink-0"
        >
          <FontAwesomeIcon icon={faCode} class="w-5 h-5 text-ocean" />
        </div>
        <div class="min-w-0">
          <p class="text-2xl font-semibold text-slate">
            {profile?.side_projects?.length || 0}
          </p>
          <p class="text-sm text-pearl truncate">Side Projects</p>
        </div>
      </div>
    </div>

    <div class="bg-snow rounded-lg border border-light p-4">
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-lg bg-ice flex items-center justify-center shrink-0"
        >
          <FontAwesomeIcon icon={faEdit} class="w-5 h-5 text-ocean" />
        </div>
        <div class="min-w-0">
          <p class="text-2xl font-semibold text-slate">
            {profile?.tech_skill_categories?.length || 0}
          </p>
          <p class="text-sm text-pearl truncate">Skill Categories</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Quick links (placeholders for future features) -->
  <div class="bg-snow rounded-lg border border-light p-6">
    <h3 class="text-lg font-semibold text-slate mb-4">Quick Actions</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <a
        href="/dashboard/profile"
        class="p-4 rounded-lg border border-light hover:border-ocean hover:bg-ice transition-colors text-center"
      >
        <FontAwesomeIcon
          icon={faFileAlt}
          class="w-6 h-6 text-ocean mx-auto mb-2"
        />
        <p class="font-medium text-slate">Edit Profile</p>
        <p class="text-sm text-pearl">Update your information</p>
      </a>
      <a
        href="/dashboard/jobs"
        class="p-4 rounded-lg border border-light hover:border-ocean hover:bg-ice transition-colors text-center"
      >
        <FontAwesomeIcon
          icon={faSearch}
          class="w-6 h-6 text-ocean mx-auto mb-2"
        />
        <p class="font-medium text-slate">Job Matches</p>
        <p class="text-sm text-pearl">View matched jobs</p>
      </a>
      <a
        href="/dashboard/applications"
        class="p-4 rounded-lg border border-light hover:border-ocean hover:bg-ice transition-colors text-center"
      >
        <FontAwesomeIcon
          icon={faPaperPlane}
          class="w-6 h-6 text-ocean mx-auto mb-2"
        />
        <p class="font-medium text-slate">Applications</p>
        <p class="text-sm text-pearl">Track your applications</p>
      </a>
    </div>
  </div>
</div>
