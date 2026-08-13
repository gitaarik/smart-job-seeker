<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCheck,
		faCircleNotch,
		faExternalLinkAlt,
		faEye,
		faEyeSlash,
		faFileAlt,
		faFilePdf,
		faMagnifyingGlass,
		faPen,
		faPlus,
		faSave,
		faTrash,
		faWandMagicSparkles,
		faXmark
	} from '@fortawesome/free-solid-svg-icons';
	import Card from '../../../components/Card.svelte';
	import AddSkillToProfile from '../../../jobs/components/AddSkillToProfile.svelte';
	import ItemPicker from './ItemPicker.svelte';
	import TailoredDetails from './TailoredDetails.svelte';
	import type { Decision, LastRun } from './types';
	import type { ItemGroup } from '$lib/tailoring';
	import { profileDocUrl, type DocType } from '$lib/utils/profile-doc-url';
	import {
		hiddenSkillsKey,
		recommendVersion,
		type HiddenSkill,
		type VersionCoverage
	} from '$lib/version-coverage';
	import { OVERRIDE_ENTITIES } from '$lib/version-overrides';

	/**
	 * The document going out for this job — built for it, checked, and recorded.
	 *
	 * One card, because it is one question. It was two: a version picker that
	 * also nudged you to tailor, above a panel that generated a version the
	 * picker then made you select. The loop existed because tailoring did not
	 * record itself; it does now, so what sat below is no longer an alternative
	 * to the row above but that row's provenance.
	 *
	 * Tailoring leads and the library is a disclosure under it. That ordering is
	 * the claim: a version built for this job beats one written for a class of
	 * jobs, and the library is for the other case — sending something to a job
	 * that isn't in here. It also means an applicant with no versions at all,
	 * which is every new user, no longer meets an empty dropdown as the first
	 * thing on the page.
	 *
	 * Between the record and the tailoring sit three different ways a document
	 * can fail this job — a required skill it holds back, a skill the match
	 * credits you for without the word appearing anywhere, and relevant work it
	 * leaves out. They are separate strips because they are separate failures
	 * with separate fixes; collapsing them into one "gaps" list would lose which
	 * lever applies.
	 *
	 * The host page must expose `setCvSent`, `clearCvSent`, `tailorVersion`,
	 * `includeInTailored`, `discardTailored`, `keepDecision`, `rejectDecision`
	 * and `promoteTailored`.
	 */
	let {
		app,
		versions,
		tailored,
		decisions,
		gaps,
		items,
		coverage,
		creditedNotNamed,
		exclusions,
		defaultBase,
		profileSlug,
		hasJob,
		lastRun = null
	}: {
		app: {
			cv_sent_through: string | null;
			cv_version_sent: string | null;
		};
		/** The applicant's own library of versions. */
		versions: { slug: string; name: string }[];
		/** This application's tailored version, if one has been generated. */
		tailored: { id: number; slug: string; name: string; baseSlug?: string | null } | null;
		decisions: Decision[];
		gaps: string[];
		/** Everything the document being sent could print — see ItemPicker. */
		items: ItemGroup[];
		coverage: Record<string, VersionCoverage>;
		/**
		 * Required skills the match credits through something related, while no
		 * skill of the applicant's carries the word itself.
		 */
		creditedNotNamed: string[];
		/** Per document, the relevant things it leaves out. Keyed like `coverage`. */
		exclusions: Record<
			string,
			Array<{ entityType: string; entityId: number; label: string; score: number }>
		>;
		/** What this profile sends when nobody names a version, per document type. */
		defaultBase: { resume: string; cv: string } | undefined;
		profileSlug: string | undefined;
		hasJob: boolean;
		lastRun?: LastRun | null;
	} = $props();

	const DOC_TYPES: { value: DocType; label: string }[] = [
		{ value: 'resume', label: 'Resume' },
		{ value: 'cv', label: 'CV' }
	];

	/**
	 * Which document type this card is about — local state, not a read of the
	 * record. Tailoring takes it as an input, so deriving it from what was
	 * recorded meant a CV could not be tailored until a CV had already been
	 * recorded, which took the version picker to do: the control this card
	 * exists to stop needing.
	 */
	let docType = $state<DocType>(app.cv_sent_through === 'cv' ? 'cv' : 'resume');
	let docLabel = $derived(docType === 'cv' ? 'CV' : 'resume');

	/** Everything selectable here: the library, plus this job's own version. */
	let selectable = $derived(
		tailored ? [...versions, { slug: tailored.slug, name: tailored.name }] : versions
	);
	let nameOf = (slug: string) => selectable.find((v) => v.slug === slug)?.name ?? '';

	let recorded = $derived(!!app.cv_sent_through);
	/** Whether what's recorded is this job's own tailored version. */
	let choseTailored = $derived(!!tailored && app.cv_version_sent === tailored.slug);

	/**
	 * What a first toggle in the picker would build on, when no tailored version
	 * exists yet: the document currently recorded. Ignored once one does.
	 */
	let pickerBase = $derived(tailored ? (tailored.baseSlug ?? '') : (app.cv_version_sent ?? ''));

	let working = $state(false);
	let cvSaved = $state(false);
	let confirmingDiscard = $state(false);

	/**
	 * The library picker, opened by "Change" or by the disclosure under the
	 * tailor button. Closed, the card states an answer instead of asking a
	 * question — a dropdown left on screen next to a chosen version asks it again
	 * on every visit, and nothing distinguished the version being sent from the
	 * one merely sitting in a select.
	 */
	let picking = $state(false);
	let versionSlug = $state<string>(app.cv_version_sent || '');
	/** Whether the picker has been touched this visit — see `describing`. */
	let touched = $state(false);

	/**
	 * The picker stands in for the tailor button whenever tailoring isn't the
	 * offer: no job to tailor against, or a tailored version already made (whose
	 * own section below carries the regenerate).
	 */
	let pickerOpen = $derived(picking || !hasJob || !!tailored);

	/**
	 * The document the warnings below describe: whatever is being eyed in the
	 * picker while it is open, else whatever is recorded.
	 *
	 * Before either exists they stay quiet. The picker defaults to no version
	 * whether or not anything was ever recorded, so without this the strips
	 * answer for the plain base document and phrase it as the document being
	 * sent — telling an applicant who hasn't chosen anything what "the resume
	 * you're sending" omits.
	 */
	let activeSlug = $derived(picking ? versionSlug : (app.cv_version_sent ?? ''));
	let describing = $derived(recorded || (picking && touched));
	/** Whether the document the warnings describe is this job's tailored version. */
	let activeIsTailored = $derived(!!tailored && activeSlug === tailored.slug);

	/**
	 * Which of the applicant's versions to build on — stated, not asked, and no
	 * longer the thing that decides what goes on the page.
	 *
	 * It used to be. Measured across seven of this profile's versions on one job,
	 * the finished document ran from 33 items to 37 depending only on where it
	 * started. Every eligible item competes now, so six of those seven produce
	 * the same document and the seventh differs only where the applicant marked
	 * two items as alternatives — which is the base's remaining job, along with
	 * the running order and being the version the diff is a diff against.
	 *
	 * So the ranking still picks the closest version, and the sentence under the
	 * button says what that buys rather than implying it picks the contents.
	 */
	let chosenBase = $state<string | null>(null);

	/**
	 * The plain document is not a candidate here, though it is one for "which
	 * version should I send".
	 *
	 * An item assigned to a version is hidden from the version-less document, so
	 * building on that document is not starting from the widest pool — it is
	 * starting from one that specifically excludes everything the applicant
	 * curated. It cost four side projects the first time it happened, and the
	 * version it produces carries an amber warning saying so. A version is the
	 * right answer whenever there is one; which version is what the ranking and
	 * these fallbacks decide, and every branch says why on screen.
	 */
	function pickBase(dt: DocType): { slug: string; why: string } {
		const winner = recommendVersion(
			coverage,
			dt,
			versions.map((v) => v.slug)
		);
		if (winner) {
			const { shown, required } = winner.coverage;
			return {
				slug: winner.versionSlug,
				// Not "which names 3 of the 4 skills this job asks for" any more: true
				// of the version, and irrelevant to the document, because a required
				// skill you have is pinned onto whatever this starts from.
				why: `the closest of your versions — it names ${shown.length} of the ${required} ${required === 1 ? 'skill' : 'skills'} this job asks for`
			};
		}
		const fallback = defaultBase?.[dt] ?? '';
		if (fallback && versions.some((v) => v.slug === fallback)) {
			return { slug: fallback, why: 'the version you send by default' };
		}
		if (versions.length > 0) {
			return {
				slug: versions[0].slug,
				why: 'no version stands out for this job — change it if another fits better'
			};
		}
		return { slug: '', why: '' };
	}

	let baseChoice = $derived(pickBase(docType));
	let baseSlug = $derived(chosenBase ?? baseChoice.slug);
	let baseName = $derived(nameOf(baseSlug));
	/** The reason only stands while the suggestion does. */
	let baseWhy = $derived(chosenBase === null ? baseChoice.why : '');
	let showBasePicker = $state(false);

	/**
	 * Skills this job requires that the applicant has but the document they're
	 * about to send wouldn't print — profile-only ones, mostly. Precomputed by
	 * the server for every template x version pair, so flipping either control
	 * answers instantly and without a round trip.
	 *
	 * Counted by exact name, which is deliberately stricter than the match score
	 * beside it: the matcher counts "SQL" through MySQL and PostgreSQL, but a
	 * document that prints those does not print the word SQL, and a keyword
	 * search for it will not find one.
	 */
	let hiddenSkills = $derived(
		describing ? (coverage[hiddenSkillsKey(docType, activeSlug)]?.hidden ?? []) : []
	);
	/** Relevant things the chosen document leaves out. Gated for the same reason. */
	let hiddenEvidence = $derived(
		describing ? (exclusions[hiddenSkillsKey(docType, activeSlug)] ?? []) : []
	);
	/** Hidden skills whose name the document already prints inside another. */
	let carried = $derived(hiddenSkills.filter((s) => s.carriedBy));

	let liftTarget = $derived(activeSlug ? nameOf(activeSlug) || activeSlug : 'all your documents');

	/**
	 * How much of what this job asks for a candidate would actually print,
	 * appended to its name in the picker.
	 *
	 * The measurement used to headline this card as a suggestion to send one
	 * version over another. It reads better as an annotation on the choice than
	 * as a recommendation competing with the tailor button — same number, no
	 * second opinion about what to do with it.
	 */
	function covLabel(slug: string): string {
		const entry = coverage[hiddenSkillsKey(docType, slug)];
		if (!entry || entry.required === 0) return '';
		return ` — names ${entry.shown.length} of ${entry.required}`;
	}

	/**
	 * What the record currently claims, in the SAVED values rather than the
	 * picker's — the confirmations have to name what is being changed, and the
	 * picker may have been moved since without being saved.
	 */
	let recordedLabel = $derived(
		app.cv_version_sent
			? nameOf(app.cv_version_sent) || app.cv_version_sent
			: `the plain ${app.cv_sent_through === 'cv' ? 'CV' : 'resume'}`
	);

	/**
	 * Where to look at a candidate document before committing to it.
	 *
	 * Null for the version-less selection on purpose: `profileDocUrl` with no
	 * version produces a URL with no `?version=`, which the public route
	 * resolves to the profile's PUBLIC version — so a "preview" there would show
	 * a different document than the one being considered, which is worse than
	 * offering nothing.
	 */
	function previewUrl(slug: string): string | null {
		if (!profileSlug || !slug) return null;
		return profileDocUrl({ profileSlug, docType, versionSlug: slug });
	}

	let lifting = $state<number | null>(null);
	let lifted = $state<number[]>([]);
	let liftError = $state<string | null>(null);

	async function lift(skill: HiddenSkill) {
		if (lifting !== null) return;
		lifting = skill.id;
		liftError = null;
		try {
			const res = await fetch('/api/profile-skills', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: skill.id, show_on: activeSlug || 'all' })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body?.error || "Couldn't update the skill.");
			lifted = [...lifted, skill.id];
			// Recompute the strip against the new tags.
			await invalidateAll();
		} catch (e) {
			liftError = e instanceof Error ? e.message : "Couldn't update the skill.";
		} finally {
			lifting = null;
		}
	}

	/**
	 * Clearing is a small destructive act on a factual record — what you told
	 * this application you sent — and the two other places on this page that
	 * throw something away (a note, a tailored version) both ask twice.
	 */
	let confirmingClear = $state(false);

	/**
	 * Back to nothing recorded. The local picker has to be reset with it:
	 * `touched` is component state, so a card that had been clicked would keep
	 * describing a document against a record that no longer exists.
	 */
	function handleClear() {
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			versionSlug = '';
			touched = false;
			picking = false;
			lifted = [];
		};
	}

	function track() {
		working = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			working = false;
		};
	}

	function handleCvSubmit() {
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: () => Promise<void>;
		}) => {
			await update();
			if (result.type === 'success') {
				picking = false;
				cvSaved = true;
				setTimeout(() => {
					cvSaved = false;
				}, 2000);
			}
		};
	}

	function cancelPicking() {
		versionSlug = app.cv_version_sent || '';
		docType = app.cv_sent_through === 'cv' ? 'cv' : 'resume';
		picking = false;
	}
