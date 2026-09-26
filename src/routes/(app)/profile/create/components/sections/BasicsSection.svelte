<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faChevronDown, faChevronUp, faUser } from '@fortawesome/free-solid-svg-icons';
	import type { ResumeBasics } from '$lib/server/resume/types';
	import Card from '../../../../components/Card.svelte';

	interface Props {
		basics: ResumeBasics;
	}

	let { basics = $bindable() }: Props = $props();
	// Links each label to its field; unique per mounted section.
	const uid = $props.id();

	let isExpanded = $state(true);
</script>

<Card class="overflow-hidden">
	<button
		type="button"
		onclick={() => (isExpanded = !isExpanded)}
		class="flex w-full items-center justify-between p-3 transition-colors hover:bg-[var(--dash-bg)] sm:p-4"
	>
		<div class="flex items-center gap-3">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--dash-primary)]/10"
			>
				<FontAwesomeIcon icon={faUser} class="h-5 w-5 text-[var(--dash-primary)]" />
			</div>
			<span class="text-base font-semibold text-[var(--dash-text)]">Basic Information</span>
		</div>
		<FontAwesomeIcon
			icon={isExpanded ? faChevronUp : faChevronDown}
			class="h-4 w-4 text-[var(--dash-text-muted)]"
		/>
	</button>

	{#if isExpanded}
		<div class="space-y-4 border-t border-[var(--dash-border)] p-3 sm:p-4">
			<div class="grid gap-4 md:grid-cols-2">
				<div>
					<label for="{uid}-name" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						Full Name <span class="text-[var(--dash-error)]">*</span>
					</label>
					<input
						id="{uid}-name"
						type="text"
						bind:value={basics.name}
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>

				<div>
					<label for="{uid}-title" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
						Professional Title
					</label>
					<input
						id="{uid}-title"
						type="text"
						bind:value={basics.title}
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>
			</div>

			<div class="grid gap-4 md:grid-cols-3">
				<div>
					<label for="{uid}-email" class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
						>Email</label
					>
					<input
						id="{uid}-email"
						type="email"
						bind:value={basics.email}
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>

				<div>
					<label for="{uid}-phone" class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
						>Phone</label
					>
					<input
						id="{uid}-phone"
						type="tel"
						bind:value={basics.phone}
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>

				<div>
					<label for="{uid}-location" class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
						>Location</label
					>
					<input
						id="{uid}-location"
						type="text"
						bind:value={basics.location}
						placeholder="City, Country"
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>
			</div>

			<div>
				<label for="{uid}-summary" class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
					>Summary</label
				>
				<textarea
					id="{uid}-summary"
					bind:value={basics.summary}
					rows="3"
					class="w-full resize-none rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				></textarea>
			</div>

			<div class="grid gap-4 md:grid-cols-3">
				<div>
					<label for="{uid}-website" class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
						>Website</label
					>
					<input
						id="{uid}-website"
						type="url"
						bind:value={basics.website}
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>

				<div>
					<label for="{uid}-linkedin" class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
						>LinkedIn</label
					>
					<input
						id="{uid}-linkedin"
						type="text"
						bind:value={basics.linkedin}
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>

				<div>
					<label for="{uid}-github" class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
						>GitHub</label
					>
					<input
						id="{uid}-github"
						type="text"
						bind:value={basics.github}
						class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>
			</div>
		</div>
	{/if}
</Card>
