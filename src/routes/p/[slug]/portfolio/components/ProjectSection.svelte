<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faBullseye, faCalendarAlt, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

	interface Props {
		project: any;
		companyName: string;
	}

	let { project, companyName }: Props = $props();
</script>

<div class="border-ocean/20 rounded-lg border bg-white/60 p-4 sm:p-6">
	<!-- Project Header -->
	<div class="mb-6">
		<!-- Breadcrumb -->
		<div class="text-slate/60 mb-3 flex items-center text-xs">
			<span>Professional Experience</span>
			<span class="mx-2">›</span>
			<span>{companyName}</span>
			<span class="mx-2">›</span>
			<span class="text-teal font-medium">{project.name}</span>
		</div>

		<div class="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between">
			<h3 class="text-slate text-xl font-bold">{project.name}</h3>
			<div class="text-teal mt-1 flex items-center text-sm sm:mt-0">
				<FontAwesomeIcon icon={faCalendarAlt} class="mr-1 h-3 w-3" />
				<span>
					{new Date(project.startDate).toLocaleDateString('en-US', {
						month: 'short',
						year: 'numeric'
					})} -
					{new Date(project.endDate).toLocaleDateString('en-US', {
						month: 'short',
						year: 'numeric'
					})}
				</span>
			</div>
		</div>

		<!-- Summary -->
		<div class="bg-teal/5 border-teal rounded-r-lg border-l-4 p-4">
			<p class="text-slate font-medium">{project.summary}</p>
		</div>
	</div>

	<!-- Project Details -->
	<div class="space-y-6">
		<!-- Description -->
		<div>
			<h4 class="text-slate mb-3 flex items-center text-lg font-semibold">
				<FontAwesomeIcon icon={faBullseye} class="text-ocean mr-2 h-4 w-4" />
				Project Details
			</h4>
			<p class="text-slate leading-relaxed">{project.description}</p>
		</div>

		<!-- Outcome -->
		<div>
			<h4 class="text-slate mb-3 flex items-center text-lg font-semibold">
				<FontAwesomeIcon icon={faCheckCircle} class="mr-2 h-4 w-4 text-emerald-500" />
				Outcome & Impact
			</h4>
			<p class="text-slate leading-relaxed">{project.outcome}</p>
		</div>
	</div>
</div>
