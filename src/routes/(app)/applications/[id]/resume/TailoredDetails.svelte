<script lang="ts">
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowUp,
		faCheck,
		faEye,
		faEyeSlash,
		faRotateLeft
	} from '@fortawesome/free-solid-svg-icons';
	import type { DocType } from '$lib/utils/profile-doc-url';
	import { overrideEntityLabel, OVERRIDE_ENTITIES } from '$lib/version-overrides';
	import type { Decision, LastRun } from './types';

	/**
	 * How the tailored version came to look the way it does — every decision,
	 * with the reason that produced it.
	 *
	 * The "Changes" view of the page's contents section, beside "Everything". The
	 * two answer different questions about the same document: what is on it, and
	 * what tailoring (or the applicant) changed against the version it builds on.
	 *
	 * A tailored version is a SELECTION over what the applicant already wrote —
	 * it can hide a bullet, surface a held-back skill and reorder within a role,
	 * but it never writes a word. That is what makes this list possible: each
	 * decision is auditable in one line, against text the applicant recognises.
	 *
	 * The host page must expose `rejectDecision` and `keepDecision`.
	 */
	let {
		tailored,
		decisions,
		gaps,
		docType,
		baseName,
		lastRun = null
	}: {
		/** Only where it was built from: the plain document ignores every version tag. */
		tailored: { baseSlug?: string | null };
		decisions: Decision[];
		/** What the match found missing — what a selection cannot fix. */
		gaps: string[];
		docType: DocType;
		/** The library version this one builds on, by name; empty for the plain document. */
		baseName: string;
		/**
		 * The run that just finished, when one did. Shown only here, at the moment
		 * it can still be acted on: the decisions are stored and read the same
		 * either way, and a page count is about a file that may since have changed.
		 */
		lastRun?: LastRun | null;
	} = $props();

	let working = $state(false);

	/**
	 * The applicant's own "leave it the way it was" decisions. Recorded so a
	 * regeneration can't redo what they took back, but listing them as changes
	 * would say the document gained or lost something it didn't.
	 */
	let kept = $derived(decisions.filter((d) => d.keptAsBase));
	let changes = $derived(decisions.filter((d) => !d.keptAsBase));

	// A skill is only ever surfaced, never promoted: it carries a sort so it
	// lands beside its relatives rather than at the end of its category, and
	// that placement is part of showing it, not a second claim that the document
	// changed order. Reading the sort alone would file it under "Moved up",
	// where it would be the only row whose item wasn't there before.
	let isSkill = (d: Decision) => d.entityType === OVERRIDE_ENTITIES.skill;
	let included = $derived(
		changes.filter((d) => d.action === 'include' && (d.sort === null || isSkill(d)))
	);
	let excluded = $derived(changes.filter((d) => d.action === 'exclude'));
	let reordered = $derived(changes.filter((d) => d.sort !== null && !isSkill(d)));

	let docLabel = $derived(docType === 'cv' ? 'CV' : 'resume');

	function track() {
		working = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			working = false;
		};
	}

	const clip = (s: string, n = 90) => (s.length > n ? s.slice(0, n).trimEnd() + '…' : s);
</script>

