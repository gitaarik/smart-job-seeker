<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form: { error?: string } | null } = $props();

	let relations = $derived(data.relations);
	let aliases = $derived(data.aliases);
	let stats = $derived(data.stats);

	let pendingRelations = $derived(relations.filter((r) => !r.approved));
	let approvedRelations = $derived(relations.filter((r) => r.approved));
	let pendingAliases = $derived(aliases.filter((a) => !a.approved));
	let approvedAliases = $derived(aliases.filter((a) => a.approved));

	/**
	 * Rendered as a sentence, not as a row of columns.
	 *
	 * The judgement being asked for is "is this claim true", and a claim reads
	 * as a claim. `React | broader | JavaScript` invites scanning; "React is a
	 * kind of JavaScript" invites deciding — and direction, which is the thing
	 * most often wrong, is only legible in prose.
	 */
	function sentence(relation: string, from: string, to: string): string {
		if (relation === 'broader') return `${from} is a kind of ${to}`;
		if (relation === 'requires') return `${from} cannot be used without ${to}`;
		return `${from} — ${relation} — ${to}`;
	}
</script>

<svelte:head><title>Skill ontology · Admin</title></svelte:head>

{#snippet action(act: string, id: number, label: string, kind: 'yes' | 'no' | 'flip')}
	<form method="POST" action={act} use:enhance>
		<input type="hidden" name="id" value={id} />
		<button
			class="rounded-md border px-2 py-1 text-xs whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-[var(--dash-primary)] focus-visible:outline-none
				{kind === 'yes'
				? 'border-[var(--dash-success)] text-[var(--dash-success)] hover:bg-[var(--dash-success-bg)]'
				: 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-hover)]'}"
		>
			{label}
		</button>
	</form>
{/snippet}

<div class="space-y-4">
	<div class="flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold text-[var(--dash-text)]">Skill ontology</h1>
			<p class="mt-1 text-sm text-[var(--dash-text-secondary)]">
				{stats.concepts} concepts · {stats.edges} approved relations · {stats.aliases} approved aliases.
				Nothing unapproved affects matching.
			</p>
		</div>
		<a
			href="/admin/skill-ontology/graph"
			class="shrink-0 rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg-hover)]"
		>
			View graph
		</a>
	</div>

	<!-- Not decoration. The confidence floor let through two edges scoring 0.90
	     and 0.95, so the numbers below are a sort order and never a verdict. -->
	<div
		class="rounded-lg border border-[var(--dash-warning-border)] bg-[var(--dash-warning-bg)] px-4 py-3 text-sm text-[var(--dash-text)]"
	>
		These relations are shared by <strong>every profile</strong> — approving a wrong one degrades matching
		for everyone, silently. And confidence is not accuracy: the two edges that had to be revoked scored
		0.90 and 0.95. Read the sentence, not the number.
	</div>

	{#if form?.error}
		<div
			class="rounded-lg border border-[var(--dash-error)] px-4 py-3 text-sm text-[var(--dash-error)]"
		>
			{form.error}
		</div>
	{/if}

	<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)]">
		<h2
			class="border-b border-[var(--dash-border)] px-4 py-2.5 text-sm font-medium text-[var(--dash-text)]"
		>
			Pending relations
			{#if pendingRelations.length > 0}
				<span
					class="ml-2 rounded-full bg-[var(--dash-bg-inset)] px-2 py-0.5 text-xs font-normal text-[var(--dash-text-secondary)]"
					>{pendingRelations.length}</span
				>
			{/if}
		</h2>
		{#if pendingRelations.length === 0}
			<p class="px-4 py-4 text-sm text-[var(--dash-text-muted)]">Nothing waiting.</p>
		{:else}
			<ul>
				{#each pendingRelations as r (r.id)}
					<li
						class="flex items-center gap-2 border-b border-[var(--dash-border)] px-4 py-2 last:border-0"
					>
						<span class="flex-1 text-sm text-[var(--dash-text)]">
							{sentence(r.relation, r.from_label, r.to_label)}
							<span class="ml-2 text-xs text-[var(--dash-text-muted)]">
								{r.relation}{r.confidence != null ? ` · ${r.confidence.toFixed(2)}` : ''}
							</span>
						</span>
						{@render action('?/approveRelation', r.id, 'Approve', 'yes')}
						{@render action('?/flipRelation', r.id, 'Flip', 'flip')}
						{@render action('?/rejectRelation', r.id, 'Reject', 'no')}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)]">
		<h2
			class="border-b border-[var(--dash-border)] px-4 py-2.5 text-sm font-medium text-[var(--dash-text)]"
		>
			Pending aliases
			{#if pendingAliases.length > 0}
				<span
					class="ml-2 rounded-full bg-[var(--dash-bg-inset)] px-2 py-0.5 text-xs font-normal text-[var(--dash-text-secondary)]"
					>{pendingAliases.length}</span
				>
			{/if}
		</h2>
		<p class="px-4 pt-3 text-xs text-[var(--dash-text-secondary)]">
			An alias makes one concept answer for another in <em>both</em> directions at once — a larger claim
			than a relation, so there is no bulk path for these.
		</p>
		{#if pendingAliases.length === 0}
			<p class="px-4 py-4 text-sm text-[var(--dash-text-muted)]">Nothing waiting.</p>
		{:else}
			<ul class="mt-2">
				{#each pendingAliases as a (a.id)}
					<li
						class="flex items-center gap-2 border-b border-[var(--dash-border)] px-4 py-2 last:border-0"
					>
						<span class="flex-1 text-sm text-[var(--dash-text)]">
							“{a.alias}” is another way of writing <strong>{a.label}</strong>
						</span>
						{@render action('?/approveAlias', a.id, 'Approve', 'yes')}
						{@render action('?/rejectAlias', a.id, 'Reject', 'no')}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)]">
		<h2
			class="border-b border-[var(--dash-border)] px-4 py-2.5 text-sm font-medium text-[var(--dash-text)]"
		>
			In use ({approvedRelations.length + approvedAliases.length})
		</h2>
		<p class="px-4 pt-3 text-xs text-[var(--dash-text-secondary)]">
			Revoking takes effect on the next match. It does not delete the proposal — a deleted one comes
			straight back on the next pipeline run.
		</p>
		<ul class="mt-2 max-h-96 overflow-y-auto">
			{#each approvedRelations as r (r.id)}
				<li
					class="flex items-center gap-2 border-b border-[var(--dash-border)] px-4 py-1.5 last:border-0"
				>
					<span class="flex-1 text-sm text-[var(--dash-text)]"
						>{sentence(r.relation, r.from_label, r.to_label)}</span
					>
					{@render action('?/rejectRelation', r.id, 'Revoke', 'no')}
				</li>
			{/each}
			{#each approvedAliases as a (a.id)}
				<li
					class="flex items-center gap-2 border-b border-[var(--dash-border)] px-4 py-1.5 last:border-0"
				>
					<span class="flex-1 text-sm text-[var(--dash-text)]">“{a.alias}” = {a.label}</span>
					{@render action('?/rejectAlias', a.id, 'Revoke', 'no')}
				</li>
			{/each}
		</ul>
	</div>
</div>
