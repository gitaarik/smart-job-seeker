<script lang="ts">
	import InfoSection from './InfoSection.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { faCalendar, faCode, faExternalLinkAlt, faStar } from '@fortawesome/free-solid-svg-icons';
	import { resume } from '$lib/data/resume';
	import { formatDateRangeVerbose } from '$lib/tools/date-utils';
	import { formatProjectUrl } from '$lib/tools/url-utils';
	import InfoBoxes from '../components/InfoBoxes.svelte';
	import TechTag from '../components/TechTag.svelte';

	let props = $props();
	const profile = props.profile;
</script>

<InfoSection title="Side Projects" icon={faCode}>
	<div>
		{#each profile.side_projects as project, index (project.name)}
			<div class="break-inside-avoid {index === 0 ? 'mt-10' : ''}">
				<header class="mb-4">
					<h3 class="text-ocean text-2xl font-semibold">
						{project.name}
					</h3>
				</header>

				<p class="leading-relaxed print:text-sm">{project.summary}</p>

				{#if project.url || project.repo_url}
					<div class="mt-6 flex flex-wrap items-center justify-start gap-3">
						{#if project.url}
							{@const { isGithub, displayLabel } = formatProjectUrl(project.url)}
							<a
								href={project.url}
								target="_blank"
								class="bg-ocean hover:bg-ocean/85 inline-flex items-center gap-2 rounded-lg px-5 py-3 text-white transition-all"
							>
								<FontAwesomeIcon icon={isGithub ? faGithub : faExternalLinkAlt} size="lg" />

								<span class="nowrap font-medium">
									{displayLabel}
								</span>

								{#if project.stars && isGithub && !project.repo_url}
									<span class="ml-2 flex items-center gap-1 border-l border-white/30 pl-2">
										<FontAwesomeIcon icon={faStar} class="text-yellow-500" />
										<span>{project.stars}</span>
									</span>
								{/if}
							</a>
						{/if}

						{#if project.repo_url}
							{@const repo = formatProjectUrl(project.repo_url)}
							<a
								href={project.repo_url}
								target="_blank"
								class="border-ocean text-ocean hover:bg-ocean/10 inline-flex items-center gap-2 rounded-lg border px-5 py-3 transition-all"
							>
								<FontAwesomeIcon icon={faGithub} size="lg" />

								<span class="nowrap font-medium">
									{repo.displayLabel}
								</span>

								{#if project.stars}
									<span class="border-ocean/30 ml-2 flex items-center gap-1 border-l pl-2">
										<FontAwesomeIcon icon={faStar} class="text-yellow-500" />
										<span>{project.stars}</span>
									</span>
								{/if}
							</a>
						{/if}
					</div>
				{/if}

				{#if project.side_project_achievements.length}
					<h4 class="mt-6 mb-3 text-lg font-semibold">Highlights:</h4>
					<InfoBoxes items={project.side_project_achievements} />
				{/if}

				{#if project.side_project_technologies.length}
					<div class="mt-4">
						<h4 class="mb-3 text-lg font-semibold print:mb-2 print:text-base">
							Technologies Used:
						</h4>
						<ul class="flex flex-wrap gap-2 print:gap-[5px]">
							{#each project.side_project_technologies as tech (tech.name)}
								<TechTag tech={tech.name} />
							{/each}
						</ul>
					</div>
				{/if}
			</div>

			{#if index < profile.side_projects.length - 1}
				<hr class="border-cloud my-12" />
			{/if}
		{/each}
	</div>
</InfoSection>