<div>
	<!-- Name the base. "Against the version it builds on" was true and useless:
	     a version built on the plain document shows none of the applicant's
	     version tags — four side projects vanished here — and nothing on the
	     page said which document the diff was a diff against. -->
	<p class="text-xs text-[var(--dash-text-secondary)]">
		{changes.length}
		{changes.length === 1 ? 'change' : 'changes'} against
		{#if baseName}<strong class="font-medium text-[var(--dash-text)]">{baseName}</strong>{:else}your
			plain {docLabel}{/if}.
	</p>

	{#if lastRun && (lastRun.ranker === 'lexical' || lastRun.pages)}
		<!-- What the run that just finished did with the page, and whether it had
		     to rank blind. The embedding service being unreachable happened once
		     in thirteen runs and produced a visibly worse document with nothing
		     anywhere to say why; the page count is the answer to the question the
		     fit loop exists for, and it is worth saying it reached it. -->
		<div
			class="mt-3 rounded-lg border p-3 {lastRun.ranker === 'lexical'
				? 'border-amber-500/30 bg-amber-500/5'
				: 'border-[var(--dash-border)] bg-[var(--dash-bg)]'}"
		>
			{#if lastRun.ranker === 'lexical'}
				<p class="text-xs text-[var(--dash-text)]">
					This run ranked by word overlap — the embedding service didn't answer. The result is
					weaker than usual; regenerating will try again.
				</p>
			{/if}
			{#if lastRun.pages}
				<p
					class="text-xs text-[var(--dash-text-secondary)] {lastRun.ranker === 'lexical'
						? 'mt-1'
						: ''}"
				>
					Renders to {lastRun.pages}
					{lastRun.pages === 1 ? 'page' : 'pages'}{lastRun.pages > lastRun.targetPages
						? ` — one page would have meant dropping too much, so it kept ${lastRun.pages}`
						: ''}.
				</p>
			{/if}
		</div>
	{/if}

	{#if !tailored.baseSlug}
		<!-- Not a warning about taste: the plain document ignores every version
		     tag, so this one is missing whatever the applicant put on a version,
		     and it is not the document a public profile serves either.
		     Regenerating from a real version fixes it. -->
		<div class="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
			<p class="text-xs text-[var(--dash-text)]">
				This was built on your plain {docLabel}, so none of your version tags apply — anything you
				put on a specific version won't print here.
			</p>
			<p class="mt-1 text-[10px] text-[var(--dash-text-secondary)]">
				Pick a version under “Built on” below and regenerate.
			</p>
		</div>
	{/if}

	{#if changes.length === 0 && kept.length === 0}
		<p class="mt-3 text-xs text-[var(--dash-text-secondary)]">
			Nothing to change — the version this builds on already reads well for this job.
		</p>
	{/if}

	<!-- Every decision, with the reason that produced it. A resume you can't
	     audit is one you can't defend in the room it gets read in. -->
	<!-- What the document WILL show first — surfaced skills, then promoted
	     bullets — and what it won't, last. Two thoughts, not three, and it keeps
	     the short groups above the long one: hidden is routinely ten rows, which
	     buried the promotions under a wall of amber. Position is not what draws
	     the eye to the removals; their colour is. -->
	{#each [{ rows: included, icon: faEye, tone: 'text-[var(--dash-success)]', head: 'Now showing' }, { rows: reordered, icon: faArrowUp, tone: 'text-[var(--dash-primary)]', head: 'Moved up' }, { rows: excluded, icon: faEyeSlash, tone: 'text-amber-600', head: 'Hidden for this job' }] as group (group.head)}
		{#if group.rows.length > 0}
			<div class="mt-4">
				<p class="mb-2 text-[10px] font-semibold tracking-wide text-[var(--dash-text)] uppercase">
					{group.head}
				</p>
				<ul class="space-y-2">
					{#each group.rows as row (row.id)}
						<li
							class="flex items-start gap-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] p-2"
						>
							<FontAwesomeIcon icon={group.icon} class="mt-1 h-3 w-3 shrink-0 {group.tone}" />
							<div class="min-w-0 flex-1">
								<!-- What KIND of thing this is, before its text. A bullet, a side
								     project and a skill all rendered as one line of prose here, and
								     an achievement out of a role reads like a sentence about nothing
								     in particular until you know it is one — so the type leads, and
								     a bullet names its role. -->
								<p class="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] leading-none">
									<span
										class="rounded border border-[var(--dash-border)] px-1 py-0.5 font-medium tracking-wide text-[var(--dash-text-secondary)] uppercase"
									>
										{overrideEntityLabel(row.entityType)}
									</span>
									{#if row.context}
										<span class="truncate text-[var(--dash-text-secondary)]">{row.context}</span>
									{/if}
								</p>
								<p class="text-xs text-[var(--dash-text)]">{clip(row.label)}</p>
								{#if row.reason}
									<p class="mt-0.5 text-[10px] text-[var(--dash-text-secondary)]">{row.reason}</p>
								{/if}
							</div>
							<div class="flex shrink-0 items-center gap-1">
								{#if row.source === 'user'}
									<span
										title="Kept through regenerations"
										class="text-[10px] text-[var(--dash-success)]"
									>
										<FontAwesomeIcon icon={faCheck} class="h-2.5 w-2.5" /> yours
									</span>
								{:else}
									<form method="POST" action="?/keepDecision" use:enhance={track}>
										<input type="hidden" name="decision_id" value={row.id} />
										<button
											type="submit"
											disabled={working}
											title="Keep this through future regenerations"
											class="rounded px-1.5 py-1 text-[10px] text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-success)] disabled:opacity-70"
										>
											Keep
										</button>
									</form>
								{/if}
								<form method="POST" action="?/rejectDecision" use:enhance={track}>
									<input type="hidden" name="decision_id" value={row.id} />
									<!-- Taking back one of tailoring's changes is recorded as yours, so
									     regenerating doesn't make it again. Taking back your own just
									     removes it. -->
									<button
										type="submit"
										disabled={working}
										title={row.source === 'user'
											? 'Undo your change'
											: "Undo this change. Regenerating won't make it again."}
										class="rounded px-1.5 py-1 text-[10px] text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-error)] disabled:opacity-70"
									>
										Undo
									</button>
								</form>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/each}

	{#if kept.length > 0}
		<!-- Quiet on purpose: none of these changes the document. They are listed
		     because they are still decisions, and handing one back to tailoring is
		     a real choice the applicant may want. -->
		<div class="mt-4">
			<p class="mb-1 text-[10px] font-semibold tracking-wide text-[var(--dash-text)] uppercase">
				Put back the way it was
			</p>
			<p class="mb-2 text-[10px] text-[var(--dash-text-secondary)]">
				These match {baseName || `your plain ${docLabel}`}. They're kept as your choice, so
				regenerating leaves them alone.
			</p>
			<ul class="space-y-1">
				{#each kept as row (row.id)}
					<li class="flex items-center gap-2 text-[11px] text-[var(--dash-text-secondary)]">
						<span
							class="shrink-0 rounded border border-[var(--dash-border)] px-1 py-0.5 text-[10px] leading-none tracking-wide uppercase"
						>
							{overrideEntityLabel(row.entityType)}
						</span>
						<span class="min-w-0 flex-1 truncate">
							{clip(row.label, 80)}{row.context ? ` · ${row.context}` : ''}
						</span>
						<form method="POST" action="?/rejectDecision" use:enhance={track} class="shrink-0">
							<input type="hidden" name="decision_id" value={row.id} />
							<button
								type="submit"
								disabled={working}
								title="Let tailoring decide about this again"
								class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors hover:text-[var(--dash-primary)] disabled:opacity-70"
							>
								<FontAwesomeIcon icon={faRotateLeft} class="h-2.5 w-2.5" />
								Let tailoring decide
							</button>
						</form>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- What no amount of reshuffling closes. Shown here so a tidier document
	     doesn't read as a stronger application. -->
	{#if gaps.length > 0}
		<div class="mt-4 rounded-lg border border-[var(--dash-border)] p-3">
			<p class="text-[10px] font-semibold tracking-wide text-[var(--dash-text)] uppercase">
				Choosing what to show can't fix
			</p>
			<ul class="mt-1 list-inside list-disc text-[10px] text-[var(--dash-text-secondary)]">
				{#each gaps as gap (gap)}
					<li>{gap}</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
