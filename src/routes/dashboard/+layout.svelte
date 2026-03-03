<script lang="ts">
  import type { LayoutData } from "./$types";
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import DashboardHeader from "./components/DashboardHeader.svelte";
  import Sidebar from "./components/Sidebar.svelte";
  import "./dashboard.css";

  let { children, data }: { children: Snippet; data: LayoutData } =
    $props();

  // Auto-capture browser fingerprint (user agent, language, timezone) for the
  // scraper's anti-detection profile. Runs once per session, only updates if
  // the profile has no values stored yet.
  onMount(() => {
    if (!data.selectedProfile?.id) return;
    const profileId = data.selectedProfile.id;
    const key = `sjs_browser_captured_${profileId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    const browserInfo = {
      browser_user_agent: navigator.userAgent,
      browser_language: navigator.language,
      browser_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    fetch(`/api/profile/${profileId}/browser-info`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(browserInfo),
    }).catch(() => {});
  });
</script>

<svelte:head>
  <title>Dashboard - Smart Job Seeker</title>
</svelte:head>

<div class="min-h-screen bg-[var(--dash-bg)] transition-colors">
  <DashboardHeader
    user={data.user}
    profiles={data.profiles}
    selectedProfile={data.selectedProfile}
  />

  <Sidebar />

  <main class="text-sm py-5 px-4 lg:pl-60 pb-24 lg:pb-5">
    <div class="max-w-5xl mx-auto">
      {@render children()}
    </div>
  </main>
</div>
