<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCog, faExclamationTriangle, faTrash } from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../profile/components/SectionHeader.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let confirmName = $state('');
	let isLoading = $state(false);
	let showFinalConfirm = $state(false);

	const nameMatches = $derived(confirmName === data.profileName);

	function handleDeleteClick() {
		showFinalConfirm = true;
	}

	function confirmDelete() {
		document.getElementById('delete-form')?.requestSubmit();
	}

	function cancelDelete() {
		showFinalConfirm = false;
	}
</script>

<svelte:head>
	<title>Profile Settings - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<SectionHeader title="Profile Settings" icon={faCog} />

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
				<h3 class="text-lg font-semibold" style="color: var(--dash-error);">Danger Zone</h3>
				<p class="mt-1 text-[var(--dash-text-secondary)]">
					This action <strong>cannot be undone</strong>. This will permanently delete the profile
					<strong>"{data.profileName}"</strong> and all associated data including:
				</p>
				<ul class="mt-2 ml-5 list-disc space-y-1 text-[var(--dash-text-secondary)]">
					<li>Work experiences and achievements</li>
					<li>Education records</li>
					<li>Skills and skill categories</li>
					<li>Side projects</li>
					<li>Resume/CV versions</li>
					<li>Share links and access tokens</li>
					<li>Exported files</li>
				</ul>
			</div>
		</div>
	</div>

	{#if data.isLastProfile}
		<div
			class="rounded-lg border p-4"
			style="background-color: var(--dash-warning-light); border-color: var(--dash-warning-border);"
		>
			<p style="color: var(--dash-warning);">
				This is your only profile. You cannot delete it. Create another profile first if you want to
				delete this one.
			</p>
		</div>
	{:else}
		<form
			id="delete-form"
			method="POST"
			action="?/delete"
			use:enhance={() => {
				isLoading = true;
				return async ({ result }) => {
					isLoading = false;
					if (result.type === 'redirect') {
						await goto(result.location, { replaceState: true });
					}
				};
			}}
			class="space-y-4"
		>
			{#if form?.error}
				<div
					class="rounded-md border p-4"
					style="background-color: var(--dash-error-light); border-color: var(--dash-error);"
				>
					<p class="text-sm" style="color: var(--dash-error);">{form.error}</p>
				</div>
			{/if}

			<div>
				<label for="confirmName" class="mb-2 block text-sm font-medium text-[var(--dash-text)]">
					To confirm, type <strong>"{data.profileName}"</strong> below:
				</label>
				<input
					type="text"
					id="confirmName"
					name="confirmName"
					bind:value={confirmName}
					autocomplete="off"
					class="w-full max-w-md rounded-md border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-2 text-[var(--dash-text)] focus:border-transparent focus:ring-2 focus:outline-none"
					style="--tw-ring-color: var(--dash-error);"
					placeholder="Enter profile name to confirm"
				/>
			</div>

			{#if showFinalConfirm}
				<div
					class="space-y-3 rounded-lg border p-4"
					style="border-color: var(--dash-error); background-color: var(--dash-error-light);"
				>
					<p class="font-medium" style="color: var(--dash-error);">
						Are you absolutely sure you want to delete "{data.profileName}"?
					</p>
					<div class="flex gap-2">
						<button
							type="button"
							onclick={cancelDelete}
							disabled={isLoading}
							class="rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)] disabled:opacity-50"
						>
							Cancel
						</button>
						<button
							type="button"
							onclick={confirmDelete}
							disabled={isLoading}
							class="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-white transition-colors hover:opacity-90 disabled:opacity-50"
							style="background-color: var(--dash-error);"
						>
							{#if isLoading}
								<Spinner size="w-3 h-3" />
							{/if}
							Yes, delete permanently
						</button>
					</div>
				</div>
			{:else}
				<button
					type="button"
					onclick={handleDeleteClick}
					disabled={!nameMatches || isLoading}
					class="flex items-center gap-2 rounded-lg px-4 py-2 font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
					style="background-color: var(--dash-error);"
				>
					<FontAwesomeIcon icon={faTrash} class="h-4 w-4" />
					Delete this profile
				</button>
			{/if}
		</form>
	{/if}
</div>
