<script lang="ts">
	import { faBell, faBookmark, faChartBar, faStar } from '@fortawesome/free-solid-svg-icons';
	import StatCard from './StatCard.svelte';

	interface Stats {
		total: number;
		strong: number;
		strongThreshold: number;
		saved: number;
		newUnreviewed: number;
	}

	interface Props {
		stats: Stats;
	}

	let { stats }: Props = $props();

	const items = $derived([
		{
			label: 'Total Matches',
			value: stats.total,
			icon: faChartBar,
			href: '/jobs?minScore=1',
			color: 'text-[var(--dash-text-muted)]'
		},
		{
			label: `Strong (${stats.strongThreshold}+)`,
			value: stats.strong,
			icon: faStar,
			href: `/jobs?minScore=${stats.strongThreshold}`,
			color: 'text-amber-500'
		},
		{
			label: 'Saved Jobs',
			value: stats.saved,
			icon: faBookmark,
			href: '/jobs?status=saved',
			color: 'text-green-500'
		},
		{
			label: 'New to Review',
			value: stats.newUnreviewed,
			icon: faBell,
			href: '/jobs?minScore=1',
			color: 'text-blue-500',
			highlight: stats.newUnreviewed > 0
		}
	]);
</script>

<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
	{#each items as item (item.label)}
		<StatCard
			label={item.label}
			value={item.value}
			icon={item.icon}
			color={item.color}
			href={item.href}
			highlight={item.highlight}
		/>
	{/each}
</div>
