<script lang="ts">
	/**
	 * A role project's own fields.
	 *
	 * This was an accordion row on the role's page — five components deep inside
	 * a section inside a page, which is why it had run to three hundred lines by
	 * the time it grew source scanning, notes and proposals. Nothing here is new;
	 * it is the same editor with room around it.
	 *
	 * The saves still go through `sectionRows`, with this project as the only row.
	 * A section of one is a slightly odd thing to say, but the alternative is a
	 * second write path for the same table — and this one already knows the
	 * draft/POST/PATCH rules, the body mapping and the per-row indicator.
	 */
	import type { PageData } from './$types';
	import { resolve } from '$app/paths';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import TranslatableField from '$lib/components/TranslatableField.svelte';
	import ProjectRepoFetch from '$lib/components/ProjectRepoFetch.svelte';
	import ProjectSuggestions from '$lib/components/ProjectSuggestions.svelte';
	import { sectionRows } from '$lib/components/section-rows.svelte';
	import Card from '../../../../../../components/Card.svelte';
	import ProjectTechnologies from '../../../../../components/ProjectTechnologies.svelte';
	import ProjectSourcesPointer from '../../../../../components/ProjectSourcesPointer.svelte';
	import {
		blankProject,
		projectBody,
		projectIsWorthCreating,
		toProjectData,
		type ProjectData
	} from '../../../../../components/work-experience-projects';

	let { data }: { data: PageData } = $props();

	const sourcesHref = $derived(
		resolve('/(app)/profile/(data)/work-experience/[id]/projects/[pid]/sources', {
			id: String(data.experience.id),
			pid: String(data.project.id)
		})
	);

	const store = sectionRows({
		resource: 'work_experience_project',
		parentKey: 'work_experience_id',
		parentId: data.experience.id,
		profileId: data.profileId,
		initial: [data.project],
		toData: toProjectData,
		blank: blankProject,
		toBody: projectBody,
		canCreate: projectIsWorthCreating
	});

	const row = $derived(store.rows[0]);
	const technologies = $derived(data.project.work_experience_project_technologies ?? []);

	const inputClass =
		'w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent';

	function set(patch: Partial<ProjectData>) {
		store.update(row, patch);
	}

	/** The chips component owns its own store, so proposals reach it by ref. */
	let technologiesRef = $state<{ addTechnologies: (names: string[]) => void } | null>(null);

	/**
	 * An answered question lands in `outcome`, whose placeholder is literally
	 * "What changed because of it?" — this table has no achievement rows, and
	 * that field is the same idea in singular form. Appended rather than
	 * replaced: a role's project can have more than one thing worth saying, and
	 * silently overwriting what is there would be the worse failure.
	 */
	function applyDraftedAchievement(achievement: string) {
		const current = (row.data.outcome ?? '').trim();
		set({ outcome: current ? `${current}\n${achievement}` : achievement });
		row.field.flush();
	}
</script>

<div class="space-y-6">
	<Card padding="lg">
		<div class="mb-4 flex items-center gap-3">
			<h2 class="text-lg font-semibold text-[var(--dash-text)]">Details</h2>
			<AutoSaveIndicator field={row.field} idleLabel="Saves as you type" />
		</div>

		<div class="space-y-4">
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<TranslatableField
					entity="work_experience_project"
					id={row.id ?? 0}
					field="name"
					label="Project Name"
					required
					bind:value={() => row.data.name, (v) => set({ name: v })}
					onblur={row.field.flush}
					placeholder="e.g. Payments rewrite"
				/>
				<div>
					<label for="proj-url" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						URL
					</label>
					<input
						id="proj-url"
						type="url"
						value={row.data.url}
						oninput={(e) => set({ url: e.currentTarget.value })}
						onblur={row.field.flush}
						placeholder="https://…"
						class={inputClass}
					/>
				</div>
				<div>
					<label for="proj-repo" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						Repo URL
					</label>
					<input
						id="proj-repo"
						type="url"
						value={row.data.repo_url}
						oninput={(e) => set({ repo_url: e.currentTarget.value })}
						onblur={row.field.flush}
						placeholder="https://github.com/…"
						class={inputClass}
					/>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="proj-start" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
							Start Date
						</label>
						<input
							id="proj-start"
							type="date"
							value={row.data.start_date}
							onchange={(e) => set({ start_date: e.currentTarget.value })}
							class={inputClass}
						/>
					</div>
					<div>
						<label for="proj-end" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
							End Date
						</label>
						<input
							id="proj-end"
							type="date"
							value={row.data.end_date}
							onchange={(e) => set({ end_date: e.currentTarget.value })}
							class={inputClass}
						/>
					</div>
				</div>
			</div>

			<TranslatableField
				entity="work_experience_project"
				id={row.id ?? 0}
				field="description"
				label="Description"
				multiline
				rows={4}
				bind:value={() => row.data.description, (v) => set({ description: v })}
				onblur={row.field.flush}
				placeholder="What was the project and your role in it?"
			/>

			<TranslatableField
				entity="work_experience_project"
				id={row.id ?? 0}
				field="outcome"
				label="Outcome"
				multiline
				rows={3}
				bind:value={() => row.data.outcome, (v) => set({ outcome: v })}
				onblur={row.field.flush}
				placeholder="What changed because of it?"
			/>
		</div>

		<ProjectSourcesPointer count={data.sourceCount} href={sourcesHref} />
		<!--
			The two proposal surfaces sit with the fields they fill, not on the
			Files & code tab that feeds them. A proposal you cannot see land is a
			proposal you have to go and check.
		-->
		<ProjectRepoFetch
			kind="work_experience_project"
			projectId={data.project.id}
			repoUrl={row.data.repo_url ?? ''}
			current={{
				name: row.data.name ?? '',
				url: row.data.url ?? '',
				description: row.data.description ?? '',
				start_date: row.data.start_date ?? '',
				end_date: row.data.end_date ?? ''
			}}
			currentTechnologies={technologies.map((t) => t.name ?? '').filter(Boolean)}
			onApply={(values: Record<string, string>) => {
				set(values as Partial<ProjectData>);
				row.field.flush();
			}}
			onApplyTechnologies={(names: string[]) => technologiesRef?.addTechnologies(names)}
			onSetRepoUrl={(v: string) => {
				set({ repo_url: v });
				row.field.flush();
			}}
		/>
		<ProjectSuggestions
			kind="work_experience_project"
			projectId={data.project.id}
			currentSummary={row.data.description ?? ''}
			currentTechnologies={technologies.map((t) => t.name ?? '').filter(Boolean)}
			currentAchievement={row.data.outcome ?? ''}
			summaryLabel="Description"
			achievementLabel="Outcome"
			onApplySummary={(v) => {
				set({ description: v });
				row.field.flush();
			}}
			onApplyTechnologies={(names) => technologiesRef?.addTechnologies(names)}
			onApplyAchievement={applyDraftedAchievement}
		/>
	</Card>

	<Card padding="lg">
		<ProjectTechnologies
			bind:this={technologiesRef}
			projectId={data.project.id}
			profileId={data.profileId}
			initial={technologies}
		/>
	</Card>
</div>
