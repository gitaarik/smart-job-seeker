<script lang="ts">
	import type { ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faCircleCheck,
		faExclamationTriangle,
		faListCheck,
		faPlus,
		faSpinner,
		faWandMagicSparkles
	} from '@fortawesome/free-solid-svg-icons';
	import Card from '../../components/Card.svelte';
	import JobFieldsForm, {
		emptyJobFields,
		type JobFields
	} from '../../components/JobFieldsForm.svelte';

	let { form }: { form: ActionData } = $props();

	// Two steps: paste a posting and let it be extracted, then review/correct
	// the extracted fields before the job is created. "Enter the details
	// manually" skips straight to the (blank) review step.

	type ParsedFields = {
		title: string | null;
		company: string | null;
		job_poster: string | null;
		office_location: string | null;
		work_location: string[];
		job_types: string[];
		experience_levels: string[];
		source_url: string | null;
		date_posted: string | null;
		salary_min: number | null;
		salary_max: number | null;
		salary_currency: string | null;
		salary_period: string | null;
	};

	type ParsedPreview = {
		company_description: string | null;
		skills_required: string[];
		skills_preferred: string[];
		responsibilities: string[];
		soft_skills: string[];
	};

	let step = $state<'paste' | 'review'>('paste');
	let parsing = $state(false);
	let parseWarning = $state<string | null>(null);
	let parseToken = $state('');
	let didParse = $state(false);
	let creating = $state(false);

	// Review-step form values. The shared field set lives in `fields`; the
	// description is ours alone (it drives the parse, so it sits above the form
	// in the paste step and below it in the review step).
	let fields = $state<JobFields>(emptyJobFields());
	let fDescription = $state('');
	let preview = $state<ParsedPreview | null>(null);

	let previewGroups = $derived(
		preview
			? [
					{ label: 'Required skills', items: preview.skills_required },
					{ label: 'Preferred skills', items: preview.skills_preferred },
					{ label: 'Responsibilities', items: preview.responsibilities },
					{ label: 'Soft skills', items: preview.soft_skills }
				].filter((g) => g.items.length > 0)
			: []
	);

	async function runParse() {
		if (!fDescription.trim() || parsing) return;
		parsing = true;
		parseWarning = null;
		try {
			const res = await fetch('/api/jobs/parse-description', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					description: fDescription,
					source_url: fields.source_url || null
				})
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const body = await res.json();
			if (!body.ok) {
				// Extraction degraded (LLM error, no credits). Still let them through
				// to the review step and fill it in by hand.
				parseWarning = body.message ?? "We couldn't read that posting automatically.";
			} else {
				applyParsedFields(body.fields as ParsedFields);
				preview = body.preview as ParsedPreview;
				parseToken = body.token;
				didParse = true;
			}
		} catch {
			parseWarning = 'Extraction failed. You can still fill in the details yourself.';
		} finally {
			parsing = false;
			step = 'review';
			window.scrollTo({ top: 0 });
		}
	}

	/**
	 * Pre-fill the review form from a parse. Deliberately overwrites: a parse is
	 * a fresh starting point the user then corrects, so going back and re-parsing
	 * an edited description replaces the previous extraction rather than leaving
	 * stale values behind. The one exception is a URL the user typed themselves,
	 * which is more reliable than one recovered from the posting text.
	 */
	function applyParsedFields(parsedFields: ParsedFields) {
		const str = (v: string | number | null) => (v == null ? '' : String(v));
		fields = {
			title: str(parsedFields.title),
			company: str(parsedFields.company),
			job_poster: str(parsedFields.job_poster),
			office_location: str(parsedFields.office_location),
			source_url: fields.source_url || str(parsedFields.source_url),
			date_posted: str(parsedFields.date_posted),
			salary_min: str(parsedFields.salary_min),
			salary_max: str(parsedFields.salary_max),
			salary_currency: str(parsedFields.salary_currency),
			salary_period: str(parsedFields.salary_period),
			work_location: parsedFields.work_location,
			job_types: parsedFields.job_types,
			experience_levels: parsedFields.experience_levels
		};
	}

	const inputClass =
		'w-full px-3 py-2 text-sm bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-md text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]';
	const labelClass = 'block text-xs font-medium text-[var(--dash-text-muted)] mb-1';
</script>

<svelte:head>
	<title>New application — Smart Job Seeker</title>
</svelte:head>

