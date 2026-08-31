<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faExternalLinkAlt,
		faPenToSquare,
		faPlus,
		faTriangleExclamation
	} from '@fortawesome/free-solid-svg-icons';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Re-seeding the inputs from `form.values` only matters without JS — with
	// `use:enhance` the bound state survives a failed submit on its own.
	const submitted = form?.values ?? null;

	let showCreate = $state(!!form?.error);
	let creating = $state(false);
	let keyTouched = $state(!!submitted?.key);

	let name = $state(submitted?.name ?? '');
	let key = $state(submitted?.key ?? '');
	let url = $state(submitted?.url ?? '');
	let type = $state(submitted?.type ?? '');
	let status = $state(submitted?.status ?? 'draft');
	let loginPageUrl = $state(submitted?.login_page_url ?? '');
	let searchPageUrl = $state(submitted?.search_page_url ?? '');

	/** Mirrors the key convention already in the table: `We Work Remotely` →
	 *  `we-work-remotely`, `Arc.dev` → `arc-dev`. A suggestion only — the admin
	 *  can overwrite it, and once they do we stop tracking the name. */
	function slugify(value: string): string {
		return value
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');
	}

	// Free-text in the schema, so offer what the existing rows already use
	// instead of inventing an enum the rest of the app doesn't enforce.
	let knownTypes = $derived(
		[...new Set(data.platforms.map((p) => p.type).filter((t): t is string => !!t))].sort()
	);

	function resetCreateForm() {
		showCreate = false;
		keyTouched = false;
		name = '';
		key = '';
		url = '';
		type = '';
		status = 'draft';
		loginPageUrl = '';
		searchPageUrl = '';
	}
</script>

