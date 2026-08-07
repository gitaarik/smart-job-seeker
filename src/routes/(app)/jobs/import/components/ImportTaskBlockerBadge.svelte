<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
	import type { ImportTaskBlocker } from '$lib/import-tasks/readiness';
	import ImportTaskBlockerList from './ImportTaskBlockerList.svelte';

	let { blockers }: { blockers: ImportTaskBlocker[] } = $props();

	// Hover opens on desktop; tap toggles on mobile. The row is a link, so the
	// trigger swallows the click to avoid navigating while reading the recap.
	let open = $state(false);
	function toggle(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		open = !open;
	}
</script>

{#if blockers.length > 0}
	<span
		class="relative inline-flex"
		onmouseenter={() => (open = true)}
		onmouseleave={() => (open = false)}
	>
		<button
			type="button"
			onclick={toggle}
			aria-label="{blockers.length} setup step{blockers.length === 1
				? ''
				: 's'} needed before this import can run"
			class="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs whitespace-nowrap text-amber-600 transition-colors hover:bg-amber-500/25 dark:text-amber-400"
		>
			<FontAwesomeIcon icon={faTriangleExclamation} class="h-3 w-3" />
			Needs setup
		</button>

		{#if open}
			<div
				role="tooltip"
				onclick={(e) => e.preventDefault()}
				onkeydown={() => {}}
				class="absolute top-full right-0 z-20 mt-1.5 w-72 cursor-default rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-3 text-left shadow-lg"
			>
				<p class="mb-2 text-xs font-semibold text-[var(--dash-text)]">
					Finish setup before it can run
				</p>
				<ImportTaskBlockerList {blockers} />
			</div>
		{/if}
	</span>
{/if}
