<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
	import type { ImportTaskBlocker } from '$lib/import-tasks/readiness';

	let { blockers, showDetail = true }: { blockers: ImportTaskBlocker[]; showDetail?: boolean } =
		$props();
</script>

<ul class="space-y-2">
	{#each blockers as blocker (blocker.key)}
		<li class="flex items-start gap-2">
			<FontAwesomeIcon
				icon={faExclamationTriangle}
				class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500"
			/>
			<div class="min-w-0">
				<p class="text-sm font-medium text-[var(--dash-text)]">
					{blocker.title}
				</p>
				{#if showDetail}
					<p class="text-xs text-[var(--dash-text-secondary)]">
						{blocker.detail}
					</p>
				{/if}
			</div>
		</li>
	{/each}
</ul>
