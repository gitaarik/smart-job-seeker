<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';

	interface Props {
		profile: any;
	}

	let { profile }: Props = $props();
</script>

<header class="flex flex-col items-center">
	<div>
		<Logo class="h-30 w-30" />
	</div>

	<h1 class="mt-2 mb-4 text-3xl font-medium">
		{profile.name}
	</h1>

	<h2 class="text-xl">
		{profile.title}
	</h2>
</header>
