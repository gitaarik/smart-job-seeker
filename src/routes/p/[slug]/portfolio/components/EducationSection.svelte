<script lang="ts">
	import InfoSection from './InfoSection.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faBook,
		faBuilding,
		faCalendarAlt,
		faExternalLinkAlt,
		faGraduationCap,
		faLink,
		faMapMarkerAlt
	} from '@fortawesome/free-solid-svg-icons';

	import { formatDateRangeVerbose } from '$lib/tools/date-utils';
	import { getImg } from '$lib/tools/get-img';

	let props = $props();
	const profile = props.profile;
</script>

<InfoSection title="Education" icon={faGraduationCap}>
	<div>
		{#each profile.educations as edu, index (index)}
			<div class="break-inside-avoid {index === 0 ? 'mt-12 print:mt-0' : ''}">
				<header class="mb-6 print:mb-4">
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<h3 class="text-ocean mb-1 text-2xl font-semibold">
								{edu.institution}
							</h3>

							<ul class="inline-grid list-none grid-cols-2 gap-x-8 gap-y-2 p-0 text-sm">
								<li class="flex items-center">
									<FontAwesomeIcon icon={faBook} class="mr-1 h-3 w-3 flex-shrink-0" />
									<span>{edu.area}</span>
								</li>

								{#if edu.graduation_year}
									<li class="flex items-center">
										<FontAwesomeIcon icon={faGraduationCap} class="mr-1 h-3 w-3 flex-shrink-0" />
										<span>Graduated in {edu.graduation_year}</span>
									</li>
								{/if}

								<li class="flex items-center">
									<FontAwesomeIcon icon={faMapMarkerAlt} class="mr-1 h-3 w-3 flex-shrink-0" />
									<span>{edu.location}</span>
								</li>

								<li class="flex items-center">
									<FontAwesomeIcon icon={faCalendarAlt} class="mr-1 h-3 w-3 flex-shrink-0" />
									<span>
										{formatDateRangeVerbose(edu.start_date, edu.end_date)}
									</span>
								</li>

								<li class="flex items-center">
									<FontAwesomeIcon icon={faBuilding} class="mr-1 h-3 w-3 flex-shrink-0" />
									<span>{edu.study_type}</span>
								</li>

								{#if edu.url}
									<li class="flex items-center">
										<FontAwesomeIcon icon={faLink} class="mr-1 h-3 w-3 flex-shrink-0" />
										<a href={edu.url} target="_blank" class="text-ocean hover:text-teal"
											>{edu.url.replace('https://', '').replace('www.', '')}</a
										>
									</li>
								{/if}
							</ul>
						</div>

						{#if edu.logo}
							<div class="ml-4 flex-shrink-0">
								<img
									src={getImg(edu.logo)}
									alt="{edu.institution} Logo"
									class="border-aqua h-22 w-auto rounded border"
								/>
							</div>
						{/if}
					</div>
				</header>

				{#if edu.summary}
					<div class="space-y-3 print:space-y-2">
						<p class="leading-relaxed print:text-sm">{edu.summary}</p>
					</div>
				{/if}
			</div>
			{#if index < profile.educations.length - 1}
				<hr class="border-cloud my-12" />
			{/if}
		{/each}
	</div>
</InfoSection>
