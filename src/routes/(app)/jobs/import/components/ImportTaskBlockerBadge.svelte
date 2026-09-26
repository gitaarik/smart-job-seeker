<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
	import type { ImportTaskBlocker } from '$lib/import-tasks/readiness';
	import ImportTaskBlockerList from './ImportTaskBlockerList.svelte';

	let { blockers }: { blockers: ImportTaskBlocker[] } = $props();

	// Hover shows the recap (CSS `group-hover`, so no mouse handlers); a tap or
	// click pins it open. The row is a link, so the trigger swallows the click to
	// avoid navigating while reading the recap.
	let open = $state(false);
	// The recap describes the trigger, for a screen reader that never hovers.
	const recapId = $props.id();
	function toggle(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		open = !open;
	}
</script>

{#if blockers.length > 0}
	<span class="group relative inline-flex">
		<button
			type="button"
			onclick={toggle}
			aria-describedby={recapId}
			aria-label="{blockers.length} setup step{blockers.length === 1
				? ''
				: 's'} needed before this import can run"
			class="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs whitespace-nowrap text-amber-600 transition-colors hover:bg-amber-500/25 dark:text-amber-400"
		>
			<FontAwesomeIcon icon={faTriangleExclamation} class="h-3 w-3" />
			Needs setup
		</button>

		<!-- The listener only stops a click on the recap from following the row's link;
		     there is no action here for a key to take. -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
		<div
			id={recapId}
			role="tooltip"
			onclick={(e) => e.preventDefault()}
			class="{open
				? 'block'
				: 'hidden group-hover:block'} absolute top-full right-0 z-20 mt-1.5 w-72 cursor-default rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-3 text-left shadow-lg"
		>
			<p class="mb-2 text-xs font-semibold text-[var(--dash-text)]">
				Finish setup before it can run
			</p>
			<ImportTaskBlockerList {blockers} />
		</div>
	</span>
{/if}
