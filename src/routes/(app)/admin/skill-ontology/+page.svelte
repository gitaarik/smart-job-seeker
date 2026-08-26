<script lang="ts">
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck, faXmark, faRightLeft } from '@fortawesome/free-solid-svg-icons';
	import Card from '../../components/Card.svelte';
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

<div class="mx-auto max-w-4xl space-y-6 p-4">
	<div>
		<h1 class="text-2xl font-semibold">Skill ontology</h1>
		<p class="text-base-content/70 mt-1 text-sm">
			{stats.concepts} concepts · {stats.edges} approved relations · {stats.aliases} approved aliases.
			Nothing unapproved affects matching.
		</p>
	</div>

	<!-- Not decoration. The confidence floor let through two edges scoring 0.90
	     and 0.95, so the numbers below are a sort order and never a verdict. -->
	<div class="alert alert-warning text-sm">
		<span>
			These relations are shared by <strong>every profile</strong>. Approving a wrong one degrades
			matching for everyone, silently — and confidence is not accuracy: the two edges that had to be
			revoked scored 0.90 and 0.95. Read the sentence, not the number.
		</span>
	</div>

	{#if form?.error}
		<div class="alert alert-error text-sm"><span>{form.error}</span></div>
	{/if}

	<Card>
		<h2 class="mb-3 text-lg font-medium">
			Pending relations
			{#if pendingRelations.length > 0}
				<span class="badge badge-warning ml-2">{pendingRelations.length}</span>
			{/if}
		</h2>

		{#if pendingRelations.length === 0}
			<p class="text-base-content/60 text-sm">Nothing waiting.</p>
		{:else}
			<ul class="divide-base-300 divide-y">
				{#each pendingRelations as r (r.id)}
					<li class="flex items-center gap-3 py-2">
						<span class="flex-1 text-sm">
							{sentence(r.relation, r.from_label, r.to_label)}
							<span class="text-base-content/50 ml-2 text-xs">
								{r.relation}{r.confidence != null ? ` · ${r.confidence.toFixed(2)}` : ''} · {r.source}
							</span>
						</span>
						<form method="POST" action="?/approveRelation" use:enhance>
							<input type="hidden" name="id" value={r.id} />
							<button class="btn btn-xs btn-success" title="Approve">
								<FontAwesomeIcon icon={faCheck} />
							</button>
						</form>
						<!-- Inverted direction is the failure this table exists to prevent,
						     and a flip is one click from correct rather than a delete and a
						     wait for the model to propose it the other way round. -->
						<form method="POST" action="?/flipRelation" use:enhance>
							<input type="hidden" name="id" value={r.id} />
							<button class="btn btn-xs" title="Swap direction (stays unapproved)">
								<FontAwesomeIcon icon={faRightLeft} />
							</button>
						</form>
						<form method="POST" action="?/rejectRelation" use:enhance>
							<input type="hidden" name="id" value={r.id} />
							<button class="btn btn-xs btn-ghost" title="Leave rejected">
								<FontAwesomeIcon icon={faXmark} />
							</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>

	<Card>
		<h2 class="mb-3 text-lg font-medium">
			Pending aliases
			{#if pendingAliases.length > 0}
				<span class="badge badge-warning ml-2">{pendingAliases.length}</span>
			{/if}
		</h2>
		<p class="text-base-content/70 mb-3 text-sm">
			An alias makes one concept answer for another in <em>both</em> directions at once. A larger claim
			than a relation, so there is no bulk path for these.
		</p>

		{#if pendingAliases.length === 0}
			<p class="text-base-content/60 text-sm">Nothing waiting.</p>
		{:else}
			<ul class="divide-base-300 divide-y">
				{#each pendingAliases as a (a.id)}
					<li class="flex items-center gap-3 py-2">
						<span class="flex-1 text-sm">
							“{a.alias}” is another way of writing <strong>{a.label}</strong>
						</span>
						<form method="POST" action="?/approveAlias" use:enhance>
							<input type="hidden" name="id" value={a.id} />
							<button class="btn btn-xs btn-success"><FontAwesomeIcon icon={faCheck} /></button>
						</form>
						<form method="POST" action="?/rejectAlias" use:enhance>
							<input type="hidden" name="id" value={a.id} />
							<button class="btn btn-xs btn-ghost"><FontAwesomeIcon icon={faXmark} /></button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>

	<Card>
		<h2 class="mb-3 text-lg font-medium">In use ({approvedRelations.length})</h2>
		<p class="text-base-content/70 mb-3 text-sm">
			Revoking one takes effect on the next match — it does not delete the proposal.
		</p>
		<ul class="divide-base-300 max-h-96 divide-y overflow-y-auto">
			{#each approvedRelations as r (r.id)}
				<li class="flex items-center gap-3 py-1.5">
					<span class="flex-1 text-sm">{sentence(r.relation, r.from_label, r.to_label)}</span>
					<form method="POST" action="?/rejectRelation" use:enhance>
						<input type="hidden" name="id" value={r.id} />
						<button class="btn btn-xs btn-ghost" title="Revoke">
							<FontAwesomeIcon icon={faXmark} />
						</button>
					</form>
				</li>
			{/each}
			{#each approvedAliases as a (a.id)}
				<li class="flex items-center gap-3 py-1.5">
					<span class="flex-1 text-sm">“{a.alias}” = {a.label}</span>
					<form method="POST" action="?/rejectAlias" use:enhance>
						<input type="hidden" name="id" value={a.id} />
						<button class="btn btn-xs btn-ghost" title="Revoke">
							<FontAwesomeIcon icon={faXmark} />
						</button>
					</form>
				</li>
			{/each}
		</ul>
	</Card>
</div>
