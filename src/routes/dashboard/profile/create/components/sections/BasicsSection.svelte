<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faChevronDown,
    faChevronUp,
    faUser,
  } from "@fortawesome/free-solid-svg-icons";
  import type { ResumeBasics } from "$lib/server/resume/types";

  interface Props {
    basics: ResumeBasics;
  }

  let { basics = $bindable() }: Props = $props();

  let isExpanded = $state(true);
</script>

<div
  class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] overflow-hidden"
>
  <button
    type="button"
    onclick={() => (isExpanded = !isExpanded)}
    class="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-[var(--dash-bg)] transition-colors"
  >
    <div class="flex items-center gap-3">
      <div
        class="w-10 h-10 rounded-lg bg-[var(--dash-primary)]/10 flex items-center justify-center"
      >
        <FontAwesomeIcon
          icon={faUser}
          class="w-5 h-5 text-[var(--dash-primary)]"
        />
      </div>
      <span class="font-semibold text-base text-[var(--dash-text)]">Basic Information</span
      >
    </div>
    <FontAwesomeIcon
      icon={isExpanded ? faChevronUp : faChevronDown}
      class="w-4 h-4 text-[var(--dash-text-muted)]"
    />
  </button>

  {#if isExpanded}
    <div class="p-3 sm:p-4 space-y-4 border-t border-[var(--dash-border)]">
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <label
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Full Name <span class="text-[var(--dash-error)]">*</span>
          </label>
          <input
            type="text"
            bind:value={basics.name}
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Professional Title
          </label>
          <input
            type="text"
            bind:value={basics.title}
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <label
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >Email</label
          >
          <input
            type="email"
            bind:value={basics.email}
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >Phone</label
          >
          <input
            type="tel"
            bind:value={basics.phone}
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >Summary</label
        >
        <textarea
          bind:value={basics.summary}
          rows="3"
          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-none"
        ></textarea>
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <div>
          <label
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >Website</label
          >
          <input
            type="url"
            bind:value={basics.website}
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >LinkedIn</label
          >
          <input
            type="text"
            bind:value={basics.linkedin}
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>

        <div>
          <label
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >GitHub</label
          >
          <input
            type="text"
            bind:value={basics.github}
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>
      </div>
    </div>
  {/if}
</div>
