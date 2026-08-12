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
	import Card from '../../../components/Card.svelte';
	import { profileDocUrl, type DocType } from '$lib/utils/profile-doc-url';
	import { overrideEntityLabel, OVERRIDE_ENTITIES } from '$lib/version-overrides';

	/**
	 * The version tailored to this job, and every decision that shaped it.
	 *
	 * Titled "Tailored version" rather than "Tailored for this job": the card
	 * sits on one application's page, so the job is a given, and the sibling card
	 * above already ends in those words — two headings with the same tail read as
	 * a stutter. This one names the artifact it manages.
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
		/** Which role a bullet came from; null for things that name themselves. */
		context: string | null;
	}

	let {
		tailored,
		decisions,
		gaps,
		versions,
		docType,
		suggestedBaseSlug,
		profileSlug,
		hasJob,
		recordedHere
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
		/** Whether the send-record names this version — deleting it clears that. */
		recordedHere: boolean;
	} = $props();

	// Follows the suggestion until the applicant overrides it — a plain
	// `$state(suggestedBaseSlug)` would freeze whatever the first render saw and
	// then ignore a re-ranked suggestion after the page invalidates.
	let chosenBase = $state<string | null>(null);
	let baseSlug = $derived(chosenBase ?? tailored?.baseSlug ?? suggestedBaseSlug);
	let baseName = $derived(versions.find((v) => v.slug === tailored?.baseSlug)?.name ?? '');
	let working = $state(false);
	/**
	 * Deleting destroys a generated version and every decision on it, and the
	 * only way back is another model call. One click is too few for that, and
	 * the notes list on this page already asks twice for the same reason.
	 */
	let confirmingDiscard = $state(false);

	// A skill is only ever surfaced, never promoted: it carries a sort so it
	// lands beside its relatives rather than at the end of its category, and
	// that placement is part of showing it, not a second claim that the document
	// changed order. Reading the sort alone would file it under "Moved up",
	// where it would be the only row whose item wasn't there before.
	let isSkill = (d: Decision) => d.entityType === OVERRIDE_ENTITIES.skill;
	let included = $derived(
		decisions.filter((d) => d.action === 'include' && (d.sort === null || isSkill(d)))
	);
	let excluded = $derived(decisions.filter((d) => d.action === 'exclude'));
	let reordered = $derived(decisions.filter((d) => d.sort !== null && !isSkill(d)));

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
		<h2 class="text-lg font-semibold text-[var(--dash-text)]">Tailored version</h2>
	</div>

	<Card padding="lg">
		{#if !hasJob}
			<p class="text-xs text-[var(--dash-text-secondary)]">
				Link a job to this application to tailor a version for it.
			</p>
		{:else if !tailored}
			<p class="mb-3 text-xs text-[var(--dash-text-secondary)]">
				Build a version of your resume for this job: it starts from one of your own versions and
				only decides what to <em>show</em> — which achievements, which side projects, and any skill this
				job requires that your document would otherwise hide. It never rewrites your words.
			</p>
			<form method="POST" action="?/tailorVersion" use:enhance={track}>
				<input type="hidden" name="doc_type" value={docType} />
				<div class="flex flex-col gap-2 sm:flex-row">
					<div class="flex-1">
						<label
							for="tailor-base-slug"
							class="mb-1 block text-[10px] text-[var(--dash-text-secondary)]">Start from</label
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
				<div class="min-w-0">
					<p class="text-sm font-medium text-[var(--dash-text)]">{tailored.name}</p>
					<!-- Name the base. "Against the version it builds on" was true and
					     useless: a version built on the plain document shows none of
					     the applicant's version tags — four side projects vanished
					     here — and nothing on the page said which document the diff
					     was a diff against. -->
					<p class="text-[10px] text-[var(--dash-text-secondary)]">
						{decisions.length}
						{decisions.length === 1 ? 'change' : 'changes'} against
						{#if baseName}<strong class="font-medium">{baseName}</strong>{:else}your plain {docType ===
							'cv'
								? 'CV'
								: 'resume'}{/if}.
					</p>
				</div>
				<div class="flex items-center gap-3">
					{#if profileSlug}
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
					{/if}
					<!-- Up here rather than in the footer with the other two: those are
					     "what next", this is "get rid of it", and a card that routinely
					     lists a dozen decisions put it a screen and a half down where
					     nobody found it. Deleting a thing belongs beside opening it. -->
					<button
						type="button"
						onclick={() => (confirmingDiscard = true)}
						disabled={working}
						title="Delete this tailored version"
						class="inline-flex items-center gap-1.5 text-xs text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-error)] disabled:opacity-70"
					>
						<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
						Delete
					</button>
				</div>
			</div>

			{#if confirmingDiscard}
				<div
					class="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--dash-error)]/30 bg-[var(--dash-error)]/5 p-3"
				>
					<p class="flex-1 text-xs text-[var(--dash-text)]">
						Delete this version and its {decisions.length}
						{decisions.length === 1 ? 'change' : 'changes'}? Your own versions and your profile stay
						as they are{recordedHere ? ', but the record of what you sent clears with it' : ''}.
					</p>
					<form
						method="POST"
						action="?/discardTailored"
						use:enhance={() => {
							const done = track();
							confirmingDiscard = false;
							return done;
						}}
					>
						<button
							type="submit"
							disabled={working}
							class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--dash-error)] px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-70"
						>
							<FontAwesomeIcon icon={faTrash} class="h-3 w-3" />
							Delete it
						</button>
					</form>
					<button
						type="button"
						onclick={() => (confirmingDiscard = false)}
						class="text-xs text-[var(--dash-text-secondary)] hover:underline"
					>
						Cancel
					</button>
				</div>
			{/if}

			{#if !tailored.baseSlug}
				<!-- Not a warning about taste: the plain document ignores every
				     version tag, so this one is missing whatever the applicant put
				     on a version, and it is not the document a public profile
				     serves either. Regenerating from a real version fixes it. -->
				<div class="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
					<p class="text-xs text-[var(--dash-text)]">
						This was built on your plain {docType === 'cv' ? 'CV' : 'resume'}, so none of your
						version tags apply — anything you put on a specific version won't print here.
					</p>
					<p class="mt-1 text-[10px] text-[var(--dash-text-secondary)]">
						Pick a version under “Start from” below and regenerate.
					</p>
				</div>
			{/if}

			{#if decisions.length === 0}
				<p class="mt-3 text-xs text-[var(--dash-text-secondary)]">
					Nothing to change — the version this builds on already reads well for this job.
				</p>
			{/if}

			<!-- Every decision, with the reason that produced it. A resume you can't
			     audit is one you can't defend in the room it gets read in. -->
			<!-- What the document WILL show first — surfaced skills, then promoted
			     bullets — and what it won't, last. Two thoughts, not three, and it
			     keeps the short groups above the long one: hidden is routinely ten
			     rows, which buried the promotions under a wall of amber. Position
			     is not what draws the eye to the removals; their colour is. -->
			{#each [{ rows: included, icon: faEye, tone: 'text-[var(--dash-success)]', head: 'Now showing' }, { rows: reordered, icon: faArrowUp, tone: 'text-[var(--dash-primary)]', head: 'Moved up' }, { rows: excluded, icon: faEyeSlash, tone: 'text-amber-600', head: 'Hidden for this job' }] as group (group.head)}
				{#if group.rows.length > 0}
					<div class="mt-4">
						<p
							class="mb-2 text-[10px] font-semibold tracking-wide text-[var(--dash-text)] uppercase"
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
										<!-- What KIND of thing this is, before its text. A bullet, a
										     side project and a skill all rendered as one line of prose
										     here, and an achievement out of a role reads like a
										     sentence about nothing in particular until you know it is
										     one — so the type leads, and a bullet names its role. -->
										<p class="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] leading-none">
											<span
												class="rounded border border-[var(--dash-border)] px-1 py-0.5 font-medium tracking-wide text-[var(--dash-text-secondary)] uppercase"
											>
												{overrideEntityLabel(row.entityType)}
											</span>
											{#if row.context}
												<span class="truncate text-[var(--dash-text-secondary)]">{row.context}</span
												>
											{/if}
										</p>
										<p class="text-xs text-[var(--dash-text)]">{clip(row.label)}</p>
										{#if row.reason}
											<p class="mt-0.5 text-[10px] text-[var(--dash-text-secondary)]">
												{row.reason}
											</p>
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
			</div>
		{/if}
	</Card>
</div>
