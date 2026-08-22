<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const fmt = (d: Date) =>
		new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
</script>

<svelte:head>
	<title>Account Scheduled for Deletion - Smart Job Seeker</title>
</svelte:head>

<div
	class="flex min-h-screen items-center justify-center bg-[var(--dash-bg)] px-4 py-12 transition-colors sm:px-6 lg:px-8"
>
	<div class="w-full max-w-md space-y-6 text-center">
		<h2 class="text-2xl font-bold text-[var(--dash-text)]">Your account is being deleted</h2>

		<p class="text-[var(--dash-text-secondary)]">
			You asked for this account to be deleted on <strong>{fmt(data.requestedAt)}</strong>. Access
			to your data was switched off straight away.
		</p>

		<p class="text-[var(--dash-text-secondary)]">
			It will be erased permanently on <strong>{fmt(data.scheduledFor)}</strong> — from our backups as
			well as our database. Until then it can still be restored.
		</p>

		{#if data.supportEmail}
			<p class="text-[var(--dash-text-secondary)]">
				Changed your mind? Email
				<a class="underline" href="mailto:{data.supportEmail}">{data.supportEmail}</a> before that date.
			</p>
		{:else}
			<p class="text-[var(--dash-text-secondary)]">
				Changed your mind? Get in touch before that date and we can put it back.
			</p>
		{/if}

		<a
			href={resolve('/logout')}
			class="inline-block text-sm font-medium text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
			>Sign out</a
		>
	</div>
</div>
