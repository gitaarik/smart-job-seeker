<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCompass, faTimes } from '@fortawesome/free-solid-svg-icons';
	import Card from '../../components/Card.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import SectionHeader from '../components/SectionHeader.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// The form owns its values from mount on; a failed submit must not reset
	// what was typed.
	const loaded = untrack(() => data);

	let title = $state(loaded.title);
	let location = $state(loaded.location);
	let workLocation = $state<string[]>([...loaded.config.work_location]);
	let jobTypes = $state<string[]>([...loaded.config.job_types]);
	let levels = $state<string[]>([...loaded.config.experience_levels]);
	let locations = $state<string[]>([...loaded.config.locations]);
	let newSkills = $state<string[]>([]);
	let skillInput = $state('');
	let locationInput = $state('');
	let saving = $state(false);

	const existing = new Set(loaded.skills.map((s) => s.toLowerCase()));
	const skillCount = $derived(loaded.skills.length + newSkills.length);
	const placeOnSite = $derived(workLocation.some((w) => w !== 'Remote'));
	const ready = $derived(title.trim().length > 0 && workLocation.length > 0 && jobTypes.length > 0);

	function toggle(list: string[], value: string): string[] {
		return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
	}

	/** Comma or Enter ends a skill, so a pasted list splits on its own. */
	function addSkills(raw: string) {
		for (const part of raw.split(',')) {
			const name = part.trim();
			if (!name) continue;
			const key = name.toLowerCase();
			if (existing.has(key) || newSkills.some((s) => s.toLowerCase() === key)) continue;
			newSkills = [...newSkills, name];
		}
		skillInput = '';
	}

	function onSkillKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			addSkills(skillInput);
		}
	}

	function addLocation() {
		const place = locationInput.trim();
		if (place && !locations.includes(place)) locations = [...locations, place];
		locationInput = '';
	}

	const inputClass =
		'w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none';
	const chipClass =
		'flex items-center gap-1 rounded-lg bg-[var(--dash-bg)] py-1 pr-1 pl-3 text-sm text-[var(--dash-text)]';
</script>

<svelte:head>
	<title>What are you looking for? - Smart Job Seeker</title>
</svelte:head>

<form
	method="POST"
	class="space-y-4"
	use:enhance={({ formData }) => {
		// A skill still in the box counts: nobody expects to press Enter first.
		if (skillInput.trim()) {
			addSkills(skillInput);
			formData.delete('skills');
			for (const s of newSkills) formData.append('skills', s);
		}
		saving = true;
		return async ({ update }) => {
			await update({ reset: false });
			saving = false;
		};
	}}
