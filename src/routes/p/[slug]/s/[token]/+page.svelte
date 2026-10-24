<script lang="ts">
	import type { PageData } from './$types';
	import { ProfileDisplay } from '$lib/components/ProfileDisplay';
	import PortfolioSite from '$lib/components/PortfolioSite/PortfolioSite.svelte';
	import ShowcaseSite from '$lib/components/PortfolioSite/showcase/ShowcaseSite.svelte';
	import { themeLayout } from '$lib/portfolio-themes';

	let { data }: { data: PageData } = $props();
</script>

{#if data.profile}
	{#if data.format === 'portfolio' && data.theme && themeLayout(data.theme.config) === 'showcase'}
		<ShowcaseSite
			profile={data.profile}
			theme={data.theme}
			versionId={data.versionId}
			contact={data.contact}
			accessToken={data.accessToken}
		/>
	{:else if data.format === 'portfolio'}
		<PortfolioSite profile={data.profile} theme={data.theme} versionId={data.versionId} />
	{:else}
		<ProfileDisplay
			profile={data.profile}
			type={data.format}
			versionId={data.versionId}
			locale={data.locale}
		/>
	{/if}
{/if}
