<script lang="ts">
	import type { PageData } from './$types';
	import PortfolioSite from '$lib/components/PortfolioSite/PortfolioSite.svelte';

	let { data }: { data: PageData } = $props();
</script>

<PortfolioSite profile={data.profile} theme={data.theme} versionId={data.versionId} />
