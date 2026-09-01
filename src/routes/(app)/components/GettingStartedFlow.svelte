<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faArrowRight, faCheck } from '@fortawesome/free-solid-svg-icons';
	import Card from './Card.svelte';
	import {
		MIN_SKILLS_FOR_MATCHING,
		isProfileReadyForMatching,
		type ProfileCompleteness
	} from '$lib/profile-completeness';

	interface Props {
		completeness: ProfileCompleteness;
		hasSearchTasks: boolean;
		hasMatches: boolean;
	}

	let { completeness, hasSearchTasks, hasMatches }: Props = $props();

	const enoughSkills = $derived(completeness.skillCount >= MIN_SKILLS_FOR_MATCHING);
	const profileComplete = $derived(isProfileReadyForMatching(completeness));

	const profileMissing = $derived(() => {
		const missing: string[] = [];
		// Not "tech skill". The vocabulary is whatever the applicant's field uses
		// — Stakeholder Engagement, Patient Care, HACCP — and calling it technical
		// tells someone in a non-technical field that this product is not for
		// them, on the one screen whose job is to get them started.
		if (!completeness.hasSkills) {
			missing.push('your skills');
		} else if (!enoughSkills) {
			missing.push(
				`more skills (you have ${completeness.skillCount}; ${MIN_SKILLS_FOR_MATCHING} or more matches noticeably better)`
			);
		}
		if (!completeness.hasExperienceOrEducation)
			missing.push('at least one work experience or education item');
		return missing;
	});

	const profileDescription = $derived(
		profileComplete
			? 'Your profile has the essentials covered.'
			: `To get good matches, add ${profileMissing().join(' and ')}.`
	);

	const profileHref = $derived(!enoughSkills ? '/profile/skills' : '/profile/edit');

	const profileActionLabel = $derived(!enoughSkills ? 'Add Skills' : 'Edit Profile');

	const steps = $derived([
		{
			number: 1,
			title: 'Complete your profile',
			description: profileDescription,
			done: profileComplete,
			href: profileHref,
			actionLabel: profileActionLabel
		},
		{
			number: 2,
			title: 'Configure match preferences',
			description:
				"Tell us what you're looking for: job types, work arrangements, locations, and experience levels.",
			done: completeness.hasMatchConfig,
			href: '/jobs/import/config',
			actionLabel: 'Set Preferences'
		},
		{
			number: 3,
			title: 'Set up job searches',
			description:
				'Add search tasks that automatically scrape job boards for new listings matching your criteria.',
			done: hasSearchTasks,
			href: '/jobs/import/tasks',
			actionLabel: 'Add Search'
		},
		{
			number: 4,
			title: 'Get matched!',
			description:
				'Once jobs are found, the AI matcher will score them against your profile. Best matches appear here.',
			done: hasMatches,
			href: '/jobs',
			actionLabel: 'View Jobs'
		}
	]);

	// Find the first incomplete step
	const activeStepIndex = $derived(steps.findIndex((s) => !s.done));
</script>

<Card padding="md">
	<h3 class="mb-4 text-base font-semibold text-[var(--dash-text)]">Getting Started</h3>

	<div class="space-y-1">
		{#each steps as step, index (step.number)}
			{@const isActive = index === activeStepIndex}
			{@const isFuture = index > activeStepIndex && activeStepIndex >= 0}

			<div
				class="flex gap-3 rounded-lg p-2.5 transition-colors {isActive
					? 'bg-[var(--dash-primary)]/5'
					: ''}"
			>
				<!-- Step indicator with connecting line -->
				<div class="flex shrink-0 flex-col items-center">
					<div
						class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold {step.done
							? 'bg-green-500/20 text-green-600'
							: isActive
								? 'bg-[var(--dash-primary)] text-white'
								: 'border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}"
					>
						{#if step.done}
							<FontAwesomeIcon icon={faCheck} class="h-3.5 w-3.5" />
						{:else}
							{step.number}
						{/if}
					</div>
					{#if index < steps.length - 1}
						<div
							class="mt-1 min-h-2 w-0.5 flex-1 {step.done
								? 'bg-green-500/30'
								: 'bg-[var(--dash-border)]'}"
						></div>
					{/if}
				</div>

				<!-- Step content -->
				<div class="min-w-0 flex-1 pb-2">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p
								class="text-sm font-medium {step.done
									? 'text-[var(--dash-text-muted)] line-through'
									: isFuture
										? 'text-[var(--dash-text-muted)]'
										: 'text-[var(--dash-text)]'}"
							>
								{step.title}
							</p>
							{#if isActive}
								<p class="mt-0.5 text-xs leading-relaxed text-[var(--dash-text-secondary)]">
									{step.description}
								</p>
							{/if}
						</div>

						{#if isActive}
							<a
								href={step.href}
								class="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--dash-primary)] px-3 py-1.5 text-xs whitespace-nowrap text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
							>
								{step.actionLabel}
								<FontAwesomeIcon icon={faArrowRight} class="h-3 w-3" />
							</a>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>
</Card>
