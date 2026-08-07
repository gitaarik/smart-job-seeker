<script lang="ts">
	import InfoSection from './InfoSection.svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faBrain,
		faChartBar,
		faPalette,
		faRobot,
		faRocket,
		faServer
	} from '@fortawesome/free-solid-svg-icons';
	import { resume } from '$lib/data/resume';

	let activeVariation = 'hybrid';

	const variations = [
		{
			id: 'hybrid',
			label: 'AI-Driven Leader',
			icon: faBrain
		},
		{
			id: 'general',
			label: 'Technical Leadership',
			icon: faRocket
		},
		{
			id: 'datascience',
			label: 'Data Science',
			icon: faChartBar
		},
		{
			id: 'aiml',
			label: 'AI/ML Specialist',
			icon: faRobot
		},
		{
			id: 'backend',
			label: 'Backend Specialist',
			icon: faServer
		},
		{
			id: 'frontend',
			label: 'Frontend Specialist',
			icon: faPalette
		}
	];

	function handleVariationClick(variationId: string) {
		activeVariation = variationId;
	}

	// Convert markdown-style bold text to HTML
	function formatContent(content: string): string {
		// Escape BEFORE adding markup. The result goes through {@html} on a public
		// portfolio page, and the content is user-authored — so without this, a
		// profile containing `<img src=x onerror=...>` executes for every visitor.
		// Same order as $lib/utils/linkify: escape, then add the markup we intend.
		const escaped = content
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');

		return escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
	}
</script>

<InfoSection title="Me in 5 Years" icon={faRocket}>
	<!-- Career Path Navigation Menu -->
	<div class="mb-6 print:hidden">
		<nav class="bg-frost/50 border-ocean/30 rounded-lg border p-2">
			<div class="flex flex-wrap gap-1">
				{#each variations as variation}
					<button
						class="
              flex items-center rounded-md px-3 py-2 text-sm transition-colors duration-200 {activeVariation ===
						variation.id
							? 'bg-ocean text-white'
							: 'text-slate hover:bg-ocean/10 hover:text-teal'}
            "
						onclick={() => handleVariationClick(variation.id)}
					>
						<FontAwesomeIcon icon={variation.icon} class="mr-2 h-3 w-3" />
						<span class="whitespace-nowrap">{variation.label}</span>
					</button>
				{/each}
			</div>
		</nav>
	</div>

	<!-- Active Variation Content -->
	<div class="prose prose-slate max-w-none">
		<h3 class="text-slate mb-4 text-xl font-semibold">
			{resume.fiveYearVision.variations[
				activeVariation as keyof typeof resume.fiveYearVision.variations
			].title}
		</h3>
		<div class="text-slate space-y-4 leading-relaxed">
			{#each resume.fiveYearVision.variations[activeVariation as keyof typeof resume.fiveYearVision.variations].content.split('\n\n') as paragraph}
				{#if paragraph.trim()}
					<p class="mb-4">{@html formatContent(paragraph.trim())}</p>
				{/if}
			{/each}
		</div>
	</div>
</InfoSection>
