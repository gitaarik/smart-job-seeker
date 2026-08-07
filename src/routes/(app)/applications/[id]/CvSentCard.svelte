<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCheck,
		faCircleNotch,
		faExternalLinkAlt,
		faEyeSlash,
		faFileAlt,
		faFilePdf,
		faPlus,
		faSave
	} from '@fortawesome/free-solid-svg-icons';
	import Card from '../../components/Card.svelte';
	import { profileDocUrl } from '$lib/utils/profile-doc-url';
	import type { DocType } from '$lib/utils/profile-doc-url';

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
	interface HiddenSkill {
		id: number;
		name: string;
		liftable: boolean;
	}

	let {
		app,
		versions,
		hiddenRequiredSkills,
		profileSlug
	}: {
		app: {
			cv_sent_through: string | null;
			cv_version_sent: string | null;
		};
		versions: { slug: string; name: string }[];
		hiddenRequiredSkills: Record<string, HiddenSkill[]>;
		profileSlug: string | undefined;
	} = $props();

	let cvSaved = $state(false);
	let docType = $state<string>(app.cv_sent_through || 'resume');
	let versionSlug = $state<string>(app.cv_version_sent || '');

	/**
	 * Skills this job requires that the applicant has but the document they're
	 * about to send wouldn't print — profile-only ones, mostly. Precomputed by the
	 * server for every template x version pair, so flipping either picker answers
	 * instantly and without a round trip.
	 */
	let hiddenSkills = $derived(hiddenRequiredSkills[`${docType}:${versionSlug}`] ?? []);
	let liftTarget = $derived(
		versionSlug
			? (versions.find((v) => v.slug === versionSlug)?.name ?? versionSlug)
			: 'all your documents'
	);

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
						onclick={() => (docType = opt.value)}
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
					class="flex-1 rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				>
					<option value="">Select</option>
					{#each versions as v}
						<option value={v.slug}>
							{v.name}
						</option>
					{/each}
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
			</div>
		</form>

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
						{hiddenSkills.length === 1 ? 'it' : 'they'} won't appear on the
						{docType === 'cv' ? 'CV' : 'resume'} you're sending.
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
