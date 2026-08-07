<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck, faChevronDown, faPlus, faUser } from '@fortawesome/free-solid-svg-icons';
	import type { ProfileSummary } from '$lib/server/profile/user-profiles';
	import HeaderDropdown from './HeaderDropdown.svelte';

	interface Props {
		profiles: ProfileSummary[];
		selectedProfile: ProfileSummary;
	}

	let { profiles, selectedProfile }: Props = $props();
	let dropdown: HeaderDropdown;
	let isCreatePage = $derived($page.url.pathname.startsWith('/profile/create'));

	function selectProfile(profile: ProfileSummary) {
		dropdown.close();
		goto(`/home?profile=${profile.id}`);
	}
</script>

<HeaderDropdown bind:this={dropdown} id="profile" width="w-64">
	{#snippet trigger({ isOpen })}
		<div
			class="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 transition-colors hover:bg-white/20"
		>
			<FontAwesomeIcon
				icon={isCreatePage ? faPlus : faUser}
				class="h-4 w-4 text-[var(--dash-chrome-text)]"
			/>
			<span class="max-w-32 truncate text-sm font-medium text-[var(--dash-chrome-text)]">
				{isCreatePage ? 'New Profile' : selectedProfile.name || 'Unnamed Profile'}
			</span>
			<FontAwesomeIcon
				icon={faChevronDown}
				class="h-3 w-3 text-[var(--dash-chrome-text)] transition-transform {isOpen
					? 'rotate-180'
					: ''}"
			/>
		</div>
	{/snippet}

	<div class="py-2">
		<div class="px-3 py-1 text-xs font-semibold text-[var(--dash-text-secondary)] uppercase">
			Your Profiles
		</div>

		{#each profiles as profile (profile.id)}
			<button
				onclick={() => selectProfile(profile)}
				class="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--dash-bg)] {!isCreatePage &&
				profile.id === selectedProfile.id
					? 'bg-[var(--dash-bg)]'
					: ''}"
			>
				<span class="flex-1 truncate text-[var(--dash-text)]"
					>{profile.name || 'Unnamed Profile'}</span
				>
				{#if !isCreatePage && profile.id === selectedProfile.id}
					<FontAwesomeIcon icon={faCheck} class="h-3 w-3 text-[var(--dash-primary)]" />
				{/if}
			</button>
		{/each}

		<div class="mt-2 border-t border-[var(--dash-border)] pt-2">
			<a
				href="/profile/create"
				onclick={() => dropdown.close()}
				class="flex w-full items-center gap-2 px-3 py-2 text-left text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-bg)]"
			>
				<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
				<span>Create New Profile</span>
			</a>
		</div>
	</div>
</HeaderDropdown>
