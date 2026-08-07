<script lang="ts">
	import InfoSection from './InfoSection.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faBuilding, faExclamationCircle, faThumbsUp } from '@fortawesome/free-solid-svg-icons';
	import { resume } from '$lib/data/resume';
</script>

<InfoSection title="Ideal Company" icon={faBuilding}>
	<div class="space-y-8">
		<!-- Required Section -->
		<div>
			<div class="mb-4 flex items-center">
				<h3 class="text-slate text-lg font-semibold">Required</h3>
				<FontAwesomeIcon icon={faExclamationCircle} class="ml-2 h-5 w-5" />
			</div>
			<div class="space-y-4">
				{#each resume.idealCompany.required as item, index (index)}
					<div class="flex items-start">
						<div class="mr-2 flex-shrink-0">
							<FontAwesomeIcon icon={item.icon} class="text-ocean mt-0.5 h-5 w-5" />
						</div>
						<p class="text-slate leading-relaxed">{item.description}</p>
					</div>
				{/each}
			</div>
		</div>

		<!-- Nice to Have Section -->
		<div>
			<div class="mb-4 flex items-center">
				<h3 class="text-slate text-lg font-semibold">Nice to Have</h3>
				<FontAwesomeIcon icon={faThumbsUp} class="ml-2 h-5 w-5" />
			</div>
			<div class="space-y-4">
				{#each resume.idealCompany.niceToHave as item, index (index)}
					<div class="flex items-start">
						<div class="mr-2 flex-shrink-0">
							<FontAwesomeIcon icon={item.icon} class="text-ocean mt-0.5 h-5 w-5" />
						</div>
						<p class="text-slate leading-relaxed">{item.description}</p>
					</div>
				{/each}
			</div>
		</div>
	</div>
</InfoSection>
