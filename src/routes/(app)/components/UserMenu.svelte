<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faChevronDown,
    faAddressBook,
    faCommentDots,
    faCog,
    faSignOutAlt,
  } from "@fortawesome/free-solid-svg-icons";
  import ThemeSwitcher from "$lib/components/ThemeSwitcher.svelte";
  import HeaderDropdown from "./HeaderDropdown.svelte";

  interface Props {
    user: { id: string; name: string | null; email: string };
  }

  let { user }: Props = $props();

  const displayName = $derived(user.name || user.email);
  const initial = $derived(displayName.charAt(0).toUpperCase());
</script>

<HeaderDropdown id="user" width="w-56">
  {#snippet trigger({ isOpen })}
    <div class="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/10 transition-colors">
      <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
        <span class="text-[var(--dash-chrome-text)] text-sm font-medium">
          {initial}
        </span>
      </div>
      <FontAwesomeIcon
        icon={faChevronDown}
        class="w-3 h-3 text-[var(--dash-chrome-text)] transition-transform {isOpen ? 'rotate-180' : ''}"
      />
    </div>
  {/snippet}

  <div class="px-4 py-3 border-b border-[var(--dash-border)]">
    <p class="text-sm font-medium text-[var(--dash-text)] truncate">
      {user.name || "User"}
    </p>
    <p class="text-xs text-[var(--dash-text-secondary)] truncate">{user.email}</p>
  </div>

  <div class="py-2">
    <ThemeSwitcher variant="inline" />

    <a
      href="/contacts"
      class="flex items-center gap-2 px-4 py-2 text-sm text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
    >
      <FontAwesomeIcon icon={faAddressBook} class="w-4 h-4" />
      <span>Contacts</span>
    </a>

    <a
      href="/feedback"
      class="flex items-center gap-2 px-4 py-2 text-sm text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
    >
      <FontAwesomeIcon icon={faCommentDots} class="w-4 h-4" />
      <span>Feedback</span>
    </a>

    <a
      href="/settings"
      class="flex items-center gap-2 px-4 py-2 text-sm text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
    >
      <FontAwesomeIcon icon={faCog} class="w-4 h-4" />
      <span>Settings</span>
    </a>

    <a
      href="/logout"
      class="flex items-center gap-2 px-4 py-2 text-sm text-[var(--dash-error)] hover:bg-[var(--dash-bg)] transition-colors"
    >
      <FontAwesomeIcon icon={faSignOutAlt} class="w-4 h-4" />
      <span>Sign out</span>
    </a>
  </div>
</HeaderDropdown>
