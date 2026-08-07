<!--
  Billing page — OSS version (self-hosted, everything free).
  The cloud version overlays this with full plan management UI.
-->

<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCompass } from '@fortawesome/free-solid-svg-icons';

	let { data } = $props();
	let { subscription } = $derived(data);
</script>

<svelte:head>
	<title>Plan - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-xl font-semibold text-[var(--dash-text)]">Plan</h1>

	<div class="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-card)] p-5">
		<div class="flex items-center gap-3">
			<div
				class="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 text-green-500"
			>
				<FontAwesomeIcon icon={faCompass} class="h-4.5 w-4.5" />
			</div>
			<div>
				<h2 class="text-base font-semibold text-green-500 capitalize">{subscription.plan}</h2>
				<p class="mt-0.5 text-xs text-[var(--dash-text-secondary)]">
					Self-hosted — full access, no limits
				</p>
			</div>
		</div>
	</div>
</div>
