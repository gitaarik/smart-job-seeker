<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.title} — Guide — Smart Job Seeker</title>
</svelte:head>

<!-- Trusted, authored markdown rendered to HTML in the load function. -->
<!-- Repo-authored markdown from src/lib/guide/*.md, rendered in +page.ts. The -->
<!-- content ships in the repo; nothing user-supplied reaches it. -->
<!-- eslint-disable-next-line svelte/no-at-html-tags -->
{@html data.html}
