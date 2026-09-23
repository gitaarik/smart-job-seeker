<script lang="ts">
	/**
	 * Why this turn could propose what it did. Staff only.
	 *
	 * The write-side counterpart of RetrievalSources, and it exists for the same
	 * reason: the decision is per turn, it is not obvious, and until the record
	 * existed it left no trace. Three tiers compete for a 22k block and
	 * `fitMatchedCapabilities` admits groups while they fit, so "it didn't offer
	 * to fix my skill" has three answers that look identical from outside — the
	 * matcher never found the section, it found it and nothing authorized, or it
	 * found it and the budget was already full.
	 *
	 * There is no applicant-facing half here, unlike retrieval. What the
	 * assistant can change this turn is already said in its own reply and shown
	 * in the proposal cards; this is about the machinery behind that, which is
	 * ours to debug and nobody else's to read.
	 *
	 * The prop is absent for non-staff because the server omits it, so this
	 * component is never the thing standing between a user and the data.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faChevronDown, faChevronUp, faWrench } from '@fortawesome/free-solid-svg-icons';
	import type { CapabilityRecord } from '$lib/server/ai-chat/capability-record';

	let { record = null }: { record?: CapabilityRecord | null } = $props();

	let expanded = $state(false);

	let admitted = $derived((record?.entries ?? []).filter((e) => e.admitted));
	let dropped = $derived((record?.entries ?? []).filter((e) => !e.admitted));

	// A turn that resolved nothing at all is the ordinary case on most pages and
	// says nothing worth a line. A turn that resolved something — admitted or
	// dropped — is the one worth being able to open.
	let show = $derived(!!record && record.entries.length > 0);

	const TIER_LABELS: Record<string, string> = {
		subject: "the page's own",
		always: 'every page',
		child: 'child collection',
		matched: 'matched from the message'
	};
</script>

{#if show && record}
	<div class="mt-1 text-[11px] text-[var(--dash-text-muted)]">
		<button
			type="button"
			onclick={() => (expanded = !expanded)}
			class="flex items-center gap-1.5 transition-colors hover:text-[var(--dash-text-secondary)]"
		>
			<FontAwesomeIcon icon={faWrench} class="h-2.5 w-2.5 flex-shrink-0" />
			<span>
				{admitted.length} capabilit{admitted.length === 1 ? 'y' : 'ies'} live
				{#if dropped.length > 0}
					<span class="text-[var(--dash-error)]">
						· {dropped.length} dropped for budget
					</span>
				{/if}
			</span>
			<FontAwesomeIcon
				icon={expanded ? faChevronUp : faChevronDown}
				class="h-2.5 w-2.5 flex-shrink-0"
			/>
		</button>

		{#if expanded}
			<ul class="mt-1 ml-4 space-y-0.5 font-mono">
				{#each record.entries as entry, i (i)}
					<li class={entry.admitted ? '' : 'text-[var(--dash-error)]'}>
						{entry.admitted ? '✓' : '✗'}
						{entry.capability} · {TIER_LABELS[entry.tier] ?? entry.tier} · {entry.targets}
						{entry.targets === 1 ? 'row' : 'rows'}
					</li>
				{/each}
			</ul>
			<p class="mt-1 ml-4 font-mono">
				block {record.chars} / {record.budgetChars} chars
			</p>
		{/if}
	</div>
{/if}
