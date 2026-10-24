<script lang="ts">
	import type { PageData } from './$types';
	import PortfolioSite from '$lib/components/PortfolioSite/PortfolioSite.svelte';
	import ShowcaseSite from '$lib/components/PortfolioSite/showcase/ShowcaseSite.svelte';
	import { themeLayout } from '$lib/portfolio-themes';

	let { data }: { data: PageData } = $props();
</script>

{#if themeLayout(data.theme.config) === 'showcase'}
	<ShowcaseSite
		profile={data.profile}
		theme={data.theme}
		versionId={data.versionId}
		contact={data.contact}
		accessToken={data.accessToken}
	/>
{:else}
	<PortfolioSite profile={data.profile} theme={data.theme} versionId={data.versionId} />
{/if}
