<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faExclamationTriangle, faTrash, faUserSlash } from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../profile/components/SectionHeader.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let confirmEmail = $state('');
	let isLoading = $state(false);
	let showFinalConfirm = $state(false);

	const emailMatches = $derived(confirmEmail.trim() === data.email);
</script>

<svelte:head>
	<title>Delete Account - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<SectionHeader title="Delete Account" icon={faUserSlash} />

	<p class="text-sm text-[var(--dash-text-secondary)]">
		Access stops immediately, the data goes after 30 days, and there is no self-service undo.
		<a
			href={resolve('/guide/[slug]', { slug: 'your-data' })}
			class="text-[var(--dash-primary)] hover:underline">Read the guide</a
		>.
	</p>

	{#if data.isDemo}
		<div
			class="rounded-lg border p-6"
			style="background-color: var(--dash-bg-secondary); border-color: var(--dash-border);"
		>
			<p class="text-[var(--dash-text-secondary)]">
				This is a demo account. It expires on its own when the invite link that created it runs out,
				and there is nothing here to delete separately.
			</p>
		</div>
	{:else}
		<div
			class="space-y-4 rounded-lg border p-6"
			style="background-color: var(--dash-error-light); border-color: var(--dash-error);"
		>
			<div class="flex items-start gap-3">
				<FontAwesomeIcon
					icon={faExclamationTriangle}
					class="mt-0.5 h-6 w-6 flex-shrink-0"
					style="color: var(--dash-error);"
				/>
				<div>
					<h3 class="text-lg font-semibold" style="color: var(--dash-error);">
						Delete your account and everything in it
					</h3>
					<p class="mt-1 text-[var(--dash-text-secondary)]">
						This deletes your account, all
						<strong>{data.profileCount}</strong>
						{data.profileCount === 1 ? 'profile' : 'profiles'} on it, and every file you have uploaded
						— CVs, certificates, logos and attachments — from disk as well as from the database.
					</p>

					<p class="mt-3 text-[var(--dash-text-secondary)]">
						You are signed out immediately and your device and MCP keys stop working. Your data is
						erased for real after
						<strong>{data.graceDays} days</strong>, which is also how long our backups are kept — so
						once it is gone, it is gone from the backups too. Inside that window an administrator
						can still restore the account; after it, nobody can.
					</p>

					<p class="mt-3 text-sm text-[var(--dash-text-secondary)]">
						One thing is kept: records of payments you have made. Invoicing law requires us to
						retain those, and they are kept with your account reference removed so they can no
						longer be traced back to you.
					</p>

					<p class="mt-3 text-sm text-[var(--dash-text-secondary)]">
						If you only want a copy of your data, use
						<a class="underline" href={resolve('/data/profile-export')}>Profile export</a>
						first — you cannot get it afterwards.
					</p>
				</div>
			</div>

			{#if form?.error}
				<p class="text-sm font-medium" style="color: var(--dash-error);">{form.error}</p>
			{/if}

			<form
				id="delete-account-form"
				method="POST"
				action="?/request"
				use:enhance={() => {
					isLoading = true;
					return async ({ update }) => {
						isLoading = false;
						showFinalConfirm = false;
						await update();
					};
				}}
			>
				<label class="block text-sm font-medium text-[var(--dash-text)]" for="confirmEmail">
					Type <strong>{data.email}</strong> to confirm
				</label>
				<input
					id="confirmEmail"
					name="confirmEmail"
					type="text"
					autocomplete="off"
					bind:value={confirmEmail}
					class="mt-1 w-full max-w-md rounded-md border px-3 py-2"
					style="background-color: var(--dash-bg); border-color: var(--dash-border); color: var(--dash-text);"
				/>

				{#if !showFinalConfirm}
					<button
						type="button"
						disabled={!emailMatches || isLoading}
						onclick={() => (showFinalConfirm = true)}
						class="mt-4 inline-flex items-center gap-2 rounded-md px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
						style="background-color: var(--dash-error);"
					>
						<FontAwesomeIcon icon={faTrash} class="h-4 w-4" />
						Delete my account
					</button>
				{:else}
					<div class="mt-4 flex items-center gap-3">
						<span class="text-sm font-medium" style="color: var(--dash-error);">
							Really delete? This signs you out now.
						</span>
						<button
							type="submit"
							disabled={!emailMatches || isLoading}
							class="inline-flex items-center gap-2 rounded-md px-4 py-2 font-medium text-white disabled:opacity-50"
							style="background-color: var(--dash-error);"
						>
							{#if isLoading}<Spinner />{/if}
							Yes, delete it
						</button>
						<button
							type="button"
							onclick={() => (showFinalConfirm = false)}
							class="rounded-md border px-4 py-2 font-medium"
							style="border-color: var(--dash-border); color: var(--dash-text);"
						>
							Cancel
						</button>
					</div>
				{/if}
			</form>
		</div>
	{/if}
</div>
