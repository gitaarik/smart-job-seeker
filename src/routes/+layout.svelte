<script lang="ts">
	import { config } from '@fortawesome/fontawesome-svg-core';
	config.autoAddCss = false;

	import '../app.css';
	import './(app)/dashboard.css';
	import { onMount, untrack } from 'svelte';
	import { initializeTheme, themeState, updateDOM } from '#lib/stores/theme.svelte.ts';
	import { identify } from '#lib/tools/analytics.ts';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	// Initialize theme store with server-detected theme data, once: the root
	// layout lives as long as the app, and the store owns the theme from here.
	untrack(() => {
		if (data.themePreference && data.actualTheme && data.systemTheme) {
			initializeTheme(data.themePreference, data.actualTheme, data.systemTheme);
		}
	});

	// Lives here, not in ThemeSwitcher, so OS-theme changes in "auto" mode still propagate while the user menu is closed.
	$effect(() => {
		updateDOM(themeState.actual);
	});

	// Inject Umami analytics script if configured. The script itself is
	// anonymous statistics on our own server: no cookie, no storage, a visitor
	// hash that rotates. Linking a visit to the account is a different thing
	// and only happens for people who turned it on at /data/privacy; see
	// users.analytics_consented_at in the schema for why.
	onMount(() => {
		if (data.umamiUrl && data.umamiWebsiteId) {
			const script = document.createElement('script');
			script.defer = true;
			script.src = `${data.umamiUrl}/script.js`;
			script.dataset.websiteId = data.umamiWebsiteId;
			script.onload = () => {
				const consented = (data.user as { analytics_consented_at?: Date | null } | null)
					?.analytics_consented_at;
				if (data.user && consented) {
					identify({ id: data.user.id });
				}
			};
			document.head.appendChild(script);
		}
	});
</script>

{@render children()}
