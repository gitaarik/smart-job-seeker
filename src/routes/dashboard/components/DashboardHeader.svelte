<script lang="ts">
  import Logo from "$lib/components/Logo.svelte";
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

<header class="bg-[var(--dash-chrome)] border-b border-[var(--dash-chrome)]/80 transition-colors">
  <div class="max-w-5xl mx-auto px-4 py-3">
    <div class="flex items-center justify-between">
      <!-- Logo and branding -->
      <a href="/dashboard" class="flex items-center gap-3">
        <Logo class="h-8 w-8" />
        <span class="text-[var(--dash-chrome-text)] font-medium hidden sm:block"
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
