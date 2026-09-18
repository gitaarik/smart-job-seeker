<script lang="ts">
	import type { PageData } from './$types';
	import { ProfileDisplay } from '$lib/components/ProfileDisplay';
	import PortfolioSite from '$lib/components/PortfolioSite/PortfolioSite.svelte';

	let { data }: { data: PageData } = $props();
</script>

{#if data.profile}
	{#if data.format === 'portfolio'}
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
