<!--
	What the *scanned code* suggests for a side project's CV entry — Tier 3 of
	`planning/SEMANTIC-MATCHING-AND-RAG.md` § Repo-derived project evidence.

	Its sibling `RepoMetadataFetch` offers facts GitHub reports. This one offers
	an LLM's reading of the source, so it is shaped around what source code can
	and cannot support:

	- **Summary and technologies are proposals**, ticked or not, applied the same
	  way as any other.
	- **Achievements are questions, and are never applied.** Code proves what was
	  built and knows nothing about whether it mattered — no user counts, no load,
	  no incidents, no money. A generated "reduced latency by 40%" would be a
	  fabricated metric on a real CV. So the model asks the applicant instead, and
	  this panel deliberately gives those questions no Apply button: they are
	  prompts for the person to write their own achievement.
-->
<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCircleNotch,
		faDownload,
		faLightbulb,
		faWandMagicSparkles
	} from '@fortawesome/free-solid-svg-icons';
	import { SvelteSet } from 'svelte/reactivity';
	import { normalizeSkill } from '$lib/skills';

	interface Question {
		question: string;
		evidence: string;
	}

	let {
		projectId,
		currentSummary,
		currentTechnologies,
		onApplySummary,
		onApplyTechnologies
	}: {
		projectId: number;
		currentSummary: string;
		currentTechnologies: string[];
		onApplySummary: (summary: string) => void;
		onApplyTechnologies: (names: string[]) => void;
	} = $props();

	let loading = $state(false);
	let error = $state<string | null>(null);
	let open = $state(false);
	let summary = $state('');
	let technologies = $state<string[]>([]);
	let questions = $state<Question[]>([]);
	let scanTitle = $state<string | null>(null);
	let applied = $state(false);
	let summarySelected = $state(false);
	const selectedTech = new SvelteSet<string>();

	let selectedCount = $derived((summarySelected ? 1 : 0) + selectedTech.size);

	async function suggest() {
		loading = true;
		error = null;
		applied = false;
		open = false;
		try {
			const response = await fetch(`/api/side-project/${projectId}/repo-proposals`, {
				method: 'POST'
			});
			const body = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(body.message || body.error || `Request failed (${response.status})`);
			}
			summary = String(body.summary ?? '');
			// The server dedupes against the SAVED chips; this catches one the user
			// has just typed and not yet saved, which the server cannot see.
			const have = new Set(currentTechnologies.map(normalizeSkill).filter(Boolean));
			technologies = ((body.technologies ?? []) as string[]).filter(
				(t) => !have.has(normalizeSkill(t))
			);
			questions = (body.questions ?? []) as Question[];
			scanTitle = body.scan?.title ?? null;

			// Same rule as the metadata panel: a summary the applicant already wrote
			// is not replaced unless they say so.
			summarySelected = !!summary && !currentSummary.trim();
			selectedTech.clear();
			// These are read out of the code rather than off a tag list, so unlike a
			// GitHub topic they start ticked.
			for (const tech of technologies) selectedTech.add(tech);
			open = true;
		} catch (err) {
			error = (err as Error).message;
		} finally {
			loading = false;
		}
	}

	function toggleTech(name: string) {
		if (selectedTech.has(name)) selectedTech.delete(name);
		else selectedTech.add(name);
	}

	function apply() {
		if (summarySelected && summary) onApplySummary(summary);
		const names = technologies.filter((name) => selectedTech.has(name));
		if (names.length > 0) onApplyTechnologies(names);
		open = false;
		applied = true;
	}
</script>

<div class="mt-3">
	<div class="flex flex-wrap items-center gap-3">
		<button
			type="button"
			onclick={suggest}
			disabled={loading}
			class="inline-flex items-center gap-2 rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm font-medium text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)] disabled:cursor-not-allowed disabled:opacity-50"
		>
			<FontAwesomeIcon
				icon={loading ? faCircleNotch : faWandMagicSparkles}
				class="h-4 w-4 {loading ? 'animate-spin' : ''}"
			/>
			{loading ? 'Reading the code…' : 'Suggest from scanned code'}
		</button>
		<span class="text-sm text-[var(--dash-text-secondary)]">
			Reads the scanned repository — scan it first, below.
		</span>
	</div>

	{#if error}
		<p class="mt-3 text-sm text-red-500">{error}</p>
	{/if}

	{#if applied}
		<p class="mt-3 text-sm text-[var(--dash-text-secondary)]">
			Applied — the fields above save automatically.
		</p>
	{/if}

	{#if open}
		<div class="mt-3 rounded-md border border-[var(--dash-border)] p-3">
			{#if scanTitle}
				<p class="mb-2 text-sm text-[var(--dash-text-secondary)]">
					From the scan of <span class="font-medium text-[var(--dash-text)]">{scanTitle}</span>.
				</p>
			{/if}

			{#if summary}
				<label class="flex cursor-pointer items-start gap-3 text-sm">
					<input
						type="checkbox"
						bind:checked={summarySelected}
						class="mt-1 h-4 w-4 shrink-0 accent-[var(--dash-primary)]"
					/>
					<span class="min-w-0">
						<span class="font-medium text-[var(--dash-text)]">Summary:</span>
						<span class="text-[var(--dash-text)]">{summary}</span>
						{#if currentSummary.trim()}
							<span class="mt-0.5 block text-xs text-amber-500">
								Replaces what you have written.
							</span>
						{/if}
					</span>
				</label>
			{/if}

			{#if technologies.length > 0}
				<p class="mt-3 mb-2 text-sm font-medium text-[var(--dash-text)]">
					Technologies found in the code
				</p>
				<div class="flex flex-wrap gap-2">
					{#each technologies as tech (tech)}
						<label
							class="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--dash-border)] px-3 py-1 text-sm"
						>
							<input
								type="checkbox"
								checked={selectedTech.has(tech)}
								onchange={() => toggleTech(tech)}
								class="h-3.5 w-3.5 accent-[var(--dash-primary)]"
							/>
							<span class="text-[var(--dash-text)]">{tech}</span>
						</label>
					{/each}
				</div>
			{/if}

			{#if questions.length > 0}
				<div class="mt-4 rounded-md bg-[var(--dash-bg)] p-3">
					<p class="flex items-center gap-2 text-sm font-medium text-[var(--dash-text)]">
						<FontAwesomeIcon icon={faLightbulb} class="h-4 w-4 text-amber-500" />
						Worth writing an achievement about
					</p>
					<p class="mt-1 text-xs text-[var(--dash-text-secondary)]">
						The code shows what you built; only you know what it was worth. These aren't applied —
						answer one in your own words in the Achievements section.
					</p>
					<ul class="mt-2 space-y-2">
						{#each questions as q (q.question)}
							<li class="text-sm">
								<span class="text-[var(--dash-text)]">{q.question}</span>
								{#if q.evidence}
									<span class="mt-0.5 block text-xs text-[var(--dash-text-secondary)]">
										Seen in: {q.evidence}
									</span>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<div class="mt-3 flex items-center gap-3">
				<button
					type="button"
					onclick={apply}
					disabled={selectedCount === 0}
					class="inline-flex items-center gap-2 rounded-md bg-[var(--dash-primary)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<FontAwesomeIcon icon={faDownload} class="h-4 w-4" />
					Apply {selectedCount} change{selectedCount === 1 ? '' : 's'}
				</button>
				<button
					type="button"
					onclick={() => (open = false)}
					class="text-sm text-[var(--dash-text-secondary)] hover:underline"
				>
					Close
				</button>
			</div>
		</div>
	{/if}
</div>
