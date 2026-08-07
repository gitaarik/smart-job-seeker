<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Demo - Smart Job Seeker</title>
</svelte:head>

<div
	class="flex min-h-screen items-center justify-center bg-[var(--dash-bg)] px-4 py-12 transition-colors sm:px-6 lg:px-8"
>
	<div class="w-full max-w-md space-y-4 text-center">
		<h2 class="mt-6 text-3xl font-extrabold text-[var(--dash-text)]">
			{#if data.error}
				Something went wrong
			{:else}
				Demo link expired
			{/if}
		</h2>
		<p class="text-[var(--dash-text-secondary)]">
			{#if data.error}
				We couldn't start your demo. Please ask for a fresh link.
			{:else}
				This demo link is no longer active. Ask for a new one to try Smart Job Seeker.
			{/if}
		</p>
		<a
			href="/login"
			class="inline-block font-medium text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
		>
			Go to login
		</a>
	</div>
</div>
