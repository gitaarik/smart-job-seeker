<script lang="ts">
	import InfoSection from './InfoSection.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faArrowRight, faListOl } from '@fortawesome/free-solid-svg-icons';
	import { resume } from '$lib/data/resume';
</script>

<InfoSection title="Career Priorities" icon={faListOl}>
	<div class="space-y-6">
		<p class="text-slate/80 mb-6 italic">
			"What are your top priorities in your career at this time?"
		</p>

		{#each resume.careerPriorities as priority, index (priority.priority)}
			<div
				class="border-ocean/20 rounded-lg border bg-gradient-to-r from-blue-50/30 to-teal-50/30 p-5"
			>
				<div class="mb-4 flex items-start">
					<div
						class="bg-ocean mt-1 mr-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
					>
						{priority.priority}
					</div>
					<div class="mb-2 flex flex-grow items-center">
						<FontAwesomeIcon icon={priority.icon} class="text-ocean mr-3 h-5 w-5" />
						<h3 class="text-slate text-lg font-semibold">{priority.title}</h3>
					</div>
				</div>

				<div class="ml-12 space-y-3">
					<p class="text-slate leading-relaxed">{priority.description}</p>

					<div class="rounded-r border-l-2 border-teal-400 bg-white/60 py-2 pl-4">
						<div class="flex items-start">
							<FontAwesomeIcon
								icon={faArrowRight}
								class="mt-0.5 mr-2 h-4 w-4 flex-shrink-0 text-teal-600"
							/>
							<div>
								<h4 class="mb-1 text-sm font-medium text-teal-800">Current actions:</h4>
								<p class="text-sm leading-relaxed text-teal-700">
									{priority.actions}
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>

	<div class="mt-8 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
		<p class="text-sm leading-relaxed text-amber-800">
			<strong>Timeframe:</strong> These priorities reflect my current focus for the next 12-24 months.
			I regularly reassess and adjust based on market opportunities, personal growth, and changing life
			circumstances.
		</p>
	</div>
</InfoSection>
