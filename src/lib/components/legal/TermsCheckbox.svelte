<script lang="ts">
	/*
	 * The "I agree to the terms" box every account-creating form shows. Its
	 * value is the terms version it was shown with, so the server can refuse
	 * an acceptance of terms that have changed since the page loaded.
	 */
	import { resolve } from '$app/paths';

	let { version, checked = $bindable(false) }: { version: string; checked?: boolean } = $props();

	const linkClass = 'font-medium text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]';
</script>

<label class="flex items-start gap-2 text-sm text-[var(--dash-text-secondary)]">
	<input
		type="checkbox"
		name="accept_terms"
		value={version}
		bind:checked
		required
		class="mt-0.5 h-4 w-4 rounded border-[var(--dash-border-input)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
	/>
	<span>
		I agree to the
		<a href={resolve('/terms')} target="_blank" class={linkClass}>terms of service</a>
		and have read the
		<a href={resolve('/privacy')} target="_blank" class={linkClass}>privacy policy</a>.
	</span>
</label>
