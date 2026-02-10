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

<div class="border border-light rounded-lg overflow-hidden">
  <button
    type="button"
    onclick={() => (isExpanded = !isExpanded)}
    class="w-full flex items-center justify-between p-4 bg-snow hover:bg-light/30 transition-colors"
  >
    <div class="flex items-center gap-3">
      <div
        class="w-8 h-8 rounded-full bg-ocean/10 flex items-center justify-center"
      >
        <FontAwesomeIcon icon={faUser} class="w-4 h-4 text-ocean" />
      </div>
      <span class="font-medium text-slate">Basic Information</span>
    </div>
    <FontAwesomeIcon
      icon={isExpanded ? faChevronUp : faChevronDown}
      class="w-4 h-4 text-pearl"
    />
  </button>

  {#if isExpanded}
    <div class="p-4 space-y-4 border-t border-light">
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <label class="block text-sm font-medium text-slate mb-1">
            Full Name <span class="text-crimson">*</span>
          </label>
          <input
            type="text"
            bind:value={basics.name}
            class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate mb-1">
            Professional Title
          </label>
          <input
            type="text"
            bind:value={basics.title}
            class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
          />
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <label class="block text-sm font-medium text-slate mb-1">Email</label>
          <input
            type="email"
            bind:value={basics.email}
            class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate mb-1">Phone</label>
          <input
            type="tel"
            bind:value={basics.phone}
            class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
          />
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-slate mb-1">Summary</label>
        <textarea
          bind:value={basics.summary}
          rows="3"
          class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate resize-none"
        ></textarea>
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <div>
          <label class="block text-sm font-medium text-slate mb-1"
          >Website</label>
          <input
            type="url"
            bind:value={basics.website}
            class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate mb-1"
          >LinkedIn</label>
          <input
            type="text"
            bind:value={basics.linkedin}
            class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate mb-1"
          >GitHub</label>
          <input
            type="text"
            bind:value={basics.github}
            class="w-full px-3 py-2 border border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean focus:border-ocean bg-snow text-slate"
          />
        </div>
      </div>
    </div>
  {/if}
</div>
