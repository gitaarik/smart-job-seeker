<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faPlus } from '@fortawesome/free-solid-svg-icons';
	import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

	interface Props {
		icon: IconDefinition;
		title: string;
		description: string;
		actionLabel?: string;
		onAction?: () => void;
	}

	let { icon, title, description, actionLabel = 'Add First', onAction }: Props = $props();
</script>

<div
	class="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--dash-border)] px-6 py-12"
>
	<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--dash-bg)]">
		<FontAwesomeIcon {icon} class="h-8 w-8 text-[var(--dash-text-muted)]" />
	</div>
	<h3 class="mb-2 text-lg font-medium text-[var(--dash-text)]">{title}</h3>
	<p class="mb-6 max-w-sm text-center text-[var(--dash-text-secondary)]">{description}</p>
	{#if onAction}
		<button
			type="button"
			onclick={onAction}
			class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
		>
			<FontAwesomeIcon icon={faPlus} class="h-4 w-4" />
			{actionLabel}
		</button>
	{/if}
</div>
