<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faBell,
		faCheck,
		faCommentDots,
		faDesktop,
		faAddressBook
	} from '@fortawesome/free-solid-svg-icons';
	import HeaderDropdown from './HeaderDropdown.svelte';

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

	let dropdown: HeaderDropdown;
	let notifications = $state<Notification[]>([]);
	let loading = $state(false);
	let localUnread = $state(unreadCount);

	// Sync with server data on navigation
	$effect(() => {
		localUnread = unreadCount;
	});

	async function loadNotifications() {
		loading = true;
		try {
			const res = await fetch('/api/notifications');
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
		await fetch('/api/notifications', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'readAll' })
		});
		notifications = notifications.map((n) => ({ ...n, read_at: new Date().toISOString() }));
		localUnread = 0;
		await invalidateAll();
	}

	async function markRead(id: number) {
		await fetch('/api/notifications', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'read', id })
		});
		notifications = notifications.map((n) =>
			n.id === id ? { ...n, read_at: new Date().toISOString() } : n
		);
		localUnread = Math.max(0, localUnread - 1);
		await invalidateAll();
	}

	function formatTime(date: string): string {
		const d = new Date(date);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMin = Math.floor(diffMs / 60000);
		if (diffMin < 1) return 'just now';
		if (diffMin < 60) return `${diffMin}m ago`;
		const diffHours = Math.floor(diffMin / 60);
		if (diffHours < 24) return `${diffHours}h ago`;
		const diffDays = Math.floor(diffHours / 24);
		if (diffDays < 7) return `${diffDays}d ago`;
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	const typeIcons: Record<string, typeof faBell> = {
		feedback_reply: faCommentDots,
		device_share: faDesktop,
		contact_request: faAddressBook
	};
</script>

<HeaderDropdown bind:this={dropdown} id="notifications" width="w-80" onopen={loadNotifications}>
	{#snippet trigger()}
		<div class="relative rounded-lg p-2 transition-colors hover:bg-white/10">
			<FontAwesomeIcon icon={faBell} class="h-5 w-5 text-[var(--dash-chrome-text)]" />
			{#if localUnread > 0}
				<span
					class="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
				>
					{localUnread > 99 ? '99+' : localUnread}
				</span>
			{/if}
		</div>
	{/snippet}

	<!-- Header -->
	<div class="flex items-center justify-between border-b border-[var(--dash-border)] px-4 py-3">
		<span class="text-sm font-medium text-[var(--dash-text)]">Notifications</span>
		{#if localUnread > 0}
			<button
				type="button"
				onclick={markAllRead}
				class="flex items-center gap-1 text-xs text-[var(--dash-primary)] transition-colors hover:text-[var(--dash-primary-hover)]"
			>
				<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
				Mark all read
			</button>
		{/if}
	</div>

	<!-- Notification list -->
	<div class="max-h-80 overflow-y-auto">
		{#if loading}
			<div class="px-4 py-8 text-center text-sm text-[var(--dash-text-muted)]">Loading...</div>
		{:else if notifications.length === 0}
			<div class="px-4 py-8 text-center text-sm text-[var(--dash-text-muted)]">
				No notifications
			</div>
		{:else}
			{#each notifications as n (n.id)}
				{@const isUnread = !n.read_at}
				<a
					href={n.link || '#'}
					onclick={() => {
						if (isUnread) markRead(n.id);
						dropdown.close();
					}}
					class="flex items-start gap-3 border-b border-[var(--dash-border)] px-4 py-3 transition-colors last:border-b-0 hover:bg-[var(--dash-bg)] {isUnread
						? 'bg-[var(--dash-primary)]/5'
						: ''}"
				>
					<div class="mt-0.5 flex-shrink-0">
						<FontAwesomeIcon
							icon={typeIcons[n.type] || faBell}
							class="h-4 w-4 {isUnread
								? 'text-[var(--dash-primary)]'
								: 'text-[var(--dash-text-muted)]'}"
						/>
					</div>
					<div class="min-w-0 flex-1">
						<p class="text-sm text-[var(--dash-text)] {isUnread ? 'font-medium' : ''}">{n.title}</p>
						{#if n.message}
							<p class="mt-0.5 line-clamp-2 text-xs text-[var(--dash-text-muted)]">{n.message}</p>
						{/if}
						<p class="mt-1 text-xs text-[var(--dash-text-muted)]">{formatTime(n.created_at)}</p>
					</div>
					{#if isUnread}
						<div class="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[var(--dash-primary)]"></div>
					{/if}
				</a>
			{/each}
		{/if}
	</div>
</HeaderDropdown>
