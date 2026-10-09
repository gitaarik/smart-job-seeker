<script lang="ts">
	/**
	 * The Resume / CV / Site switches: which base templates one profile item
	 * appears on.
	 *
	 * Shared by the skill editor and a role's technology chips, so the two ask
	 * the same question in the same words. A switch reports the flip and the
	 * caller writes it, through `setShownOn`, because only the caller knows
	 * whether that write is a PATCH now or part of a create later.
	 *
	 * Matching always uses every item whatever these say; they only decide what
	 * it is shown on.
	 */
	import AutoSaveIndicator from './AutoSaveIndicator.svelte';
	import type { SaveStatus } from './auto-save.svelte';
	import { BASE_TEMPLATES, shownOnTemplate, shownTemplates } from '$lib/profile-visibility';

	interface Props {
		/** The item's tags as stored, version tags and all. */
		tags: string[] | null | undefined;
		ontoggle: (template: string, shown: boolean) => void;
		/**
		 * The save behind the switches, when they write on their own. Given, the
		 * switches carry its status pill and say they do not wait for a Save.
		 */
		field?: SaveStatus;
	}

	let { tags, ontoggle, field }: Props = $props();
</script>

<div>
	<span class="text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase"> Show on </span>
	{#each BASE_TEMPLATES as template (template.tag)}
		{@const shown = shownOnTemplate(tags, template.tag)}
		<button
			type="button"
			onclick={() => ontoggle(template.tag, !shown)}
			aria-pressed={shown}
			class="mt-1 flex w-full items-center justify-between gap-2 text-left"
		>
			<span class="text-xs text-[var(--dash-text)]">{template.label}</span>
			<span
				class="
          relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors {shown
					? 'bg-emerald-500'
					: 'bg-[var(--dash-border)]'}
        "
			>
				<span
					class="
            absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all {shown
						? 'left-3.5'
						: 'left-0.5'}
          "
				></span>
			</span>
		</button>
	{/each}
	{#if field}
		<!--
			Its own line, not squeezed beside the label: an editor popup is a fixed
			256px and the indicator does not wrap, so an error long enough to matter
			would hang off the edge of it. The reserved height keeps the switches
			from jumping as the pill comes and goes.
		-->
		<div class="mt-1 min-h-[1rem]">
			<AutoSaveIndicator {field} />
		</div>
	{/if}
	<!--
		Says out loud that these three do not wait for Save, because in the skill
		editor the Save button is still on screen below them and governs everything
		else there. The indicator is silent at rest by design, and silence next to
		a Save button reads as "this needs it".
	-->
	<p class="mt-1 text-[10px] leading-snug text-[var(--dash-text-muted)]">
		{#if shownTemplates(tags).length === 0}
			Nowhere: counts for job matching and appears on nothing you send or publish.
		{:else}
			Counts for job matching either way.
		{/if}
		{#if field}
			Saved as you switch.
		{/if}
	</p>
</div>
