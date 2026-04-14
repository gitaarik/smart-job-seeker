<script lang="ts">
  import { goto } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronDown,
    faPlus,
    faUser,
  } from "@fortawesome/free-solid-svg-icons";
  import type { ProfileSummary } from "$lib/server/profile/user-profiles";
  import HeaderDropdown from "./HeaderDropdown.svelte";

  interface Props {
    profiles: ProfileSummary[];
    selectedProfile: ProfileSummary;
  }

  let { profiles, selectedProfile }: Props = $props();
  let dropdown: HeaderDropdown;

  function selectProfile(profile: ProfileSummary) {
    dropdown.close();
    goto(`/dashboard?profile=${profile.id}`);
  }
</script>

<HeaderDropdown bind:this={dropdown} id="profile" width="w-64">
  {#snippet trigger({ isOpen })}
    <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
      <FontAwesomeIcon icon={faUser} class="w-4 h-4 text-[var(--dash-chrome-text)]" />
      <span class="text-[var(--dash-chrome-text)] text-sm font-medium max-w-32 truncate">
        {selectedProfile.name || "Unnamed Profile"}
      </span>
      <FontAwesomeIcon
        icon={faChevronDown}
        class="w-3 h-3 text-[var(--dash-chrome-text)] transition-transform {isOpen ? 'rotate-180' : ''}"
      />
    </div>
  {/snippet}

  <div class="py-2">
    <div class="px-3 py-1 text-xs font-semibold text-[var(--dash-text-secondary)] uppercase">
      Your Profiles
    </div>

    {#each profiles as profile (profile.id)}
      <button
        onclick={() => selectProfile(profile)}
        class="w-full px-3 py-2 text-left hover:bg-[var(--dash-bg)] transition-colors flex items-center gap-2 {profile.id === selectedProfile.id ? 'bg-[var(--dash-bg)]' : ''}"
      >
        <span class="flex-1 truncate text-[var(--dash-text)]">{profile.name || "Unnamed Profile"}</span>
        {#if profile.id === selectedProfile.id}
          <FontAwesomeIcon icon={faCheck} class="w-3 h-3 text-[var(--dash-primary)]" />
        {/if}
      </button>
    {/each}

    <div class="border-t border-[var(--dash-border)] mt-2 pt-2">
      <a
        href="/dashboard/profile/create"
        onclick={() => dropdown.close()}
        class="w-full px-3 py-2 text-left hover:bg-[var(--dash-bg)] transition-colors flex items-center gap-2 text-[var(--dash-primary)]"
      >
        <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
        <span>Create New Profile</span>
      </a>
    </div>
  </div>
</HeaderDropdown>
