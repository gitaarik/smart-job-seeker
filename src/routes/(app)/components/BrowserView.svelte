<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faDesktop, faTimes } from '@fortawesome/free-solid-svg-icons';
	import Card from './Card.svelte';

	interface Props {
		statusMessage?: string;
		onclose?: () => void;
	}

	let { statusMessage = '', onclose }: Props = $props();

	const browserViewUrl = '/vnc/vnc.html?autoconnect=true&resize=scale';
</script>

<Card class="overflow-hidden">
	<div class="flex items-center justify-between border-b border-[var(--dash-border)] p-3">
		<div class="flex items-center gap-2">
			<FontAwesomeIcon icon={faDesktop} class="h-4 w-4 text-[var(--dash-text-secondary)]" />
			<h2 class="font-medium text-[var(--dash-text)]">Browser View</h2>
		</div>
		<div class="flex items-center gap-2">
			{#if onclose}
				<button
					onclick={onclose}
					class="p-1 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
				>
					<FontAwesomeIcon icon={faTimes} class="h-4 w-4" />
				</button>
			{/if}
		</div>
	</div>

	<!-- VNC mode: noVNC has built-in resize=scale, works well at any size -->
	<div class="relative" style="padding-bottom: 56.25%;">
		<iframe
			src={browserViewUrl}
			class="absolute inset-0 h-full w-full border-0"
			title="Browser view"
		></iframe>
	</div>

	{#if statusMessage}
		<div class="border-t border-[var(--dash-border)] bg-[var(--dash-bg)] p-3">
			<p class="text-sm text-[var(--dash-text-secondary)]">{statusMessage}</p>
		</div>
	{/if}
</Card>