<div class="max-w-3xl space-y-6 pb-8">
	<div>
		<a
			href="/applications/active"
			class="mb-2 inline-flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
		>
			<FontAwesomeIcon icon={faArrowLeft} class="h-3 w-3" />
			Applications
		</a>
		<h1 class="text-xl font-semibold text-[var(--dash-text)]">
			{step === 'paste' ? 'New application' : 'Check the details'}
		</h1>
		<p class="mt-1 text-sm text-[var(--dash-text-muted)]">
			{#if step === 'paste'}
				Paste the whole job posting and we'll pull out the title, company, salary, skills and more.
				You get to check everything before it's saved.
			{:else if didParse}
				Here's what we found. Correct anything that's off — nothing is saved yet.
			{:else}
				Fill in what you know. Everything is optional; you can complete it later.
			{/if}
		</p>
	</div>

	{#if form?.error}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{form.error}</p>
		</div>
	{/if}

	{#if step === 'paste'}
		<Card padding="responsive">
			<div class="space-y-4">
				<div>
					<label for="na-paste" class={labelClass}>Job description</label>
					<!-- svelte-ignore a11y_autofocus -->
					<textarea
						id="na-paste"
						rows="16"
						autofocus
						bind:value={fDescription}
						placeholder="Paste the full posting here…"
						class="{inputClass} resize-y"></textarea>
				</div>
				<div>
					<label for="na-paste-url" class={labelClass}>
						Job URL <span class="font-normal">(optional)</span>
					</label>
					<input
						id="na-paste-url"
						type="url"
						bind:value={fields.source_url}
						placeholder="https://…"
						class={inputClass}
					/>
					<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
						If it's from a known job platform, we'll link it automatically. We'll also try to find
						it in the posting itself.
					</p>
				</div>
			</div>
		</Card>

		<div class="flex items-center justify-between gap-3">
			<button
				type="button"
				onclick={() => (step = 'review')}
				class="text-sm text-[var(--dash-text-muted)] underline transition-colors hover:text-[var(--dash-text)]"
			>
				Enter the details manually
			</button>
			<div class="flex items-center gap-2">
				<a
					href="/applications/active"
					class="rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
				>
					Cancel
				</a>
				<button
					type="button"
					onclick={runParse}
					disabled={parsing || !fDescription.trim()}
					class="flex items-center gap-2 rounded-md bg-[var(--dash-primary)] px-4 py-2 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:opacity-60"
				>
					<FontAwesomeIcon
						icon={parsing ? faSpinner : faWandMagicSparkles}
						class="h-3.5 w-3.5 {parsing ? 'animate-spin' : ''}"
					/>
					{parsing ? 'Reading…' : 'Extract details'}
				</button>
			</div>
		</div>
	{:else}
		{#if parseWarning}
			<div
				class="flex items-start gap-2 rounded-lg border border-yellow-500/40 bg-[var(--dash-warning-bg,rgba(234,179,8,0.12))] px-3 py-2.5"
			>
				<FontAwesomeIcon
					icon={faExclamationTriangle}
					class="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-500"
				/>
				<p class="text-sm text-[var(--dash-text-secondary)]">{parseWarning}</p>
			</div>
		{:else if didParse}
			<div
				class="flex items-start gap-2 rounded-lg border border-green-500/30 bg-[var(--dash-success-bg,rgba(34,197,94,0.1))] px-3 py-2.5"
			>
				<FontAwesomeIcon
					icon={faCircleCheck}
					class="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--dash-success)]"
				/>
				<p class="text-sm text-[var(--dash-text-secondary)]">
					Extracted from your paste. The description is stored exactly as you pasted it.
				</p>
			</div>
		{/if}

		<form
			method="POST"
			use:enhance={() => {
				creating = true;
				return async ({ update }) => {
					// Action redirects on success; only reached on failure.
					await update();
					creating = false;
				};
			}}
			class="space-y-6"
		>
			<!-- Proves this form was pre-filled from a parse of exactly this
           description, so the server treats the inputs as authoritative
           instead of gap-filling them. Editing the description below
           invalidates it and triggers a re-parse on save. -->
			<input type="hidden" name="parse_token" value={parseToken} />
			<!-- Extraction already ran and failed for this paste. Tells the server
           not to spend another LLM call retrying on submit — the user was told
           to fill it in by hand, so don't stall them. -->
			{#if parseWarning}
				<input type="hidden" name="parse_failed" value="1" />
			{/if}

			<JobFieldsForm bind:fields idPrefix="na" />

			<Card padding="responsive">
				<label for="na-desc" class={labelClass}>Description</label>
				<textarea
					id="na-desc"
					name="job_description"
					rows="10"
					bind:value={fDescription}
					placeholder="Paste the job description…"
					class="{inputClass} resize-y"></textarea>
				<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
					Stored exactly as pasted. Editing it here re-runs extraction when you save, which takes a
					few seconds.
				</p>
			</Card>

			{#if previewGroups.length > 0 || preview?.company_description}
				<Card padding="responsive">
					<p
						class="mb-3 flex items-center gap-1.5 text-xs font-medium text-[var(--dash-text-muted)]"
					>
						<FontAwesomeIcon icon={faListCheck} class="h-3 w-3" />
						Also extracted
					</p>
					<div class="space-y-3">
						{#each previewGroups as group}
							<div>
								<p class="mb-1.5 text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase">
									{group.label}
								</p>
								<div class="flex flex-wrap gap-1.5">
									{#each group.items as item}
										<span
											class="rounded-full border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-0.5 text-xs text-[var(--dash-text-secondary)]"
										>
											{item}
										</span>
									{/each}
								</div>
							</div>
						{/each}
						{#if preview?.company_description}
							<div>
								<p class="mb-1.5 text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase">
									About the company
								</p>
								<p class="text-xs text-[var(--dash-text-secondary)]">
									{preview.company_description}
								</p>
							</div>
						{/if}
					</div>
					<p class="pt-3 text-xs text-[var(--dash-text-muted)]">
						Saved with the job — edit these on the job page afterwards.
					</p>
				</Card>
			{/if}

			<div class="flex items-center justify-between gap-3">
				<button
					type="button"
					onclick={() => (step = 'paste')}
					class="flex items-center gap-1.5 text-sm text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
				>
					<FontAwesomeIcon icon={faArrowLeft} class="h-3 w-3" />
					Back to paste
				</button>
				<div class="flex items-center gap-2">
					<a
						href="/applications/active"
						class="rounded-md border border-[var(--dash-border)] px-3 py-2 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
					>
						Cancel
					</a>
					<button
						type="submit"
						disabled={creating}
						class="flex items-center gap-2 rounded-md bg-[var(--dash-primary)] px-4 py-2 text-sm text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:opacity-60"
					>
						<FontAwesomeIcon icon={faPlus} class="h-3.5 w-3.5" />
						{creating ? 'Creating…' : 'Create application'}
					</button>
				</div>
			</div>
		</form>
	{/if}
</div>
