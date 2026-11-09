<script lang="ts">
	/**
	 * Selected work: the projects the applicant featured, each printed in full.
	 *
	 * These are the ones they chose to be judged by, so nothing here hides
	 * behind a click; the other projects step back to a line each in their own
	 * sections (see `careerView` in site-lists.ts). A role project says which
	 * employer it was for, since it is lifted out from under its role.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCalendarAlt, faCircleCheck, faUserTie } from '@fortawesome/free-solid-svg-icons';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import { formatDateRangeVerbose } from '$lib/tools/date-utils';
	import type { FeaturedProject, Row, SiteLists } from '../site-lists';
	import InfoBoxes from './InfoBoxes.svelte';
	import TechTags from './TechTags.svelte';

	interface Props {
		items: FeaturedProject[];
		/** The site's filter, for each project's technologies. */
		show: SiteLists['show'];
		/** The line above a side project's name, where a role project names its employer. */
		sideLabel: string;
	}

	let { items, show, sideLabel }: Props = $props();
</script>

<div class="space-y-6">
	{#each items as { kind, project: p } (`${kind}-${p.id}`)}
		{@const technologies = show(
			kind === 'role' ? p.work_experience_project_technologies : p.side_project_technologies
		)}
		{@const link = p.url || (kind === 'side' ? p.repo_url : null)}
		<article
			class="featured-project rounded-sm border border-l-4 border-(--pf-line) border-l-(--pf-bright) bg-(--pf-shade) p-5 min-[40rem]:p-7"
		>
			<p class="mb-2 text-xs tracking-wide uppercase opacity-70">
				{kind === 'role' ? p.company : sideLabel}
			</p>
			<div
				class="mb-3 flex flex-col min-[40rem]:flex-row min-[40rem]:items-baseline min-[40rem]:justify-between min-[40rem]:gap-4"
			>
				<h3 class="pf-subhead text-[1.5rem]">
					{#if link}
						<ExternalLink href={link} class="hover:text-(--pf-accent-text)">{p.name}</ExternalLink>
					{:else}
						{p.name}
					{/if}
				</h3>
				{#if p.start_date}
					<div class="mt-1 flex shrink-0 items-center text-sm text-(--pf-muted) min-[40rem]:mt-0">
						<FontAwesomeIcon icon={faCalendarAlt} class="mr-1 h-3 w-3" />
						<span>{formatDateRangeVerbose(p.start_date, p.end_date)}</span>
					</div>
				{/if}
			</div>
			{#if p.project_role}
				<div class="flex items-center text-sm">
					<FontAwesomeIcon icon={faUserTie} class="mr-2 h-3 w-3 flex-shrink-0" />
					<span>{p.project_role}</span>
				</div>
			{/if}

			<div class="mt-5 space-y-6">
				{#if kind === 'role'}
					{#if p.description}
						<p class="leading-relaxed whitespace-pre-line">{p.description}</p>
					{/if}
					{#if p.outcome}
						<div>
							<h4 class="mb-3 flex items-center text-lg font-semibold">
								<FontAwesomeIcon icon={faCircleCheck} class="mr-2 h-4 w-4 text-emerald-500" />
								Outcome & Impact
							</h4>
							<p class="leading-relaxed whitespace-pre-line">{p.outcome}</p>
						</div>
					{/if}
				{:else}
					{#if p.summary}
						<p class="leading-relaxed whitespace-pre-line">{p.summary}</p>
					{/if}
					{#if p.side_project_achievements?.length}
						<InfoBoxes
							items={p.side_project_achievements.map((a: Row) => ({
								key: a.id,
								description: a.description
							}))}
						/>
					{/if}
				{/if}
				<TechTags names={technologies.map((t) => t.name)} />
			</div>
		</article>
	{/each}
</div>
