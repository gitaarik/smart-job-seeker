<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { deserialize, enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { onMount } from 'svelte';
	import {
		faArrowUpRightFromSquare,
		faCalendar,
		faClock,
		faDesktop,
		faExclamationTriangle,
		faMagicWandSparkles,
		faPlus,
		faSearch,
		faSortAmountDown,
		faTimes
	} from '@fortawesome/free-solid-svg-icons';
	import { getSearchTaskStatusIcon } from '$lib/search-task-status';
	import { searchTaskDisplayName } from '$lib/format';
	import { formatDateTime as fmtDateTime } from '$lib/format-date';
	import Spinner from '$lib/components/Spinner.svelte';
	import PlatformLogo from '$lib/components/PlatformLogo.svelte';
	import EmptyState from '../../../profile/components/EmptyState.svelte';
	import SimplifiedAddTaskForm from '../components/SimplifiedAddTaskForm.svelte';
	import SuggestionsList, { type Suggestion } from '../components/SuggestionsList.svelte';
	import ImportTaskBlockerBadge from '../components/ImportTaskBlockerBadge.svelte';
	import AuthBlockNotice from '../components/AuthBlockNotice.svelte';
	import { computeImportTaskBlockers, providerRequiresDevice } from '$lib/import-tasks/readiness';
	import { track } from '$lib/tools/analytics';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let searchTasks = $derived(data.searchTasks);
	let showAddForm = $state(false);

	// Sort options (initialized from server-persisted preference)
	type SortOption = 'added' | 'alpha' | 'last_run';
	const validSorts: SortOption[] = ['added', 'alpha', 'last_run'];
	let sortBy = $state<SortOption>(
		validSorts.includes(data.searchTaskSort as SortOption)
			? (data.searchTaskSort as SortOption)
			: 'added'
	);

	function setSortBy(value: SortOption) {
		sortBy = value;
		fetch(`/api/profile/${data.profileId}/ui-preferences`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ searchTaskSort: value })
		});
	}

	// Per-row optimistic active-state overrides so the toggle feels instant
	// without reloading the list. Keyed by task id; falls back to the row's
	// server value.
	let activeOverrides = $state<Record<number, boolean>>({});
	function isActive(s: { id: number; is_active: boolean | null }): boolean {
		return activeOverrides[s.id] ?? !!s.is_active;
	}
	async function toggleActive(s: { id: number; is_active: boolean | null }, e: Event) {
		// The whole row is a link — don't navigate when toggling.
		e.preventDefault();
		e.stopPropagation();
		const next = !isActive(s);
		activeOverrides[s.id] = next; // optimistic
		try {
			const res = await fetch(`/api/import-tasks/${s.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ is_active: next })
			});
			if (!res.ok) activeOverrides[s.id] = !next; // revert on failure
		} catch {
			activeOverrides[s.id] = !next;
		}
	}

	let sortedSearchTasks = $derived.by(() => {
		const tasks = [...searchTasks];
		switch (sortBy) {
			case 'alpha':
				return tasks.sort((a, b) => {
					const nameA = a.job_platform?.name?.toLowerCase() ?? '';
					const nameB = b.job_platform?.name?.toLowerCase() ?? '';
					return nameA.localeCompare(nameB);
				});
			case 'last_run': {
				const activeStatuses = ['running', 'queued', 'blocked', 'stopping'];
				return tasks.sort((a, b) => {
					const aActive = activeStatuses.includes(a.status ?? '') ? 1 : 0;
					const bActive = activeStatuses.includes(b.status ?? '') ? 1 : 0;
					if (aActive !== bActive) return bActive - aActive;
					const dateA = a.last_run ? new Date(a.last_run).getTime() : 0;
					const dateB = b.last_run ? new Date(b.last_run).getTime() : 0;
					return dateB - dateA;
				});
			}
			case 'added':
			default:
				return tasks.sort((a, b) => {
					const dateA = a.date_created ? new Date(a.date_created).getTime() : 0;
					const dateB = b.date_created ? new Date(b.date_created).getTime() : 0;
					return dateB - dateA;
				});
		}
	});

	// Desktop scraper connection status — the device that would be used by default.
	// Prefers user's own connected devices, then connected devices shared with them.
	interface PreferredDevice {
		apiKeyId: number;
		apiKeyName: string;
		connectedAt: string;
		lastHeartbeat: string;
		clientVersion: string;
		isShared: boolean;
		ownerLabel: string | null;
	}
	let preferredDevice = $state<PreferredDevice | null>(null);
	let connectedDeviceIds = $state<number[]>([]);
	let desktopStatusChecked = $state(false);
	let desktopConnected = $derived(preferredDevice !== null);

	// Merge the loaded api-key devices with live tunnel-status data so the
	// add-form's device picker can show per-device "(offline)" markers like
	// the edit page does.
	let devicesWithStatus = $derived(
		data.apiKeyDevices.map((d) => ({
			...d,
			connected: connectedDeviceIds.includes(d.apiKeyId)
		}))
	);

	let anyTaskUsesDesktop = $derived(searchTasks.some((s) => s.browser_provider === 'tunnel'));

	async function checkDesktopStatus() {
		const sharedKeyIds = data.apiKeyDevices.filter((d) => d.shared).map((d) => d.apiKeyId);
		try {
			const [preferredRes, profileRes, sharedResults] = await Promise.all([
				fetch(`/api/tunnel/status/preferred`),
				fetch(`/api/tunnel/status`),
				Promise.all(
					sharedKeyIds.map(async (apiKeyId) => {
						try {
							const res = await fetch(`/api/tunnel/status?apiKeyId=${apiKeyId}`);
							if (!res.ok) return null;
							const body = await res.json();
							return (body.devices ?? []).length > 0 ? apiKeyId : null;
						} catch {
							return null;
						}
					})
				)
			]);
			preferredDevice = (await preferredRes.json()).device ?? null;
			const profileStatus = await profileRes.json();
			const ownIds: number[] = (profileStatus.devices ?? []).map(
				(d: { apiKeyId: number }) => d.apiKeyId
			);
			connectedDeviceIds = [...ownIds, ...sharedResults.filter((id): id is number => id !== null)];
		} catch {
			preferredDevice = null;
			connectedDeviceIds = [];
		} finally {
			desktopStatusChecked = true;
		}
	}

	onMount(() => {
		checkDesktopStatus();
		const interval = setInterval(checkDesktopStatus, 15000);
		return () => clearInterval(interval);
	});

	// Form states for new entry
	let newNote = $state('');
	let newSearchUrl = $state('');
	let newSearchTerm = $state('');
	let newLoginPageUrl = $state('');

	// Auto-detected platform state
	let detectedPlatform = $state<{
		id: number;
		name: string;
		url: string;
		loginPageUrl: string | null;
		isNew: boolean;
	} | null>(null);
	let detectingPlatform = $state(false);

	// Credentials state for new entry — includes both the user's own
	// credentials and any shared with them by contacts for the detected
	// platform. Passwords/security answers stay server-side; only IDs and
	// usernames cross the wire so the user can pick a credential to use.
	let existingCredentials = $state<
		Array<{
			id: number;
			username: string | null;
			status: string;
			shared?: boolean;
			owner_user_id?: string | null;
			owner_label?: string | null;
		}>
	>([]);

	// Debounce timer
	let urlDebounce: ReturnType<typeof setTimeout> | null = null;

	const tz = $derived(($page.data as { userTimezone: string | null }).userTimezone || undefined);
	const tf = $derived(
		($page.data as { timeFormat: import('$lib/format-date').TimeFormat }).timeFormat
	);

	function formatDate(date: Date | string | null): string {
		return fmtDateTime(date, tf, { timezone: tz || null, fallback: 'Never' });
	}

	function formatRelativeTime(date: Date | string | null): string {
		if (!date) return 'Never';
		const d = typeof date === 'string' ? new Date(date) : date;
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		const diffHours = Math.floor(diffMs / 3600000);
		if (diffHours < 24) return `${diffHours}h ago`;
		const diffDays = Math.floor(diffMs / 86400000);
		if (diffDays === 1) return '1 day ago';
		if (diffDays < 7) return `${diffDays} days ago`;
		if (diffDays < 14) return '1 week ago';
		const diffWeeks = Math.floor(diffDays / 7);
		if (diffWeeks < 5) return `${diffWeeks} weeks ago`;
		const diffMonths = Math.floor(diffDays / 30);
		if (diffMonths === 1) return '1 month ago';
		if (diffMonths < 12) return `${diffMonths} months ago`;
		return formatDate(date);
	}

	function formatFutureRelativeTime(date: Date): string {
		const now = new Date();
		const diffMs = date.getTime() - now.getTime();
		if (diffMs <= 0) return 'Due now';
		const diffMins = Math.floor(diffMs / 60000);
		if (diffMins < 60) return `In ${diffMins}m`;
		const diffHours = Math.floor(diffMs / 3600000);
		const remainMins = Math.floor((diffMs % 3600000) / 60000);
		if (diffHours < 24) return `In ${diffHours}h ${remainMins}m`;
		const diffDays = Math.floor(diffMs / 86400000);
		if (diffDays === 1) return 'Tomorrow';
		if (diffDays < 7) return `In ${diffDays} days`;
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			timeZone: tz
		});
	}

	async function detectPlatformFromUrl(searchUrl: string) {
		if (!searchUrl) {
			detectedPlatform = null;
			existingCredentials = [];
			return;
		}

		// Extract base URL
		let baseUrl: string;
		try {
			const parsed = new URL(searchUrl.startsWith('http') ? searchUrl : `https://${searchUrl}`);
			baseUrl = parsed.origin;
		} catch {
			return;
		}

		detectingPlatform = true;

		try {
			const response = await fetch(
				`/api/platforms/detect?url=${encodeURIComponent(baseUrl)}&profileId=${data.profileId}`
			);
			if (response.ok) {
				const result = await response.json();
				detectedPlatform = result.platform;
				existingCredentials = result.credentials || [];
				if (result.platform.loginPageUrl) {
					newLoginPageUrl = result.platform.loginPageUrl;
				}
			}
		} catch {
			// Ignore errors
		} finally {
			detectingPlatform = false;
		}
	}

	function handleSearchUrlInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		newSearchUrl = value;

		// Debounce platform detection
		if (urlDebounce) clearTimeout(urlDebounce);
		urlDebounce = setTimeout(() => detectPlatformFromUrl(value), 500);
	}

	function resetAddForm() {
		showAddForm = false;
		newNote = '';
		newSearchUrl = '';
		newSearchTerm = '';
		newLoginPageUrl = '';
		detectedPlatform = null;
		existingCredentials = [];
	}

	// ── Profile-tailored task suggestions ──
	// After the URL-template flow was removed, suggestions reference a
	// platform_id + a free-form keywords string. The scraper handles the
	// search-form configuration at run time using the platform's
	// `search_page_url`; no URL is constructed up-front.
	let suggestions = $state<Suggestion[] | null>(null);
	let loadingSuggestions = $state(false);
	let suggestionsError = $state<string | null>(null);
	// Non-error status message — e.g. "every platform already has a task".
	// Separate from suggestionsError so we can render it neutrally instead of
	// in the red error styling.
	let suggestionsInfo = $state<string | null>(null);

	async function getSuggestions() {
		loadingSuggestions = true;
		suggestionsError = null;
		suggestionsInfo = null;
		try {
			const res = await fetch('/api/jobs/import/suggest', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: '{}'
			});
			const body = await res.json();
			if (!res.ok || !body.success) {
				suggestionsError =
					body.message || "Couldn't generate suggestions. Try again or start blank.";
				return;
			}
			suggestions = body.tasks.map((t: Suggestion, i: number) => ({
				...t,
				_key: i,
				filters: t.filters ?? {}
			}));
			if (suggestions !== null && suggestions.length === 0 && body.message) {
				suggestionsInfo = body.message;
			}
		} catch (err) {
			suggestionsError = err instanceof Error ? err.message : 'Network error fetching suggestions';
		} finally {
			loadingSuggestions = false;
		}
	}

	async function acceptSuggestion(suggestion: Suggestion) {
		if (suggestion.submitting || suggestion.accepted) return;
		suggestion.submitting = true;

		const formData = new FormData();
		if (suggestion.keywords) {
			formData.append('search_term', suggestion.keywords);
		}
		formData.append('search_filters', JSON.stringify(suggestion.filters ?? {}));
		formData.append('browser_provider', 'hosted');
		formData.append('login_mode', 'none');
		formData.append('note', suggestion.note);
		// Pass the platform_id directly so getOrCreatePlatform can short-circuit
		// the URL-based lookup. Without a platform_url getOrCreatePlatform would
		// bail; we look up the platform's own url server-side from this id.
		formData.append('platform_id', String(suggestion.platform_id));
		// Match the defaults that SearchTaskFields fills in for the regular form
		// path so suggestion-derived tasks behave the same on first run.
		formData.append('max_jobs', String(data.defaultMaxJobs ?? 25));
		formData.append('stop_after_duplicates', '5');
		formData.append('skip_existing', 'true');
		formData.append('keep_minimized', 'true');

		try {
			const res = await fetch('?/create', { method: 'POST', body: formData });
			// SvelteKit form-action responses over raw fetch encode the action's
			// return value in `data` as a devalue string; deserialize to get
			// structured access to taskId / error.
			const result = deserialize(await res.text()) as
				| { type: 'success'; data?: { taskId?: number } }
				| { type: 'failure'; data?: { error?: string } }
				| { type: 'redirect'; location: string }
				| { type: 'error'; error: { message?: string } };
			if (result.type === 'redirect') {
				await goto(result.location);
				return;
			}
			if (result.type === 'success' && result.data?.taskId) {
				track('search_task_created');
				track('suggestion_accepted');
				// Land the user on the task's edit page (same as the manual-add
				// flow) instead of appending to the list below — that "new task at
				// the bottom" jump is disorienting after the suggestion card they
				// were just looking at.
				await goto(`/jobs/import/tasks/${result.data.taskId}`);
				return;
			}
			suggestionsError =
				(result.type === 'failure' && result.data?.error) ||
				"Couldn't add this suggestion. You can edit it and try again, or start blank.";
			suggestion.submitting = false;
		} catch (err) {
			suggestionsError = err instanceof Error ? err.message : 'Network error';
			suggestion.submitting = false;
		}
	}

	function dismissSuggestion(suggestion: Suggestion) {
		if (!suggestions) return;
		suggestions = suggestions.filter((s) => s !== suggestion);
	}

	function clearSuggestions() {
		suggestions = null;
		suggestionsError = null;
		suggestionsInfo = null;
	}

	function handleAddSubmit() {
		return async ({
			result
		}: {
			result: { type: string; data?: { taskId?: number } };
			update: () => Promise<void>;
		}) => {
			if (result.type === 'success' && result.data?.taskId) {
				track('search_task_created');
				resetAddForm();
				goto(`/jobs/import/tasks/${result.data.taskId}`);
			}
		};
	}

	function getStatusColor(search: (typeof searchTasks)[0]): string {
		if (search.status === 'running' || search.status === 'queued') {
			return 'text-blue-500';
		}
		if (search.status === 'stopping') return 'text-orange-500';
		if (search.status === 'blocked' || search.status === 'partial') {
			return 'text-yellow-600';
		}
		if (search.status === 'error') return 'text-red-500';
		if (search.status === 'success') return 'text-[var(--dash-success)]';
		if (search.last_run) return 'text-[var(--dash-success)]';
		return 'text-[var(--dash-text-muted)]';
	}

	function getStatusBgColor(search: (typeof searchTasks)[0]): string {
		if (search.status === 'running' || search.status === 'queued') {
			return 'bg-blue-500/10';
		}
		if (search.status === 'stopping') return 'bg-orange-500/10';
		if (search.status === 'blocked' || search.status === 'partial') {
			return 'bg-yellow-500/10';
		}
		if (search.status === 'error') return 'bg-red-500/10';
		if (search.status === 'success') return 'bg-green-500/10';
		if (search.last_run) return 'bg-green-500/10';
		return 'bg-[var(--dash-bg)]';
	}

	// Per-task unmet requirements (needs a device, credentials, etc). Same
	// computation the detail page shows and the run endpoint enforces. Device
	// status is treated as connected until the live check resolves so the badge
	// doesn't flash before we know.
	function blockersFor(search: (typeof searchTasks)[0]) {
		let deviceConnected = true;
		if (
			desktopStatusChecked &&
			providerRequiresDevice(search.browser_provider, data.serverBrowserProvider)
		) {
			deviceConnected = search.sjsbrowser_api_key
				? connectedDeviceIds.includes(search.sjsbrowser_api_key)
				: desktopConnected;
		}
		return computeImportTaskBlockers({
			platformId: search.platform_id,
			platformName: search.job_platform?.name ?? null,
			taskSearchUrl: search.search_url,
			platformSearchPageUrl: search.job_platform?.search_page_url ?? null,
			platformUrl: search.job_platform?.url ?? null,
			platformLoginPageUrl: search.job_platform?.login_page_url ?? null,
			loginMode: search.login_mode,
			hasCredential: search.platform_profile_id != null,
			browserProvider: search.browser_provider,
			serverBrowserProvider: data.serverBrowserProvider,
			deviceConnected
		});
	}

	// Group the list so tasks that can run now sit above the ones that still
	// need setup (suggestions to build on). Both derive from the same blocker
	// computation as the per-row badge.
	let readyTasks = $derived(sortedSearchTasks.filter((s) => blockersFor(s).length === 0));
	let needsSetupTasks = $derived(sortedSearchTasks.filter((s) => blockersFor(s).length > 0));
	let orderedTasks = $derived([...readyTasks, ...needsSetupTasks]);
	let firstNeedsSetupId = $derived(needsSetupTasks[0]?.id ?? null);
	let showTaskGroups = $derived(readyTasks.length > 0 && needsSetupTasks.length > 0);
