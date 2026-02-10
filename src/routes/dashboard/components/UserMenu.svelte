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
    class="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-glass-light transition-colors"
  >
    <div
      class="w-8 h-8 rounded-full bg-ocean flex items-center justify-center"
    >
      <span class="text-pearl text-sm font-medium">
        {initial}
      </span>
    </div>
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
      class="absolute right-0 mt-2 w-56 bg-snow rounded-lg shadow-lg border border-light overflow-hidden z-50"
    >
      <div class="px-4 py-3 border-b border-light">
        <p class="text-sm font-medium text-slate truncate">
          {user.name || "User"}
        </p>
        <p class="text-xs text-pearl truncate">{user.email}</p>
      </div>

      <div class="py-2">
        <a
          href="/dashboard/settings"
          class="flex items-center gap-2 px-4 py-2 text-sm text-slate hover:bg-ice transition-colors"
        >
          <FontAwesomeIcon icon={faCog} class="w-4 h-4" />
          <span>Settings</span>
        </a>

        <a
          href="/logout"
          class="flex items-center gap-2 px-4 py-2 text-sm text-crimson hover:bg-ice transition-colors"
        >
          <FontAwesomeIcon icon={faSignOutAlt} class="w-4 h-4" />
          <span>Sign out</span>
        </a>
      </div>
    </div>
  {/if}
</div>
