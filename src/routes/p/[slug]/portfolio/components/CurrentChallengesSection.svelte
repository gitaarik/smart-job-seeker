<script lang="ts">
	import InfoSection from './InfoSection.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faBullseye, faRoad } from '@fortawesome/free-solid-svg-icons';
	import { resume } from '$lib/data/resume';
</script>

<InfoSection title="Current Challenges" icon={faRoad}>
	<div class="space-y-6">
		{#each resume.currentChallenges as challenge, index (index)}
			<div class="rounded-r-lg border-l-2 border-blue-400 bg-blue-50/30 p-4 pb-4 pl-4">
				<div class="mb-3">
					<h3 class="text-slate mb-2 text-lg font-semibold">
						{challenge.title}
					</h3>
					<p class="text-slate/80 mb-3 leading-relaxed">
						{challenge.description}
					</p>
				</div>

				<div class="border-l-2 border-green-400 bg-green-50/50 py-2 pl-3">
					<div class="flex items-start">
						<div class="mt-0.5 mr-2 flex-shrink-0">
							<FontAwesomeIcon icon={faBullseye} class="h-4 w-4 text-green-600" />
						</div>
						<div>
							<h4 class="mb-1 text-sm font-medium text-green-800">My approach:</h4>
							<p class="text-sm leading-relaxed text-green-700">
								{challenge.approach}
							</p>
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>

	<div class="mt-6 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
		<p class="text-sm leading-relaxed text-amber-800">
			<strong>Transparency note:</strong> I believe in being open about current challenges as they represent
			opportunities for growth and collaboration. I'm actively working on these areas and welcome discussions
			about how we can address them together.
		</p>
	</div>
</InfoSection>
