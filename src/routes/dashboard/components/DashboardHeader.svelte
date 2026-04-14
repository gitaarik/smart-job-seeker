<script lang="ts">
  import { navigating } from "$app/stores";
  import ProfileSwitcher from "./ProfileSwitcher.svelte";
  import UserMenu from "./UserMenu.svelte";
  import NotificationBell from "./NotificationBell.svelte";
  import { sidebarState } from "./sidebar-state.svelte";
  import type { ProfileSummary } from "$lib/server/profile/user-profiles";

  interface Props {
    user: { id: string; name: string | null; email: string };
    profiles: ProfileSummary[];
    selectedProfile: ProfileSummary | null;
    unreadNotifications?: number;
  }

  let { user, profiles, selectedProfile, unreadNotifications = 0 }: Props = $props();

  function handleLogoClick(e: MouseEvent) {
    if (window.innerWidth < 1024) {
      e.preventDefault();
      sidebarState.mobileOpen = !sidebarState.mobileOpen;
    }
  }
</script>

<header class="fixed top-0 left-0 right-0 z-50 bg-[var(--dash-chrome)] border-b border-[var(--dash-chrome)]/80 transition-colors">
  <div class="flex items-center py-2">
    <!-- Logo area — matches sidebar width on desktop -->
    <a href="/dashboard" onclick={handleLogoClick} class="flex items-center gap-3 px-4 lg:w-60 shrink-0">
      <svg class="h-7 w-7 text-[var(--dash-chrome-text)]" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="3" fill="none"/>
        <line x1="25" y1="25" x2="36" y2="36" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
        <path d="M10 17l4 4 8-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </svg>
      <span class="text-[var(--dash-chrome-text)] font-semibold tracking-wide uppercase hidden sm:block"
      >Smart Job Seeker</span>
    </a>

    <!-- Right side: Profile switcher + Notifications + User menu -->
    <div class="flex-1 flex items-center justify-end gap-2 px-4">
      {#if profiles.length > 0 && selectedProfile}
        <ProfileSwitcher {profiles} {selectedProfile} />
      {/if}
      <NotificationBell unreadCount={unreadNotifications} />
      <UserMenu {user} />
    </div>
  </div>
  {#if $navigating}
    <div class="h-0.5 bg-[var(--dash-chrome)]/50">
      <div class="h-full bg-white/80 animate-[nav-progress_2s_ease-in-out_infinite]"></div>
    </div>
  {/if}
</header>
