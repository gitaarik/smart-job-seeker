<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faPlus, faTimes, faUndo } from '@fortawesome/free-solid-svg-icons';

	interface Props {
		technologies: string[];
		deletedIndices?: Set<number>;
		lastAddedIndex?: number | null;
		onAdd?: () => void;
		onRemove?: (index: number) => void;
		onUndoRemove?: (index: number) => void;
		onFocused?: () => void;
	}

	let {
		technologies = $bindable(),
		deletedIndices = new Set(),
		lastAddedIndex = null,
		onAdd,
		onRemove,
		onUndoRemove,
		onFocused
	}: Props = $props();

	// Simple mode: component manages its own add/remove when callbacks not provided
	let internalLastAdded = $state<number | null>(null);
	let effectiveLastAdded = $derived(onAdd ? lastAddedIndex : internalLastAdded);

	function focusIfNew(node: HTMLInputElement, isNew: boolean) {
		if (isNew) {
			node.focus();
			if (onFocused) onFocused();
			else internalLastAdded = null;
		}
	}

	function handleAdd() {
		if (onAdd) {
			onAdd();
		} else {
			technologies = [...technologies, ''];
			internalLastAdded = technologies.length - 1;
		}
	}

	function handleRemove(index: number) {
		if (onRemove) {
			onRemove(index);
		} else {
			technologies = technologies.filter((_, i) => i !== index);
		}
	}
</script>

<div class="flex flex-wrap gap-2">
	{#each technologies as tech, index}
		{@const isDeleted = deletedIndices.has(index)}
		<div
			class="flex items-center gap-1 rounded-lg py-1 pr-1 pl-3 {isDeleted
				? 'bg-[var(--dash-bg)]/50 opacity-50'
				: 'bg-[var(--dash-bg)]'}"
		>
			<div class="relative pr-3">
				<span class="invisible min-w-[3ch] text-sm whitespace-pre {isDeleted ? 'line-through' : ''}"
					>{technologies[index] || 'Technology'}</span
				>
				{#if isDeleted}
					<span class="absolute inset-0 pr-3 text-sm text-[var(--dash-text-secondary)] line-through"
						>{technologies[index]}</span
					>
				{:else}
					<input
						type="text"
						bind:value={technologies[index]}
						placeholder="Technology"
						use:focusIfNew={index === effectiveLastAdded}
						class="absolute inset-0 w-full border-none bg-transparent pr-3 text-sm text-[var(--dash-text)] focus:outline-none"
					/>
				{/if}
			</div>
			{#if isDeleted}
				{#if onUndoRemove}
					<button
						type="button"
						onclick={() => onUndoRemove(index)}
						class="p-1 text-[var(--dash-primary)] transition-colors hover:text-[var(--dash-primary-hover)]"
						aria-label="Undo"
					>
						<FontAwesomeIcon icon={faUndo} class="h-3 w-3" />
					</button>
				{/if}
			{:else}
				<button
					type="button"
					onclick={() => handleRemove(index)}
					class="p-1 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-error)]"
					aria-label="Remove"
				>
					<FontAwesomeIcon icon={faTimes} class="h-3 w-3" />
				</button>
			{/if}
		</div>
	{/each}
	<button
		type="button"
		onclick={handleAdd}
		class="flex items-center gap-1 px-3 py-1 text-sm text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
	>
		<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
		Add
	</button>
</div>
