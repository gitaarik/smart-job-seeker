<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faArrowLeft,
		faChartLine,
		faCheck,
		faExternalLinkAlt,
		faFlask,
		faHistory,
		faPenToSquare,
		faPlus,
		faTrash,
		faTriangleExclamation,
		faXmark
	} from '@fortawesome/free-solid-svg-icons';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Bound form values for the platform-level fields.
	let saving = $state(false);
	let name = $state(data.platform.name);
	let key = $state(data.platform.key);
	let url = $state(data.platform.url);
	let type = $state(data.platform.type ?? '');
	let status = $state(data.platform.status);
	let loginPageUrl = $state(data.platform.login_page_url ?? '');
	let searchPageUrl = $state(data.platform.search_page_url ?? '');

	function discoveryStatusColor(s: string) {
		if (s === 'success') return 'text-green-600 dark:text-green-400';
		if (s === 'error') return 'text-red-600 dark:text-red-400';
		if (s === 'running' || s === 'queued' || s === 'cancelling') {
			return 'text-blue-600 dark:text-blue-400';
		}
		if (s === 'cancelled') return 'text-[var(--dash-text-muted)]';
		return 'text-[var(--dash-text-muted)]';
	}

	// Phase 1 platform-level signal stats.
	let totalRuns = $derived(data.platform.success_count + data.platform.failure_count);
	let successRate = $derived(
		totalRuns > 0 ? Math.round((data.platform.success_count / totalRuns) * 100) : null
	);

	function formatTimestamp(ts: Date | string | null): string {
		if (!ts) return '';
		const d = typeof ts === 'string' ? new Date(ts) : ts;
		return d.toLocaleString();
	}

	function truncate(value: string | null, max: number): string {
		if (!value) return '—';
		return value.length > max ? value.slice(0, max) + '…' : value;
	}

	// What still points at this platform, already worded by the server —
	// `blockers` is the SET NULL side, which the database would let through
	// while silently stripping the references, so the delete action refuses
	// instead. `cascades` is what goes with the platform when it does.
	let blockers = $derived(data.references.blockers);
	let cascades = $derived(data.references.cascades);

	let deleting = $state(false);

	// Tuples of (canonical, value-keys) recorded as unsupported on this
	// platform — drives the per-row Clear buttons below.
	let unsupportedEntries = $derived(
		Object.entries((data.platform.unsupported_filters ?? {}) as Record<string, string[]>).filter(
			([, vs]) => Array.isArray(vs) && vs.length > 0
		)
	);
</script>

