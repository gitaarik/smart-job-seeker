<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
	import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
	import type { Snippet } from 'svelte';
	import Card from '../../components/Card.svelte';

	interface Props {
		card?: boolean;
		id: number;
		expandedId?: number | null;
		onToggle?: (id: number) => void;
		icon: IconDefinition;
		iconColor?: string;
		imageUrl?: string | null;
		imageAlt?: string;
		title: Snippet;
		badges?: Snippet;
		subtitle?: Snippet;
		dateline?: Snippet;
		headerActions?: Snippet;
		expandedContent?: Snippet;
		editContent?: Snippet;
		footer?: Snippet;
	}

	let {
		card = true,
		id,
		expandedId = null,
		onToggle,
		icon,
		iconColor = 'text-[var(--dash-primary)]',
		imageUrl,
		imageAlt = '',
		title,
		badges,
		subtitle,
		dateline,
		headerActions,
		expandedContent,
		editContent,
		footer
	}: Props = $props();

	let expanded = $derived(expandedId === id);
	let expandable = $derived(!!onToggle && (!!expandedContent || !!editContent));

	function handleToggle() {
		onToggle?.(id);
	}
</script>

{#snippet innerContent()}
	{#if editContent}
		<!-- Edit mode replaces entire card -->
		<div class="p-3 sm:p-4">
			{@render editContent()}
		</div>
	{:else}
		<!-- Top right: header actions + chevron -->
		{#if expandable || headerActions}
			<div class="absolute top-3 right-3 z-10 flex items-center gap-1">
				{#if headerActions}
					{@render headerActions()}
				{/if}
				{#if expandable}
					<button
						type="button"
						onclick={(e) => {
							e.stopPropagation();
							handleToggle();
						}}
						class="p-1.5 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
						aria-label={expanded ? 'Collapse' : 'Expand'}
					>
						<span
							class="inline-block transition-transform duration-200 {expanded ? 'rotate-90' : ''}"
						>
							<FontAwesomeIcon icon={faChevronRight} class="h-4 w-4" />
						</span>
					</button>
				{/if}
			</div>
		{/if}

		<!-- Header -->
		<div class="p-3 transition-colors hover:bg-[var(--dash-bg)] sm:p-4">
			<div class="flex items-start gap-3">
				<!-- Desktop: Logo/icon on the left -->
				<div class="hidden flex-shrink-0 md:flex">
					{#if imageUrl}
						<img src={imageUrl} alt={imageAlt} class="h-12 w-12 rounded-lg object-cover" />
					{:else}
						<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--dash-bg)]">
							<FontAwesomeIcon {icon} class="h-6 w-6 {iconColor}" />
						</div>
					{/if}
				</div>

				<!-- Clickable area for expand/collapse -->
				{#if expandable}
					<button
						type="button"
						onclick={handleToggle}
						class="flex min-w-0 flex-1 items-start gap-3 text-left"
					>
						<div class="min-w-0 flex-1">
							<h3
								class="line-clamp-2 pr-8 text-sm font-medium text-[var(--dash-text)] sm:truncate sm:text-base"
							>
								{@render title()}
								{#if badges}
									{@render badges()}
								{/if}
							</h3>

							{#if subtitle}
								<div
									class="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--dash-text-secondary)] sm:gap-3 sm:text-sm"
								>
									{@render subtitle()}
								</div>
							{/if}

							{#if dateline}
								<div class="mt-1.5 text-xs text-[var(--dash-text-muted)] sm:mt-2 sm:text-sm">
									{@render dateline()}
								</div>
							{/if}
						</div>
					</button>
				{:else}
					<!-- Non-expandable: plain content, not a button -->
					<div class="min-w-0 flex-1">
						<h3 class="text-sm font-medium text-[var(--dash-text)] sm:text-base">
							{@render title()}
							{#if badges}
								{@render badges()}
							{/if}
						</h3>

						{#if subtitle}
							<div class="mt-1 text-xs text-[var(--dash-text-secondary)] sm:text-sm">
								{@render subtitle()}
							</div>
						{/if}

						{#if dateline}
							<div class="mt-1.5 text-xs text-[var(--dash-text-muted)] sm:mt-2 sm:text-sm">
								{@render dateline()}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Mobile: Logo/icon on the right -->
				<div class="flex flex-shrink-0 flex-col items-end md:hidden">
					{#if expandable || headerActions}
						<div class="mb-1 h-6"></div>
						<!-- Spacer for top-right buttons -->
					{/if}
					{#if expandable}
						<button type="button" onclick={handleToggle}>
							{#if imageUrl}
								<img src={imageUrl} alt={imageAlt} class="h-12 w-12 rounded-lg object-cover" />
							{:else}
								<div
									class="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--dash-bg)]"
								>
									<FontAwesomeIcon {icon} class="h-6 w-6 {iconColor}" />
								</div>
							{/if}
						</button>
					{:else}
						{#if imageUrl}
							<img src={imageUrl} alt={imageAlt} class="h-12 w-12 rounded-lg object-cover" />
						{:else}
							<div
								class="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--dash-bg)]"
							>
								<FontAwesomeIcon {icon} class="h-6 w-6 {iconColor}" />
							</div>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Expanded Content -->
	{#if expanded && expandedContent && !editContent}
		<div class="relative space-y-3 border-t border-[var(--dash-border)] p-3 sm:space-y-4 sm:p-4">
			{@render expandedContent()}
		</div>
	{/if}

	<!-- Footer (always visible when provided, hidden during edit) -->
	{#if footer && !editContent}
		<div
			class="flex items-center justify-end gap-2 border-t border-[var(--dash-border)] px-3 py-2 sm:px-4 md:justify-start"
		>
			{@render footer()}
		</div>
	{/if}
{/snippet}

{#if card}
	<Card class="relative overflow-hidden transition-all">
		{@render innerContent()}
	</Card>
{:else}
	<div
		class="relative overflow-hidden transition-all sm:rounded-lg sm:border sm:border-[var(--dash-border)] sm:bg-[var(--dash-card)]"
	>
		{@render innerContent()}
	</div>
{/if}
