<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCheck,
		faCircleNotch,
		faExternalLinkAlt,
		faEye,
		faEyeSlash,
		faFileAlt,
		faFilePdf,
		faLightbulb,
		faPlus,
		faMagnifyingGlass,
		faSave,
		faXmark
	} from '@fortawesome/free-solid-svg-icons';
	import Card from '../../components/Card.svelte';
	import AddSkillToProfile from '../../jobs/components/AddSkillToProfile.svelte';
	import { profileDocUrl } from '$lib/utils/profile-doc-url';
	import type { DocType } from '$lib/utils/profile-doc-url';
	import {
		hiddenSkillsKey,
		recommendVersion,
		type HiddenSkill,
		type VersionCoverage
	} from '$lib/version-coverage';

	/**
	 * "Which version did I send them?" — application state, not activity.
	 *
	 * Extracted from the Documents tab when that tab was deleted for the Activity
	 * unification. It was the one thing on that page that had nothing to do with
	 * attached files, and lifting it out whole was safer than re-typing it: the
	 * hidden-required-skills strip below carries its own fetch, its own optimistic
	 * state, and reasoning that is easy to lose in a hand port.
	 *
	 * The host page must expose a `setCvSent` action.
	 */
	let {
		app,
		versions,
		tailored,
		coverage,
		creditedNotNamed,
		profileSlug
	}: {
		app: {
			cv_sent_through: string | null;
			cv_version_sent: string | null;
		};
		/** The applicant's own library of versions. */
		versions: { slug: string; name: string }[];
		/** This application's tailored version, if one has been generated. */
		tailored: { id: number; slug: string; name: string } | null;
		coverage: Record<string, VersionCoverage>;
		/**
		 * Required skills the match credits through something related, while no
		 * skill of the applicant's carries the word itself.
		 */
		creditedNotNamed: string[];
		profileSlug: string | undefined;
	} = $props();

	/** Everything selectable here: the library, plus this job's own version. */
	let selectable = $derived(
		tailored ? [...versions, { slug: tailored.slug, name: tailored.name }] : versions
	);

	let cvSaved = $state(false);
	let docType = $state<string>(app.cv_sent_through || 'resume');
	let versionSlug = $state<string>(app.cv_version_sent || '');

	/**
	 * Whether either picker has been touched this visit. The pickers default to
	 * resume / no version whether or not anything was ever recorded, so without
	 * this the strip below answers for the plain base document and phrases it as
	 * the document being sent — telling an applicant who hasn't chosen anything
	 * yet what "the resume you're sending" omits.
	 *
	 * The empty version *is* a real choice (a saved row with no version means the
	 * plain base template, which is exactly what the server computes an entry
	 * for), so a recorded pick still warns. Only an undecided one stays quiet.
	 */
	let touched = $state(false);
	let decided = $derived(!!app.cv_sent_through || touched);

	let docLabel = $derived(docType === 'cv' ? 'CV' : 'resume');
	/** Named for what it is: a picked version, or the version-less base document. */
	let sendingLabel = $derived(
		versionSlug ? `${docLabel} you're sending` : `plain ${docLabel} (no version)`
	);

	/**
	 * Skills this job requires that the applicant has but the document they're
	 * about to send wouldn't print — profile-only ones, mostly. Precomputed by the
	 * server for every template x version pair, so flipping either picker answers
	 * instantly and without a round trip.
	 *
	 * Counted by exact name, which is deliberately stricter than the match score
	 * beside it: the matcher counts "SQL" through MySQL and PostgreSQL, but a
	 * document that prints those does not print the word SQL, and a keyword
	 * search for it will not find one. Hence "names N of M" rather than "matches"
	 * — the two numbers answer different questions and should not be read as one
	 * disagreeing with the other.
	 */
	let hiddenSkills = $derived(
		decided ? (coverage[hiddenSkillsKey(docType, versionSlug)]?.hidden ?? []) : []
	);
	let liftTarget = $derived(
		versionSlug
			? (selectable.find((v) => v.slug === versionSlug)?.name ?? versionSlug)
			: 'all your documents'
	);

	/**
	 * Which version to suggest while nothing is recorded. Ranked here rather than
	 * on the server because the document type is unsaved client state: flipping
	 * Resume/CV has to re-rank without a round trip. Plain document first, so a
	 * version is only ever suggested when it genuinely beats sending it.
	 */
	let recommendation = $derived(
		decided ? null : recommendVersion(coverage, docType, ['', ...selectable.map((v) => v.slug)])
	);
	// recommendVersion never names the version-less document, so a missing name
	// here means the version list and the coverage map disagree — show the slug
	// rather than inventing a label for it.
	let recommendedName = $derived(
		recommendation
			? (selectable.find((v) => v.slug === recommendation.versionSlug)?.name ??
					recommendation.versionSlug)
			: ''
	);

	/**
	 * Required skills the profile neither names nor is credited for — the ones
	 * genuinely absent, as opposed to the ones present under another word.
	 *
	 * `owned` counts only exact-name matches, so `required - owned` includes the
	 * semantically credited ones; reporting that difference as "not on your
	 * profile" contradicted the credited strip on the same card.
	 */
	let absentFromProfile = $derived(
		Math.max(
			0,
			(recommendation?.coverage.required ?? 0) -
				(recommendation?.coverage.owned ?? 0) -
				creditedNotNamed.length
		)
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
		return profileDocUrl({ profileSlug, docType: docType as DocType, versionSlug: slug });
	}

	function acceptRecommendation() {
		if (!recommendation) return;
		versionSlug = recommendation.versionSlug;
		touched = true;
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
				body: JSON.stringify({
					id: skill.id,
					show_on: versionSlug || 'all'
				})
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
	 * What the record currently claims, in the SAVED values rather than the
	 * pickers' — the confirmation has to name what is being forgotten, and the
	 * pickers may have been moved since without being saved.
	 */
	let recordedLabel = $derived(
		app.cv_version_sent
			? (selectable.find((v) => v.slug === app.cv_version_sent)?.name ?? app.cv_version_sent)
			: `the plain ${app.cv_sent_through === 'cv' ? 'CV' : 'resume'}`
	);

	/**
	 * Back to nothing recorded. The local pickers have to be reset with it:
	 * `touched` is component state, so a card that had been clicked would stay
	 * "decided" against a record that no longer exists — and the recommendation,
	 * which only shows while undecided, would never come back.
	 */
	function handleClear() {
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			docType = 'resume';
			versionSlug = '';
			touched = false;
			lifted = [];
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
				cvSaved = true;
				setTimeout(() => {
					cvSaved = false;
				}, 2000);
			}
		};
	}
