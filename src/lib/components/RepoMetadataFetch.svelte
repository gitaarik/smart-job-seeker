<!--
	Fetch deterministic metadata for a side project's GitHub repository and offer
	it as a reviewable proposal list.

	Tier 1 of `planning/SEMANTIC-MATCHING-AND-RAG.md` § Repo-derived project
	evidence. Nothing here is inferred — every value is a fact GitHub reports, so
	the review step exists to protect the user's *own* wording, not to catch
	hallucinations.

	Two deliberate behaviours:

	- **A field the user already filled in starts unchecked.** Pre-checking it
	  would make "fetch" quietly overwrite hand-written text, which is the one
	  thing a button like this must never do by surprise.
	- **The current value is shown next to the proposed one** whenever they
	  differ, so an overwrite is always a visible choice.
-->
<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { faCircleNotch, faDownload } from '@fortawesome/free-solid-svg-icons';
	import { SvelteSet } from 'svelte/reactivity';

	type Field = 'name' | 'url' | 'summary' | 'stars' | 'start_date' | 'end_date';

	interface Proposal {
		field: Field;
		label: string;
		value: string;
		note: string;
	}

	let {
		projectId,
		repoUrl,
		current,
		onApply
	}: {
		projectId: number;
		repoUrl: string;
		/** Live form values, so "would this overwrite something?" reflects what the
		 *  user sees rather than what was last saved. */
		current: Record<Field, string>;
		onApply: (values: Partial<Record<Field, string>>) => void;
	} = $props();

	let loading = $state(false);
	let error = $state<string | null>(null);
	let proposals = $state<Proposal[] | null>(null);
	// SvelteSet, not a plain Set: the checkboxes render from it, so mutation has
	// to be reactive.
	const selected = new SvelteSet<Field>();
	let repoLabel = $state<string | null>(null);
	let applied = $state(false);

	let canFetch = $derived(repoUrl.trim().length > 0 && !loading);

	async function fetchMetadata() {
		loading = true;
		error = null;
		applied = false;
		proposals = null;
		try {
			const response = await fetch(`/api/side-project/${projectId}/repo-metadata`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ repo_url: repoUrl })
			});
			const body = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(body.message || body.error || `Request failed (${response.status})`);
			}
			proposals = body.proposals as Proposal[];
			repoLabel = `${body.repo.owner}/${body.repo.repo}`;
			// Only what is empty today; everything else is an explicit choice.
			selected.clear();
			for (const proposal of proposals) {
				if (!current[proposal.field]?.trim()) selected.add(proposal.field);
			}
			if (proposals.length === 0) error = 'GitHub had nothing to fill in for this repository.';
		} catch (err) {
			error = (err as Error).message;
		} finally {
			loading = false;
		}
	}

	function toggle(field: Field) {
		if (selected.has(field)) selected.delete(field);
		else selected.add(field);
	}

	function apply() {
		if (!proposals) return;
		const values: Partial<Record<Field, string>> = {};
		for (const proposal of proposals) {
			if (selected.has(proposal.field)) values[proposal.field] = proposal.value;
		}
		onApply(values);
		proposals = null;
		applied = true;
	}

	function overwrites(proposal: Proposal): string | null {
		const existing = current[proposal.field]?.trim();
		if (!existing || existing === proposal.value) return null;
		return existing;
	}
</script>

<div class="mt-4 border-t border-[var(--dash-border)] pt-4">
	<div class="flex flex-wrap items-center gap-3">
		<button
			type="button"
			onclick={fetchMetadata}
			disabled={!canFetch}
			class="inline-flex items-center gap-2 rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm font-medium text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)] disabled:cursor-not-allowed disabled:opacity-50"
		>
			<FontAwesomeIcon
				icon={loading ? faCircleNotch : faGithub}
				class="h-4 w-4 {loading ? 'animate-spin' : ''}"
			/>
			{loading ? 'Fetching…' : 'Fetch from GitHub'}
		</button>
		<span class="text-sm text-[var(--dash-text-secondary)]">
			{#if !repoUrl.trim()}
				Add a repo URL to fill these fields from GitHub.
			{:else}
				Fills stars, dates and description from the public repository.
			{/if}
		</span>
	</div>

	{#if error}
		<p class="mt-3 text-sm text-red-500">{error}</p>
	{/if}

	{#if applied}
		<p class="mt-3 text-sm text-[var(--dash-text-secondary)]">
			Applied — the fields below save automatically.
		</p>
	{/if}

	{#if proposals && proposals.length > 0}
		<div class="mt-3 rounded-md border border-[var(--dash-border)] p-3">
			<p class="mb-2 text-sm text-[var(--dash-text-secondary)]">
				From <span class="font-medium text-[var(--dash-text)]">{repoLabel}</span>. Fields you have
				already filled in start unchecked.
			</p>
			<ul class="space-y-2">
				{#each proposals as proposal (proposal.field)}
					{@const existing = overwrites(proposal)}
					<li>
						<label class="flex cursor-pointer items-start gap-3 text-sm">
							<input
								type="checkbox"
								checked={selected.has(proposal.field)}
								onchange={() => toggle(proposal.field)}
								class="mt-1 h-4 w-4 shrink-0 accent-[var(--dash-primary)]"
							/>
							<span class="min-w-0">
								<span class="font-medium text-[var(--dash-text)]">{proposal.label}:</span>
								<span class="break-words text-[var(--dash-text)]">{proposal.value}</span>
								<span class="text-[var(--dash-text-secondary)]">— {proposal.note}</span>
								{#if existing}
									<span class="mt-0.5 block text-xs text-amber-500">
										Replaces: {existing}
									</span>
								{/if}
							</span>
						</label>
					</li>
				{/each}
			</ul>
			<div class="mt-3 flex items-center gap-3">
				<button
					type="button"
					onclick={apply}
					disabled={selected.size === 0}
					class="inline-flex items-center gap-2 rounded-md bg-[var(--dash-primary)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<FontAwesomeIcon icon={faDownload} class="h-4 w-4" />
					Apply {selected.size} field{selected.size === 1 ? '' : 's'}
				</button>
				<button
					type="button"
					onclick={() => (proposals = null)}
					class="text-sm text-[var(--dash-text-secondary)] hover:underline"
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}
</div>
