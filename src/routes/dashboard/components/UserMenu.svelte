<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faChevronDown,
    faCog,
    faSignOutAlt,
  } from "@fortawesome/free-solid-svg-icons";

  interface Props {
    user: { id: string; name: string | null; email: string };
  }

  let { user }: Props = $props();
  let isOpen = $state(false);

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".user-menu")) {
      isOpen = false;
    }
  }

  const displayName = $derived(user.name || user.email);
  const initial = $derived(displayName.charAt(0).toUpperCase());
</script>

<svelte:window onclick={handleClickOutside} />

<div class="user-menu relative">
  <button
    onclick={() => (isOpen = !isOpen)}
    class="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/10 transition-colors"
  >
    <div
      class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
    >
      <span class="text-[var(--dash-chrome-text)] text-sm font-medium">
        {initial}
      </span>
    </div>
    <FontAwesomeIcon
      icon={faChevronDown}
      class="
        w-3 h-3 text-[var(--dash-chrome-text)] transition-transform {isOpen
        ? 'rotate-180'
        : ''}
      "
    />
  </button>

  {#if isOpen}
    <div
      class="absolute right-0 mt-2 w-56 bg-[var(--dash-card)] rounded-lg shadow-lg border border-[var(--dash-border)] overflow-hidden z-50"
    >
      <div class="px-4 py-3 border-b border-[var(--dash-border)]">
        <p class="text-sm font-medium text-[var(--dash-text)] truncate">
          {user.name || "User"}
        </p>
        <p class="text-xs text-[var(--dash-text-secondary)] truncate">{user.email}</p>
      </div>

      <div class="py-2">
        <a
          href="/dashboard/settings"
          class="flex items-center gap-2 px-4 py-2 text-sm text-[var(--dash-text)] hover:bg-gray-100 transition-colors"
        >
          <FontAwesomeIcon icon={faCog} class="w-4 h-4" />
          <span>Settings</span>
        </a>

        <a
          href="/logout"
          class="flex items-center gap-2 px-4 py-2 text-sm text-[var(--dash-error)] hover:bg-gray-100 transition-colors"
        >
          <FontAwesomeIcon icon={faSignOutAlt} class="w-4 h-4" />
          <span>Sign out</span>
        </a>
      </div>
    </div>
  {/if}
</div>
