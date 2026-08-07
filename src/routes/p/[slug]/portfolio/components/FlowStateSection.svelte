<script lang="ts">
	import InfoSection from './InfoSection.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faClock, faPlus, faWater } from '@fortawesome/free-solid-svg-icons';
	import { resume } from '$lib/data/resume';
</script>

<InfoSection title="Flow State & Ideal Activities" icon={faWater}>
	<div class="space-y-8">
		<p class="text-slate/80 mb-8 text-center text-lg italic">
			"{resume.flowState.question}"
		</p>

		<!-- When I Get Lost in Work -->
		<div>
			<div class="mb-6 flex items-center">
				<FontAwesomeIcon icon={faClock} class="mr-3 h-5 w-5 text-blue-600" />
				<h3 class="text-slate text-xl font-semibold">When I Get Lost in Work (The Good Kind)</h3>
			</div>

			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				{#each resume.flowState.lostInWork as activity, index (index)}
					<div class="rounded-r-lg border-l-4 border-blue-400 bg-blue-50/40 p-5 pl-5">
						<div class="mb-3 flex items-center">
							<FontAwesomeIcon icon={activity.icon} class="mr-3 h-5 w-5 text-blue-600" />
							<h4 class="text-slate font-semibold">{activity.title}</h4>
						</div>

						<p class="text-slate/80 mb-3 text-sm leading-relaxed">
							{activity.description}
						</p>

						<div class="rounded-lg border border-blue-200 bg-blue-100/60 p-3">
							<p class="text-xs leading-relaxed text-blue-800 italic">
								<strong>Example:</strong>
								{activity.example}
							</p>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Activities I Want More Of -->
		<div>
			<div class="mb-6 flex items-center">
				<FontAwesomeIcon icon={faPlus} class="mr-3 h-5 w-5 text-green-600" />
				<h3 class="text-slate text-xl font-semibold">Activities I Want More Of</h3>
			</div>

			<div class="space-y-5">
				{#each resume.flowState.wantMoreOf as activity, index (index)}
					<div
						class="rounded-lg border border-green-200 bg-gradient-to-r from-green-50/50 to-teal-50/50 p-5"
					>
						<div class="mb-3">
							<h4 class="mb-2 text-lg font-semibold text-green-800">
								{activity.title}
							</h4>
							<p class="mb-3 leading-relaxed text-green-700">
								{activity.description}
							</p>
						</div>

						<div class="border-l-4 border-green-500 bg-green-100/60 py-2 pl-4">
							<p class="text-sm text-green-800">
								<strong>Why this matters to me:</strong>
								{activity.why}
							</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<div class="mt-8 rounded-lg border border-purple-200 bg-purple-50/50 p-4">
		<p class="text-sm leading-relaxed text-purple-800">
			<strong>Connection insight:</strong> The work that puts me in flow state involves complex problem-solving,
			creative technical challenges, and meaningful impact. The activities I want more of represent the
			natural evolution of these interests toward leadership, innovation, and community contribution.
		</p>
	</div>
</InfoSection>
