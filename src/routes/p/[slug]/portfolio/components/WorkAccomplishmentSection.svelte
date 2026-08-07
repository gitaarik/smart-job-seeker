<script lang="ts">
	import InfoSection from './InfoSection.svelte';
	import { resume } from '$lib/data/resume';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faChartLine,
		faMobile,
		faRocket,
		faShieldAlt,
		faTrophy
	} from '@fortawesome/free-solid-svg-icons';

	// Get the work accomplishment data and Chipta work experience
	const workAccomplishment = resume.workAccomplishment;
	const chiptaWork = resume.work[0];

	// Map accomplishments to their respective icons
	const accomplishmentsWithIcons = workAccomplishment.accomplishments.map((acc, index) => ({
		...acc,
		icon: [faChartLine, faMobile, faShieldAlt][index]
	}));
</script>

<InfoSection title="Most Impressive Work Accomplishment" icon={faTrophy}>
	<div class="space-y-8">
		<!-- Introduction -->
		<div class="from-frost to-mist border-ocean/20 rounded-xl border bg-gradient-to-r p-6">
			<div class="flex items-start gap-4">
				<div class="flex-shrink-0">
					<FontAwesomeIcon icon={faTrophy} class="h-8 w-8 text-amber-500" />
				</div>
				<div>
					<h3 class="text-slate mb-3 text-xl font-semibold">
						{workAccomplishment.title}
					</h3>
					<p class="text-slate/80 text-base leading-relaxed">
						{workAccomplishment.description}
					</p>
				</div>
			</div>
		</div>

		<!-- Key Accomplishments -->
		<div class="space-y-6">
			<h4 class="text-slate border-cloud border-b pb-2 text-lg font-semibold">
				Three Pillars of Success
			</h4>

			{#each accomplishmentsWithIcons as accomplishment}
				<div
					class="border-cloud rounded-xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
				>
					<div class="flex items-start gap-4">
						<div class="bg-frost flex-shrink-0 rounded-lg p-3">
							<FontAwesomeIcon icon={accomplishment.icon} class="text-ocean h-6 w-6" />
						</div>
						<div class="flex-1">
							<h5 class="text-slate mb-3 text-lg font-semibold">
								{accomplishment.title}
							</h5>
							<p class="text-slate/80 mb-4 leading-relaxed">
								{accomplishment.description}
							</p>
							<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
								<div class="bg-frost/50 rounded-lg p-3">
									<div class="text-teal text-sm font-medium">Impact</div>
									<div class="text-slate">{accomplishment.impact}</div>
								</div>
								<div class="bg-frost/50 rounded-lg p-3">
									<div class="text-teal text-sm font-medium">Metrics</div>
									<div class="text-slate">{accomplishment.metrics}</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Overall Impact -->
		<div class="from-teal/5 to-ocean/5 border-teal/20 rounded-xl border bg-gradient-to-r p-6">
			<div class="flex items-start gap-4">
				<div class="flex-shrink-0">
					<FontAwesomeIcon icon={faRocket} class="text-teal h-6 w-6" />
				</div>
				<div>
					<h4 class="text-slate mb-3 text-lg font-semibold">Long-term Strategic Impact</h4>
					<p class="text-slate/80 leading-relaxed">
						{workAccomplishment.impact}
					</p>
				</div>
			</div>
		</div>

		<!-- Technologies Used -->
		<div class="border-cloud border-t pt-6">
			<h4 class="text-slate mb-4 text-base font-semibold">Key Technologies Used</h4>
			<div class="flex flex-wrap gap-2">
				{#each chiptaWork.technologies.slice(0, 12) as tech}
					<span class="bg-frost text-slate border-ocean/20 rounded-full border px-3 py-1 text-sm">
						{tech}
					</span>
				{/each}
			</div>
		</div>
	</div>
</InfoSection>
