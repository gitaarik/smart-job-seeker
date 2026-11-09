<script lang="ts">
	// A portfolio link never renders here: its load sends it on to the site.
	import type { PageData } from './$types';
	import { ProfileDisplay } from '$lib/components/ProfileDisplay';

	let { data }: { data: PageData } = $props();
</script>

{#if data.profile}
	<ProfileDisplay
		profile={data.profile}
		type={data.format}
		versionId={data.versionId}
		locale={data.locale}
	/>
{/if}
