<script lang="ts">
	import InfoSection from './InfoSection.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faArrowDown, faArrowUp, faEye, faLightbulb } from '@fortawesome/free-solid-svg-icons';
	import { resume } from '$lib/data/resume';
</script>

<InfoSection title="Candid Self-Reflection" icon={faEye}>
	<div class="space-y-8">
		<!-- Biggest Positive -->
		<div class="rounded-r-lg border-l-4 border-green-500 bg-green-50/40 p-6 pl-6">
			<div class="mb-4 flex items-center">
				<FontAwesomeIcon icon={faArrowUp} class="mr-3 h-5 w-5 text-green-600" />
				<h3 class="text-xl font-semibold text-green-800">Biggest Positive in My Success</h3>
			</div>

			<div class="space-y-4">
				<div>
					<h4 class="mb-2 text-lg font-medium text-green-800">
						{resume.selfReflection.biggestPositive.title}
					</h4>
					<p class="mb-4 leading-relaxed text-green-700">
						{resume.selfReflection.biggestPositive.description}
					</p>
				</div>

				<div class="rounded-lg border border-green-200 bg-green-100/60 p-4">
					<h5 class="mb-2 font-medium text-green-800">Impact on my career:</h5>
					<p class="text-sm leading-relaxed text-green-700">
						{resume.selfReflection.biggestPositive.impact}
					</p>
				</div>
			</div>
		</div>

		<!-- Biggest Hindrance -->
		<div class="rounded-r-lg border-l-4 border-red-500 bg-red-50/40 p-6 pl-6">
			<div class="mb-4 flex items-center">
				<FontAwesomeIcon icon={faArrowDown} class="mr-3 h-5 w-5 text-red-600" />
				<h3 class="text-xl font-semibold text-red-800">What Has Hindered My Success</h3>
			</div>

			<div class="space-y-4">
				<div>
					<h4 class="mb-2 text-lg font-medium text-red-800">
						{resume.selfReflection.biggestHindrance.title}
					</h4>
					<p class="mb-4 leading-relaxed text-red-700">
						{resume.selfReflection.biggestHindrance.description}
					</p>
				</div>

				<div class="rounded-lg border border-red-200 bg-red-100/60 p-4">
					<h5 class="mb-2 font-medium text-red-800">How it has affected me:</h5>
					<p class="text-sm leading-relaxed text-red-700">
						{resume.selfReflection.biggestHindrance.impact}
					</p>
				</div>
			</div>
		</div>

		<!-- Growth Insight -->
		<div class="rounded-r-lg border-l-4 border-blue-500 bg-blue-50/40 p-6 pl-6">
			<div class="mb-4 flex items-center">
				<FontAwesomeIcon icon={faLightbulb} class="mr-3 h-5 w-5 text-blue-600" />
				<h3 class="text-xl font-semibold text-blue-800">Key Insight</h3>
			</div>

			<p class="leading-relaxed text-blue-700">
				{resume.selfReflection.growth.description}
			</p>
		</div>
	</div>

	<div class="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-4">
		<p class="text-sm leading-relaxed text-gray-700 italic">
			"This level of self-awareness and honesty about both strengths and areas for improvement
			demonstrates my commitment to continuous growth and my ability to work constructively with
			teams and stakeholders who value authentic, reflective leadership."
		</p>
	</div>
</InfoSection>
