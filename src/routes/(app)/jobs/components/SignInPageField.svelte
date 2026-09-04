<script lang="ts">
	/**
	 * The platform's sign-in page, shown and (for sites the user owns) edited
	 * from the task page.
	 *
	 * This was the dead end in the old flow. The add form asked for a login URL
	 * once, before the user could know whether the site needed one, and the
	 * task page then refused to show it at all on the grounds that it is
	 * platform-level config edited in admin. So someone who left it empty had
	 * no way back and no way to find out that an empty column is why their
	 * runs never sign in.
	 *
	 * `PATCH /api/platforms/[id]` has always allowed exactly this — staff, or a
	 * user on a platform no other account uses — and had no caller anywhere in
	 * the UI. This is it.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCheck,
		faExternalLinkAlt,
		faPen,
		faPlus,
		faXmark
	} from '@fortawesome/free-solid-svg-icons';
	import Spinner from '$lib/components/Spinner.svelte';
	import { LOGIN_PAGE_URL_MAX } from '$lib/import-tasks/custom-site';

	interface Props {
		platformId: number;
		platformName?: string | null;
		/** `job_platforms.login_page_url`, or null when the site has none. */
		value: string | null;
		/**
		 * Whether this user may write the column. Computed server-side with the
		 * same rule the endpoint enforces, so the field never renders and then
		 * 403s on save.
		 */
		canEdit: boolean;
		/**
		 * Whether the task is currently set to sign in. An empty field only
		 * opens by itself when it does: on a public board the answer is "there
		 * is no sign-in page and that is fine", and an input inviting one is
		 * noise on every task in the list.
		 */
		promptForUrl?: boolean;
		onSaved?: (value: string | null) => void;
	}

	let {
		platformId,
		platformName = null,
		value,
		canEdit,
		promptForUrl = false,
		onSaved
	}: Props = $props();

	// Open on its own when the task wants to sign in and has nowhere to do it:
	// that combination is the silent no-op this field exists to surface, so it
	// should not hide behind a pencil.
	let current = $state(value);
	let editing = $state(false);
	let draft = $state(value ?? '');
	let saving = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		// Re-seed when the task (and so the platform) changes underneath us.
		current = value;
		draft = value ?? '';
		editing = false;
		error = null;
	});

	const open = $derived(canEdit && (editing || (!current && promptForUrl)));
	const trimmed = $derived(draft.trim());
	const dirty = $derived(trimmed !== (current ?? ''));

	/** Same absolute-URL rule the add form applies to a pasted search URL. */
	const invalid = $derived.by(() => {
		if (!trimmed) return null;
		if (trimmed.length > LOGIN_PAGE_URL_MAX) {
			return `That URL is too long (over ${LOGIN_PAGE_URL_MAX} characters).`;
		}
		try {
			const parsed = new URL(trimmed);
			if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
				return 'Enter a full URL including https://';
			}
			return null;
		} catch {
			return 'Enter a full URL including https://';
		}
	});

	async function save() {
		if (invalid) return;
		saving = true;
		error = null;
		try {
			const res = await fetch(`/api/platforms/${platformId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ login_page_url: trimmed || null })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				error = body.message || body.error || `Couldn't save (HTTP ${res.status})`;
				return;
			}
			current = trimmed || null;
			editing = false;
			onSaved?.(current);
		} catch {
			error = "Couldn't save. Check your connection and try again.";
		} finally {
			saving = false;
		}
	}

	function cancel() {
		draft = current ?? '';
		editing = false;
		error = null;
	}
</script>

<div>
	<div class="mb-1 flex items-center justify-between gap-2">
		<h3 class="text-xs font-medium text-[var(--dash-text-secondary)]">Sign-in page</h3>
		{#if canEdit && !open}
			<button
				type="button"
				onclick={() => (editing = true)}
				class="p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-primary)]"
				title={current ? 'Change the sign-in page URL' : 'Add a sign-in page URL'}
				aria-label={current ? 'Change the sign-in page URL' : 'Add a sign-in page URL'}
			>
				<FontAwesomeIcon icon={current ? faPen : faPlus} class="h-3 w-3" />
			</button>
		{/if}
	</div>

	{#if open}
		<input
			type="url"
			bind:value={draft}
			disabled={saving}
			placeholder="https://example.com/login"
			aria-label="Sign-in page URL"
			aria-invalid={invalid ? 'true' : undefined}
			class="w-full rounded border bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)] disabled:opacity-60 {invalid
				? 'border-[var(--dash-error)]'
				: 'border-[var(--dash-border)]'}"
		/>
		{#if invalid}
			<p class="mt-1 text-xs text-[var(--dash-error)]">{invalid}</p>
		{:else}
			<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
				The page {platformName?.trim() || 'this site'} asks you to sign in on. Without it a run never
				signs in, whatever the setting below says.
			</p>
		{/if}
		{#if dirty}
			<div class="mt-2 flex items-center gap-2">
				<button
					type="button"
					onclick={save}
					disabled={saving || !!invalid}
					class="flex items-center gap-1 rounded-md bg-[var(--dash-primary)] px-3 py-1 text-xs text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:opacity-50"
				>
					{#if saving}
						<Spinner size="w-3 h-3" />
					{:else}
						<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
					{/if}
					Save
				</button>
				<button
					type="button"
					onclick={cancel}
					disabled={saving}
					class="flex items-center gap-1 rounded-md border border-[var(--dash-border)] px-3 py-1 text-xs text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)] disabled:opacity-50"
				>
					<FontAwesomeIcon icon={faXmark} class="h-3 w-3" />
					Cancel
				</button>
			</div>
		{/if}
	{:else if current}
		<!-- An off-site URL the user typed, so there is no route for resolve()
		     to name. -->
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			href={current}
			target="_blank"
			rel="noopener"
			class="inline-flex items-center gap-1 text-sm break-all text-[var(--dash-primary)] hover:underline"
		>
			{current}
			<FontAwesomeIcon icon={faExternalLinkAlt} class="h-3 w-3 flex-shrink-0" />
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{:else}
		<p class="text-sm text-[var(--dash-text-muted)]">
			None on file, so runs go straight to the jobs.{canEdit
				? ''
				: ` Ask an admin to add one if ${platformName?.trim() || 'this site'} hides its jobs behind a sign-in.`}
		</p>
	{/if}

	{#if error}
		<p class="mt-1 text-xs text-[var(--dash-error)]" role="alert">{error}</p>
	{/if}
</div>