</script>

<svelte:head>
	<title>Import Tasks - Job Import - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-4">
	{#if !showAddForm && searchTasks.length > 0}
		<div class="flex flex-wrap items-center gap-4">
			{#if desktopStatusChecked && (anyTaskUsesDesktop || desktopConnected)}
				<div class="flex items-center gap-2 text-xs text-[var(--dash-text-secondary)]">
					<span
						class="h-2 w-2 rounded-full {desktopConnected
							? 'bg-green-500'
							: 'bg-[var(--dash-text-muted)]'}"
					></span>
					<FontAwesomeIcon
						icon={faDesktop}
						class="h-3 w-3 {desktopConnected ? 'text-green-500' : ''}"
					/>
					{#if preferredDevice}
						{preferredDevice.apiKeyName}
						{#if preferredDevice.isShared && preferredDevice.ownerLabel}
							<span class="text-[var(--dash-text-muted)]">
								(shared by {preferredDevice.ownerLabel})
							</span>
						{/if}
					{:else}
						No device connected — <a
							href="/jobs/import/devices"
							class="underline hover:text-[var(--dash-primary)]">Setup guide</a
						>
					{/if}
				</div>
			{/if}

			{#if searchTasks.length > 1}
				<div class="flex items-center gap-2 text-xs text-[var(--dash-text-secondary)]">
					<FontAwesomeIcon icon={faSortAmountDown} class="h-3 w-3" />
					{#each [{ value: 'added', label: 'Date added' }, { value: 'last_run', label: 'Last run' }, { value: 'alpha', label: 'A–Z' }] as opt}
						<button
							type="button"
							onclick={() => setSortBy(opt.value as SortOption)}
							class="
                rounded-full px-2 py-0.5 transition-colors {sortBy === opt.value
								? 'bg-[var(--dash-primary)] text-white'
								: 'bg-[var(--dash-bg)] hover:bg-[var(--dash-border)]'}
              "
						>
							{opt.label}
						</button>
					{/each}
				</div>
			{/if}

			<div class="ml-auto flex items-center gap-2">
				<form method="POST" action="?/toggleAutoImport">
					<input type="hidden" name="enabled" value={data.autoImportEnabled ? 'false' : 'true'} />
					<button
						type="submit"
						title="When on, we keep a starter set of import tasks in sync with your profile and match preferences. New ones are added paused for you to review and activate."
						class="
              rounded-lg px-3 py-1.5 text-xs whitespace-nowrap transition-colors {data.autoImportEnabled
							? 'bg-purple-500/15 text-purple-600 hover:bg-purple-500/25'
							: 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)] hover:bg-[var(--dash-border)]'}
            "
					>
						Auto-suggest: {data.autoImportEnabled ? 'On' : 'Off'}
					</button>
				</form>
				<button
					type="button"
					onclick={() => (showAddForm = true)}
					class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[var(--dash-primary-hover)]"
				>
					<FontAwesomeIcon icon={faPlus} class="h-3 w-3" />
					Add Import
				</button>
			</div>
		</div>
	{/if}

	{#if form?.error}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{form.error}</p>
		</div>
	{/if}

	<!-- Add Form -->
	{#if showAddForm}
		<SimplifiedAddTaskForm
			platforms={data.importablePlatforms}
			defaultMaxJobs={data.defaultMaxJobs}
			{preferredDevice}
			deviceStatusChecked={desktopStatusChecked}
			onCancel={resetAddForm}
		/>
	{/if}

	<!-- Job Searches List -->
	{#if searchTasks.length === 0 && !showAddForm && (!suggestions || suggestions.length === 0)}
		<div
			class="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--dash-border)] px-6 py-12"
		>
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--dash-bg)]">
				<FontAwesomeIcon icon={faSearch} class="h-8 w-8 text-[var(--dash-text-muted)]" />
			</div>
			<h3 class="mb-2 text-lg font-medium text-[var(--dash-text)]">No search tasks yet</h3>
			<p class="mb-6 max-w-sm text-center text-[var(--dash-text-secondary)]">
				Let AI suggest searches tailored to your profile, or start with a blank form.
			</p>

			{#if suggestionsError}
				<p class="mb-3 max-w-sm text-center text-xs text-red-600 dark:text-red-400">
					{suggestionsError}
				</p>
			{/if}

			<div class="flex flex-col gap-2 sm:flex-row">
				<button
					type="button"
					onclick={getSuggestions}
					disabled={loadingSuggestions}
					class="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:opacity-60"
				>
					{#if loadingSuggestions}
						<Spinner size="w-4 h-4" />
						Analyzing your profile…
					{:else}
						<FontAwesomeIcon icon={faMagicWandSparkles} class="h-4 w-4" />
						Suggest searches for me
					{/if}
				</button>
				<button
					type="button"
					onclick={() => (showAddForm = true)}
					class="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
				>
					<FontAwesomeIcon icon={faPlus} class="h-4 w-4" />
					Add custom search
				</button>
			</div>
		</div>
	{:else if !showAddForm}
		<div class="space-y-3">
			{#each orderedTasks as search, i (search.id)}
				{@const statusIcon = getSearchTaskStatusIcon(search)}
				{@const taskBlockers = blockersFor(search)}
				{#if showTaskGroups && i === 0}
					<h2
						class="px-1 text-xs font-medium tracking-wide text-[var(--dash-text-secondary)] uppercase"
					>
						Importing now
					</h2>
				{/if}
				{#if showTaskGroups && search.id === firstNeedsSetupId}
					<h2
						class="px-1 pt-2 text-xs font-medium tracking-wide text-[var(--dash-text-secondary)] uppercase"
					>
						Suggestions — finish setup to start
					</h2>
				{/if}
				<a
					href="/jobs/import/tasks/{search.id}"
					class="block rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-3 transition-colors hover:bg-[var(--dash-bg)] sm:p-4"
				>
					<div class="flex items-start gap-3">
						<!-- Desktop: Platform logo on the left -->
						<div class="hidden flex-shrink-0 md:flex">
							<div
								class="
                  h-12 w-12 rounded-lg {getStatusBgColor(search)} flex items-center justify-center
                "
							>
								<PlatformLogo platformUrl={search.job_platform?.url} size="w-7 h-7" />
							</div>
						</div>

						<div class="min-w-0 flex-1">
							<!-- Title: platform name + optional note -->
							<h3 class="text-sm font-medium text-[var(--dash-text)] sm:text-base">
								{search.job_platform?.name || 'Search task'}
								{#if search.note}
									<span class="font-normal text-[var(--dash-text-secondary)]">—</span>
									<span class="text-sm font-normal text-[var(--dash-text-secondary)]"
										>{search.note}</span
									>
								{/if}
							</h3>
							<!-- Status / control pills, on their own row below the title -->
							<div class="mt-1.5 flex flex-wrap items-center gap-2">
								<ImportTaskBlockerBadge blockers={taskBlockers} />
								{#if search.status === 'running'}
									<span
										class="flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs whitespace-nowrap text-blue-600"
									>
										<Spinner size="w-3 h-3" />
										Running
									</span>
								{:else if search.status === 'queued'}
									<span
										class="flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs whitespace-nowrap text-blue-600"
									>
										<FontAwesomeIcon icon={faClock} class="h-3 w-3" />
										Queued
									</span>
								{:else if search.status === 'stopping'}
									<span
										class="flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs whitespace-nowrap text-orange-600"
									>
										<Spinner size="w-3 h-3" />
										Stopping
									</span>
								{:else if search.status === 'blocked'}
									<span
										class="flex animate-pulse items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs whitespace-nowrap text-yellow-600"
									>
										<FontAwesomeIcon icon={faExclamationTriangle} class="h-3 w-3" />
										Action needed
									</span>
								{:else if search.status === 'error'}
									<span
										class="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs whitespace-nowrap text-red-600"
									>
										<FontAwesomeIcon icon={faTimes} class="h-3 w-3" />
										Error
									</span>
								{:else}
									<button
										type="button"
										role="switch"
										aria-checked={isActive(search)}
										onclick={(e) => toggleActive(search, e)}
										title={isActive(search)
											? 'Active — click to pause'
											: 'Paused — click to activate'}
										class="
                      group flex cursor-pointer items-center gap-1.5 text-xs whitespace-nowrap
                      text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]
                    "
									>
										<span
											class="
                        relative inline-flex h-4 w-7 items-center rounded-full transition-colors {isActive(
												search
											)
												? 'bg-green-500'
												: 'bg-[var(--dash-border)] group-hover:bg-[var(--dash-text-muted)]'}
                      "
										>
											<span
												class="
                          inline-block h-3 w-3 rounded-full bg-white shadow transition-transform {isActive(
													search
												)
													? 'translate-x-3.5'
													: 'translate-x-0.5'}
                        "
											></span>
										</span>
										{isActive(search) ? 'Active' : 'Paused'}
									</button>
								{/if}
								{#if search.auth_block_kind}
									<span
										class="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs whitespace-nowrap text-amber-600 dark:text-amber-400"
										title={search.auto_disabled_at
											? 'Switched off after weeks of being unable to log in — run it once yourself to sort the login out.'
											: "Can't get past the platform's login, so it's retrying less often. Run it once yourself to fix it."}
									>
										{search.auto_disabled_at ? 'Login blocked — off' : 'Login blocked'}
									</span>
								{/if}
								{#if search.origin === 'auto'}
									<span
										class="rounded-full bg-purple-500/15 px-2 py-0.5 text-xs whitespace-nowrap text-purple-600"
										title="Auto-suggested from your profile and match preferences. Review and activate to start scraping."
									>
										Auto-suggested
									</span>
								{/if}
								{#if search.browser_provider === 'tunnel'}
									<span
										class={desktopConnected
											? 'text-green-500'
											: desktopStatusChecked
												? 'text-red-400'
												: 'text-[var(--dash-text-muted)]'}
										title={preferredDevice ? preferredDevice.apiKeyName : 'No device connected'}
									>
										<FontAwesomeIcon icon={faDesktop} class="h-3.5 w-3.5" />
									</span>
								{/if}
								{#if search.schedule_interval_hours}
									{@const days = search.schedule_interval_hours / 24}
									{@const prefHour = search.schedule_preferred_hour ?? 9}
									{@const h12 = prefHour === 0 ? 12 : prefHour > 12 ? prefHour - 12 : prefHour}
									{@const ampm = prefHour < 12 ? 'AM' : 'PM'}
									<span
										class="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs whitespace-nowrap text-purple-600 dark:text-purple-400"
										title="Scheduled auto-run at {h12}:00 {ampm}"
									>
										{days >= 14
											? `Every ${days / 7} weeks`
											: days >= 7
												? 'Weekly'
												: days > 1
													? `Every ${days} days`
													: 'Daily'} at {h12}
										{ampm}
									</span>
								{/if}
							</div>

							<!-- Status info -->
							<div class="mt-2 space-y-1.5 text-xs">
								{#if search.status === 'queued'}
									<div class="text-[var(--dash-text-muted)]">
										{search.status_message || 'Waiting in queue...'}
									</div>
								{:else if search.status === 'running'}
									<div class="flex items-center gap-1 text-[var(--dash-text-secondary)]">
										<Spinner size={statusIcon.iconSize} color="var(--dash-primary)" />
										<span>{search.status_message || 'Running...'}</span>
									</div>
								{:else if search.status === 'stopping'}
									<div class="flex items-center gap-1">
										<Spinner size={statusIcon.iconSize} color="var(--dash-error)" />
										<span class="text-orange-600">Stopping...</span>
									</div>
								{:else if search.status === 'blocked'}
									<div class="flex items-center gap-1">
										<FontAwesomeIcon
											icon={statusIcon.icon}
											class="{statusIcon.iconSize} {statusIcon.colorClass}"
										/>
										<span class="text-[var(--dash-warning)]">{search.status_message}</span>
									</div>
								{:else if search.status === 'error'}
									<div class="flex items-center gap-1">
										<FontAwesomeIcon
											icon={statusIcon.icon}
											class="{statusIcon.iconSize} {statusIcon.colorClass}"
										/>
										<span class="text-[var(--dash-error)]">{search.status_message}</span>
									</div>
								{:else if search.status === 'partial'}
									<div class="flex items-center gap-1.5 text-[var(--dash-text-secondary)]">
										<FontAwesomeIcon
											icon={statusIcon.icon}
											class="{statusIcon.iconSize} {statusIcon.colorClass}"
										/>
										<span class="font-medium text-[var(--dash-text-secondary)]">Last run</span>
										<span>{formatRelativeTime(search.last_run)}</span>
										<span class="text-[var(--dash-text-muted)]">— {search.status_message}</span>
									</div>
								{:else if search.status === 'cancelled'}
									<div class="flex items-center gap-1">
										<FontAwesomeIcon
											icon={statusIcon.icon}
											class="{statusIcon.iconSize} {statusIcon.colorClass}"
										/>
										<span class="text-[var(--dash-text-muted)]"
											>{search.status_message || 'Cancelled'}</span
										>
									</div>
								{:else if search.last_run}
									<div class="flex items-center gap-1.5 text-[var(--dash-text-secondary)]">
										<FontAwesomeIcon
											icon={statusIcon.icon}
											class="{statusIcon.iconSize} {statusIcon.colorClass}"
										/>
										<span class="font-medium text-[var(--dash-text-secondary)]">Last run</span>
										<span
											>{formatRelativeTime(
												search.last_run
											)}{#if search.last_run_jobs_found}{' '}({search.last_run_jobs_found} jobs){/if}</span
										>
									</div>
								{:else}
									<div class="text-[var(--dash-text-muted)]">Never run</div>
								{/if}

								{#if search.schedule_interval_hours && search.next_scheduled_run}
									{@const nextRun = new Date(search.next_scheduled_run)}
									<div class="flex items-center gap-1.5 text-[var(--dash-text-secondary)]">
										<FontAwesomeIcon
											icon={faCalendar}
											class="h-3 w-3 text-[var(--dash-text-muted)]"
										/>
										<span class="font-medium text-[var(--dash-text-secondary)]">Next run</span>
										<span>{formatFutureRelativeTime(nextRun)}</span>
									</div>
								{/if}

								{#if search.auth_block_kind}
									<AuthBlockNotice
										kind={search.auth_block_kind}
										disabled={!!search.auto_disabled_at}
										platform={search.job_platform?.name ?? 'the platform'}
										taskLabel={search.note?.trim() || search.search_term?.trim() || null}
									/>
								{/if}
							</div>
						</div>

						<!-- Mobile: Platform logo on the right -->
						<div class="flex-shrink-0 md:hidden">
							<div
								class="
                  h-10 w-10 rounded-lg {getStatusBgColor(search)} flex items-center justify-center
                "
							>
								<PlatformLogo platformUrl={search.job_platform?.url} size="w-6 h-6" />
							</div>
						</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}

	<!-- AI-suggested searches based on profile. Rendered below the task list
       so they appear near the "Suggest more" trigger and don't push the
       existing list out of view. -->
	{#if !showAddForm && suggestions && suggestions.length > 0}
		<SuggestionsList
			{suggestions}
			onAccept={acceptSuggestion}
			onDismiss={dismissSuggestion}
			onClearAll={clearSuggestions}
		/>
	{/if}

	<!-- "Suggest more" entry point: stays at the bottom of the task list so
       the user can ask for additional suggestions any time. Hidden while
       suggestion cards are on screen (dismiss them first to re-trigger),
       and hidden when there are no tasks yet — that case uses the
       empty-state CTA above. -->
	{#if !showAddForm && searchTasks.length > 0 && (!suggestions || suggestions.length === 0)}
		<div class="flex flex-col items-center gap-2 pt-2">
			{#if suggestionsInfo}
				<p class="max-w-md text-center text-xs text-[var(--dash-text-secondary)]">
					{suggestionsInfo}
				</p>
			{/if}
			{#if suggestionsError}
				<p class="max-w-md text-center text-xs text-red-600 dark:text-red-400">
					{suggestionsError}
				</p>
			{/if}
			<button
				type="button"
				onclick={getSuggestions}
				disabled={loadingSuggestions}
				class="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-xs text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-bg)] hover:text-[var(--dash-text)] disabled:opacity-60"
			>
				{#if loadingSuggestions}
					<Spinner size="w-3 h-3" />
					Analyzing your profile…
				{:else}
					<FontAwesomeIcon icon={faMagicWandSparkles} class="h-3 w-3" />
					Suggest more searches
				{/if}
			</button>
		</div>
	{/if}
</div>
