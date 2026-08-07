<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faChevronDown,
		faChevronUp,
		faPlus,
		faQuoteLeft,
		faTrash
	} from '@fortawesome/free-solid-svg-icons';
	import type { Reference } from '$lib/server/resume/types';
	import Card from '../../../../components/Card.svelte';

	interface Props {
		references: Reference[];
	}

	let { references = $bindable() }: Props = $props();

	let isExpanded = $state(false);
	let expandedItems = $state<Set<number>>(new Set());

	function toggleItem(index: number) {
		if (expandedItems.has(index)) {
			expandedItems.delete(index);
		} else {
			expandedItems.add(index);
		}
		expandedItems = new Set(expandedItems);
	}

	function removeItem(index: number) {
		if (!confirm('Remove this reference?')) return;
		references = references.filter((_, i) => i !== index);
	}

	function addReference() {
		references = [...references, { author: '', text: '' }];
		expandedItems.add(references.length - 1);
		expandedItems = new Set(expandedItems);
		isExpanded = true;
	}
</script>

<Card class="overflow-hidden">
	<button
		type="button"
		onclick={() => (isExpanded = !isExpanded)}
		class="flex w-full items-center justify-between p-3 transition-colors hover:bg-[var(--dash-bg)] sm:p-4"
	>
		<div class="flex items-center gap-3">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--dash-primary)]/10"
			>
				<FontAwesomeIcon icon={faQuoteLeft} class="h-5 w-5 text-[var(--dash-primary)]" />
			</div>
			<span class="text-base font-semibold text-[var(--dash-text)]">References</span>
			<span class="text-sm text-[var(--dash-text-secondary)]">({references.length})</span>
		</div>
		<FontAwesomeIcon
			icon={isExpanded ? faChevronUp : faChevronDown}
			class="h-4 w-4 text-[var(--dash-text-muted)]"
		/>
	</button>

	{#if isExpanded}
		<div class="divide-y divide-[var(--dash-border)] border-t border-[var(--dash-border)]">
			{#each references as ref, index}
				<div class={expandedItems.has(index) ? 'border-l-2 border-l-[var(--dash-primary)]' : ''}>
					<div
						class="flex items-center justify-between transition-colors hover:bg-[var(--dash-bg)]"
					>
						<button
							type="button"
							onclick={() => toggleItem(index)}
							class="flex-1 self-stretch p-3 text-left sm:p-4"
						>
							<div class="text-sm font-semibold text-[var(--dash-text)]">
								{ref.author || 'Author'}
							</div>
							{#if ref.authorPosition}
								<div class="text-xs text-[var(--dash-text-secondary)] sm:text-sm">
									{ref.authorPosition}
								</div>
							{/if}
						</button>
						<div class="flex items-center gap-2">
							<button
								type="button"
								onclick={() => removeItem(index)}
								class="flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 text-xs text-[var(--dash-text)] transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
								aria-label="Remove"
							>
								<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
								<span class="hidden sm:inline">Remove</span>
							</button>
							<button
								type="button"
								onclick={() => toggleItem(index)}
								class="p-1"
								aria-label={expandedItems.has(index) ? 'Collapse' : 'Expand'}
							>
								<FontAwesomeIcon
									icon={expandedItems.has(index) ? faChevronUp : faChevronDown}
									class="h-4 w-4 text-[var(--dash-text-muted)]"
								/>
							</button>
						</div>
					</div>

					{#if expandedItems.has(index)}
						<div class="space-y-4 px-3 py-4 sm:px-4">
							<div class="grid gap-4 md:grid-cols-2">
								<div>
									<label class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
										Author
									</label>
									<input
										type="text"
										bind:value={references[index].author}
										class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
									/>
								</div>

								<div>
									<label class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
										Position
									</label>
									<input
										type="text"
										bind:value={references[index].authorPosition}
										class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
									/>
								</div>
							</div>

							<div>
								<label class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
									Reference Text
								</label>
								<textarea
									bind:value={references[index].text}
									rows="3"
									class="w-full resize-none rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
								></textarea>
							</div>
						</div>
					{/if}
				</div>
			{/each}

			<div class="p-3 sm:p-4">
				<button
					type="button"
					onclick={addReference}
					class="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--dash-border)] py-2 text-sm text-[var(--dash-primary)] transition-colors hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary-hover)]"
				>
					<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
					Add reference
				</button>
			</div>
		</div>
	{/if}
</Card>
