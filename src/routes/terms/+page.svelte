<script lang="ts">
	import LegalPage from '$lib/components/legal/LegalPage.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<LegalPage title="Terms of Service" html={data.html} draft={data.draft} />
