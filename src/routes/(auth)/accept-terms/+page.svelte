<script lang="ts">
	import { resolve } from '$app/paths';
	import TermsCheckbox from '$lib/components/legal/TermsCheckbox.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let accepted = $state(false);
</script>

<svelte:head>
	<title>Terms of Service - Smart Job Seeker</title>
</svelte:head>

<div
	class="flex min-h-screen items-center justify-center bg-[var(--dash-bg)] px-4 py-12 transition-colors sm:px-6 lg:px-8"
>
	<div class="w-full max-w-md space-y-6">
		<div class="text-center">
			{#if data.updated}
				<h2 class="text-2xl font-bold text-[var(--dash-text)]">Our terms have changed</h2>
				<p class="mt-4 text-[var(--dash-text-secondary)]">
					Please read the new terms of service and privacy policy, and accept them to keep using
					Smart Job Seeker.
				</p>
			{:else}
				<h2 class="text-2xl font-bold text-[var(--dash-text)]">Before you continue</h2>
				<p class="mt-4 text-[var(--dash-text-secondary)]">
					Smart Job Seeker now has terms of service and a privacy policy. Please read them and
					accept them to keep using your account.
				</p>
			{/if}
		</div>

		<form method="POST" class="space-y-6">
			{#if form?.error}
				<div class="rounded-md bg-[var(--dash-error-light)] p-4">
					<p class="text-sm text-[var(--dash-error)]">{form.error}</p>
				</div>
			{/if}

			<TermsCheckbox version={data.termsVersion} bind:checked={accepted} />

			<button
				type="submit"
				disabled={!accepted}
				class="flex w-full justify-center rounded-md border border-transparent bg-[var(--dash-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--dash-primary-hover)] focus:ring-2 focus:ring-[var(--dash-primary)] focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
			>
				Continue
			</button>
		</form>

		<p class="text-center text-sm text-[var(--dash-text-secondary)]">
			Don't agree? You can
			<a class="underline" href={resolve('/logout')}>sign out</a>, or
			<a class="underline" href={resolve('/data/delete')}>delete your account</a> and its data.
		</p>
	</div>
</div>
