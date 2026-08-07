<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faChevronDown,
		faChevronUp,
		faPlus,
		faMinus,
		faPen
	} from '@fortawesome/free-solid-svg-icons';
	import type { FieldDiff, ItemDiffType } from '$lib/resume-diff';
	import DiffFieldRow from './DiffFieldRow.svelte';

	interface Props {
		type: ItemDiffType;
		title: string;
		subtitle?: string;
		enabled: boolean;
		fieldDiffs?: FieldDiff[];
		nestedDiffs?: {
			field: string;
			label: string;
			added: string[];
			removed: string[];
			addedEnabled: boolean[];
			removedEnabled: boolean[];
		}[];
		defaultExpanded?: boolean;
		showUnchanged?: boolean;
	}

	let {
		type,
		title,
		subtitle,
		enabled = $bindable(),
		fieldDiffs,
		nestedDiffs,
		defaultExpanded = false,
		showUnchanged = false
	}: Props = $props();

	let isExpanded = $state(defaultExpanded);

	const borderClass = $derived(
		type === 'added'
			? 'border-l-2 border-l-green-500'
			: type === 'removed'
				? 'border-l-2 border-l-red-400'
				: type === 'modified'
					? 'border-l-2 border-l-amber-500'
					: ''
	);

	const typeIcon = $derived(type === 'added' ? faPlus : type === 'removed' ? faMinus : faPen);

	const typeColor = $derived(
		type === 'added' ? 'text-green-600' : type === 'removed' ? 'text-red-500' : 'text-amber-600'
	);

	const changedFields = $derived(fieldDiffs?.filter((d) => d.changed) ?? []);

	const hasNestedChanges = $derived(nestedDiffs && nestedDiffs.length > 0);

	const hasDetails = $derived(changedFields.length > 0 || hasNestedChanges);
</script>

{#if type === 'unchanged' && showUnchanged}
	<div class="opacity-50">
		<div class="flex items-center gap-3 p-3 sm:p-4">
			<div class="min-w-0 flex-1">
				<div class="text-sm text-[var(--dash-text-muted)]">
					{title}
				</div>
				{#if subtitle}
					<div class="text-xs text-[var(--dash-text-muted)]">
						{subtitle}
					</div>
				{/if}
			</div>
			<span class="shrink-0 text-[10px] text-[var(--dash-text-muted)]">unchanged</span>
		</div>
	</div>
{:else if type !== 'unchanged'}
	<div class={borderClass}>
		<div class="flex items-center justify-between transition-colors hover:bg-[var(--dash-bg)]">
			<div class="flex flex-1 items-center gap-3 p-3 sm:p-4">
				<label class="flex-shrink-0">
					<input
						type="checkbox"
						bind:checked={enabled}
						class="rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
					/>
				</label>

				<FontAwesomeIcon icon={typeIcon} class="h-3.5 w-3.5 {typeColor}" />

				<div class="min-w-0">
					<div class="text-sm font-semibold text-[var(--dash-text)]">
						{title}
					</div>
					{#if subtitle}
						<div class="text-xs text-[var(--dash-text-secondary)]">
							{subtitle}
						</div>
					{/if}
				</div>

				{#if type === 'modified' && changedFields.length > 0}
					<span class="mr-2 ml-auto text-xs text-[var(--dash-text-muted)]">
						{changedFields.length} field{changedFields.length !== 1 ? 's' : ''} changed
					</span>
				{/if}
			</div>

			{#if hasDetails}
				<button
					type="button"
					onclick={() => (isExpanded = !isExpanded)}
					class="p-3 sm:p-4"
					aria-label={isExpanded ? 'Collapse' : 'Expand'}
				>
					<FontAwesomeIcon
						icon={isExpanded ? faChevronUp : faChevronDown}
						class="h-4 w-4 text-[var(--dash-text-muted)]"
					/>
				</button>
			{/if}
		</div>

		{#if isExpanded && hasDetails}
			<div class="ml-7 space-y-1 px-3 pb-4 sm:px-4">
				{#if changedFields.length > 0 && fieldDiffs}
					{#each fieldDiffs as _, j}
						{#if fieldDiffs[j].changed}
							<DiffFieldRow bind:diff={fieldDiffs[j]} />
						{/if}
					{/each}
				{/if}

				{#if nestedDiffs}
					{#each nestedDiffs as _, ni}
						{@const nested = nestedDiffs[ni]}
						<div class="mt-2">
							<div class="mb-1 text-xs font-medium text-[var(--dash-text-secondary)]">
								{nested.label}
							</div>
							{#if nested.added.length > 0}
								<div class="space-y-1">
									{#each nested.added as item, i}
										<div class="flex items-center gap-2 rounded bg-green-50 px-2 py-1 text-sm">
											<label class="flex-shrink-0">
												<input
													type="checkbox"
													bind:checked={nestedDiffs[ni].addedEnabled[i]}
													class="rounded border-[var(--dash-border)] text-green-600 focus:ring-green-500"
												/>
											</label>
											<FontAwesomeIcon icon={faPlus} class="h-3 w-3 text-green-600" />
											<span class="text-[var(--dash-text)]">{item}</span>
										</div>
									{/each}
								</div>
							{/if}
							{#if nested.removed.length > 0}
								<div class="mt-1 space-y-1">
									{#each nested.removed as item, i}
										<div class="flex items-center gap-2 rounded bg-red-50 px-2 py-1 text-sm">
											<label class="flex-shrink-0">
												<input
													type="checkbox"
													bind:checked={nestedDiffs[ni].removedEnabled[i]}
													class="rounded border-[var(--dash-border)] text-red-600 focus:ring-red-500"
												/>
											</label>
											<FontAwesomeIcon icon={faMinus} class="h-3 w-3 text-red-500" />
											<span class="text-[var(--dash-text-muted)] line-through">{item}</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
{/if}
