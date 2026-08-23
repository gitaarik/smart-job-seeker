<script lang="ts">
	/**
	 * Inline notice for an import task stuck at the platform's login.
	 *
	 * The notification is what reaches the user who has walked away; this is
	 * what they see when they come back and open the list, and it has to answer
	 * the question the row otherwise raises — "this says it failed, is it
	 * broken?" — with the specific fix rather than a shrug.
	 *
	 * The copy comes from the same `explainAuthBlock` the notification uses, so
	 * the two can't drift into saying different things about one task.
	 *
	 * The heading is the exception, and deliberately so: the explanation's own
	 * title repeats the task name, which the row above this already shows. It
	 * does have to follow the *kind*, though — a device that never came online
	 * is not a login problem, and this component said "Can't log in" for one
	 * until 2026-08-23.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faPlugCircleXmark, faRightToBracket } from '@fortawesome/free-solid-svg-icons';
	import { explainAuthBlock } from '$lib/import-tasks/failure-policy';
	import { toFailureKind } from '$lib/import-tasks/failure-kinds';

	let {
		kind,
		disabled = false,
		platform,
		taskLabel = null
	}: {
		kind: string | null;
		disabled?: boolean;
		platform: string;
		taskLabel?: string | null;
	} = $props();

	let failureKind = $derived(toFailureKind(kind));
	let isDevice = $derived(failureKind === 'device_unavailable');
	let heading = $derived(
		isDevice
			? disabled
				? 'Switched off — your device was offline'
				: "Can't reach your device"
			: disabled
				? 'Switched off — login needs you'
				: "Can't log in — needs you once"
	);
	let explanation = $derived(
		failureKind ? explainAuthBlock(failureKind, { platform, taskLabel, disabled }) : null
	);
	// The first paragraph restates what the row already shows; the rest is the
	// part worth reading here.
	let detail = $derived(explanation?.message.split('\n\n').slice(1).join(' ') ?? '');
</script>

{#if explanation}
	<div
		class="
			mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10
			px-2.5 py-2 text-xs text-[var(--dash-text-secondary)]
		"
	>
		<FontAwesomeIcon
			icon={isDevice ? faPlugCircleXmark : faRightToBracket}
			class="mt-0.5 h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400"
		/>
		<div class="min-w-0">
			<p class="font-semibold text-amber-700 dark:text-amber-400">
				{heading}
			</p>
			<p class="mt-0.5">{detail}</p>
		</div>
	</div>
{/if}
