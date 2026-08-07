<script lang="ts">
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { flushPendingSaves, hasPendingSaves } from '$lib/components/auto-save.svelte';
	import DashboardHeader from './components/DashboardHeader.svelte';
	import Sidebar from './components/Sidebar.svelte';
	import FeedbackWidget from './components/FeedbackWidget.svelte';
	import AgentChat from './components/AgentChat.svelte';
	import { overlayState } from './components/sidebar-state.svelte';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	// Auto-capture browser fingerprint (user agent, language, timezone) for the
	// scraper's anti-detection profile. Runs once per session, only updates if
	// the profile has no values stored yet.
	onMount(() => {
		if (!data.selectedProfile?.id) return;
		const profileId = data.selectedProfile.id;
		const key = `sjs_browser_captured_${profileId}`;
		if (sessionStorage.getItem(key)) return;
		sessionStorage.setItem(key, '1');

		const browserInfo = {
			browser_language: navigator.language,
			browser_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
		};

		fetch(`/api/profile/${profileId}/browser-info`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(browserInfo)
		}).catch(() => {});
	});

	// Auto-saved fields debounce their PATCH, so a click on the sidebar can land
	// inside that window — client-side nav doesn't blur the input first, which is
	// what normally flushes. Push everything out before the route tears down.
	beforeNavigate(() => {
		flushPendingSaves();
	});

	// Same window, but for a hard reload/close: the request can't be guaranteed
	// to finish, so flush and then let the browser ask whether to stay.
	function handleBeforeUnload(event: BeforeUnloadEvent) {
		flushPendingSaves();
		if (hasPendingSaves()) event.preventDefault();
	}

	// Mirror --imp-offset onto <body> so modals portaled out of the route subtree
	// (via the portalToBody action) can still read it for chrome-offset padding.
	$effect(() => {
		document.body.style.setProperty('--imp-offset', data.adminUser ? '36px' : '0px');
	});
</script>

<svelte:window onbeforeunload={handleBeforeUnload} />

<svelte:head>
	<title>Dashboard - Smart Job Seeker</title>
</svelte:head>

<div
	class="min-h-screen bg-[var(--dash-bg)] transition-colors"
	style:--imp-offset={data.adminUser ? '36px' : '0px'}
>
	{#if data.adminUser}
		<div
			class="fixed top-0 right-0 left-0 z-[60] flex items-center justify-between bg-purple-600 px-4 py-1.5 text-sm text-white"
		>
			<span>
				Impersonating <strong>{data.user?.name || data.user?.email}</strong>
			</span>
			<form method="POST" action="/admin/users?/stop_impersonate">
				<button
					type="submit"
					class="rounded bg-white/20 px-3 py-0.5 text-white transition-colors hover:bg-white/30"
				>
					Stop
				</button>
			</form>
		</div>
	{/if}
	<DashboardHeader
		user={data.user}
		profiles={data.profiles}
		selectedProfile={data.selectedProfile}
		unreadNotifications={data.unreadNotifications}
	/>
	<!-- Spacer for fixed header + optional impersonation banner -->
	<div style="height: calc(65px + var(--imp-offset))"></div>

	<!-- Shared overlay for sidebar and header dropdowns -->
	{#if overlayState.onclose}
		<button
			type="button"
			class="fixed inset-0 z-40 bg-black/50"
			style="top: calc(65px + var(--imp-offset))"
			onclick={() => {
				overlayState.onclose?.();
				overlayState.onclose = null;
			}}
			aria-label="Close menu"
		>
		</button>
	{/if}

	<Sidebar creditBalance={data.creditBalance} />

	<main class="overflow-x-clip px-4 py-5 pb-24 text-sm lg:pb-20 lg:pl-60">
		<div class="mx-auto max-w-5xl">
			{@render children()}
		</div>
	</main>

	<FeedbackWidget />
	<AgentChat />
</div>