</script>

<div>
	<div class="mb-3 flex items-center gap-2">
		<FontAwesomeIcon icon={faFileAlt} class="h-5 w-5 text-[var(--dash-primary)]" />
		<h2 class="text-lg font-semibold text-[var(--dash-text)]">Resume / CV Sent</h2>
	</div>

	<Card padding="lg">
		<p class="mb-4 text-xs text-[var(--dash-text-muted)]">
			Track which version you sent, so you can open the same one they'll have during an interview.
		</p>
		<form method="POST" action="?/setCvSent" use:enhance={handleCvSubmit}>
			<!-- Document type segmented control -->
			<input type="hidden" name="cv_sent_through" value={docType} />
			<div class="mb-3 inline-flex overflow-hidden rounded-lg border border-[var(--dash-border)]">
				{#each [{ value: 'resume', label: 'Resume' }, { value: 'cv', label: 'CV' }] as opt, i}
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

			<!-- Version selector -->
			<div class="flex flex-col gap-2 sm:flex-row">
				<select
					name="version_slug"
					bind:value={versionSlug}
					onchange={() => (touched = true)}
					class="flex-1 rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				>
					<option value="">Select</option>
					{#each versions as v}
						<option value={v.slug}>
							{v.name}
						</option>
					{/each}
					{#if tailored}
						<option value={tailored.slug}>{tailored.name} — tailored for this job</option>
					{/if}
				</select>
				<button
					type="submit"
					class="flex items-center justify-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
				>
					{#if cvSaved}
						<FontAwesomeIcon icon={faCheck} class="h-3.5 w-3.5" />
						Saved
					{:else}
						<FontAwesomeIcon icon={faSave} class="h-3.5 w-3.5" />
						Set
					{/if}
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
			</div>
		</form>

		{#if app.cv_sent_through}
			<div class="mt-2">
				{#if confirmingClear}
					<div class="inline-flex flex-wrap items-center gap-2">
						<span class="text-[10px] text-[var(--dash-text-secondary)]">
							Forget that you sent {recordedLabel}?
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
							class="text-[10px] text-[var(--dash-text-muted)] hover:underline"
						>
							Cancel
						</button>
					</div>
				{:else}
					<button
						type="button"
						onclick={() => (confirmingClear = true)}
						title="Forget what was recorded here"
						class="inline-flex items-center gap-1.5 text-[10px] text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-error)]"
					>
						<FontAwesomeIcon icon={faXmark} class="h-2.5 w-2.5" />
						Clear this record
					</button>
				{/if}
			</div>
		{/if}

		<!-- Which version to send, while nothing has been recorded. Ranked by how
         much of what the job requires each candidate would actually print, so
         the answer is measured rather than guessed — and stated with its
         evidence, since an unexplained suggestion about your own resume is not
         worth following. -->
		{#if recommendation}
			<div
				class="mt-4 rounded-lg border border-[var(--dash-primary)]/30 bg-[var(--dash-primary)]/5 p-3"
			>
				<p class="flex items-start gap-2 text-xs text-[var(--dash-text)]">
					<FontAwesomeIcon
						icon={faLightbulb}
						class="mt-0.5 h-3 w-3 shrink-0 text-[var(--dash-primary)]"
					/>
					<span>
						Send <strong>{recommendedName}</strong> — it names
						{recommendation.coverage.shown.length} of the {recommendation.coverage.required}
						{recommendation.coverage.required === 1 ? 'skill' : 'skills'} this job asks for.
					</span>
				</p>
				<div class="mt-2 flex flex-wrap items-center gap-3">
					<button
						type="button"
						onclick={acceptRecommendation}
						class="inline-flex items-center gap-1.5 rounded border border-[var(--dash-primary)]/40 bg-[var(--dash-card)] px-2 py-1 text-xs text-[var(--dash-primary)] transition-colors hover:bg-[var(--dash-primary)]/10"
					>
						<FontAwesomeIcon icon={faCheck} class="h-2.5 w-2.5" />
						Use this one
					</button>
					<!-- Look before you commit: the suggestion is a measurement of skill
					     coverage, which is one thing a document is judged on and not the
					     only one. -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					{#if previewUrl(recommendation.versionSlug)}
						<a
							href={previewUrl(recommendation.versionSlug)}
							target="_blank"
							rel="noopener"
							class="inline-flex items-center gap-1 text-xs text-[var(--dash-primary)] hover:underline"
						>
							<FontAwesomeIcon icon={faEye} class="h-2.5 w-2.5" />
							Preview it
						</a>
					{/if}
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					<!-- Three separate facts about the rest, not one alternative. The
					     original said "the other N aren't on your profile at all", which
					     counted every skill the profile doesn't NAME — and so called SQL
					     and Linux missing while the strip below credited them. -->
					{#if recommendation.coverage.hidden.length > 0}
						<span class="text-[10px] text-[var(--dash-text-muted)]">
							{recommendation.coverage.hidden.length} more you have wouldn't print on it.
						</span>
					{/if}
					{#if creditedNotNamed.length > 0}
						<span class="text-[10px] text-[var(--dash-text-muted)]">
							{creditedNotNamed.length} you're credited for through related skills.
						</span>
					{/if}
					{#if absentFromProfile > 0}
						<span class="text-[10px] text-[var(--dash-text-muted)]">
							{absentFromProfile}
							{absentFromProfile === 1 ? "isn't" : "aren't"} on your profile at all.
						</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Credited by the match, absent from the document as a word.
         Distinct from the strip below, and shown whether or not a version has
         been picked: this one is not about which document you send — no
         version of a profile that never says "SQL" says it. The match counts
         it through MySQL and PostgreSQL, and a recruiter searching the file
         for the word finds nothing. -->
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

				<p class="mt-2 text-[10px] text-[var(--dash-text-muted)]">
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
						{hiddenSkills.length === 1 ? 'it' : 'they'} won't appear on the {sendingLabel}.
					</span>
				</p>

				<div class="mt-2 flex flex-wrap gap-1.5">
					{#each hiddenSkills as skill (skill.id)}
						{#if skill.liftable}
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
							<!-- Something other than the profile-only pair holds it back
                   (a hidden category, or a "CV only" tag on a resume), so
                   the one-click lift wouldn't reveal it — don't pretend. -->
							<span
								title="Held back by another rule — edit it in your profile skills"
								class="inline-flex items-center gap-1 rounded border border-dashed border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-xs text-[var(--dash-text-muted)]"
							>
								{skill.name}
							</span>
						{/if}
					{/each}
				</div>

				<p class="mt-2 text-[10px] text-[var(--dash-text-muted)]">
					Adding puts the skill on <strong>{liftTarget}</strong>. Skills you can't add here are held
					back by another rule — change them in
					<a href="/profile/skills" class="dash-link">your skills</a>.
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

		{#if app.cv_version_sent && app.cv_sent_through && profileSlug}
			{@const dt = app.cv_sent_through as DocType}
			<div class="mt-4 flex items-center gap-3 border-t border-[var(--dash-border)] pt-4">
				<a
					href={profileDocUrl({ profileSlug, docType: dt, versionSlug: app.cv_version_sent })}
					target="_blank"
					class="dash-link-ext"
				>
					<FontAwesomeIcon icon={faExternalLinkAlt} class="h-3 w-3" />
					Open {dt === 'cv' ? 'CV' : 'Resume'}
				</a>
				<a
					href={profileDocUrl({
						profileSlug,
						docType: dt,
						versionSlug: app.cv_version_sent,
						pdf: true
					})}
					target="_blank"
					class="dash-link-ext"
				>
					<FontAwesomeIcon icon={faFilePdf} class="h-3 w-3" />
					PDF
				</a>
			</div>
		{/if}
	</Card>
</div>
