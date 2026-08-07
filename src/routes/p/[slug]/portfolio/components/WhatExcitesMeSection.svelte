<script lang="ts">
	import InfoSection from './InfoSection.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faFire, faThumbsDown, faThumbsUp } from '@fortawesome/free-solid-svg-icons';
	import { resume } from '$lib/data/resume';
</script>

<InfoSection title="What Excites Me" icon={faFire}>
	<div class="space-y-8">
		<!-- What Excites Me -->
		<div>
			<div class="mb-4 flex items-center">
				<h3 class="text-slate text-lg font-semibold">What Energizes Me</h3>
				<FontAwesomeIcon icon={faThumbsUp} class="ml-2 h-5 w-5 text-green-600" />
			</div>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				{#each resume.whatExcitesMe.excites as item, index (index)}
					<div class="rounded-r-lg border-l-2 border-green-400 bg-green-50/30 p-4 pb-4 pl-4">
						<div class="mb-2 flex items-start">
							<div class="mt-1 mr-3 flex-shrink-0">
								<FontAwesomeIcon icon={item.icon} class="h-4 w-4 text-green-600" />
							</div>
							<div>
								<h4 class="text-slate mb-1 font-medium">{item.title}</h4>
								<p class="text-slate/80 text-sm leading-relaxed">
									{item.description}
								</p>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- What Doesn't Excite Me -->
		<div>
			<div class="mb-4 flex items-center">
				<h3 class="text-slate text-lg font-semibold">What Doesn't Energize Me</h3>
				<FontAwesomeIcon icon={faThumbsDown} class="ml-2 h-5 w-5 text-red-600" />
			</div>
			<div class="space-y-3">
				{#each resume.whatExcitesMe.doesntExcite as item, index (index)}
					<div class="rounded-r-lg border-l-2 border-red-400 bg-red-50/30 p-3 pb-3 pl-4">
						<h4 class="text-slate mb-1 font-medium">{item.title}</h4>
						<p class="text-slate/80 text-sm leading-relaxed">
							{item.description}
						</p>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<div class="mt-6 rounded-lg border border-purple-200 bg-purple-50/50 p-4">
		<p class="text-sm leading-relaxed text-purple-800">
			<strong>Balance note:</strong> While I have preferences, I understand that all aspects of development
			are important. I'm committed to delivering quality work across all areas, even those that may not
			be my primary sources of excitement.
		</p>
	</div>
</InfoSection>
