<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck } from '@fortawesome/free-solid-svg-icons';
	import Spinner from '$lib/components/Spinner.svelte';

	type SaveState = 'idle' | 'saving' | 'saved' | 'error';

	interface Props {
		state?: SaveState;
		onClick?: () => void;
		disabled?: boolean;
		label?: string;
	}

	let { state = 'idle', onClick, disabled = false, label }: Props = $props();

	const defaultLabel = label ?? 'Save';

	const buttonText = $derived(
		state === 'saving'
			? 'Saving...'
			: state === 'saved'
				? 'Saved'
				: state === 'error'
					? 'Error'
					: defaultLabel
	);
</script>

<button
	type="button"
	onclick={onClick}
	disabled={disabled || state === 'saving'}
	class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200
    {state === 'saved'
		? 'bg-[var(--dash-success)] text-white'
		: state === 'error'
			? 'bg-[var(--dash-error)] text-white'
			: 'bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-hover)]'}
    disabled:cursor-not-allowed disabled:opacity-50"
>
	{#if state === 'saving'}
		<Spinner size="w-4 h-4" />
	{:else if state === 'saved'}
		<FontAwesomeIcon icon={faCheck} class="h-4 w-4" />
	{/if}
	{buttonText}
</button>
