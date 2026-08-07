<script lang="ts">
	import InfoSection from './InfoSection.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faExclamationTriangle, faLightbulb } from '@fortawesome/free-solid-svg-icons';
	import { resume } from '$lib/data/resume';
</script>

<InfoSection title="Areas for Growth" icon={faExclamationTriangle}>
	<div class="space-y-6">
		{#each resume.weaknesses as weakness, index (index)}
			<div class="rounded-r-lg border-l-2 border-orange-400 bg-orange-50/30 p-4 pb-4 pl-4">
				<div class="mb-3">
					<h3 class="text-slate mb-2 text-lg font-semibold">
						{weakness.title}
					</h3>
					<p class="text-slate/80 mb-3 leading-relaxed">
						{weakness.description}
					</p>
				</div>

				<div class="border-l-2 border-green-400 bg-green-50/50 py-2 pl-3">
					<div class="flex items-start">
						<div class="mt-0.5 mr-2 flex-shrink-0">
							<FontAwesomeIcon icon={faLightbulb} class="h-4 w-4 text-green-600" />
						</div>
						<div>
							<h4 class="mb-1 text-sm font-medium text-green-800">How I'm addressing it:</h4>
							<p class="text-sm leading-relaxed text-green-700">
								{weakness.mitigation}
							</p>
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>

	<div class="mt-6 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
		<p class="text-sm leading-relaxed text-blue-800">
			<strong>Self-awareness note:</strong> I believe acknowledging areas for improvement is crucial for
			professional growth. These weaknesses are areas I actively work on, and I welcome feedback and mentorship
			to continue developing in these areas.
		</p>
	</div>
</InfoSection>
