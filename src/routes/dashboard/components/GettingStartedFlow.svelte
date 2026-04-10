<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowRight,
    faCheck,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "./Card.svelte";

  interface Completeness {
    hasSkills: boolean;
    skillCount: number;
    hasMatchConfig: boolean;
    hasWorkExperience: boolean;
    hasEducation: boolean;
    hasExperienceOrEducation: boolean;
    hasTitle: boolean;
    hasHeadline: boolean;
    hasLocation: boolean;
  }

  interface Props {
    completeness: Completeness;
    hasSearchTasks: boolean;
    hasMatches: boolean;
  }

  let { completeness, hasSearchTasks, hasMatches }: Props = $props();

  const profileComplete = $derived(completeness.hasSkills && completeness.hasExperienceOrEducation);

  const profileMissing = $derived(() => {
    const missing: string[] = [];
    if (!completeness.hasSkills) missing.push("at least one tech skill");
    if (!completeness.hasExperienceOrEducation) missing.push("at least one work experience or education item");
    return missing;
  });

  const profileDescription = $derived(
    profileComplete
      ? "Your profile has the essentials covered."
      : `To get good matches, add ${profileMissing().join(" and ")}.`,
  );

  const profileHref = $derived(
    !completeness.hasSkills
      ? "/dashboard/profile/skills"
      : "/dashboard/profile/edit",
  );

  const profileActionLabel = $derived(
    !completeness.hasSkills
      ? "Add Skills"
      : "Edit Profile",
  );

  const steps = $derived([
    {
      number: 1,
      title: "Complete your profile",
      description: profileDescription,
      done: profileComplete,
      href: profileHref,
      actionLabel: profileActionLabel,
    },
    {
      number: 2,
      title: "Configure match preferences",
      description:
        "Tell us what you're looking for: job types, work arrangements, locations, and experience levels.",
      done: completeness.hasMatchConfig,
      href: "/dashboard/jobs/import/config",
      actionLabel: "Set Preferences",
    },
    {
      number: 3,
      title: "Set up job searches",
      description:
        "Add search tasks that automatically scrape job boards for new listings matching your criteria.",
      done: hasSearchTasks,
      href: "/dashboard/jobs/import/tasks",
      actionLabel: "Add Search",
    },
    {
      number: 4,
      title: "Get matched!",
      description:
        "Once jobs are found, the AI matcher will score them against your profile. Best matches appear here.",
      done: hasMatches,
      href: "/dashboard/jobs",
      actionLabel: "View Jobs",
    },
  ]);

  // Find the first incomplete step
  const activeStepIndex = $derived(steps.findIndex((s) => !s.done));
</script>

<Card padding="md">
  <h3 class="text-base font-semibold text-[var(--dash-text)] mb-4">
    Getting Started
  </h3>

  <div class="space-y-1">
    {#each steps as step, index (step.number)}
      {@const isActive = index === activeStepIndex}
      {@const isFuture = index > activeStepIndex && activeStepIndex >= 0}

      <div
        class="flex gap-3 p-2.5 rounded-lg transition-colors {isActive
          ? 'bg-[var(--dash-primary)]/5'
          : ''}"
      >
        <!-- Step indicator with connecting line -->
        <div class="flex flex-col items-center shrink-0">
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold {step.done
              ? 'bg-green-500/20 text-green-600'
              : isActive
                ? 'bg-[var(--dash-primary)] text-white'
                : 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)] border border-[var(--dash-border)]'}"
          >
            {#if step.done}
              <FontAwesomeIcon icon={faCheck} class="w-3.5 h-3.5" />
            {:else}
              {step.number}
            {/if}
          </div>
          {#if index < steps.length - 1}
            <div
              class="w-0.5 flex-1 min-h-2 mt-1 {step.done
                ? 'bg-green-500/30'
                : 'bg-[var(--dash-border)]'}"
            ></div>
          {/if}
        </div>

        <!-- Step content -->
        <div class="flex-1 min-w-0 pb-2">
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
                <p
                  class="text-xs text-[var(--dash-text-secondary)] mt-0.5 leading-relaxed"
                >
                  {step.description}
                </p>
              {/if}
            </div>

            {#if isActive}
              <a
                href={step.href}
                class="px-3 py-1.5 text-xs bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
              >
                {step.actionLabel}
                <FontAwesomeIcon icon={faArrowRight} class="w-3 h-3" />
              </a>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </div>
</Card>
