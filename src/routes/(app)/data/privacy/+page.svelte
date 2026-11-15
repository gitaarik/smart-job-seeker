<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { faUserShield } from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../profile/components/SectionHeader.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Follows the load after a save: the page is kept, only `data` changes.
	let enabled = $derived(data.analyticsConsentedAt !== null);
	let saving = $state(false);

	function submit(event: Event) {
		(event.currentTarget as HTMLInputElement).form?.requestSubmit();
	}
</script>

<svelte:head>
	<title>Privacy - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<SectionHeader title="Privacy" icon={faUserShield} />

	<p class="text-sm text-[var(--dash-text-secondary)]">
		What the app stores on your device is your login and a few preferences. Page statistics are
		collected on our own server without cookies and without knowing who you are. The one choice
		below is whether those statistics may be linked to your account. The
		<a href={resolve('/privacy')} class="text-[var(--dash-primary)] hover:underline"
			>privacy policy</a
		> has the full picture.
	</p>

	<form
		method="POST"
		action="?/analytics"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				saving = false;
				await update();
			};
		}}
		class="rounded-lg border p-6"
		style="background-color: var(--dash-card); border-color: var(--dash-border);"
	>
		<label class="flex items-start gap-3">
			<input
				type="checkbox"
				name="enabled"
				checked={enabled}
				disabled={saving}
				onchange={submit}
				class="mt-1 h-4 w-4 rounded border-[var(--dash-border)]"
			/>
			<span>
				<span class="block font-medium text-[var(--dash-text)]">
					Link my visits to my account in Smart Job Seeker's own analytics
				</span>
				<span class="mt-1 block text-sm text-[var(--dash-text-secondary)]">
					Helps us see how the app is actually used by real people. The link is kept for 30 days,
					then removed; the anonymous statistics stay. Nothing is shared with anyone else, and
					turning this off stops the linking at once.
				</span>
			</span>
			{#if saving}
				<Spinner size="w-4 h-4" class="mt-1 ml-auto" />
			{/if}
		</label>

		{#if form?.saved}
			<p class="mt-4 text-sm text-[var(--dash-text-muted)]">
				Saved. {form.enabled
					? 'Your visits are linked from your next page load.'
					: 'Your visits are anonymous from your next page load.'}
			</p>
		{/if}
		{#if form?.error}
			<p class="mt-4 text-sm" style="color: var(--dash-error);">{form.error}</p>
		{/if}
	</form>
</div>
