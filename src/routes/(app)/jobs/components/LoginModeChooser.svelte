<script lang="ts">
	/**
	 * The three-way "how does this task sign in?" control.
	 *
	 * Extracted because the same toggle existed three times — here (via
	 * CredentialSelector), inline in SearchTaskFields' add branch, and as a
	 * derived constant with no UI at all in the simplified add form — and the
	 * three had already drifted into describing the modes differently. The
	 * words now come from `$lib/import-tasks/sign-in`, which is also what the
	 * server reads for the default, so a change lands everywhere at once.
	 */
	import {
		describeLoginMode,
		explainMissingSignInPage,
		loginModeOptions,
		type LoginMode
	} from '$lib/import-tasks/sign-in';

	interface Props {
		/**
		 * The selected mode. Read-only on purpose: both callers already own this
		 * value (one posts it in a hidden field, the other diffs it against the
		 * saved row to decide whether to show Save), and a second source of
		 * truth inside the control is how the old copies drifted.
		 */
		mode: LoginMode;
		/** Platform display name, so the help text can name the site. */
		platformName?: string | null;
		/** Whether `job_platforms.login_page_url` is set for this platform. */
		hasSignInPage: boolean;
		disabled?: boolean;
		onchange?: (mode: LoginMode) => void;
	}

	let { mode, platformName = null, hasSignInPage, disabled = false, onchange }: Props = $props();

	const options = $derived(loginModeOptions(platformName));
	const help = $derived(describeLoginMode(mode, platformName).help);
	const missingPage = $derived(explainMissingSignInPage(mode, hasSignInPage, platformName));

	function pick(next: LoginMode) {
		if (disabled || next === mode) return;
		onchange?.(next);
	}
</script>

<div>
	<div class="flex overflow-hidden rounded-md border border-[var(--dash-border)]">
		{#each options as option (option.key)}
			<button
				type="button"
				{disabled}
				onclick={() => pick(option.key)}
				aria-pressed={mode === option.key}
				class={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
					mode === option.key
						? 'bg-[var(--dash-primary)] text-white'
						: 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface)]'
				} disabled:opacity-60`}
			>
				{option.label}
			</button>
		{/each}
	</div>

	<p class="mt-1.5 text-xs text-[var(--dash-text-muted)]">{help}</p>

	{#if missingPage}
		<p
			class="
				mt-2 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs
				text-amber-700 dark:text-amber-400
			"
		>
			{missingPage}
		</p>
	{/if}
</div>
