<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faArrowLeft, faPlus } from '@fortawesome/free-solid-svg-icons';
	import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		icon?: IconDefinition;
		backHref?: string;
		backLabel?: string;
		showAddButton?: boolean;
		addLabel?: string;
		onAdd?: () => void;
		actions?: Snippet;
	}

	let {
		title,
		icon,
		backHref,
		backLabel = 'Back',
		showAddButton = false,
		addLabel = 'Add New',
		onAdd,
		actions
	}: Props = $props();
</script>

<div class="mb-6">
	{#if backHref}
		<div class="mb-4">
			<a
				href={backHref}
				class="flex items-center gap-2 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
			>
				<FontAwesomeIcon icon={faArrowLeft} class="h-4 w-4" />
				<span class="text-sm">{backLabel}</span>
			</a>
		</div>
	{/if}
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			{#if icon}
				<div class="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--dash-bg)]">
					<FontAwesomeIcon {icon} class="h-6 w-6 text-[var(--dash-text-muted)]" />
				</div>
			{/if}
			<h1 class="text-2xl font-bold text-[var(--dash-text)]">{title}</h1>
		</div>

		{#if actions || showAddButton}
			<div class="flex items-center gap-2">
				{#if actions}
					{@render actions()}
				{/if}
				{#if showAddButton}
					<button
						type="button"
						onclick={onAdd}
						class="flex items-center justify-center gap-2 rounded-lg bg-[var(--dash-primary)] p-3 text-white transition-colors hover:bg-[var(--dash-primary-hover)] sm:px-4 sm:py-2"
					>
						<FontAwesomeIcon icon={faPlus} class="h-5 w-5 sm:h-4 sm:w-4" />
						<span class="hidden sm:inline">{addLabel}</span>
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>