<svelte:head>
	<title>{data.platform.name} - Job Platforms - Admin</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<a
			href="/admin/job-platforms"
			class="text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
		>
			<FontAwesomeIcon icon={faArrowLeft} class="h-4 w-4" />
		</a>
		<h1 class="text-2xl font-semibold text-[var(--dash-text)]">
			{data.platform.name}
		</h1>
		<code class="font-mono text-sm text-[var(--dash-text-secondary)]">{data.platform.key}</code>
	</div>

	{#if form && 'savedFields' in form && form.savedFields}
		<div
			class="flex items-center gap-2 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200"
		>
			<FontAwesomeIcon icon={faCheck} class="h-4 w-4" />
			{#if form.savedFields.length === 0}
				No changes to save.
			{:else}
				Saved: {form.savedFields.join(', ')}
			{/if}
		</div>
	{/if}

	{#if form && 'error' in form && form.error}
		<div
			class="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
		>
			<FontAwesomeIcon icon={faTriangleExclamation} class="h-4 w-4" />
			{form.error}
		</div>
	{/if}

	<!-- Platform-level fields -->
	<form
		method="POST"
		action="?/save"
		class="space-y-4 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				await update();
				saving = false;
			};
		}}
	>
		<h3 class="text-sm font-medium text-[var(--dash-text)]">Platform details</h3>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<label
					class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
					for="field-name">Name</label
				>
				<input
					id="field-name"
					name="name"
					type="text"
					bind:value={name}
					required
					class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)]"
				/>
			</div>
			<div>
				<label
					class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
					for="field-key">Key</label
				>
				<input
					id="field-key"
					name="key"
					type="text"
					bind:value={key}
					required
					class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 font-mono text-sm text-[var(--dash-text)]"
				/>
			</div>
			<div class="md:col-span-2">
				<label
					class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
					for="field-url">Base URL</label
				>
				<div class="flex items-center gap-2">
					<input
						id="field-url"
						name="url"
						type="url"
						bind:value={url}
						required
						class="flex-1 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)]"
					/>
					<a
						href={url}
						target="_blank"
						rel="noopener noreferrer"
						class="text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)]"
						aria-label="Open base URL"
					>
						<FontAwesomeIcon icon={faExternalLinkAlt} class="h-4 w-4" />
					</a>
				</div>
			</div>
			<div>
				<label
					class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
					for="field-status">Status</label
				>
				<input
					id="field-status"
					name="status"
					type="text"
					bind:value={status}
					required
					class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)]"
				/>
			</div>
			<div>
				<label
					class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
					for="field-type">Type</label
				>
				<input
					id="field-type"
					name="type"
					type="text"
					bind:value={type}
					placeholder="job_boards / vetted_platforms / …"
					class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)]"
				/>
			</div>
			<div class="md:col-span-2">
				<label
					class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
					for="field-login">Login page URL</label
				>
				<input
					id="field-login"
					name="login_page_url"
					type="url"
					bind:value={loginPageUrl}
					placeholder="https://example.com/login"
					class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)]"
				/>
			</div>
			<div class="md:col-span-2">
				<label
					class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
					for="field-search">Search page URL</label
				>
				<div class="flex items-center gap-2">
					<input
						id="field-search"
						name="search_page_url"
						type="url"
						bind:value={searchPageUrl}
						placeholder="https://example.com/jobs"
						class="flex-1 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)]"
					/>
					{#if searchPageUrl}
						<a
							href={searchPageUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)]"
							aria-label="Open search page URL"
						>
							<FontAwesomeIcon icon={faExternalLinkAlt} class="h-4 w-4" />
						</a>
					{/if}
				</div>
				<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
					Entry page for the keyword + filter form. The scraper navigates here before identifying
					form fields. Falls back to the base URL when empty. Usually set by discovery — only edit
					if discovery picked the wrong page.
				</p>
			</div>
		</div>

		<div class="flex justify-end">
			<button
				type="submit"
				disabled={saving}
				class="rounded bg-[var(--dash-primary)] px-4 py-2 text-white hover:bg-[var(--dash-primary-hover)] disabled:opacity-60"
			>
				{saving ? 'Saving…' : 'Save platform'}
			</button>
		</div>
	</form>

	<!-- Discovery — the dedicated discovery page hosts the config + history -->
	<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4">
		<div class="flex items-start justify-between gap-3">
			<div>
				<h3 class="text-sm font-medium text-[var(--dash-text)]">Discovery</h3>
				<p class="mt-1 text-xs text-[var(--dash-text-secondary)]">
					The discovery scraper auto-detects this platform's search URL template + filter parameters
					by logging in, probing the search form, and clicking each filter option. Configure
					credentials and start runs on the discovery page.
				</p>
				{#if !data.platform.login_page_url}
					<p class="mt-2 text-xs text-amber-600 dark:text-amber-400">
						Set a login page URL above first — discovery requires login.
					</p>
				{/if}
				{#if data.discoveryRuns.length > 0}
					{@const lastRun = data.discoveryRuns[0]}
					<p class="mt-2 text-xs text-[var(--dash-text-muted)]">
						{data.discoveryRuns.length} run{data.discoveryRuns.length === 1 ? '' : 's'}
						·
						<span class={discoveryStatusColor(lastRun.status)}>last {lastRun.status}</span>
						{new Date(lastRun.started_at).toLocaleString()}
					</p>
				{/if}
			</div>
			<a
				href={`/admin/job-platforms/${data.platform.id}/discover`}
				class="shrink-0 rounded bg-[var(--dash-primary)] px-4 py-2 text-sm whitespace-nowrap text-white hover:bg-[var(--dash-primary-hover)]"
				>Open discovery</a
			>
		</div>
	</div>

	<!-- Platform-level usage signals -->
	<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4">
		<div class="mb-3 flex items-center gap-2">
			<FontAwesomeIcon icon={faChartLine} class="h-4 w-4 text-[var(--dash-text-secondary)]" />
			<h3 class="text-sm font-medium text-[var(--dash-text)]">Platform-level signals</h3>
			<span class="text-xs text-[var(--dash-text-muted)]">aggregate across all scrape runs</span>
		</div>
		{#if totalRuns === 0}
			<p class="text-sm text-[var(--dash-text-muted)]">No runs recorded for this platform yet.</p>
		{:else}
			<div class="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
				<div>
					<div class="text-[var(--dash-text-muted)]">Successful runs</div>
					<div class="text-base font-medium text-green-600 tabular-nums dark:text-green-400">
						{data.platform.success_count}
					</div>
					{#if data.platform.last_success_at}
						<div class="mt-0.5 text-[var(--dash-text-muted)]">
							last {formatTimestamp(data.platform.last_success_at)}
						</div>
					{/if}
				</div>
				<div>
					<div class="text-[var(--dash-text-muted)]">Failed runs</div>
					<div class="text-base font-medium text-red-600 tabular-nums dark:text-red-400">
						{data.platform.failure_count}
					</div>
					{#if data.platform.last_failure_at}
						<div class="mt-0.5 text-[var(--dash-text-muted)]">
							last {formatTimestamp(data.platform.last_failure_at)}
						</div>
					{/if}
				</div>
				<div>
					<div class="text-[var(--dash-text-muted)]">Total runs</div>
					<div class="text-base font-medium text-[var(--dash-text)] tabular-nums">
						{totalRuns}
					</div>
				</div>
				<div>
					<div class="text-[var(--dash-text-muted)]">Success rate</div>
					<div
						class="
              text-base font-medium tabular-nums {successRate != null && successRate >= 70
							? 'text-green-600 dark:text-green-400'
							: successRate != null && successRate >= 40
								? 'text-amber-600 dark:text-amber-400'
								: 'text-red-600 dark:text-red-400'}
            "
					>
						{successRate}%
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Unsupported filters -->
	<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4">
		<div class="mb-3 flex items-center gap-2">
			<FontAwesomeIcon
				icon={faTriangleExclamation}
				class="h-4 w-4 text-[var(--dash-text-secondary)]"
			/>
			<h3 class="text-sm font-medium text-[var(--dash-text)]">
				Unsupported filters
				<span class="font-normal text-[var(--dash-text-muted)]">
					({unsupportedEntries.length})
				</span>
			</h3>
			{#if data.platform.unsupported_filters_at}
				<span class="ml-auto text-xs text-[var(--dash-text-muted)]">
					last recorded {formatTimestamp(data.platform.unsupported_filters_at)}
				</span>
			{/if}
		</div>

		{#if unsupportedEntries.length === 0}
			<p class="text-sm text-[var(--dash-text-muted)]">
				No filters recorded as unsupported on this platform.
			</p>
		{:else}
			<p class="mb-3 text-xs text-[var(--dash-text-muted)]">
				Recorded automatically when the scraper requested a filter the form didn't expose. Stripped
				from future runs — clear to let the scraper re-attempt.
			</p>
			<ul class="space-y-1 text-sm">
				{#each unsupportedEntries as [canonical, values] (canonical)}
					<li
						class="flex items-center gap-3 border-b border-[var(--dash-border)] py-1 last:border-0"
					>
						<span
							class="rounded bg-[var(--dash-bg)] px-1.5 py-0.5 font-mono text-[var(--dash-text)]"
							>{canonical}</span
						>
						<span class="min-w-0 flex-1 truncate text-[var(--dash-text-muted)]">
							[{values.join(', ')}]
						</span>
						<form
							method="POST"
							action="?/clear_unsupported"
							use:enhance={() => {
								return async ({ result, update }) => {
									await update();
									if (result.type === 'success') await invalidateAll();
								};
							}}
						>
							<input type="hidden" name="canonical" value={canonical} />
							<button
								type="submit"
								class="rounded border border-[var(--dash-border)] px-2 py-0.5 text-xs text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)]"
							>
								Clear
							</button>
						</form>
					</li>
				{/each}
			</ul>
			<form
				method="POST"
				action="?/clear_unsupported"
				class="mt-3 text-right"
				use:enhance={({ cancel }) => {
					if (
						!confirm(
							`Clear all ${unsupportedEntries.length} unsupported-filter record(s) for this platform?`
						)
					) {
						cancel();
						return;
					}
					return async ({ result, update }) => {
						await update();
						if (result.type === 'success') await invalidateAll();
					};
				}}
			>
				<input type="hidden" name="canonical" value="__all__" />
				<button
					type="submit"
					class="rounded border border-[var(--dash-border)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)]"
				>
					Clear all
				</button>
			</form>
		{/if}
	</div>

	<!-- Change history -->
	<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4">
		<div class="mb-3 flex items-center gap-2">
			<FontAwesomeIcon icon={faHistory} class="h-4 w-4 text-[var(--dash-text-secondary)]" />
			<h3 class="text-sm font-medium text-[var(--dash-text)]">
				Change history
				<span class="font-normal text-[var(--dash-text-muted)]">
					({data.history.length})
				</span>
			</h3>
		</div>
		{#if data.history.length === 0}
			<p class="text-sm text-[var(--dash-text-muted)]">
				No platform-level edits recorded yet. (Preset CRUD is not audited in v1.)
			</p>
		{:else}
			<div class="space-y-2 text-xs">
				{#each data.history as entry (entry.id)}
					<div
						class="flex items-start gap-3 border-b border-[var(--dash-border)] py-1 last:border-0"
					>
						<span class="whitespace-nowrap text-[var(--dash-text-muted)]">
							{formatTimestamp(entry.changed_at)}
						</span>
						<span
							class="rounded bg-[var(--dash-bg)] px-1.5 py-0.5 font-mono text-[var(--dash-text)]"
							>{entry.field}</span
						>
						<div class="min-w-0 flex-1">
							<span class="text-red-600 line-through dark:text-red-400">
								{truncate(entry.old_value, 80)}
							</span>
							<span class="mx-1 text-[var(--dash-text-muted)]">→</span>
							<span class="text-green-600 dark:text-green-400">
								{truncate(entry.new_value, 80)}
							</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Danger zone -->
	<div class="rounded-lg border border-red-200 bg-[var(--dash-card)] p-4 dark:border-red-900">
		<div class="mb-2 flex items-center gap-2">
			<FontAwesomeIcon icon={faTrash} class="h-4 w-4 text-red-600 dark:text-red-400" />
			<h3 class="text-sm font-medium text-[var(--dash-text)]">Delete platform</h3>
		</div>

		{#if blockers.length > 0}
			<p class="text-xs text-[var(--dash-text-secondary)]">
				Referenced by {blockers.join(', ')}. Deleting would strip those references rather than fail,
				so it is refused.
				{#if data.platform.status === 'published'}
					Set the status to <code>draft</code> above to retire it without deleting.
				{:else}
					Remove what references it first, or leave it as the draft it already is.
				{/if}
			</p>
		{:else}
			<p class="text-xs text-[var(--dash-text-secondary)]">
				Nothing references this platform.
				{#if cascades.length > 0}
					Deleting it also removes {cascades.join(', ')}.
				{/if}
				There is no undo.
			</p>
			<form
				method="POST"
				action="?/delete"
				class="mt-3 text-right"
				use:enhance={({ cancel }) => {
					const also = cascades.length > 0 ? `\n\nThis also removes ${cascades.join(', ')}.` : '';
					if (!confirm(`Delete ${data.platform.name} permanently?${also}`)) {
						cancel();
						return;
					}
					deleting = true;
					return async ({ update }) => {
						await update();
						deleting = false;
					};
				}}
			>
				<button
					type="submit"
					disabled={deleting}
					class="rounded border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
				>
					{deleting ? 'Deleting…' : 'Delete platform'}
				</button>
			</form>
		{/if}
	</div>
</div>