</script>

<div>
	<div class="mb-3 flex items-center gap-2">
		<FontAwesomeIcon icon={faFileAlt} class="h-5 w-5 text-[var(--dash-primary)]" />
		<h2 class="text-lg font-semibold text-[var(--dash-text)]">Document for this job</h2>
	</div>

	<Card padding="lg">
		{#if recorded && !picking}
			<!-- The answer, not the question. Open, PDF and Delete live here rather
			     than in a footer below the warnings: they act on this document, and
			     putting them beside its name is what makes the row read as a
			     record. -->
			<div
				class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] p-3"
			>
				<div class="min-w-0">
					<p
						class="text-[10px] font-semibold tracking-wide text-[var(--dash-text-secondary)] uppercase"
					>
						Sending
					</p>
					<p class="truncate text-sm font-medium text-[var(--dash-text)]">
						{recordedLabel}<span class="font-normal text-[var(--dash-text-secondary)]">
							· {app.cv_sent_through === 'cv' ? 'CV' : 'Resume'}{choseTailored
								? ' · tailored for this job'
								: ''}</span
						>
					</p>
				</div>
				<div class="flex shrink-0 flex-wrap items-center gap-3">
					{#if app.cv_version_sent && app.cv_sent_through && profileSlug}
						{@const dt = app.cv_sent_through as DocType}
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							href={profileDocUrl({ profileSlug, docType: dt, versionSlug: app.cv_version_sent })}
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
								docType: dt,
								versionSlug: app.cv_version_sent,
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
					<button
						type="button"
						onclick={() => {
							picking = true;
							touched = false;
						}}
						class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-primary)]/60 hover:text-[var(--dash-primary)]"
					>
						<FontAwesomeIcon icon={faPen} class="h-3 w-3" />
						Change
					</button>
					{#if choseTailored}
						<!-- Deleting the artifact this row names belongs beside opening it.
						     A card that routinely lists a dozen decisions put this a screen
						     and a half down, where nobody found it. -->
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
					{/if}
				</div>
			</div>
			{#if cvSaved}
				<p class="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--dash-success)]">
					<FontAwesomeIcon icon={faCheck} class="h-2.5 w-2.5" />
					Saved
				</p>
			{/if}

			{#if confirmingDiscard && tailored}
				<div
					class="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--dash-error)]/30 bg-[var(--dash-error)]/5 p-3"
				>
					<p class="flex-1 text-xs text-[var(--dash-text)]">
						Delete this version and its {decisions.length}
						{decisions.length === 1 ? 'change' : 'changes'}? Your own versions and your profile stay
						as they are, but the record of what you're sending clears with it.
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
		{:else}
			<!-- Nothing chosen yet, or the applicant asked to change it. The document
			     type governs everything below: what gets tailored, what the warnings
			     answer about, and what the links open. -->
			<div class="mb-4 inline-flex overflow-hidden rounded-lg border border-[var(--dash-border)]">
				{#each DOC_TYPES as opt, i (opt.value)}
					<button
						type="button"
						onclick={() => {
							docType = opt.value;
							touched = true;
						}}
						class="px-3 py-1.5 text-sm transition-colors {docType === opt.value
							? 'bg-[var(--dash-primary)]/10 font-medium text-[var(--dash-primary)]'
							: 'text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)]'} {i > 0
							? 'border-l border-[var(--dash-border)]'
							: ''}"
					>
						{opt.label}
					</button>
				{/each}
			</div>

			{#if !pickerOpen}
				<!-- The offer. One button, and the base stated under it rather than
				     asked in front of it. -->
				<form method="POST" action="?/tailorVersion" use:enhance={track}>
					<input type="hidden" name="doc_type" value={docType} />
					<input type="hidden" name="base_slug" value={baseSlug} />
					<p class="mb-3 text-xs text-[var(--dash-text-secondary)]">
						Build a {docLabel} for this job: it decides what to <em>show</em> — which achievements, which
						side projects, and any skill this job requires that your document would otherwise hide. It
						never rewrites your words.
					</p>
					<button
						type="submit"
						disabled={working}
						class="flex items-center justify-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:opacity-70"
					>
						{#if working}
							<FontAwesomeIcon icon={faCircleNotch} spin class="h-3.5 w-3.5" />
							Working…
						{:else}
							<FontAwesomeIcon icon={faWandMagicSparkles} class="h-3.5 w-3.5" />
							Tailor a {docLabel} for this job
						{/if}
					</button>
					<p class="mt-2 text-[10px] text-[var(--dash-text-secondary)]">
						{#if baseName}
							Starting from <strong class="font-medium">{baseName}</strong>{#if baseWhy}, {baseWhy}{/if}.
							It sets the running order; what goes on the page is picked for this job from
							everything on your profile.
						{:else if versions.length === 0}
							Starting from your plain {docLabel} — you have no versions to build on yet.
						{:else}
							Starting from your plain {docLabel}. It sets the running order; what goes on the page
							is picked for this job from everything on your profile.
						{/if}
						{#if versions.length > 0}
							<button
								type="button"
								onclick={() => (showBasePicker = !showBasePicker)}
								class="text-[var(--dash-primary)] hover:underline"
							>
								{showBasePicker ? 'Never mind' : 'Start from a different one'}
							</button>
						{/if}
					</p>
					{#if showBasePicker}
						<!-- A real choice, not a formality: tailoring can surface a bullet
						     or a held-back skill, but a whole role or skill category the
						     base leaves out is out of its reach. -->
						<select
							value={baseSlug}
							onchange={(e) => (chosenBase = e.currentTarget.value)}
							aria-label="Version to start from"
							class="mt-2 rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-xs focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						>
							<option value="">Your plain {docLabel}</option>
							{#each versions as v (v.slug)}
								<option value={v.slug}>{v.name}</option>
							{/each}
						</select>
					{/if}
				</form>

				<!-- The other case, kept quiet: a job that isn't really in here, or one
				     that doesn't need its own document. -->
				<div class="mt-4 border-t border-[var(--dash-border)] pt-3">
					<button
						type="button"
						onclick={() => (picking = true)}
						class="text-xs text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
					>
						Or send one of my versions as it is →
					</button>
				</div>
			{:else}
				{#if !hasJob}
					<p class="mb-3 text-xs text-[var(--dash-text-secondary)]">
						Link a job to this application to tailor a {docLabel} for it. Until then, record which of
						your versions you're sending.
					</p>
				{/if}
				<form method="POST" action="?/setCvSent" use:enhance={handleCvSubmit}>
					<input type="hidden" name="cv_sent_through" value={docType} />
					<div class="flex flex-col gap-2 sm:flex-row">
						<select
							name="version_slug"
							bind:value={versionSlug}
							onchange={() => (touched = true)}
							aria-label="Version to send"
							class="flex-1 rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						>
							<option value="">Your plain {docLabel} (no version){covLabel('')}</option>
							{#each versions as v (v.slug)}
								<option value={v.slug}>{v.name}{covLabel(v.slug)}</option>
							{/each}
							{#if tailored}
								<option value={tailored.slug}>
									{tailored.name} — tailored for this job{covLabel(tailored.slug)}
								</option>
							{/if}
						</select>
						<button
							type="submit"
							class="flex items-center justify-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
						>
							<FontAwesomeIcon icon={faSave} class="h-3.5 w-3.5" />
							{recorded ? 'Save' : 'Set'}
						</button>
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						{#if previewUrl(versionSlug)}
							<a
								href={previewUrl(versionSlug)}
								target="_blank"
								rel="noopener"
								class="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-primary)]/60 hover:text-[var(--dash-primary)]"
							>
								<FontAwesomeIcon icon={faEye} class="h-3.5 w-3.5" />
								Preview
							</a>
						{/if}
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{#if recorded || picking}
							<button
								type="button"
								onclick={cancelPicking}
								class="flex items-center justify-center rounded-lg px-3 py-2 text-sm text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
							>
								Cancel
							</button>
						{/if}
					</div>
				</form>
			{/if}
		{/if}

		<!-- Evidence, not vocabulary. The skills strip below answers "does this
		     document say the words this job asks for"; this one answers "does it
		     show the work". A missing keyword costs you a search hit, a missing
		     bullet costs you the proof. The bar is comparative: only things
		     ranking above half of what this document DOES show, so a sensible
		     selection says nothing at all. -->
		{#if hiddenEvidence.length > 0}
			<div class="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
				<p class="flex items-start gap-2 text-xs text-[var(--dash-text)]">
					<FontAwesomeIcon icon={faEyeSlash} class="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
					<span>
						This {docLabel} leaves out
						{hiddenEvidence.length === 1 ? 'something' : `${hiddenEvidence.length} things`} that
						{hiddenEvidence.length === 1 ? 'speaks' : 'speak'} to this job more than half of what it does
						show.
					</span>
				</p>

				<ul class="mt-2 space-y-1.5">
					{#each hiddenEvidence as item (item.entityType + item.entityId)}
						<li
							class="flex items-start justify-between gap-2 rounded border border-[var(--dash-border)] bg-[var(--dash-card)] p-2"
						>
							<span class="min-w-0 flex-1 text-[11px] text-[var(--dash-text-secondary)]">
								{item.label.length > 110 ? item.label.slice(0, 110).trimEnd() + '…' : item.label}
							</span>
							{#if activeIsTailored}
								<form method="POST" action="?/includeInTailored" use:enhance={() => () => {}}>
									<input type="hidden" name="entity_type" value={item.entityType} />
									<input type="hidden" name="entity_id" value={item.entityId} />
									<button
										type="submit"
										title="Show this on the version tailored for this job"
										class="shrink-0 rounded border border-[var(--dash-border)] px-1.5 py-0.5 text-[10px] text-[var(--dash-text-secondary)] transition-colors hover:border-amber-500/50 hover:text-amber-700"
									>
										Put it back
									</button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>

				{#if !activeIsTailored}
					<!-- No one-click fix here on purpose: this version's tags belong to
					     every job that uses it, so "put it back" would be a change to
					     all of them. Tailoring makes the exception job-local. -->
					<p class="mt-2 text-[10px] text-[var(--dash-text-secondary)]">
						Putting these back on <strong>{liftTarget}</strong> itself would change it for every job
						that uses it — a {docLabel} tailored for this one keeps the exception here.
					</p>
				{/if}
			</div>
		{/if}

		<!-- Credited by the match, absent from the document as a word. Distinct
		     from the strip below, and shown whether or not a version has been
		     picked: this one is not about which document you send — no version of
		     a profile that never says "SQL" says it. The match counts it through
		     MySQL and PostgreSQL, and a recruiter searching the file for the word
		     finds nothing. -->
		{#if creditedNotNamed.length > 0}
			<div class="mt-4 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] p-3">
				<p class="flex items-start gap-2 text-xs text-[var(--dash-text)]">
					<FontAwesomeIcon icon={faMagnifyingGlass} class="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
					<span>
						This job's match already credits you with
						{creditedNotNamed.length === 1 ? 'this' : 'these'}, through related skills you have —
						but
						{creditedNotNamed.length === 1 ? 'the word' : 'the words'} never {creditedNotNamed.length ===
						1
							? 'appears'
							: 'appear'} on your {docLabel}, so a keyword search of it finds nothing.
					</span>
				</p>

				<div class="mt-2 flex flex-wrap gap-1.5">
					{#each creditedNotNamed as skill (skill)}
						<AddSkillToProfile {skill} strength="strong" variant="required" defaultShowOnCv />
					{/each}
				</div>

				<p class="mt-2 text-[10px] text-[var(--dash-text-secondary)]">
					Adding one puts the word on your profile and, unless you say otherwise, on the documents
					you send.
				</p>
			</div>
		{/if}

		<!-- Required skills the applicant has but this document won't print.
		     Profile-only skills are invisible by design and are stripped from the
		     AI snapshot too, so a generated letter won't raise them either — when
		     the job *requires* one, that silence is the wrong default. -->
		{#if hiddenSkills.length > 0}
			<div class="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
				<p class="flex items-start gap-2 text-xs text-[var(--dash-text)]">
					<FontAwesomeIcon icon={faEyeSlash} class="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
					<span>
						This job requires {hiddenSkills.length === 1
							? 'a skill'
							: `${hiddenSkills.length} skills`} you have, but
						{hiddenSkills.length === 1 ? 'it' : 'they'} won't appear on the {docLabel} you're sending.
					</span>
				</p>

				<div class="mt-2 flex flex-wrap gap-1.5">
					{#each hiddenSkills as skill (skill.id)}
						{#if skill.liftable && activeIsTailored}
							<!-- On the tailored version, say it the way the generator says it:
							     an override row, keyed by the version's id. The tag route below
							     edits the SKILL, so it survives the version it was meant for and
							     names that version by slug — which "Keep in my versions"
							     renames. Same visible result here, a job-local decision that
							     travels with the version. -->
							<form
								method="POST"
								action="?/includeInTailored"
								use:enhance={() =>
									async ({ update }) => {
										await update();
										lifted = [...lifted, skill.id];
									}}
							>
								<input type="hidden" name="entity_type" value={OVERRIDE_ENTITIES.skill} />
								<input type="hidden" name="entity_id" value={skill.id} />
								<button
									type="submit"
									title="Show {skill.name} on this job's version"
									class="inline-flex items-center gap-1 rounded border border-[var(--dash-border)] bg-[var(--dash-card)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-amber-500/50 hover:text-amber-700"
								>
									<FontAwesomeIcon icon={faPlus} class="h-2.5 w-2.5" />
									{skill.name}
								</button>
							</form>
						{:else if skill.liftable}
							<button
								type="button"
								onclick={() => lift(skill)}
								disabled={lifting !== null}
								title="Add {skill.name} to {liftTarget}"
								class="inline-flex items-center gap-1 rounded border border-[var(--dash-border)] bg-[var(--dash-card)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-amber-500/50 hover:text-amber-700 disabled:opacity-70"
							>
								{#if lifting === skill.id}
									<FontAwesomeIcon icon={faCircleNotch} spin class="h-2.5 w-2.5" />
								{:else}
									<FontAwesomeIcon icon={faPlus} class="h-2.5 w-2.5" />
								{/if}
								{skill.name}
							</button>
						{:else}
							<!-- Something other than the profile-only pair holds it back (a
							     hidden category, or a "CV only" tag on a resume), so the
							     one-click lift wouldn't reveal it — don't pretend. -->
							<span
								title="Held back by another rule — edit it in your profile skills"
								class="inline-flex items-center gap-1 rounded border border-dashed border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-xs text-[var(--dash-text-secondary)]"
							>
								{skill.name}
							</span>
						{/if}
					{/each}
				</div>

				<!-- The case against adding them, where there is one. A keyword search
				     for "SQL" already hits "SQL optimization" — so this is a judgement
				     about human readers, and the applicant is better placed to make it
				     than a substring rule is. Stated, not acted on. -->
				{#if carried.length > 0}
					<p class="mt-2 text-[10px] text-[var(--dash-text-secondary)]">
						Already on the page inside another skill:
						{#each carried as skill, i (skill.id)}<span
								>{i > 0 ? ', ' : ''}<strong>{skill.name}</strong> in “{skill.carriedBy}”</span
							>{/each}. A keyword search finds
						{carried.length === 1 ? 'it' : 'them'} there; a reader may not.
					</p>
				{/if}

				<p class="mt-2 text-[10px] text-[var(--dash-text-secondary)]">
					{#if activeIsTailored}
						Adding shows the skill on this job's version only — your other documents are untouched.
					{:else}
						Adding puts the skill on <strong>{liftTarget}</strong>.
					{/if}
					Skills you can't add here are held back by another rule — change them in
					<a href={resolve('/(app)/profile/(data)/skills')} class="dash-link">your skills</a>.
				</p>

				{#if liftError}
					<p class="mt-1 text-[10px] text-[var(--dash-error)]">{liftError}</p>
				{/if}
			</div>
		{:else if lifted.length > 0}
			<p class="mt-4 flex items-center gap-2 text-xs text-[var(--dash-success)]">
				<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
				Every skill this job requires now appears on the document you're sending.
			</p>
		{/if}

		{#if items.length > 0}
			<ItemPicker {items} {docType} baseSlug={pickerBase} />
		{/if}

		{#if tailored}
			<TailoredDetails
				{tailored}
				{decisions}
				{gaps}
				{versions}
				{docType}
				{profileSlug}
				{lastRun}
				recordedHere={choseTailored}
			/>
		{/if}

		{#if recorded}
			<div class="mt-4">
				{#if confirmingClear}
					<div class="inline-flex flex-wrap items-center gap-2">
						<span class="text-[10px] text-[var(--dash-text-secondary)]">
							Forget that you're sending {recordedLabel}?
						</span>
						<form
							method="POST"
							action="?/clearCvSent"
							use:enhance={() => {
								const done = handleClear();
								confirmingClear = false;
								return done;
							}}
						>
							<button type="submit" class="text-[10px] text-[var(--dash-error)] hover:underline">
								Clear
							</button>
						</form>
						<button
							type="button"
							onclick={() => (confirmingClear = false)}
							class="text-[10px] text-[var(--dash-text-secondary)] hover:underline"
						>
							Cancel
						</button>
					</div>
				{:else}
					<button
						type="button"
						onclick={() => (confirmingClear = true)}
						title="Forget what was recorded here"
						class="inline-flex items-center gap-1.5 text-[10px] text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-error)]"
					>
						<FontAwesomeIcon icon={faXmark} class="h-2.5 w-2.5" />
						Clear this record
					</button>
				{/if}
			</div>
		{/if}
	</Card>
</div>
