<script lang="ts">
  import type { LayoutData } from "./$types";
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import DashboardHeader from "./components/DashboardHeader.svelte";
  import Sidebar from "./components/Sidebar.svelte";
  import FeedbackWidget from "./components/FeedbackWidget.svelte";
  import { overlayState } from "./components/sidebar-state.svelte";

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

<div class="min-h-screen bg-[var(--dash-bg)] transition-colors" style:--imp-offset="{data.adminUser ? '36px' : '0px'}">
  {#if data.adminUser}
    <div
      class="fixed top-0 left-0 right-0 bg-purple-600 text-white px-4 py-1.5 text-sm flex items-center justify-between z-[60]"
    >
      <span>
        Impersonating <strong>{data.user?.name || data.user?.email}</strong>
      </span>
      <form
        method="POST"
        action="/admin/users?/stop_impersonate"
      >
        <button
          type="submit"
          class="px-3 py-0.5 bg-white/20 hover:bg-white/30 rounded text-white transition-colors"
        >
          Stop
        </button>
      </form>
    </div>
  {/if}
  <DashboardHeader
    user={data.user}
    profiles={data.profiles}
    selectedProfile={data.selectedProfile}
    unreadNotifications={data.unreadNotifications}
  />
  <!-- Spacer for fixed header + optional impersonation banner -->
  <div style="height: calc(65px + var(--imp-offset))"></div>

  <!-- Shared overlay for sidebar and header dropdowns -->
  {#if overlayState.onclose}
    <button
      type="button"
      class="fixed inset-0 bg-black/50 z-40"
      style="top: calc(65px + var(--imp-offset))"
      onclick={() => { overlayState.onclose?.(); overlayState.onclose = null; }}
      aria-label="Close menu"
    ></button>
  {/if}

  <Sidebar creditBalance={data.creditBalance} />

  <main class="text-sm py-5 px-4 lg:pl-60 pb-24 lg:pb-5 overflow-x-clip">
    <div class="max-w-5xl mx-auto">
      {@render children()}
    </div>
  </main>

  <FeedbackWidget />
</div>
