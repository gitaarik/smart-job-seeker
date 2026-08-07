<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
	import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
	import Card from '../../../../components/Card.svelte';

	interface Props {
		title: string;
		icon: IconDefinition;
		count?: string;
		badge?: { added: number; modified: number; removed: number };
		defaultExpanded?: boolean;
		children?: import('svelte').Snippet;
	}

	let { title, icon, count, badge, defaultExpanded = false, children }: Props = $props();

	let isExpanded = $state(defaultExpanded);

	const hasBadgeChanges = $derived(
		badge && (badge.added > 0 || badge.modified > 0 || badge.removed > 0)
	);
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
				<FontAwesomeIcon {icon} class="h-5 w-5 text-[var(--dash-primary)]" />
			</div>
			<span class="text-base font-semibold text-[var(--dash-text)]">{title}</span>
			{#if count}
				<span class="text-sm text-[var(--dash-text-secondary)]">({count})</span>
			{/if}
			{#if hasBadgeChanges}
				<div class="flex items-center gap-1.5">
					{#if badge && badge.modified > 0}
						<span
							class="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700"
						>
							{badge.modified} modified
						</span>
					{/if}
					{#if badge && badge.added > 0}
						<span
							class="rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700"
						>
							{badge.added} new
						</span>
					{/if}
					{#if badge && badge.removed > 0}
						<span class="rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
							{badge.removed} removed
						</span>
					{/if}
				</div>
			{:else if badge}
				<span
					class="rounded-full bg-[var(--dash-bg)] px-1.5 py-0.5 text-xs font-medium text-[var(--dash-text-muted)]"
				>
					No changes
				</span>
			{/if}
		</div>
		<FontAwesomeIcon
			icon={isExpanded ? faChevronUp : faChevronDown}
			class="h-4 w-4 text-[var(--dash-text-muted)]"
		/>
	</button>

	{#if isExpanded}
		<div class="border-t border-[var(--dash-border)]">
			{@render children?.()}
		</div>
	{/if}
</Card>
