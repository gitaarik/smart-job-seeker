<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faAddressBook,
		faBook,
		faChevronDown,
		faCog,
		faCommentDots,
		faSignOutAlt
	} from '@fortawesome/free-solid-svg-icons';
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
	import HeaderDropdown from './HeaderDropdown.svelte';

	interface Props {
		user: { id: string; name: string | null; email: string };
	}

	let { user }: Props = $props();

	const displayName = $derived(user.name || user.email);
	const initial = $derived(displayName.charAt(0).toUpperCase());
</script>

<HeaderDropdown id="user" width="w-56">
	{#snippet trigger({ isOpen })}
		<div class="flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-white/10">
			<div class="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
				<span class="text-sm font-medium text-[var(--dash-chrome-text)]">
					{initial}
				</span>
			</div>
			<FontAwesomeIcon
				icon={faChevronDown}
				class="h-3 w-3 text-[var(--dash-chrome-text)] transition-transform {isOpen
					? 'rotate-180'
					: ''}"
			/>
		</div>
	{/snippet}

	<div class="border-b border-[var(--dash-border)] px-4 py-3">
		<p class="truncate text-sm font-medium text-[var(--dash-text)]">
			{user.name || 'User'}
		</p>
		<p class="truncate text-xs text-[var(--dash-text-secondary)]">
			{user.email}
		</p>
	</div>

	<div class="py-2">
		<ThemeSwitcher variant="inline" />

		<a
			href="/contacts"
			class="flex items-center gap-2 px-4 py-2 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
		>
			<FontAwesomeIcon icon={faAddressBook} class="h-4 w-4" />
			<span>Contacts</span>
		</a>

		<a
			href="/guide"
			target="_blank"
			rel="noopener"
			class="flex items-center gap-2 px-4 py-2 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
		>
			<FontAwesomeIcon icon={faBook} class="h-4 w-4" />
			<span>Guide</span>
		</a>

		<a
			href="/feedback"
			class="flex items-center gap-2 px-4 py-2 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
		>
			<FontAwesomeIcon icon={faCommentDots} class="h-4 w-4" />
			<span>Feedback</span>
		</a>

		<a
			href="/settings"
			class="flex items-center gap-2 px-4 py-2 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
		>
			<FontAwesomeIcon icon={faCog} class="h-4 w-4" />
			<span>Settings</span>
		</a>

		<a
			href="/logout"
			class="flex items-center gap-2 px-4 py-2 text-sm text-[var(--dash-error)] transition-colors hover:bg-[var(--dash-bg)]"
		>
			<FontAwesomeIcon icon={faSignOutAlt} class="h-4 w-4" />
			<span>Sign out</span>
		</a>
	</div>
</HeaderDropdown>
