<script lang="ts">
  import type { LayoutData } from "./$types";
  import type { Snippet } from "svelte";
  import DashboardHeader from "./components/DashboardHeader.svelte";
  import Sidebar from "./components/Sidebar.svelte";
  import "./dashboard.css";

  let { children, data }: { children: Snippet; data: LayoutData } =
    $props();
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

  <Sidebar isAdmin={data.isAdmin} />

  <main class="text-sm py-5 px-4 lg:pl-60 pb-24 lg:pb-5">
    <div class="max-w-5xl mx-auto">
      {@render children()}
    </div>
  </main>
</div>
