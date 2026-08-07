<script lang="ts">
	import type { FieldDiff } from '$lib/resume-diff';

	interface Props {
		diff: FieldDiff;
		showUnchanged?: boolean;
	}

	let { diff = $bindable(), showUnchanged = false }: Props = $props();
</script>

{#if diff.changed || showUnchanged}
	<div
		class="flex items-start gap-3 rounded-md px-3 py-2 {diff.changed ? 'bg-[var(--dash-bg)]' : ''}"
	>
		{#if diff.changed}
			<label class="mt-0.5 flex-shrink-0">
				<input
					type="checkbox"
					bind:checked={diff.enabled}
					class="rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
				/>
			</label>
		{:else}
			<div class="w-4 flex-shrink-0"></div>
		{/if}

		<div class="min-w-0 flex-1">
			<div class="mb-0.5 text-xs font-medium text-[var(--dash-text-secondary)]">
				{diff.label}
			</div>
			{#if diff.changed}
				<div class="space-y-0.5">
					{#if diff.current}
						<div class="text-sm break-words text-[var(--dash-text-muted)] line-through">
							{diff.current}
						</div>
					{/if}
					{#if diff.incoming}
						<div class="text-sm break-words text-[var(--dash-text)]">
							{diff.incoming}
						</div>
					{:else}
						<div class="text-sm text-[var(--dash-text-muted)] italic">(removed)</div>
					{/if}
				</div>
			{:else}
				<div class="text-sm text-[var(--dash-text-muted)]">
					{diff.current || '—'}
				</div>
			{/if}
		</div>
	</div>
{/if}
