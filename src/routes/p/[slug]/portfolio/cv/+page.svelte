<script lang="ts">
	import type { PageData } from './$types';
	import ShowcaseSite from '$lib/components/PortfolioSite/showcase/ShowcaseSite.svelte';

	let { data }: { data: PageData } = $props();
</script>

<ShowcaseSite
	profile={data.profile}
	theme={data.theme}
	versionId={data.versionId}
	contact={data.contact}
	page={data.page}
	homeHref={data.homeHref}
	cvHref={data.cvHref}
/>
