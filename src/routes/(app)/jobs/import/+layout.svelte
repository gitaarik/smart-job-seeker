<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import {
		faChartBar,
		faDesktop,
		faDownload,
		faEnvelope,
		faRobot,
		faSliders
	} from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../profile/components/SectionHeader.svelte';
	import TabNav from '../../components/TabNav.svelte';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Import Tasks', href: '/jobs/import/tasks', icon: faDownload },
		{ label: 'Match Config', href: '/jobs/import/config', icon: faSliders },
		{ label: 'Match Progress', href: '/jobs/import/progress', icon: faChartBar },
		{ label: 'My Devices', href: '/jobs/import/devices', icon: faDesktop },
		{ label: 'Email Digest', href: '/jobs/import/notifications', icon: faEnvelope }
	];

	function isTabActive(href: string): boolean {
		return $page.url.pathname.startsWith(href);
	}
</script>

<TabNav {tabs} isActive={isTabActive} inset>
	{#snippet header()}
		<SectionHeader title="Job Import" icon={faRobot} />
	{/snippet}
	{@render children()}
</TabNav>
