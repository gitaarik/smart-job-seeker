<!--
  Billing page — OSS version (self-hosted, everything free).
  The cloud version overlays this with full plan management UI.
-->

<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faCompass } from "@fortawesome/free-solid-svg-icons";

  let { data } = $props();
  let { subscription } = $derived(data);
</script>

<svelte:head>
  <title>Plan - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
  <h1 class="text-xl font-semibold text-[var(--dash-text)]">Plan</h1>

  <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-5">
    <div class="flex items-center gap-3">
      <div class="w-9 h-9 rounded-lg flex items-center justify-center text-green-500 bg-green-500/10">
        <FontAwesomeIcon icon={faCompass} class="w-4.5 h-4.5" />
      </div>
      <div>
        <h2 class="text-base font-semibold text-green-500 capitalize">{subscription.plan}</h2>
        <p class="text-xs text-[var(--dash-text-secondary)] mt-0.5">Self-hosted — full access, no limits</p>
      </div>
    </div>
  </div>
</div>
