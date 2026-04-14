<script lang="ts">
  import { page } from "$app/stores";
  import { invalidateAll } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBell,
    faCheck,
    faCommentDots,
    faDesktop,
    faAddressBook,
  } from "@fortawesome/free-solid-svg-icons";
  import { sidebarState } from "./sidebar-state.svelte";

  interface Notification {
    id: number;
    type: string;
    title: string;
    message: string | null;
    link: string | null;
    read_at: string | null;
    created_at: string;
  }

  let { unreadCount = 0 }: { unreadCount?: number } = $props();

  let isOpen = $state(false);
  let notifications = $state<Notification[]>([]);
  let loading = $state(false);
  let localUnread = $state(unreadCount);

  // Sync with server data on navigation
  $effect(() => {
    localUnread = unreadCount;
  });

  // Close on navigation
  $effect(() => {
    $page.url;
    isOpen = false;
  });

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".notification-bell")) {
      isOpen = false;
    }
  }

  async function toggle() {
    isOpen = !isOpen;
    if (isOpen) {
      sidebarState.mobileOpen = false;
      await loadNotifications();
    }
  }

  async function loadNotifications() {
    loading = true;
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        notifications = data.notifications;
      }
    } catch {
      // silent
    } finally {
      loading = false;
    }
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "readAll" }),
    });
    notifications = notifications.map((n) => ({ ...n, read_at: new Date().toISOString() }));
    localUnread = 0;
    await invalidateAll();
  }

  async function markRead(id: number) {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", id }),
    });
    notifications = notifications.map((n) =>
      n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
    );
    localUnread = Math.max(0, localUnread - 1);
    await invalidateAll();
  }

  function formatTime(date: string): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const typeIcons: Record<string, typeof faBell> = {
    feedback_reply: faCommentDots,
    device_share: faDesktop,
    contact_request: faAddressBook,
  };
</script>

<svelte:window onclick={handleClickOutside} />

<div class="notification-bell relative">
  <button
    type="button"
    onclick={toggle}
    class="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
    aria-label="Notifications"
  >
    <FontAwesomeIcon icon={faBell} class="w-5 h-5 text-[var(--dash-chrome-text)]" />
    {#if localUnread > 0}
      <span class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
        {localUnread > 99 ? "99+" : localUnread}
      </span>
    {/if}
  </button>

  {#if isOpen}
    <div class="fixed right-2 left-2 top-14 sm:absolute sm:left-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-80 bg-[var(--dash-card)] rounded-lg shadow-lg border border-[var(--dash-border)] overflow-hidden z-50">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--dash-border)]">
        <span class="text-sm font-medium text-[var(--dash-text)]">Notifications</span>
        {#if localUnread > 0}
          <button
            type="button"
            onclick={markAllRead}
            class="flex items-center gap-1 text-xs text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] transition-colors"
          >
            <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
            Mark all read
          </button>
        {/if}
      </div>

      <!-- Notification list -->
      <div class="max-h-80 overflow-y-auto">
        {#if loading}
          <div class="px-4 py-8 text-center text-sm text-[var(--dash-text-muted)]">Loading...</div>
        {:else if notifications.length === 0}
          <div class="px-4 py-8 text-center text-sm text-[var(--dash-text-muted)]">No notifications</div>
        {:else}
          {#each notifications as n (n.id)}
            {@const isUnread = !n.read_at}
            <a
              href={n.link || "#"}
              onclick={() => { if (isUnread) markRead(n.id); isOpen = false; }}
              class="flex items-start gap-3 px-4 py-3 hover:bg-[var(--dash-bg)] transition-colors border-b border-[var(--dash-border)] last:border-b-0 {isUnread ? 'bg-[var(--dash-primary)]/5' : ''}"
            >
              <div class="mt-0.5 flex-shrink-0">
                <FontAwesomeIcon
                  icon={typeIcons[n.type] || faBell}
                  class="w-4 h-4 {isUnread ? 'text-[var(--dash-primary)]' : 'text-[var(--dash-text-muted)]'}"
                />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm text-[var(--dash-text)] {isUnread ? 'font-medium' : ''}">{n.title}</p>
                {#if n.message}
                  <p class="text-xs text-[var(--dash-text-muted)] mt-0.5 line-clamp-2">{n.message}</p>
                {/if}
                <p class="text-xs text-[var(--dash-text-muted)] mt-1">{formatTime(n.created_at)}</p>
              </div>
              {#if isUnread}
                <div class="w-2 h-2 rounded-full bg-[var(--dash-primary)] mt-1.5 flex-shrink-0"></div>
              {/if}
            </a>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
