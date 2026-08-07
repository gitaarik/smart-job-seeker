<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.title} — Guide — Smart Job Seeker</title>
</svelte:head>

<!-- Trusted, authored markdown rendered to HTML in the load function. -->
{@html data.html}
