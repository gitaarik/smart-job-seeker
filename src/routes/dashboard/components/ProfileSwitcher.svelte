<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronDown,
    faPlus,
    faUser,
  } from "@fortawesome/free-solid-svg-icons";
  import type { ProfileSummary } from "$lib/server/profile/user-profiles";

  interface Props {
    profiles: ProfileSummary[];
    selectedProfile: ProfileSummary;
  }

  let { profiles, selectedProfile }: Props = $props();
  let isOpen = $state(false);

  function selectProfile(profile: ProfileSummary) {
    isOpen = false;
    // Navigate with new profile parameter
    const url = new URL(page.url);
    url.searchParams.set("profile", String(profile.id));
    goto(url.toString());
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".profile-switcher")) {
      isOpen = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="profile-switcher relative">
  <button
    onclick={() => (isOpen = !isOpen)}
    class="flex items-center gap-2 px-3 py-2 rounded-lg bg-glass-light hover:bg-glass transition-colors"
  >
    <FontAwesomeIcon icon={faUser} class="w-4 h-4 text-pearl" />
    <span class="text-pearl text-sm font-medium max-w-32 truncate">
      {selectedProfile.name || "Unnamed Profile"}
    </span>
    <FontAwesomeIcon
      icon={faChevronDown}
      class="
        w-3 h-3 text-pearl transition-transform {isOpen
        ? 'rotate-180'
        : ''}
      "
    />
  </button>

  {#if isOpen}
    <div
      class="absolute right-0 mt-2 w-64 bg-snow rounded-lg shadow-lg border border-light overflow-hidden z-50"
    >
      <div class="py-2">
        <div class="px-3 py-1 text-xs font-semibold text-pearl uppercase">
          Your Profiles
        </div>

        {#each profiles as profile (profile.id)}
          <button
            onclick={() => selectProfile(profile)}
            class="
              w-full px-3 py-2 text-left hover:bg-ice transition-colors flex items-center gap-2 {profile.id ===
              selectedProfile.id
              ? 'bg-ice'
              : ''}
            "
          >
            <span class="flex-1 truncate text-slate">{
              profile.name || "Unnamed Profile"
            }</span>
            {#if profile.id === selectedProfile.id}
              <FontAwesomeIcon icon={faCheck} class="w-3 h-3 text-teal" />
            {/if}
          </button>
        {/each}

        <div class="border-t border-light mt-2 pt-2">
          <a
            href="/dashboard/profile/create"
            class="w-full px-3 py-2 text-left hover:bg-ice transition-colors flex items-center gap-2 text-teal"
          >
            <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
            <span>Create New Profile</span>
          </a>
        </div>
      </div>
    </div>
  {/if}
</div>
