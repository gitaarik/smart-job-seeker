<script lang="ts">
  import ProfileSwitcher from "./ProfileSwitcher.svelte";
  import UserMenu from "./UserMenu.svelte";
  import type { ProfileSummary } from "$lib/server/profile/user-profiles";

  interface Props {
    user: { id: string; name: string | null; email: string };
    profiles: ProfileSummary[];
    selectedProfile: ProfileSummary | null;
  }

  let { user, profiles, selectedProfile }: Props = $props();
</script>

<header class="sticky top-0 z-50 bg-[var(--dash-chrome)] border-b border-[var(--dash-chrome)]/80 transition-colors">
  <div class="max-w-5xl mx-auto px-4 py-2">
    <div class="flex items-center justify-between">
      <!-- Logo and branding -->
      <a href="/dashboard" class="flex items-center gap-3">
        <svg class="h-7 w-7 text-[var(--dash-chrome-text)]" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="3" fill="none"/>
          <line x1="25" y1="25" x2="36" y2="36" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
          <path d="M10 17l4 4 8-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
        <span class="text-[var(--dash-chrome-text)] font-semibold tracking-wide uppercase hidden sm:block"
        >Smart Job Seeker</span>
      </a>

      <!-- Right side: Profile switcher + User menu -->
      <div class="flex items-center gap-4">
        {#if profiles.length > 0 && selectedProfile}
          <ProfileSwitcher {profiles} {selectedProfile} />
        {/if}
        <UserMenu {user} />
      </div>
    </div>
  </div>
</header>
