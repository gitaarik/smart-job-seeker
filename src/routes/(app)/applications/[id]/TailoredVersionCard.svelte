<script lang="ts">
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowUp,
		faBoxArchive,
		faCheck,
		faCircleNotch,
		faExternalLinkAlt,
		faEye,
		faEyeSlash,
		faFilePdf,
		faRotate,
		faTrash,
		faWandMagicSparkles
	} from '@fortawesome/free-solid-svg-icons';
	import Card from '../../components/Card.svelte';
	import { profileDocUrl, type DocType } from '$lib/utils/profile-doc-url';

	/**
	 * The version tailored to this job, and every decision that shaped it.
	 *
	 * A tailored version is a SELECTION over what the applicant already wrote —
	 * it can hide a bullet, surface a held-back skill and reorder within a role,
	 * but it never writes a word. That is what makes this panel possible: each
	 * decision is auditable in one line, against text the applicant recognises.
	 *
	 * The host page must expose `tailorVersion`, `rejectDecision`, `keepDecision`
	 * and `discardTailored` actions.
	 */
	interface Decision {
		id: number;
		entityType: string;
		entityId: number;
		action: string;
		reason: string | null;
		sort: number | null;
		source: string;
		label: string;
	}

	let {
		tailored,
		decisions,
		gaps,
		versions,
		docType,
		suggestedBaseSlug,
		profileSlug,
		hasJob
	}: {
		tailored: { id: number; slug: string; name: string; baseSlug?: string | null } | null;
		decisions: Decision[];
		/** What the match found missing — what a selection cannot fix. */
		gaps: string[];
		versions: { slug: string; name: string }[];
		docType: string;
		suggestedBaseSlug: string;
		profileSlug: string | undefined;
		hasJob: boolean;
	} = $props();

	// Follows the suggestion until the applicant overrides it — a plain
	// `$state(suggestedBaseSlug)` would freeze whatever the first render saw and
	// then ignore a re-ranked suggestion after the page invalidates.
	let chosenBase = $state<string | null>(null);
	let baseSlug = $derived(chosenBase ?? tailored?.baseSlug ?? suggestedBaseSlug);
	let working = $state(false);

	let included = $derived(decisions.filter((d) => d.action === 'include' && d.sort === null));
	let excluded = $derived(decisions.filter((d) => d.action === 'exclude'));
	let reordered = $derived(decisions.filter((d) => d.sort !== null));

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
	<div class="mb-3 flex items-center gap-2">
		<FontAwesomeIcon icon={faWandMagicSparkles} class="h-5 w-5 text-[var(--dash-primary)]" />
		<h2 class="text-lg font-semibold text-[var(--dash-text)]">Tailored for this job</h2>
	</div>

	<Card padding="lg">
		{#if !hasJob}
			<p class="text-xs text-[var(--dash-text-muted)]">
				Link a job to this application to tailor a version for it.
			</p>
		{:else if !tailored}
			<p class="mb-3 text-xs text-[var(--dash-text-muted)]">
				Build a version of your resume for this job: it starts from one of your own versions and
				only decides what to <em>show</em> — which bullets, which projects, and any skill this job requires
				that your document would otherwise hide. It never rewrites your words.
			</p>
			<form method="POST" action="?/tailorVersion" use:enhance={track}>
				<input type="hidden" name="doc_type" value={docType} />
				<div class="flex flex-col gap-2 sm:flex-row">
					<div class="flex-1">
						<label
							for="tailor-base-slug"
							class="mb-1 block text-[10px] text-[var(--dash-text-muted)]">Start from</label
						>
						<select
							id="tailor-base-slug"
							name="base_slug"
							value={baseSlug}
							onchange={(e) => (chosenBase = e.currentTarget.value)}
							class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						>
							<option value="">Your plain {docType === 'cv' ? 'CV' : 'resume'}</option>
							{#each versions as v (v.slug)}
								<option value={v.slug}>{v.name}</option>
							{/each}
						</select>
					</div>
					<button
						type="submit"
						disabled={working}
						class="flex items-center justify-center gap-2 self-end rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:opacity-70"
					>
						{#if working}
							<FontAwesomeIcon icon={faCircleNotch} spin class="h-3.5 w-3.5" />
							Working…
						{:else}
							<FontAwesomeIcon icon={faWandMagicSparkles} class="h-3.5 w-3.5" />
							Tailor a version
						{/if}
					</button>
				</div>
			</form>
		{:else}
			<div class="flex flex-wrap items-center justify-between gap-2">
				<div>
					<p class="text-sm font-medium text-[var(--dash-text)]">{tailored.name}</p>
					<p class="text-[10px] text-[var(--dash-text-muted)]">
						{decisions.length}
						{decisions.length === 1 ? 'change' : 'changes'} against the version it builds on.
					</p>
				</div>
				{#if profileSlug}
					<div class="flex items-center gap-3">
						<!-- profileDocUrl builds a public /p/[slug] URL with a query string at
						     runtime, which resolve() cannot express; the same links on the
						     recorded version in CvSentCard are in the lint baseline for this. -->
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							href={profileDocUrl({
								profileSlug,
								docType: docType as DocType,
								versionSlug: tailored.slug
							})}
							target="_blank"
							rel="noopener"
							class="dash-link-ext"
						>
							<FontAwesomeIcon icon={faExternalLinkAlt} class="h-3 w-3" />
							Open
						</a>
						<a
							href={profileDocUrl({
								profileSlug,
								docType: docType as DocType,
								versionSlug: tailored.slug,
								pdf: true
							})}
							target="_blank"
							rel="noopener"
							class="dash-link-ext"
						>
							<FontAwesomeIcon icon={faFilePdf} class="h-3 w-3" />
							PDF
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</div>
				{/if}
			</div>

			{#if decisions.length === 0}
				<p class="mt-3 text-xs text-[var(--dash-text-muted)]">
					Nothing to change — the version this builds on already reads well for this job.
				</p>
			{/if}

			<!-- Every decision, with the reason that produced it. A resume you can't
			     audit is one you can't defend in the room it gets read in. -->
			{#each [{ rows: included, icon: faEye, tone: 'text-[var(--dash-success)]', head: 'Now showing' }, { rows: excluded, icon: faEyeSlash, tone: 'text-amber-600', head: 'Hidden for this job' }, { rows: reordered, icon: faArrowUp, tone: 'text-[var(--dash-primary)]', head: 'Moved up' }] as group (group.head)}
				{#if group.rows.length > 0}
					<div class="mt-4">
						<p
							class="mb-2 text-[10px] font-semibold tracking-wide text-[var(--dash-text-muted)] uppercase"
						>
							{group.head}
						</p>
						<ul class="space-y-2">
							{#each group.rows as row (row.id)}
								<li
									class="flex items-start gap-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] p-2"
								>
									<FontAwesomeIcon icon={group.icon} class="mt-1 h-3 w-3 shrink-0 {group.tone}" />
									<div class="min-w-0 flex-1">
										<p class="text-xs text-[var(--dash-text)]">{clip(row.label)}</p>
										{#if row.reason}
											<p class="mt-0.5 text-[10px] text-[var(--dash-text-muted)]">{row.reason}</p>
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
													title="Keep this through future regenerations"
													class="rounded px-1.5 py-1 text-[10px] text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-success)]"
												>
													Keep
												</button>
											</form>
										{/if}
										<form method="POST" action="?/rejectDecision" use:enhance={track}>
											<input type="hidden" name="decision_id" value={row.id} />
											<button
												type="submit"
												title="Undo this change"
												class="rounded px-1.5 py-1 text-[10px] text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-error)]"
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

			<!-- What no amount of reshuffling closes. Shown here so a tidier
			     document doesn't read as a stronger application. -->
			{#if gaps.length > 0}
				<div class="mt-4 rounded-lg border border-[var(--dash-border)] p-3">
					<p
						class="text-[10px] font-semibold tracking-wide text-[var(--dash-text-muted)] uppercase"
					>
						Choosing what to show can't fix
					</p>
					<ul class="mt-1 list-inside list-disc text-[10px] text-[var(--dash-text-muted)]">
						{#each gaps as gap (gap)}
							<li>{gap}</li>
						{/each}
					</ul>
				</div>
			{/if}

			<div class="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--dash-border)] pt-3">
				<form
					method="POST"
					action="?/tailorVersion"
					use:enhance={track}
					class="flex items-center gap-2"
				>
					<input type="hidden" name="doc_type" value={docType} />
					<!-- The base is re-offered here, not frozen at creation: regenerating
					     against a different version of your own is the main reason to
					     regenerate at all, and the action moves the extension to match. -->
					<label for="tailor-rebase-slug" class="sr-only">Start from</label>
					<select
						id="tailor-rebase-slug"
						name="base_slug"
						value={baseSlug}
						onchange={(e) => (chosenBase = e.currentTarget.value)}
						class="rounded-md border border-[var(--dash-border)] px-2 py-1 text-xs focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					>
						<option value="">Your plain {docType === 'cv' ? 'CV' : 'resume'}</option>
						{#each versions as v (v.slug)}
							<option value={v.slug}>{v.name}</option>
						{/each}
					</select>
					<button
						type="submit"
						disabled={working}
						class="inline-flex items-center gap-1.5 text-xs text-[var(--dash-primary)] hover:underline disabled:opacity-70"
					>
						<FontAwesomeIcon
							icon={working ? faCircleNotch : faRotate}
							spin={working}
							class="h-3 w-3"
						/>
						Regenerate
					</button>
				</form>
				<form
					method="POST"
					action="?/promoteTailored"
					use:enhance={track}
					class="flex items-center gap-2"
				>
					<input type="hidden" name="name" value={tailored.name} />
					<button
						type="submit"
						disabled={working}
						title="Keep this as one of your own versions, decisions and all"
						class="inline-flex items-center gap-1.5 text-xs text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] disabled:opacity-70"
					>
						<FontAwesomeIcon icon={faBoxArchive} class="h-3 w-3" />
						Keep in my versions
					</button>
				</form>
				<form method="POST" action="?/discardTailored" use:enhance={track}>
					<button
						type="submit"
						disabled={working}
						class="inline-flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-error)] disabled:opacity-70"
					>
						<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
						Discard
					</button>
				</form>
			</div>
		{/if}
	</Card>
</div>
