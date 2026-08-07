<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';
	import Card from './Card.svelte';

	interface Props {
		label: string;
		value: string | number;
		icon: IconDefinition;
		color?: string;
		href?: string;
		highlight?: boolean;
	}

	let {
		label,
		value,
		icon,
		color = 'text-[var(--dash-text-muted)]',
		href,
		highlight = false
	}: Props = $props();
</script>

{#if href}
	<a {href} class="group block">
		<Card padding="sm">
			<div class="flex items-center justify-between gap-2.5">
				<div class="min-w-0">
					<div class="flex items-center gap-1.5">
						<p class="text-lg font-semibold text-[var(--dash-text)]">
							{value}
						</p>
						{#if highlight}
							<span class="h-2 w-2 animate-pulse rounded-full bg-blue-500"></span>
						{/if}
					</div>
					<p
						class="truncate text-xs text-[var(--dash-text-secondary)] transition-colors group-hover:text-[var(--dash-primary)]"
					>
						{label}
					</p>
				</div>
				<div
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--dash-bg)] transition-colors group-hover:bg-[var(--dash-border)]"
				>
					<FontAwesomeIcon {icon} class="h-4 w-4 {color}" />
				</div>
			</div>
		</Card>
	</a>
{:else}
	<Card padding="sm">
		<div class="flex items-center justify-between gap-2.5">
			<div class="min-w-0">
				<div class="flex items-center gap-1.5">
					<p class="text-lg font-semibold text-[var(--dash-text)]">
						{value}
					</p>
					{#if highlight}
						<span class="h-2 w-2 animate-pulse rounded-full bg-blue-500"></span>
					{/if}
				</div>
				<p class="truncate text-xs text-[var(--dash-text-secondary)]">
					{label}
				</p>
			</div>
			<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--dash-bg)]">
				<FontAwesomeIcon {icon} class="h-4 w-4 {color}" />
			</div>
		</div>
	</Card>
{/if}