<svelte:head>
	<title>Job Platforms - Admin - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center justify-between gap-3">
		<h1 class="text-2xl font-semibold text-[var(--dash-text)]">Job Platforms</h1>
		<div class="flex items-center gap-3">
			<p class="text-sm text-[var(--dash-text-secondary)]">
				{data.platforms.length} total · {data.platforms.filter(
					(p) => p.status === 'published' && p.search_page_url !== null
				).length} suggestable
			</p>
			{#if !showCreate}
				<button
					type="button"
					onclick={() => (showCreate = true)}
					class="inline-flex items-center gap-1.5 rounded bg-[var(--dash-primary)] px-3 py-1.5 text-sm text-white hover:bg-[var(--dash-primary-hover)]"
				>
					<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
					New platform
				</button>
			{/if}
		</div>
	</div>

	<p class="text-sm text-[var(--dash-text-secondary)]">
		Any published platform with a <code>search_page_url</code> shows up in the AI suggestion flow at
		<code>/jobs/import/tasks</code>. Click a platform name to edit it, manage presets, see signals,
		and review change history.
	</p>

	{#if form?.error}
		<div
			class="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
		>
			<FontAwesomeIcon icon={faTriangleExclamation} class="h-4 w-4" />
			{form.error}
		</div>
	{/if}

	{#if showCreate}
		<form
			method="POST"
			action="?/create"
			class="space-y-4 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4"
			use:enhance={() => {
				creating = true;
				return async ({ update }) => {
					await update();
					creating = false;
				};
			}}
		>
			<h3 class="text-sm font-medium text-[var(--dash-text)]">New platform</h3>

			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label
						class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
						for="new-name">Name</label
					>
					<input
						id="new-name"
						name="name"
						type="text"
						bind:value={name}
						oninput={() => {
							if (!keyTouched) key = slugify(name);
						}}
						required
						placeholder="Hacker News Jobs"
						class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)]"
					/>
				</div>
				<div>
					<label
						class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
						for="new-key">Key</label
					>
					<input
						id="new-key"
						name="key"
						type="text"
						bind:value={key}
						oninput={() => (keyTouched = true)}
						required
						pattern="[a-z0-9]+(-[a-z0-9]+)*"
						placeholder="hacker-news-jobs"
						class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 font-mono text-sm text-[var(--dash-text)]"
					/>
					<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
						Lowercase slug, unique, and permanent in practice — profile export/import matches
						platforms by key, not id.
					</p>
				</div>
				<div class="md:col-span-2">
					<label
						class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
						for="new-url">Base URL</label
					>
					<input
						id="new-url"
						name="url"
						type="url"
						bind:value={url}
						required
						placeholder="https://example.com/"
						class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)]"
					/>
				</div>
				<div>
					<label
						class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
						for="new-status">Status</label
					>
					<select
						id="new-status"
						name="status"
						bind:value={status}
						class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)]"
					>
						<option value="draft">draft</option>
						<option value="published">published</option>
					</select>
					<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
						Draft keeps it out of the suggestion flow until the search page is configured.
					</p>
				</div>
				<div>
					<label
						class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
						for="new-type">Type</label
					>
					<input
						id="new-type"
						name="type"
						type="text"
						bind:value={type}
						list="platform-types"
						placeholder="job_boards / vetted_platforms / …"
						class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)]"
					/>
					<datalist id="platform-types">
						{#each knownTypes as t (t)}
							<option value={t}></option>
						{/each}
					</datalist>
				</div>
				<div class="md:col-span-2">
					<label
						class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
						for="new-login">Login page URL</label
					>
					<input
						id="new-login"
						name="login_page_url"
						type="url"
						bind:value={loginPageUrl}
						placeholder="https://example.com/login"
						class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)]"
					/>
					<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
						Optional, but discovery needs it — leave it empty and you can still add it later.
					</p>
				</div>
				<div class="md:col-span-2">
					<label
						class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
						for="new-search">Search page URL</label
					>
					<input
						id="new-search"
						name="search_page_url"
						type="url"
						bind:value={searchPageUrl}
						placeholder="https://example.com/jobs"
						class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)]"
					/>
					<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
						Optional — discovery usually fills this in. Falls back to the base URL when empty.
					</p>
				</div>
			</div>

			<div class="flex justify-end gap-2">
				<button
					type="button"
					onclick={resetCreateForm}
					class="rounded border border-[var(--dash-border)] px-4 py-2 text-sm text-[var(--dash-text)] hover:bg-[var(--dash-bg)]"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={creating}
					class="rounded bg-[var(--dash-primary)] px-4 py-2 text-white hover:bg-[var(--dash-primary-hover)] disabled:opacity-60"
				>
					{creating ? 'Creating…' : 'Create platform'}
				</button>
			</div>
		</form>
	{/if}

	<div class="overflow-x-auto rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)]">
		<table class="w-full text-sm">
			<thead
				class="bg-[var(--dash-bg)] text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase"
			>
				<tr>
					<th class="px-3 py-2 text-left">Name</th>
					<th class="px-3 py-2 text-left">Key</th>
					<th class="px-3 py-2 text-left">Status</th>
					<th class="px-3 py-2 text-left">Search form</th>
					<th class="px-3 py-2 text-left">Signals</th>
					<th class="px-3 py-2 text-left">Edits</th>
					<th class="px-3 py-2 text-right"></th>
				</tr>
			</thead>
			<tbody>
				{#each data.platforms as platform (platform.id)}
					<tr class="border-t border-[var(--dash-border)]">
						<td class="px-3 py-2 font-medium">
							<a
								href="/admin/job-platforms/{platform.id}"
								class="text-[var(--dash-primary)] hover:underline">{platform.name}</a
							>
							<a
								href={platform.url}
								target="_blank"
								rel="noopener noreferrer"
								class="ml-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)]"
								title="Open base URL"
							>
								<FontAwesomeIcon icon={faExternalLinkAlt} class="h-3 w-3" />
							</a>
						</td>
						<td class="px-3 py-2 font-mono text-xs text-[var(--dash-text-secondary)]">
							{platform.key}
						</td>
						<td class="px-3 py-2">
							<span
								class="inline-flex items-center rounded px-2 py-0.5 text-xs {platform.status ===
								'published'
									? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
									: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}"
								>{platform.status}</span
							>
						</td>
						<td class="px-3 py-2 text-xs whitespace-nowrap tabular-nums">
							{#if platform.search_page_url}
								<span class="text-green-600 dark:text-green-400">configured</span>
							{:else}
								<span class="text-[var(--dash-text-muted)]">none</span>
							{/if}
						</td>
						<td class="px-3 py-2 text-xs whitespace-nowrap tabular-nums">
							{#if platform.success_count + platform.failure_count > 0}
								<span class="text-green-600 dark:text-green-400" title="Successful runs"
									>{platform.success_count}</span
								>
								<span class="mx-0.5 text-[var(--dash-text-muted)]">/</span>
								<span class="text-red-600 dark:text-red-400" title="Failed runs"
									>{platform.failure_count}</span
								>
							{:else}
								<span class="text-[var(--dash-text-muted)]">—</span>
							{/if}
						</td>
						<td class="px-3 py-2 text-[var(--dash-text-secondary)] tabular-nums"
							>{platform.change_count}</td
						>
						<td class="px-3 py-2 text-right">
							<a
								href="/admin/job-platforms/{platform.id}"
								class="inline-flex items-center gap-1 rounded border border-[var(--dash-border)] px-2 py-1 text-xs text-[var(--dash-text)] hover:bg-[var(--dash-bg)]"
							>
								<FontAwesomeIcon icon={faPenToSquare} class="h-3 w-3" />
								Edit
							</a>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