>
	<SectionHeader title="What are you looking for?" icon={faCompass} />

	<p class="text-sm text-[var(--dash-text-secondary)]">
		A few answers and we can start finding jobs for you.
		{#if data.picksOn}
			Your first picks from company career sites start arriving within about ten minutes of saving.
		{/if}
		You can change all of this later.
	</p>

	{#if data.thin}
		<p
			class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4 text-sm text-[var(--dash-text-secondary)]"
		>
			<span class="font-medium text-[var(--dash-text)]">Have a CV?</span>
			<a
				href={resolve('/(app)/data/(transfer)/profile-import')}
				class="text-[var(--dash-primary)] hover:underline">Add it to your profile</a
			>
			too. These answers are enough to find jobs; your work history is what makes their match scores mean
			something.
		</p>
	{/if}

	<input type="hidden" name="profile_id" value={data.profileId} />
	{#if data.created}<input type="hidden" name="created" value="true" />{/if}
	{#each newSkills as skill (skill)}
		<input type="hidden" name="skills" value={skill} />
	{/each}
	{#each workLocation as w (w)}
		<input type="hidden" name="work_location" value={w} />
	{/each}
	{#each jobTypes as t (t)}
		<input type="hidden" name="job_types" value={t} />
	{/each}
	{#each levels as l (l)}
		<input type="hidden" name="experience_levels" value={l} />
	{/each}
	{#each locations as place (place)}
		<input type="hidden" name="locations" value={place} />
	{/each}

	<Card padding="responsive">
		<label class="block">
			<span class="font-medium text-[var(--dash-text)]">Job title</span>
			<span class="mt-1 block text-sm text-[var(--dash-text-secondary)]">
				The role you want next, as a job posting would name it.
			</span>
			<input
				name="title"
				bind:value={title}
				required
				maxlength="200"
				placeholder="e.g. Senior Backend Developer"
				class="mt-2 {inputClass}"
			/>
		</label>
	</Card>

	<Card padding="responsive">
		<span class="font-medium text-[var(--dash-text)]">Skills</span>
		<span class="mt-1 block text-sm text-[var(--dash-text-secondary)]">
			{#if loaded.skills.length}
				Your profile has {loaded.skills.length}
				{loaded.skills.length === 1 ? 'skill' : 'skills'}. Add any that are missing.
			{:else}
				At least {data.suggestedSkills}, the ones a job posting for this role would ask for.
			{/if}
		</span>
		{#if loaded.skills.length}
			<p class="mt-2 text-sm text-[var(--dash-text-muted)]">
				{loaded.skills.slice(0, 12).join(', ')}{loaded.skills.length > 12 ? ', ...' : ''}
			</p>
		{/if}
		{#if newSkills.length}
			<div class="mt-2 flex flex-wrap gap-2">
				{#each newSkills as skill (skill)}
					<span class={chipClass}>
						{skill}
						<button
							type="button"
							onclick={() => (newSkills = newSkills.filter((s) => s !== skill))}
							class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)]"
							aria-label="Remove {skill}"
						>
							<FontAwesomeIcon icon={faTimes} class="h-3 w-3" />
						</button>
					</span>
				{/each}
			</div>
		{/if}
		<input
			bind:value={skillInput}
			onkeydown={onSkillKeydown}
			onblur={() => addSkills(skillInput)}
			placeholder="Type a skill and press Enter, or paste a comma-separated list"
			aria-label="Add a skill"
			class="mt-2 {inputClass}"
		/>
		{#if skillCount > 0 && skillCount < data.suggestedSkills}
			<p class="mt-2 text-sm text-[var(--dash-text-muted)]">
				{data.suggestedSkills - skillCount} more would help the first picks a lot.
			</p>
		{/if}
	</Card>

	<Card padding="responsive">
		<span class="font-medium text-[var(--dash-text)]">How do you want to work?</span>
		<div class="mt-2 flex flex-wrap gap-4">
			{#each data.options.workLocation as option (option)}
				<label class="flex items-center gap-2 text-sm text-[var(--dash-text)]">
					<input
						type="checkbox"
						checked={workLocation.includes(option)}
						onchange={() => (workLocation = toggle(workLocation, option))}
					/>
					{option}
				</label>
			{/each}
		</div>

		<span class="mt-4 block font-medium text-[var(--dash-text)]">Job types</span>
		<div class="mt-2 flex flex-wrap gap-4">
			{#each data.options.jobTypes as option (option)}
				<label class="flex items-center gap-2 text-sm text-[var(--dash-text)]">
					<input
						type="checkbox"
						checked={jobTypes.includes(option)}
						onchange={() => (jobTypes = toggle(jobTypes, option))}
					/>
					{option}
				</label>
			{/each}
		</div>

		<span class="mt-4 block font-medium text-[var(--dash-text)]">Level</span>
		<span class="mt-1 block text-sm text-[var(--dash-text-secondary)]">
			Optional. Leave it empty to see every level.
		</span>
		<div class="mt-2 flex flex-wrap gap-4">
			{#each data.options.experienceLevels as option (option)}
				<label class="flex items-center gap-2 text-sm text-[var(--dash-text)]">
					<input
						type="checkbox"
						checked={levels.includes(option)}
						onchange={() => (levels = toggle(levels, option))}
					/>
					{option}
				</label>
			{/each}
		</div>
	</Card>

	<Card padding="responsive">
		<label class="block">
			<span class="font-medium text-[var(--dash-text)]">Where do you live?</span>
			<span class="mt-1 block text-sm text-[var(--dash-text-secondary)]">
				City and country. Remote jobs are matched to the country.
			</span>
			<input
				name="location"
				bind:value={location}
				maxlength="200"
				placeholder="e.g. Haarlem, Netherlands"
				class="mt-2 {inputClass}"
			/>
		</label>

		{#if placeOnSite}
			<span class="mt-4 block font-medium text-[var(--dash-text)]">Other places to work</span>
			<span class="mt-1 block text-sm text-[var(--dash-text-secondary)]">
				Optional, for hybrid and on-site jobs outside where you live.
			</span>
			{#if locations.length}
				<div class="mt-2 flex flex-wrap gap-2">
					{#each locations as place (place)}
						<span class={chipClass}>
							{place}
							<button
								type="button"
								onclick={() => (locations = locations.filter((l) => l !== place))}
								class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)]"
								aria-label="Remove {place}"
							>
								<FontAwesomeIcon icon={faTimes} class="h-3 w-3" />
							</button>
						</span>
					{/each}
				</div>
			{/if}
			<input
				bind:value={locationInput}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						addLocation();
					}
				}}
				onblur={addLocation}
				placeholder="Add a city, region or country"
				aria-label="Add a place"
				class="mt-2 {inputClass}"
			/>
		{/if}
	</Card>

	{#if form?.error}
		<p class="text-sm text-[var(--dash-error)]">{form.error}</p>
	{/if}

	<div class="flex items-center justify-between gap-4">
		<a
			href="{resolve('/home')}?profile={data.profileId}{data.created ? '&created=true' : ''}"
			class="text-sm text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
			>Skip for now</a
		>
		<button
			type="submit"
			disabled={!ready || saving}
			class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--dash-primary-hover)] disabled:opacity-50"
		>
			{#if saving}<Spinner />{/if}
			Start finding jobs
		</button>
	</div>
</form>
