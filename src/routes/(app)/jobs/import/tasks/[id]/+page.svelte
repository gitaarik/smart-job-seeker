<script lang="ts">
	import type { PageData } from './$types';
	import { armOn } from '$lib/actions/arm-on';
	import { onDestroy, onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import Card from '../../../../components/Card.svelte';
	import ImportTaskBlockerList from '../../components/ImportTaskBlockerList.svelte';
	import AuthBlockNotice from '../../components/AuthBlockNotice.svelte';
	import { computeImportTaskBlockers } from '$lib/import-tasks/readiness';
	import Spinner from '$lib/components/Spinner.svelte';
	import { autoSaveField } from '$lib/components/auto-save.svelte';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import { portalToBody } from '$lib/actions/portal';
	import PlatformLogo from '$lib/components/PlatformLogo.svelte';
	import CategoryPill from '$lib/components/CategoryPill.svelte';
	import ScoreBadge from '../../../components/ScoreBadge.svelte';
	import SkillPill from '../../../components/SkillPill.svelte';
	import { adjacentFor, provenanceFor } from '$lib/match-provenance';
	import SearchTaskFields from '../../../components/SearchTaskFields.svelte';
	import SourceEditor from '../../components/SourceEditor.svelte';
	import FilterEditor from '../../components/FilterEditor.svelte';
	import {
		formatJobType,
		formatSalaryRange,
		formatWorkLocation,
		searchTaskDisplayName,
		timeAgo
	} from '$lib/format';
	import { page } from '$app/stores';
	import { formatDateTime, formatMonthDay, formatTime as fmtTime } from '$lib/format-date';
	import type { TimeFormat } from '$lib/format-date';
	import {
		faArrowLeft,
		faBuilding,
		faCalendar,
		faCamera,
		faCheck,
		faChevronDown,
		faChevronRight,
		faClock,
		faCloud,
		faCog,
		faCopy,
		faDesktop,
		faEllipsisV,
		faEnvelope,
		faExclamationTriangle,
		faExternalLinkAlt,
		faEye,
		faEyeSlash,
		faForward,
		faGlobe,
		faHandPointer,
		faHistory,
		faMapMarkerAlt,
		faMoneyBillWave,
		faPencil,
		faPlay,
		faPlus,
		faStop,
		faSync,
		faTerminal,
		faTimes,
		faTrash
	} from '@fortawesome/free-solid-svg-icons';

	let { data }: { data: PageData } = $props();

	let searchTask = $state(data.searchTask);
	const profileSkillLevels = $derived(data.profileSkillLevels);

	/**
	 * Strong = matched + user is proficient/expert; weak = matched + user is
	 * beginner/intermediate; null = not matched. Mirrors the job-detail page so
	 * SkillPill renders the same tiers in both places.
	 */
	function getSkillMatchStrength(skill: string, matchedSet: Set<string>): 'strong' | 'weak' | null {
		if (!matchedSet.has(skill)) return null;
		const level = profileSkillLevels[skill.toLowerCase()];
		return level === 'weak' ? 'weak' : 'strong';
	}

	// Header note — auto-saved with an undo window, matching the fields in
	// <SearchTaskFields> further down the page. `isEditingNote` only controls
	// whether the input is shown; it no longer gates the save.
	let isEditingNote = $state(false);
	let editNoteInput = $state(searchTask.note ?? '');
	const noteField = autoSaveField<string | null>({
		armOnInteraction: true,
		initial: searchTask.note ?? null,
		save: async (v) => {
			const res = await fetch(`/api/import-tasks/${searchTask.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ note: v ?? '' })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.message || body.error || `Save failed (${res.status})`);
			}
		},
		onSaved: (v) => {
			searchTask.note = v;
			editNoteInput = v ?? '';
		},
		equal: (a, b) => (a ?? '') === (b ?? ''),
		debounceMs: 700
	});
	$effect(() => {
		noteField.set(editNoteInput.trim() || null);
	});

	// Collapse back to the display view. Flushes first so a change still inside
	// the debounce window goes out rather than waiting on a hidden timer.
	function closeNoteEditor() {
		noteField.flush();
		isEditingNote = false;
	}

	// Settings section (danger zone) — collapsed by default
	let settingsOpen = $state(
		(() => {
			const v = (data.uiPreferences as Record<string, unknown>)['task_sections_settings'];
			return v === undefined ? false : Boolean(v);
		})()
	);

	function toggleSettingsSection() {
		settingsOpen = !settingsOpen;
		fetch(`/api/import-tasks/${data.searchTask.id}/ui-preferences`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ task_sections_settings: settingsOpen })
		}).catch(() => {});
	}

	// Delete task
	let isDeleting = $state(false);
	let showDeleteConfirm = $state(false);

	async function deleteTask() {
		isDeleting = true;
		try {
			const res = await fetch(`/api/import-tasks/${searchTask.id}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				goto('/jobs/import/tasks');
			}
		} finally {
			isDeleting = false;
		}
	}

	// Desktop scraper connection status
	// - preferredDevice drives the banner and the start-scrape gate (the device
	//   that would be used by default; own first, then shared).
	// - connectedDeviceIds powers the per-device "connected" markers in the
	//   device picker, covering both own and shared devices.
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

	async function checkDesktopStatus() {
		const sharedKeyIds = data.apiKeyDevices.filter((d) => d.shared).map((d) => d.apiKeyId);
		try {
			// When the task has a configured device, ask the API about *that*
			// device's status so the widgets reflect what will actually run —
			// not the user's auto-pick fallback.
			const preferredUrl = searchTask.sjsbrowser_api_key
				? `/api/tunnel/status/preferred?apiKeyId=${searchTask.sjsbrowser_api_key}`
				: `/api/tunnel/status/preferred`;
			const [preferredRes, profileRes, sharedResults] = await Promise.all([
				fetch(preferredUrl),
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

	// Merge API key devices with live connection status
	let devices = $derived(
		data.apiKeyDevices.map((d) => ({
			...d,
			connected: connectedDeviceIds.includes(d.apiKeyId)
		}))
	);

	let isStarting = $state(false);
	let isStopping = $state(false);
	let isOpeningBrowser = $state(false);
	let openBrowserMessage = $state<string | null>(null);
	let isSendingFeedback = $state(false);
	let feedbackSent = $state(false);
	let errorMessage = $state<string | null>(null);
	let showBrowser = $state(false);
	let showBrowserLogs = $state(false);
	let browserLogRef = $state<HTMLElement | null>(null);
	let liveUrl = $state<string | null>(null);
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let currentRunId = $state<number | null>(null);

	// Type-text feature (for 2FA codes on mobile)
	let typeTextValue = $state('');
	let isTypingText = $state(false);
	let typeTextMessage = $state<string | null>(null);
	// Which type-text-area button is currently in flight, so the spinner only
	// shows on the button the user actually clicked.
	let typeTextAction = $state<'send' | 'type' | 'submit' | 'clear' | null>(null);

	// Intervention controls overlay (auto-opens when run blocks; user can dismiss)
	let showInterventionControls = $state(false);
	let prevIsBlocked = false;
	// Header overflow menu (kebab, mobile only)
	let headerMenuOpen = $state(false);

	// Navigate-URL feature (for magic link login)
	let navigateUrlValue = $state('');
	let isNavigating = $state(false);
	let navigateUrlMessage = $state<string | null>(null);

	// Runs history
	interface RunSettings {
		max_jobs?: number | null;
		skip_existing?: boolean;
		skip_first?: number | null;
		stop_after_duplicates?: number | null;
		browser_provider?: string | null;
	}

	interface Run {
		id: number;
		status: string;
		started_at: string;
		finished_at: string | null;
		jobs_found: number | null;
		error_message: string | null;
		triggered_by: string;
		live_url: string | null;
		settings: RunSettings | null;
	}

	interface LogEntry {
		id: number;
		level: string;
		message: string;
		timestamp: string;
		/** Filename of a debug screenshot attached to this log row. */
		screenshot_path?: string | null;
	}

	interface JobDetails {
		id: number;
		title: string | null;
		company: string | null;
		office_location: string | null;
		salary_min: number | null;
		salary_max: number | null;
		salary_currency: string | null;
		salary_period: string | null;
		job_types: string[] | null;
		experience_levels: string[] | null;
		work_location: string[] | null;
		skills_required: string[] | null;
		skills_preferred: string[] | null;
		job_description: string | null;
		source_url: string | null;
		job_platform: { name: string } | null;
	}

	interface RunItem {
		id: number;
		position: number;
		title: string | null;
		company: string | null;
		location: string | null;
		source_url: string | null;
		status: string;
		status_message: string | null;
		job_id: number | null;
		was_created: boolean | null;
		job: JobDetails | null;
		match: {
			score: number;
			recommendation: string | null;
			matched_skills?: string[] | null;
			matched_skill_details?: unknown;
			adjacent_skills?: unknown;
		} | null;
	}

	interface RunItemsData {
		items: RunItem[];
		stats: {
			total: number;
			pending: number;
			processing: number;
			completed: number;
			skipped: number;
			error: number;
			new: number;
			existing: number;
		};
	}

	let runs = $state<Run[]>([]);
	let copiedRunId = $state<number | null>(null);
	let expandedRunId = $state<number | null>(null);
	let expandedItemId = $state<number | null>(null);
	let runLogs = $state<Record<number, LogEntry[]>>({});
	let runItems = $state<Record<number, RunItemsData>>({});
	let loadingLogs = $state<Record<number, boolean>>({});
	let loadingItems = $state<Record<number, boolean>>({});
	let logPollIntervals = $state<Record<number, ReturnType<typeof setInterval>>>({});
	let itemPollIntervals = $state<Record<number, ReturnType<typeof setInterval>>>({});
	let runTabView = $state<Record<number, 'jobs' | 'logs'>>({}); // Tab view per run

	// Featured run = shown in the status card instead of history.
	// Stays there for the lifetime of this page session (even after completing).
	// On page load, we pick the currently active run (if any), or fall back to the
	// most recent run. Once set, it sticks.
	const activeRunStatuses = ['running', 'queued', 'blocked', 'stopping'];
	let featuredRunId = $state<number | null>(null);
	$effect(() => {
		if (featuredRunId !== null) return; // already locked in
		const active = runs.find((r) => activeRunStatuses.includes(r.status));
		if (active) {
			featuredRunId = active.id;
		} else if (runs.length > 0) {
			featuredRunId = runs[0].id; // most recent run (runs are sorted by date desc)
		}
	});
	let featuredRun = $derived(
		featuredRunId !== null ? (runs.find((r) => r.id === featuredRunId) ?? null) : null
	);
	let historyRuns = $derived(runs.filter((r) => r.id !== featuredRunId));
	let logLevelFilter = $state<'debug' | 'info' | 'warn' | 'error'>('info');

	// Log auto-scroll: track container refs and whether user has scrolled up
	let logContainerRefs = $state<Record<number, HTMLElement | null>>({});
	let logAutoScroll = $state<Record<number, boolean>>({});

	// Reset all page state when navigating between different search tasks
	let currentSearchTaskId = $state(data.searchTask.id);
	$effect(() => {
		if (data.searchTask.id === currentSearchTaskId) return;
		currentSearchTaskId = data.searchTask.id;
		// Reset note input
		isEditingNote = false;
		editNoteInput = data.searchTask.note ?? '';
		noteField.reset(data.searchTask.note ?? null);
		// Reset settings section
		settingsOpen = (() => {
			const v = (data.uiPreferences as Record<string, unknown>)['task_sections_settings'];
			return v === undefined ? false : Boolean(v);
		})();
		// Reset transient input state
		typeTextValue = '';
		typeTextMessage = null;
		navigateUrlValue = '';
		navigateUrlMessage = null;
		errorMessage = null;

		showBrowser = false;
		liveUrl = null;
		currentRunId = null;
		runs = [];
		expandedRunId = null;
		featuredRunId = null;
		// Reload runs for the new search task
		loadRuns();
		// Restart polling if needed
		stopPolling();
		if (['running', 'blocked', 'queued', 'stopping'].includes(data.searchTask.status ?? '')) {
			startPolling();
		}
	});

	// Computed states
	let isRunning = $derived(searchTask.status === 'running');
	let isBlocked = $derived(searchTask.status === 'blocked');
	let isQueued = $derived(searchTask.status === 'queued');
	let isStoppingStatus = $derived(searchTask.status === 'stopping');
	let needsIntervention = $derived(isRunning || isBlocked);
	// A browser instance only actually exists once the run is live — queued runs
	// haven't spun up Chrome yet. While it's live, offer "Browser View" (watch /
	// intervene); otherwise offer "Open Browser" (manual no-scrape launch).
	let browserLive = $derived(isRunning || isBlocked || isStoppingStatus);
	$effect(() => {
		if (isBlocked && !prevIsBlocked) showInterventionControls = true;
		prevIsBlocked = isBlocked;
	});
	let hasOtherRunning = $state(data.hasOtherRunning);
	let isCloudMode = $derived(!!liveUrl);
	let isMagicLink = $derived(isBlocked && searchTask.status_message?.includes('login link'));
	let isVerification = $derived(
		isBlocked &&
			(searchTask.status_message?.includes('verification') ||
				searchTask.status_message?.includes('login link'))
	);
	let verificationEmailAddress = $state(data.verificationEmailAddress);
	let copiedVerifyEmail = $state(false);

	function copyVerificationEmail() {
		if (!verificationEmailAddress) return;
		navigator.clipboard.writeText(verificationEmailAddress);
		copiedVerifyEmail = true;
		setTimeout(() => (copiedVerifyEmail = false), 2000);
	}

	// Determine if this search uses a cloud browser (GoLogin) — either per-search override or server default
	let expectsCloudBrowser = $derived(
		(searchTask as any).browser_provider === 'hosted' ||
			(!(searchTask as any).browser_provider && data.browserProvider === 'goLogin')
	);
	// Tunnel mode: uses desktop app browser (no VNC, no live URL by default)
	let isTunnelMode = $derived(
		(searchTask as any).browser_provider === 'tunnel' ||
			(!(searchTask as any).browser_provider && data.browserProvider === 'tunnel')
	);
	// Unmet requirements that stop this task from running (needs a connected
	// device, login credentials, etc). Same computation the run endpoint enforces
	// and the overview list shows, so the banner never disagrees with the gate.
	// Device status is optimistic until the live check resolves, so the device
	// blocker doesn't flash before we actually know.
	let blockers = $derived(
		computeImportTaskBlockers({
			platformId: searchTask.platform_id,
			platformName: searchTask.job_platform?.name ?? null,
			taskSearchUrl: (searchTask as any).search_url ?? null,
			platformSearchPageUrl: searchTask.job_platform?.search_page_url ?? null,
			platformUrl: searchTask.job_platform?.url ?? null,
			platformLoginPageUrl: searchTask.job_platform?.login_page_url ?? null,
			loginMode: (searchTask as any).login_mode ?? null,
			hasCredential: (searchTask as any).platform_credential_id != null,
			browserProvider: (searchTask as any).browser_provider ?? null,
			serverBrowserProvider: data.browserProvider,
			deviceConnected: !isTunnelMode ? true : desktopStatusChecked ? desktopConnected : true
		})
	);

	// Only fall back to VNC when using local browser; show nothing while waiting for cloud live URL
	let browserViewUrl = $derived(
		liveUrl ||
			(expectsCloudBrowser
				? null
				: isTunnelMode
					? null
					: '/vnc/vnc.html?autoconnect=true&resize=scale')
	);

	// Browser view mode for tunnel: "screenshot" (polling) or "vnc" (interactive)
	type BrowserViewMode = 'screenshot' | 'vnc';
	let browserViewMode = $state<BrowserViewMode>('screenshot');

	// VNC state (for tunnel mode — interactive browser control via noVNC)
	let vncEnabled = $state(false);
	let vncUrl = $state<string | null>(null);
	let vncError = $state<string | null>(null);
	let vncConnecting = $state(false);

	async function startVnc() {
		vncError = null;
		vncConnecting = true;

		try {
			// Pin VNC to the device configured on the search task — otherwise with
			// multiple devices connected the dashboard can show a different one
			// than the scraper is driving.
			const targetApiKeyId = searchTask.sjsbrowser_api_key ?? preferredDevice?.apiKeyId;
			if (!targetApiKeyId) {
				vncError = 'No connected device to drive VNC against';
				return;
			}
			const res = await fetch(`/api/tunnel/vnc/${targetApiKeyId}`, { method: 'POST' });
			if (!res.ok) {
				const err = await res.json().catch(() => ({
					message: 'Failed to start VNC'
				}));
				vncError = err.message || err.error || 'Failed to start VNC';
				return;
			}

			const { token, apiKeyId } = await res.json();
			const host = window.location.host;
			const encrypt = window.location.protocol === 'https:' ? 1 : 0;
			const wsPath = `tunnel/vnc/${apiKeyId}?token=${token}`;
			vncUrl = `/vnc/vnc.html?autoconnect=true&resize=scale&password=secret&host=${host}&path=${encodeURIComponent(
				wsPath
			)}&encrypt=${encrypt}`;
			vncEnabled = true;
		} catch {
			vncError = 'Failed to connect to VNC';
		} finally {
			vncConnecting = false;
		}
	}

	function stopVnc() {
		vncEnabled = false;
		vncUrl = null;
	}

	function setViewMode(mode: BrowserViewMode) {
		if (mode === browserViewMode) return;
		// Stop the other mode
		if (mode === 'screenshot' && vncEnabled) stopVnc();
		if (mode === 'vnc') stopScreenshotPolling();
		browserViewMode = mode;
		if (mode === 'vnc') startVnc();
		if (mode === 'screenshot' && showBrowser) startScreenshotPolling();
	}

	// Screenshot polling state
	let screenshotSrc = $state<string | null>(null);
	let screenshotPollingInterval: ReturnType<typeof setInterval> | null = null;
	let screenshotLoading = $state(false);

	async function fetchScreenshot() {
		try {
			const targetApiKeyId = searchTask.sjsbrowser_api_key ?? preferredDevice?.apiKeyId;
			if (!targetApiKeyId) return;
			const res = await fetch(`/api/tunnel/screencast/${targetApiKeyId}`);
			if (res.ok && res.status !== 204) {
				const blob = await res.blob();
				const url = URL.createObjectURL(blob);
				if (screenshotSrc) URL.revokeObjectURL(screenshotSrc);
				screenshotSrc = url;
				screenshotLoading = false;
			}
		} catch {
			// Silently ignore — will retry on next poll
		}
	}

	function startScreenshotPolling() {
		if (screenshotPollingInterval) return;
		screenshotLoading = !screenshotSrc;
		fetchScreenshot();
		screenshotPollingInterval = setInterval(fetchScreenshot, 2000);
	}

	function stopScreenshotPolling() {
		if (screenshotPollingInterval) {
			clearInterval(screenshotPollingInterval);
			screenshotPollingInterval = null;
		}
	}

	// Interactive screenshot mode
	let interactiveMode = $state(false);
	let screenshotImgEl = $state<HTMLImageElement | null>(null);

	// Translate mouse position on the displayed image to browser viewport coordinates
	function imgToViewport(e: MouseEvent): { x: number; y: number } | null {
		const img = screenshotImgEl;
		if (!img || !img.naturalWidth || !img.naturalHeight) return null;
		const rect = img.getBoundingClientRect();
		// object-contain: image is centered with aspect ratio preserved
		const imgAspect = img.naturalWidth / img.naturalHeight;
		const boxAspect = rect.width / rect.height;
		let renderW: number, renderH: number, offsetX: number, offsetY: number;
		if (imgAspect > boxAspect) {
			// Image is wider than box — letterboxed top/bottom
			renderW = rect.width;
			renderH = rect.width / imgAspect;
			offsetX = 0;
			offsetY = (rect.height - renderH) / 2;
		} else {
			// Image is taller — pillarboxed left/right
			renderH = rect.height;
			renderW = rect.height * imgAspect;
			offsetX = (rect.width - renderW) / 2;
			offsetY = 0;
		}
		const relX = (e.clientX - rect.left - offsetX) / renderW;
		const relY = (e.clientY - rect.top - offsetY) / renderH;
		if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return null;
		return {
			x: Math.round(relX * img.naturalWidth),
			y: Math.round(relY * img.naturalHeight)
		};
	}

	function getModifiers(e: MouseEvent | KeyboardEvent): number {
		let mod = 0;
		if (e.altKey) mod |= 1;
		if (e.ctrlKey) mod |= 2;
		if (e.metaKey) mod |= 4;
		if (e.shiftKey) mod |= 8;
		return mod;
	}

	const MOUSE_BUTTON_MAP = ['left', 'middle', 'right'] as const;

	function sendInput(body: Record<string, unknown>) {
		const targetApiKeyId = searchTask.sjsbrowser_api_key ?? preferredDevice?.apiKeyId;
		if (!targetApiKeyId) return;
		fetch(`/api/tunnel/input/${targetApiKeyId}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}).catch(() => {});
	}

	function handleInteractiveMouseDown(e: MouseEvent) {
		if (!interactiveMode) return;
		const pos = imgToViewport(e);
		if (!pos) return;
		e.preventDefault();
		sendInput({
			type: 'rawMouseEvent',
			...pos,
			eventType: 'mousePressed',
			button: MOUSE_BUTTON_MAP[e.button] || 'left',
			clickCount: e.detail,
			modifiers: getModifiers(e)
		});
	}

	function handleInteractiveMouseUp(e: MouseEvent) {
		if (!interactiveMode) return;
		const pos = imgToViewport(e);
		if (!pos) return;
		e.preventDefault();
		sendInput({
			type: 'rawMouseEvent',
			...pos,
			eventType: 'mouseReleased',
			button: MOUSE_BUTTON_MAP[e.button] || 'left',
			clickCount: e.detail,
			modifiers: getModifiers(e)
		});
	}

	let lastMoveTime = 0;
	function handleInteractiveMouseMove(e: MouseEvent) {
		if (!interactiveMode) return;
		// Throttle to ~30fps
		const now = Date.now();
		if (now - lastMoveTime < 33) return;
		lastMoveTime = now;
		const pos = imgToViewport(e);
		if (!pos) return;
		sendInput({
			type: 'rawMouseEvent',
			...pos,
			eventType: 'mouseMoved',
			modifiers: getModifiers(e)
		});
	}

	function handleInteractiveWheel(e: WheelEvent) {
		if (!interactiveMode) return;
		const pos = imgToViewport(e);
		if (!pos) return;
		e.preventDefault();
		sendInput({
			type: 'rawScrollEvent',
			...pos,
			deltaX: e.deltaX,
			deltaY: e.deltaY
		});
	}

	function handleInteractiveKeyDown(e: KeyboardEvent) {
		if (!interactiveMode) return;
		e.preventDefault();
		sendInput({
			type: 'rawKeyEvent',
			eventType: 'keyDown',
			key: e.key,
			code: e.code,
			text: e.key.length === 1 ? e.key : undefined,
			modifiers: getModifiers(e)
		});
	}

	function handleInteractiveKeyUp(e: KeyboardEvent) {
		if (!interactiveMode) return;
		e.preventDefault();
		sendInput({
			type: 'rawKeyEvent',
			eventType: 'keyUp',
			key: e.key,
			code: e.code,
			modifiers: getModifiers(e)
		});
	}

	// Start/stop screenshot polling when browser view opens/closes
	// Faster polling (500ms) in interactive mode, normal (2s) otherwise
	$effect(() => {
		if (showBrowser && isTunnelMode && browserViewMode === 'screenshot') {
			stopScreenshotPolling();
			const interval = interactiveMode ? 500 : 2000;
			screenshotLoading = !screenshotSrc;
			fetchScreenshot();
			screenshotPollingInterval = setInterval(fetchScreenshot, interval);
		} else {
			stopScreenshotPolling();
		}
	});

	onDestroy(() => {
		if (vncEnabled) stopVnc();
		stopScreenshotPolling();
		if (screenshotSrc) URL.revokeObjectURL(screenshotSrc);
	});

	const tz = $derived(($page.data as { userTimezone: string | null }).userTimezone || undefined);
	const tf = $derived(($page.data as { timeFormat: TimeFormat }).timeFormat);

	function formatDate(date: Date | string | null): string {
		return formatDateTime(date, tf, {
			timezone: tz || null,
			fallback: 'Never'
		});
	}

	function formatRelativeTime(date: Date | string | null): string {
		if (!date) return '';
		const d = typeof date === 'string' ? new Date(date) : date;
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return formatDate(date);
	}

	function getRunStatusColor(status: string): string {
		switch (status) {
			case 'success':
				return 'text-[var(--dash-success)]';
			case 'partial':
				return 'text-[var(--dash-warning)]';
			case 'error':
			case 'cancelled':
				return 'text-[var(--dash-error)]';
			case 'running':
			case 'queued':
				return 'text-[var(--dash-primary)]';
			case 'blocked':
				return 'text-[var(--dash-warning)]';
			default:
				return 'text-[var(--dash-text-secondary)]';
		}
	}

	function getRunStatusIcon(status: string) {
		switch (status) {
			case 'success':
				return faCheck;
			case 'partial':
			case 'blocked':
				return faExclamationTriangle;
			case 'error':
			case 'cancelled':
				return faTimes;
			case 'running':
			case 'queued':
				// Spinner template branch renders <Spinner> instead of this icon —
				// returning faCog as a placeholder keeps the type as IconDefinition.
				return faCog;
			default:
				return faCog;
		}
	}

	function getLogLevelColor(level: string): string {
		switch (level) {
			case 'error':
				return 'text-[var(--dash-error)]';
			case 'warn':
				return 'text-[var(--dash-warning)]';
			case 'info':
				return 'text-[var(--dash-text)]';
			case 'debug':
				return 'text-[var(--dash-text-muted)]';
			default:
				return 'text-[var(--dash-text-secondary)]';
		}
	}

	function getLogLevelColorOnDark(level: string): string {
		switch (level) {
			case 'error':
				return 'text-red-400';
			case 'warn':
				return 'text-yellow-300';
			case 'info':
				return 'text-gray-100';
			case 'debug':
				return 'text-gray-400';
			default:
				return 'text-gray-300';
		}
	}

	async function loadRuns() {
		try {
			const response = await fetch(`/api/import-tasks/${searchTask.id}/runs?limit=10`);
			if (response.ok) {
				const data = await response.json();
				// Spread each run object to ensure Svelte 5 reactivity detects changes
				// This forces re-render even when only nested properties change
				runs = data.runs.map((run: Run) => ({ ...run }));
			}
		} catch (err) {
			console.error('Failed to load runs:', err);
		}
	}

	async function loadRunLogs(runId: number) {
		if (loadingLogs[runId]) return;
		loadingLogs[runId] = true;

		try {
			const response = await fetch(
				`/api/import-tasks/${searchTask.id}/runs/${runId}/logs?level=${logLevelFilter}`
			);
			if (response.ok) {
				const data = await response.json();
				// Merge with any logs that polling may have added concurrently
				const existing = runLogs[runId] || [];
				if (existing.length === 0) {
					runLogs[runId] = data.logs;
				} else {
					const existingIds = new Set(existing.map((l: { id: number }) => l.id));
					const newLogs = data.logs.filter((l: { id: number }) => !existingIds.has(l.id));
					if (newLogs.length > 0) {
						runLogs[runId] = [...existing, ...newLogs];
					}
				}
				scrollLogToBottom(runId);
			}
		} catch (err) {
			console.error('Failed to load logs:', err);
		} finally {
			loadingLogs[runId] = false;
		}
	}

	async function loadRunItems(runId: number) {
		if (loadingItems[runId]) return;
		loadingItems[runId] = true;

		try {
			const response = await fetch(`/api/import-tasks/${searchTask.id}/runs/${runId}/items`);
			if (response.ok) {
				const data = await response.json();
				runItems[runId] = data;
			} else {
				console.error('Failed to load items:', response.status, await response.text());
			}
		} catch (err) {
			console.error('Failed to load items:', err);
		} finally {
			loadingItems[runId] = false;
		}
	}

	function startItemPolling(runId: number) {
		if (itemPollIntervals[runId]) return;

		itemPollIntervals[runId] = setInterval(async () => {
			await loadRunItems(runId);

			// Stop polling if run is complete
			const run = runs.find((r) => r.id === runId);
			if (run && !['running', 'blocked', 'queued'].includes(run.status)) {
				stopItemPolling(runId);
			}
		}, 2000);
	}

	function stopItemPolling(runId: number) {
		if (itemPollIntervals[runId]) {
			clearInterval(itemPollIntervals[runId]);
			delete itemPollIntervals[runId];
		}
	}

	function getItemStatusColor(status: string): string {
		switch (status) {
			case 'completed':
				return 'text-[var(--dash-success)]';
			case 'processing':
				return 'text-[var(--dash-primary)]';
			case 'pending':
				return 'text-[var(--dash-text-muted)]';
			case 'skipped':
				return 'text-[var(--dash-warning)]';
			case 'error':
				return 'text-[var(--dash-error)]';
			default:
				return 'text-[var(--dash-text-secondary)]';
		}
	}

	function toggleItemExpanded(itemId: number) {
		expandedItemId = expandedItemId === itemId ? null : itemId;
	}

	function formatSalary(
		min: number | null,
		max: number | null,
		currency: string | null,
		period: string | null
	): string {
		const result = formatSalaryRange(min, max, currency, period);
		return result === 'Not specified' ? '' : result;
	}

	function truncateText(text: string | null, maxLength: number): string {
		if (!text) return '';
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength) + '...';
	}

	function getItemStatusBg(
		status: string,
		wasCreated?: boolean | null,
		skipExisting?: boolean
	): string {
		// Lower opacity than the matched-skill pill (which uses full
		// dash-success-light) so the pill keeps contrast against the row.
		if (status === 'completed' && wasCreated === true) {
			return 'bg-[var(--dash-success-light)]/40';
		}
		if (status === 'completed' && wasCreated === false && skipExisting) {
			return 'bg-slate-500/10';
		}
		if (status === 'completed') {
			return 'bg-[var(--dash-success-light)]/40';
		}
		switch (status) {
			case 'processing':
				return 'bg-[var(--dash-primary-light)]';
			case 'pending':
				return 'bg-[var(--dash-bg)]';
			case 'skipped':
				return 'bg-[var(--dash-warning-light)]';
			case 'error':
				return 'bg-[var(--dash-error-light)]';
			default:
				return 'bg-[var(--dash-bg)]';
		}
	}

	async function copyRunId(runId: number) {
		try {
			await navigator.clipboard.writeText(String(runId));
			copiedRunId = runId;
			setTimeout(() => {
				copiedRunId = null;
			}, 2000);
		} catch {
			// Fallback: ignore
		}
	}

	function toggleRunExpanded(runId: number) {
		if (expandedRunId === runId) {
			expandedRunId = null;
			// Stop polling logs and items for this run
			stopItemPolling(runId);
			if (logPollIntervals[runId]) {
				clearInterval(logPollIntervals[runId]);
				delete logPollIntervals[runId];
			}
		} else {
			expandedRunId = runId;
			runTabView[runId] = runTabView[runId] || 'jobs'; // Default to jobs tab
			loadRunLogs(runId);
			loadRunItems(runId);

			// Start polling if run is active
			const run = runs.find((r) => r.id === runId);
			if (
				run &&
				(run.status === 'running' || run.status === 'blocked' || run.status === 'queued')
			) {
				startLogPolling(runId);
				startItemPolling(runId);
			}
		}
	}

	function handleLogScroll(runId: number, event: Event) {
		const el = event.target as HTMLElement;
		// Consider "at bottom" if within 20px of the bottom
		const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
		logAutoScroll[runId] = atBottom;
	}

	function scrollLogToBottom(runId: number) {
		// Default to auto-scroll if not explicitly set
		if (logAutoScroll[runId] === false) return;
		// Use tick to wait for DOM update
		requestAnimationFrame(() => {
			const el = logContainerRefs[runId];
			if (el) {
				el.scrollTop = el.scrollHeight;
			}
		});
	}

	function scrollJobsToProcessing(runId: number) {
		requestAnimationFrame(() => {
			const container = document.querySelector(
				`[data-jobs-container="${runId}"]`
			) as HTMLElement | null;
			if (!container) return;
			const processingEl = container.querySelector(
				'[data-item-status="processing"]'
			) as HTMLElement | null;
			if (processingEl) {
				container.scrollTop =
					processingEl.offsetTop -
					container.offsetTop -
					container.clientHeight / 2 +
					processingEl.clientHeight / 2;
			}
		});
	}

	function startLogPolling(runId: number) {
		if (logPollIntervals[runId]) return;

		logPollIntervals[runId] = setInterval(async () => {
			const existingLogs = runLogs[runId] || [];
			const lastTimestamp =
				existingLogs.length > 0 ? existingLogs[existingLogs.length - 1].timestamp : null;

			try {
				let url = `/api/import-tasks/${searchTask.id}/runs/${runId}/logs?level=${logLevelFilter}`;
				if (lastTimestamp) {
					url += `&after=${encodeURIComponent(lastTimestamp)}`;
				}

				const response = await fetch(url);
				if (response.ok) {
					const data = await response.json();
					if (data.logs.length > 0) {
						// Deduplicate by log id to prevent Svelte keyed each errors
						const existingIds = new Set(existingLogs.map((l: { id: number }) => l.id));
						const newLogs = data.logs.filter((l: { id: number }) => !existingIds.has(l.id));
						if (newLogs.length > 0) {
							runLogs[runId] = [...existingLogs, ...newLogs];
							scrollLogToBottom(runId);
						}
					}

					// Stop polling if run is complete
					if (!['running', 'blocked', 'queued'].includes(data.runStatus)) {
						if (logPollIntervals[runId]) {
							clearInterval(logPollIntervals[runId]);
							delete logPollIntervals[runId];
						}
					}
				}
			} catch (err) {
				console.error('Failed to poll logs:', err);
			}
		}, 2000);
	}

	async function startScrape() {
		// Prevent starting until the task is fully configured (device, credentials,
		// etc). Mirrors the server-side gate so the user gets the same reason here.
		if (blockers.length > 0) {
			errorMessage = blockers.map((b) => b.detail).join(' ');
			return;
		}

		isStarting = true;
		errorMessage = null;

		try {
			const response = await fetch(`/api/import-tasks/${searchTask.id}/run`, {
				method: 'POST'
			});

			const result = await response.json();

			if (!response.ok) {
				errorMessage = result.message || 'Failed to start scrape';
				return;
			}

			if (result.status === 'already_queued') {
				errorMessage = 'This search is already queued';
				return;
			}

			if (result.status === 'already_running') {
				errorMessage = 'This search is already running';
				return;
			}

			// Queued successfully
			searchTask.status = 'queued';
			searchTask.status_message = 'Waiting in queue';
			currentRunId = result.runId;

			// Reload runs to show the new one
			await loadRuns();

			// Feature this run in the status card (items/logs auto-loaded by $effect)
			if (result.runId) {
				featuredRunId = result.runId;
				runTabView[result.runId] = 'jobs';
			}

			// Start polling for status updates
			startPolling();
		} catch (err) {
			errorMessage = 'Failed to start scrape';
			console.error(err);
		} finally {
			isStarting = false;
		}
	}

	// Manual-browser entrypoint: open a tab on the user's NAS Chrome at the
	// platform URL without queueing a scrape. The same Chrome that scrapes
	// owns the cookie jar, so changes the user makes (display language,
	// dismissing banners, manual logins) persist into the next scrape. Auto-
	// opens the VNC browser view so the user lands on an interactive
	// session immediately.
	async function openBrowser(url?: string) {
		if (isTunnelMode && !desktopConnected) {
			openBrowserMessage =
				'No device is connected. Connect the desktop app or self-hosted tunnel first.';
			return;
		}

		isOpeningBrowser = true;
		openBrowserMessage = null;
		try {
			const res = await fetch(`/api/import-tasks/${searchTask.id}/open-browser`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				// The endpoint defaults to the platform's search page; the
				// sign-in button overrides it so the user lands on the login
				// form rather than on a job list that will bounce them to it.
				body: JSON.stringify(url ? { url } : {})
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				openBrowserMessage = data.message || data.error || 'Failed to open browser';
				return;
			}
			// Surface the browser panel and switch to VNC so the user can
			// interact with the new tab without a second click.
			showBrowser = true;
			setViewMode('vnc');
		} catch (err) {
			console.error(err);
			openBrowserMessage = 'Failed to open browser';
		} finally {
			isOpeningBrowser = false;
		}
	}

	// "Sign in now" from the sign-in section. Same Chrome as the scrape, so the
	// session created here is the one the next run finds already signed in.
	const signInPageUrl = $derived(searchTask?.job_platform?.login_page_url ?? null);
	const canSignInNow = $derived(isTunnelMode && desktopConnected && !!signInPageUrl);
	function signInNow() {
		if (!signInPageUrl) return;
		openBrowser(signInPageUrl);
	}

	function startPolling() {
		if (pollInterval) return;

		pollInterval = setInterval(async () => {
			try {
				const response = await fetch(`/api/import-tasks/${searchTask.id}/run`);
				const result = await response.json();

				if (feedbackSent && result.status !== 'blocked') {
					feedbackSent = false;
				}
				searchTask.status = result.status;
				searchTask.status_message = result.statusMessage;
				searchTask.last_run = result.lastRun;
				searchTask.last_run_jobs_found = result.jobsFound;
				if (result.nextScheduledRun !== undefined) {
					searchTask.next_scheduled_run = result.nextScheduledRun;
				}
				liveUrl = result.liveUrl || null;
				currentRunId = result.currentRunId || null;

				// Update runs list
				await loadRuns();

				// Stop polling when scrape is complete (keep polling during "stopping")
				if (!['running', 'blocked', 'queued', 'stopping'].includes(result.status)) {
					stopPolling();
					showBrowser = false;
					liveUrl = null;
					// Invalidate so overview page shows fresh status on navigation
					invalidateAll();
				}
			} catch (err) {
				console.error('Failed to poll status:', err);
			}
		}, 3000);
	}

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	async function stopScrape() {
		if (!confirm('Are you sure you want to stop the running scrape? This cannot be undone.')) {
			return;
		}

		isStopping = true;
		errorMessage = null;

		try {
			const response = await fetch(`/api/import-tasks/${searchTask.id}/run`, {
				method: 'DELETE'
			});

			const result = await response.json();

			if (!response.ok) {
				errorMessage = result.message || 'Failed to stop scrape';
				return;
			}

			if (result.status === 'removed_from_queue' || result.status === 'cancelled') {
				// Immediate cancellation (was queued, not yet running)
				searchTask.status = 'idle';
				searchTask.status_message = 'Cancelled by user';
				stopPolling();
				showBrowser = false;
				liveUrl = null;
				await loadRuns();
				await invalidateAll();
			} else if (result.status === 'cancellation_requested') {
				// Worker is still running, transition to "stopping" state
				searchTask.status = 'stopping';
				searchTask.status_message = 'Stopping...';
				// Keep polling — the worker will set the final status
				if (!pollInterval) startPolling();
				await loadRuns();
			}
		} catch (err) {
			errorMessage = 'Failed to stop scrape';
			console.error(err);
		} finally {
			isStopping = false;
		}
	}

	let stoppingAt = $state<number | null>(null);
	let showForceStop = $state(false);
	let forceStopTimeout: ReturnType<typeof setTimeout> | null = null;

	// Show force stop button after 10 seconds in "stopping" state
	$effect(() => {
		if (searchTask.status === 'stopping') {
			if (!stoppingAt) stoppingAt = Date.now();
			forceStopTimeout = setTimeout(() => {
				showForceStop = true;
			}, 10_000);
		} else {
			stoppingAt = null;
			showForceStop = false;
			if (forceStopTimeout) {
				clearTimeout(forceStopTimeout);
				forceStopTimeout = null;
			}
		}
		return () => {
			if (forceStopTimeout) clearTimeout(forceStopTimeout);
		};
	});

	async function forceStop() {
		errorMessage = null;
		try {
			const response = await fetch(`/api/import-tasks/${searchTask.id}/run?force=true`, {
				method: 'DELETE'
			});
			const result = await response.json();
			if (!response.ok) {
				errorMessage = result.message || 'Failed to force stop';
				return;
			}
			searchTask.status = 'idle';
			searchTask.status_message = 'Force stopped by user';
			stopPolling();
			showBrowser = false;
			liveUrl = null;
			await loadRuns();
			await invalidateAll();
		} catch (err) {
			errorMessage = 'Failed to force stop';
			console.error(err);
		}
	}

	async function sendFeedback(response: 'continue' | 'skip' | 'cancel') {
		if (!currentRunId) {
			errorMessage = 'No active run to respond to';
			return;
		}

		isSendingFeedback = true;
		errorMessage = null;

		try {
			const res = await fetch(`/api/import-tasks/${searchTask.id}/runs/${currentRunId}/respond`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ response })
			});

			const result = await res.json();

			if (!res.ok) {
				errorMessage = result.message || `Failed to send ${response} response`;
				return;
			}

			// If cancelled, update UI immediately
			if (response === 'cancel') {
				searchTask.status = 'cancelled';
				searchTask.status_message = 'Cancelled by user';
				stopPolling();
				showBrowser = false;
				liveUrl = null;
				await loadRuns();
			}
			// For continue/skip, keep feedbackSent=true so buttons stay disabled
			// until the status changes from "blocked" via polling
			if (response !== 'cancel') {
				feedbackSent = true;
			}
		} catch (err) {
			errorMessage = `Failed to send ${response} response`;
			console.error(err);
		} finally {
			isSendingFeedback = false;
		}
	}

	async function sendTypeText(submit = false) {
		if (!currentRunId || !typeTextValue.trim()) return;

		isTypingText = true;
		typeTextAction = submit ? 'send' : 'type';
		typeTextMessage = null;

		try {
			const res = await fetch(`/api/import-tasks/${searchTask.id}/runs/${currentRunId}/type-text`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: typeTextValue, submit })
			});

			const result = await res.json();

			if (!res.ok) {
				typeTextMessage = result.message || 'Failed to type text';
				return;
			}

			typeTextMessage = submit ? 'Typed and submitted' : 'Typed successfully';
			typeTextValue = '';
			// Clear success message after a moment
			setTimeout(() => {
				typeTextMessage = null;
			}, 2000);
		} catch (err) {
			typeTextMessage = 'Failed to type text';
			console.error(err);
		} finally {
			isTypingText = false;
			typeTextAction = null;
		}
	}

	async function submitBrowserForm() {
		if (!currentRunId) return;
		isTypingText = true;
		typeTextAction = 'submit';
		typeTextMessage = null;
		try {
			const res = await fetch(`/api/import-tasks/${searchTask.id}/runs/${currentRunId}/type-text`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: '', submit: true })
			});
			const result = await res.json();
			if (!res.ok) {
				typeTextMessage = result.message || 'Failed to submit';
				return;
			}
			typeTextMessage = 'Submitted';
			setTimeout(() => {
				typeTextMessage = null;
			}, 2000);
		} catch {
			typeTextMessage = 'Failed to submit';
		} finally {
			isTypingText = false;
			typeTextAction = null;
		}
	}

	async function clearBrowserInput() {
		if (!currentRunId) return;
		isTypingText = true;
		typeTextAction = 'clear';
		typeTextMessage = null;
		try {
			const res = await fetch(`/api/import-tasks/${searchTask.id}/runs/${currentRunId}/type-text`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: '', clear: true })
			});
			const result = await res.json();
			if (!res.ok) {
				typeTextMessage = result.message || 'Failed to clear';
				return;
			}
			typeTextMessage = 'Cleared';
			setTimeout(() => {
				typeTextMessage = null;
			}, 2000);
		} catch {
			typeTextMessage = 'Failed to clear';
		} finally {
			isTypingText = false;
			typeTextAction = null;
		}
	}

	async function sendNavigateUrl() {
		if (!currentRunId || !navigateUrlValue.trim()) return;

		isNavigating = true;
		navigateUrlMessage = null;

		try {
			const res = await fetch(
				`/api/import-tasks/${searchTask.id}/runs/${currentRunId}/navigate-url`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ url: navigateUrlValue })
				}
			);

			const result = await res.json();

			if (!res.ok) {
				navigateUrlMessage = result.message || 'Failed to navigate';
				return;
			}

			navigateUrlMessage = 'Navigated successfully';
			navigateUrlValue = '';
			setTimeout(() => {
				navigateUrlMessage = null;
			}, 2000);
		} catch (err) {
			navigateUrlMessage = 'Failed to navigate';
			console.error(err);
		} finally {
			isNavigating = false;
		}
	}

	let desktopPollInterval: ReturnType<typeof setInterval> | null = null;

	// Auto-load items/logs for the featured run shown in the status card
	$effect(() => {
		const run = featuredRun;
		if (!run) return;
		// Load items and logs if not already loaded
		if (!runItems[run.id] && !loadingItems[run.id]) loadRunItems(run.id);
		if (!runLogs[run.id] && !loadingLogs[run.id]) loadRunLogs(run.id);
		// Start polling if not already
		startItemPolling(run.id);
		startLogPolling(run.id);
	});

	// Auto-scroll browser popup logs to bottom
	$effect(() => {
		if (!showBrowserLogs || !featuredRunId || !browserLogRef) return;
		const logs = runLogs[featuredRunId];
		if (!logs || logs.length === 0) return;
		// Access logs.length to create a reactive dependency
		void logs.length;
		requestAnimationFrame(() => {
			if (browserLogRef) {
				browserLogRef.scrollTop = browserLogRef.scrollHeight;
			}
		});
	});

	// Poll desktop connection status unconditionally — the user wants to see
	// whether their device is online regardless of which browser-control mode
	// the task is set to, so they can switch modes informed. Tunnel-mode gating
	// happens in the consumers (start-button enable, browser-view widgets).
	// Re-runs when the configured device changes so the widget refreshes
	// immediately on a device switch instead of waiting for the next poll.
	$effect(() => {
		void searchTask.sjsbrowser_api_key;
		checkDesktopStatus();
		if (!desktopPollInterval) {
			desktopPollInterval = setInterval(checkDesktopStatus, 15000);
		}
		return () => {
			if (desktopPollInterval) {
				clearInterval(desktopPollInterval);
				desktopPollInterval = null;
			}
		};
	});

	// Notice runs that start outside this page. The fast 3s poll (startPolling)
	// only runs when *this* client kicked off the run or it was already active
	// at mount. A run started elsewhere — a schedule, an auto-import trigger, or
	// a co-user/owner on a shared device — would otherwise stay invisible (the
	// Browser View button gates on `browserLive`, derived from searchTask.status)
	// until a manual refresh. Watch the status at a slow cadence and hand off to
	// the fast poll once it goes live, so the button appears on its own.
	$effect(() => {
		const watcher = setInterval(async () => {
			// Fast poll already covering an active run; nothing to detect.
			if (pollInterval) return;
			try {
				const res = await fetch(`/api/import-tasks/${searchTask.id}/run`);
				const result = await res.json();
				if (['running', 'blocked', 'queued', 'stopping'].includes(result.status)) {
					searchTask.status = result.status;
					searchTask.status_message = result.statusMessage;
					startPolling();
				}
			} catch {
				// Transient fetch failure — the next tick retries.
			}
		}, 15000);
		return () => clearInterval(watcher);
	});

	onMount(() => {
		// Load runs history
		loadRuns();

		// Start polling if already running/blocked/queued/stopping
		if (needsIntervention || isQueued || isStoppingStatus) {
			startPolling();
		}
	});

	onDestroy(() => {
		stopPolling();
		// Clean up all log and item polling intervals
		Object.values(logPollIntervals).forEach((interval) => clearInterval(interval));
		Object.values(itemPollIntervals).forEach((interval) => clearInterval(interval));
	});
</script>

{#snippet runDetails(run: Run, standalone: boolean = false)}
	<div
		class="{standalone
			? 'overflow-hidden rounded-lg border border-[var(--dash-border)]'
			: 'border-t border-[var(--dash-border)]'} bg-[var(--dash-bg)]"
	>
		<!-- Tab buttons -->
		<div class="flex border-b border-[var(--dash-border)]">
			<button
				onclick={() => {
					runTabView[run.id] = 'jobs';
					scrollJobsToProcessing(run.id);
				}}
				class={`px-4 py-2 text-sm font-medium transition-colors ${
					!runTabView[run.id] || runTabView[run.id] === 'jobs'
						? 'border-b-2 border-[var(--dash-primary)] text-[var(--dash-primary)]'
						: 'text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]'
				}`}
			>
				Jobs
				{#if runItems[run.id]?.stats}
					<span class="ml-1 text-xs text-[var(--dash-text-muted)]">
						({runItems[run.id].stats.new} new / {runItems[run.id].stats.total}
						total)
					</span>
				{/if}
			</button>
			<button
				onclick={() => {
					runTabView[run.id] = 'logs';
					logAutoScroll[run.id] = true;
					scrollLogToBottom(run.id);
				}}
				class={`px-4 py-2 text-sm font-medium transition-colors ${
					runTabView[run.id] === 'logs'
						? 'border-b-2 border-[var(--dash-primary)] text-[var(--dash-primary)]'
						: 'text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]'
				}`}
			>
				Logs
			</button>
		</div>

		<!-- Jobs view -->
		{#if !runTabView[run.id] || runTabView[run.id] === 'jobs'}
			<div class="flex items-center justify-between px-4 py-2">
				<div class="flex items-center gap-3">
					{#if runItems[run.id]?.stats}
						{@const stats = runItems[run.id].stats}
						<div class="flex gap-3 text-xs">
							<span class="text-[var(--dash-text-muted)]"
								>{stats.total}
								total</span
							>
							{#if stats.new > 0}
								<span class="text-[var(--dash-success)]">{stats.new} new</span>
							{/if}
							{#if stats.existing > 0}
								<span class="text-[var(--dash-text-secondary)]"
									>{stats.existing}
									existing</span
								>
							{/if}
							{#if stats.processing > 0}
								<span class="text-[var(--dash-primary)]"
									>{stats.processing}
									processing</span
								>
							{/if}
							{#if stats.pending > 0}
								<span class="text-[var(--dash-text-muted)]"
									>{stats.pending}
									pending</span
								>
							{/if}
							{#if stats.skipped > 0}
								<span class="text-[var(--dash-warning)]"
									>{stats.skipped}
									skipped</span
								>
							{/if}
							{#if stats.error > 0}
								<span class="text-[var(--dash-error)]"
									>{stats.error}
									errors</span
								>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<div
				data-jobs-container={run.id}
				class="max-h-80 overflow-y-auto border-t border-[var(--dash-border)]"
			>
				{#if !runItems[run.id]?.items || runItems[run.id].items.length === 0}
					<div class="p-4 text-center text-sm text-[var(--dash-text-muted)]">
						{#if loadingItems[run.id]}
							Loading jobs...
						{:else if run.finished_at}
							No jobs imported
						{:else}
							No jobs discovered yet
						{/if}
					</div>
				{:else}
					<div class="divide-y divide-[var(--dash-border)]">
						{#each runItems[run.id].items as item (item.id)}
							{@const jobData = item.job}
							{@const workLocs = Array.isArray(jobData?.work_location) ? jobData.work_location : []}
							{@const jobTyps = Array.isArray(jobData?.job_types) ? jobData.job_types : []}
							{@const expLvls = Array.isArray(jobData?.experience_levels)
								? jobData.experience_levels
								: []}
							{@const salaryText = jobData
								? formatSalary(
										jobData.salary_min,
										jobData.salary_max,
										jobData.salary_currency,
										jobData.salary_period
									)
								: ''}
							{@const datePosted = jobData?.date_posted || jobData?.date_created}
							<div
								data-item-status={item.status}
								class={`${getItemStatusBg(
									item.status,
									item.was_created,
									run.settings?.skip_existing
								)} ${
									expandedItemId === item.id ? 'border-l-2 border-l-[var(--dash-primary)]' : ''
								}`}
							>
								<!-- Item header (clickable for completed items with job details) -->
								<button
									type="button"
									onclick={() => item.job && toggleItemExpanded(item.id)}
									class={`relative flex w-full gap-2 py-2 pr-3 pl-2 text-left transition-all ${
										item.job
											? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5'
											: 'cursor-default'
									}`}
									disabled={!item.job}
								>
									<!-- Left: position number -->
									<span
										class="w-4 shrink-0 pt-0.5 text-center text-xs text-[var(--dash-text-muted)]"
									>
										{item.position}
									</span>

									<!-- Score badge (desktop): on the left, between # and title.
                       On mobile we render it on the right of the row instead
                       so the title gets full width — same pattern as JobCard. -->
									{#if item.job_id && item.status === 'completed'}
										<div class="hidden shrink-0 self-center md:flex">
											<ScoreBadge
												score={item.match?.score ?? null}
												matched={!!item.match?.recommendation}
												size="sm"
											/>
										</div>
									{/if}

									<!-- Content: title, details, and pill -->
									<div class="min-w-0 flex-1">
										<!-- Title row with chevron -->
										<div class="flex items-start gap-2">
											<div class="min-w-0 flex-1">
												{#if item.job_id && item.status === 'completed'}
													<span class="text-sm font-medium text-[var(--dash-primary)]">
														{item.job?.title || item.title || 'Untitled'}
													</span>
												{:else}
													<span class="text-sm font-medium text-[var(--dash-text)]">
														{item.title || 'Untitled'}
													</span>
												{/if}
											</div>
											{#if item.job}
												<span
													class="inline-block shrink-0 transition-transform duration-200 {expandedItemId ===
													item.id
														? 'rotate-90'
														: ''} mt-0.5 text-[var(--dash-text-muted)]"
												>
													<FontAwesomeIcon icon={faChevronRight} class="h-3 w-3" />
												</span>
											{/if}
										</div>
										<!-- Details left, pill right — flex-wrap so pill stays bottom-right -->
										<div class="mt-1 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
											<div class="flex min-w-0 flex-1 flex-col gap-0.5">
												{#if jobData?.company || item.company || jobData?.office_location || item.location || jobData?.job_platform}
													<div
														class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--dash-text-secondary)]"
													>
														{#if jobData?.company || item.company}
															<span class="flex items-center gap-1">
																<FontAwesomeIcon icon={faBuilding} class="h-3 w-3" />
																{jobData?.company || item.company}
															</span>
														{/if}
														{#if jobData?.office_location || item.location}
															<span class="flex items-center gap-1">
																<FontAwesomeIcon icon={faMapMarkerAlt} class="h-3 w-3" />
																{jobData?.office_location || item.location}
															</span>
														{/if}
														{#if jobData?.job_platform}
															<span class="flex items-center gap-1">
																<FontAwesomeIcon
																	icon={faGlobe}
																	class="h-3 w-3 text-[var(--dash-text-muted)]"
																/>
																{jobData.job_platform.name}
															</span>
														{/if}
													</div>
												{/if}
												{#if workLocs.length > 0 || jobTyps.length > 0 || expLvls.length > 0}
													<div class="mt-0.5 flex flex-wrap items-center gap-1.5">
														{#each workLocs as loc}
															<CategoryPill category="work_location" value={loc} />
														{/each}
														{#each jobTyps as type}
															<CategoryPill category="job_type" value={type} />
														{/each}
														{#each expLvls as level}
															<CategoryPill category="experience_level" value={level} />
														{/each}
													</div>
												{/if}
												{#if salaryText || datePosted}
													<div
														class="mt-1.5 flex flex-wrap items-center gap-2 text-xs sm:mt-2 sm:gap-4 sm:text-sm"
													>
														{#if salaryText}
															<span class="flex items-center gap-1 text-[var(--dash-success)]">
																<FontAwesomeIcon icon={faMoneyBillWave} class="h-3 w-3" />
																<span class="max-w-[140px] truncate sm:max-w-none"
																	>{salaryText}</span
																>
															</span>
														{/if}
														{#if datePosted}
															<span
																class="flex items-center gap-1 text-[var(--dash-text-secondary)]"
															>
																<FontAwesomeIcon icon={faCalendar} class="h-3 w-3" />
																{timeAgo(datePosted)}
																<span class="opacity-50"
																	>{formatMonthDay(datePosted, { fallback: '' })}</span
																>
															</span>
														{/if}
													</div>
												{/if}
											</div>
											<!-- Right column: mobile score above status pill,
                           desktop just the pill (score lives on the left).
                           Stacked so they share the right edge with the
                           chevron above (in the title row). -->
											<div class="ml-auto flex shrink-0 flex-col items-end gap-2">
												{#if item.job_id && item.status === 'completed'}
													<div class="md:hidden">
														<ScoreBadge
															score={item.match?.score ?? null}
															matched={!!item.match?.recommendation}
															size="sm"
														/>
													</div>
												{/if}
												<span
													class="
                            inline-flex max-w-32 items-center gap-1 truncate rounded px-1.5 py-0.5 text-xs {item.status ===
														'completed' && item.was_created === true
														? 'bg-[var(--dash-success)] text-white'
														: item.status === 'completed' &&
															  item.was_created === false &&
															  run.settings?.skip_existing
															? 'bg-slate-500 text-white'
															: item.status === 'completed'
																? 'bg-[var(--dash-success)]/70 text-white'
																: item.status === 'processing'
																	? 'bg-[var(--dash-primary-light)] text-[var(--dash-primary)]'
																	: item.status === 'skipped'
																		? 'bg-amber-600 text-white'
																		: item.status === 'error'
																			? 'bg-red-600 text-white'
																			: 'bg-[var(--dash-bg)] text-[var(--dash-text-muted)]'}
                          "
												>
													{#if item.status === 'completed' && item.was_created === false && run.settings?.skip_existing}
														<FontAwesomeIcon icon={faForward} class="h-2.5 w-2.5 shrink-0" />
														duplicate
													{:else if item.status === 'completed'}
														<FontAwesomeIcon icon={faCheck} class="h-2.5 w-2.5 shrink-0" />
														{item.was_created === true
															? 'new'
															: item.was_created === false
																? 'updated'
																: ''}
													{:else if item.status === 'processing'}
														<FontAwesomeIcon
															icon={faSync}
															class="h-2.5 w-2.5 shrink-0 animate-spin"
														/>
													{:else if item.status === 'skipped'}
														<FontAwesomeIcon icon={faForward} class="h-2.5 w-2.5 shrink-0" />
														{item.status_message || 'skipped'}
													{:else if item.status === 'error'}
														<FontAwesomeIcon icon={faTimes} class="h-2.5 w-2.5 shrink-0" />
														{item.status_message || 'error'}
													{:else}
														<FontAwesomeIcon icon={faClock} class="h-2.5 w-2.5 shrink-0" />
													{/if}
												</span>
											</div>
										</div>
									</div>
								</button>

								<!-- Source link for items without a job row (skipped/error)
                     so the user can still inspect what the scraper saw. -->
								{#if !item.job && item.source_url}
									<a
										href={item.source_url}
										target="_blank"
										rel="noopener"
										class="-mt-1 block truncate pr-3 pb-2 pl-8 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)]"
									>
										<FontAwesomeIcon icon={faExternalLinkAlt} class="mr-1 h-3 w-3" />
										{item.source_url}
									</a>
								{/if}

								<!-- Expanded job details -->
								{#if expandedItemId === item.id && item.job}
									{@const job = item.job}
									{@const matchedSkillsSet = new Set(
										Array.isArray(item.match?.matched_skills) ? item.match.matched_skills : []
									)}
									<div
										class="space-y-3 border-t border-[var(--dash-border)] p-3 sm:p-4 {getItemStatusBg(
											item.status,
											item.was_created,
											run.settings?.skip_existing
										)}"
									>
										<!-- Skills -->
										{#if job.skills_required && Array.isArray(job.skills_required) && job.skills_required.length > 0}
											<div>
												<p
													class="mb-2 text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase"
												>
													Required Skills
												</p>
												<div class="flex flex-wrap gap-1">
													{#each job.skills_required.slice(0, 12) as skill}
														{@const via = provenanceFor(item.match?.matched_skill_details, skill)}
														<SkillPill
															{skill}
															strength={getSkillMatchStrength(skill, matchedSkillsSet)}
															via={via?.via ?? null}
															from={via?.from ?? null}
															relatedFrom={adjacentFor(item.match?.adjacent_skills, skill)}
															variant="required"
															size="sm"
														/>
													{/each}
													{#if job.skills_required.length > 12}
														<span class="px-2 py-1 text-xs text-[var(--dash-text-muted)]"
															>+{job.skills_required.length - 12} more</span
														>
													{/if}
												</div>
											</div>
										{/if}

										{#if job.skills_preferred && Array.isArray(job.skills_preferred) && job.skills_preferred.length > 0}
											<div>
												<p
													class="mb-2 text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase"
												>
													Preferred Skills
												</p>
												<div class="flex flex-wrap gap-1">
													{#each job.skills_preferred.slice(0, 12) as skill}
														{@const via = provenanceFor(item.match?.matched_skill_details, skill)}
														<SkillPill
															{skill}
															strength={getSkillMatchStrength(skill, matchedSkillsSet)}
															via={via?.via ?? null}
															from={via?.from ?? null}
															relatedFrom={adjacentFor(item.match?.adjacent_skills, skill)}
															variant="preferred"
															size="sm"
														/>
													{/each}
													{#if job.skills_preferred.length > 12}
														<span class="px-2 py-1 text-xs text-[var(--dash-text-muted)]"
															>+{job.skills_preferred.length - 12} more</span
														>
													{/if}
												</div>
											</div>
										{/if}

										<!-- Description Preview -->
										{#if job.job_description}
											<div>
												<p
													class="mb-1 text-xs tracking-wide text-[var(--dash-text-secondary)] uppercase"
												>
													Description
												</p>
												<p class="text-sm whitespace-pre-wrap text-[var(--dash-text)]">
													{truncateText(job.job_description, 300)}
												</p>
											</div>
										{/if}

										<!-- Footer with links -->
										<div
											class="flex items-center gap-4 border-t border-[var(--dash-border)] pt-2 text-xs text-[var(--dash-text-muted)]"
										>
											<a
												href="/jobs/{job.id}"
												class="flex items-center gap-1 text-[var(--dash-primary)] hover:underline"
											>
												<FontAwesomeIcon icon={faEye} class="h-3 w-3" />
												View details
											</a>
											{#if job.source_url}
												<a
													href={job.source_url}
													target="_blank"
													rel="noopener"
													class="flex items-center gap-1 hover:text-[var(--dash-primary)]"
												>
													<FontAwesomeIcon icon={faExternalLinkAlt} class="h-3 w-3" />
													Source
												</a>
											{/if}
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{:else if runTabView[run.id] === 'logs'}
			<!-- Logs view -->
			<div class="flex items-center justify-between px-4 py-2">
				<div class="flex items-center gap-2">
					<span class="text-sm font-medium text-[var(--dash-text)]">Logs</span>
					<select
						bind:value={logLevelFilter}
						onchange={() => {
							runLogs[run.id] = [];
							loadRunLogs(run.id);
						}}
						class="rounded border border-[var(--dash-border)] bg-[var(--dash-card)] px-2 py-1 text-xs text-[var(--dash-text)]"
					>
						<option value="debug">Debug</option>
						<option value="info">Info</option>
						<option value="warn">Warn</option>
						<option value="error">Error</option>
					</select>
				</div>
				{#if loadingLogs[run.id]}
					<Spinner size="w-3 h-3" color="var(--dash-text-muted)" />
				{/if}
			</div>

			<div
				bind:this={logContainerRefs[run.id]}
				onscroll={(e) => handleLogScroll(run.id, e)}
				class="max-h-64 overflow-y-auto border-t border-[var(--dash-border)]"
			>
				{#if !runLogs[run.id] || runLogs[run.id].length === 0}
					<div class="p-4 text-center text-sm text-[var(--dash-text-muted)]">
						{#if loadingLogs[run.id]}
							Loading logs...
						{:else}
							No logs available
						{/if}
					</div>
				{:else}
					<div class="divide-y divide-[var(--dash-border)]/60 p-2 font-mono text-xs">
						{#each runLogs[run.id] as log (log.id)}
							<div
								class="flex flex-wrap items-start gap-x-2 rounded px-1 py-1.5 hover:bg-[var(--dash-bg)] sm:flex-nowrap"
							>
								<span class="whitespace-nowrap text-[var(--dash-text-muted)]">
									{fmtTime(log.timestamp, tf, { timezone: tz || null })}
								</span>
								<span class={`w-12 uppercase ${getLogLevelColor(log.level)}`}>
									{log.level}
								</span>
								<span class="w-full min-w-0 break-all text-[var(--dash-text)] sm:w-auto sm:flex-1">
									{log.message}
								</span>
								{#if log.screenshot_path}
									<a
										href="/api/import-tasks/{searchTask.id}/runs/{run.id}/screenshots/{log.screenshot_path}"
										target="_blank"
										rel="noopener"
										class="flex-shrink-0"
										title="Open debug screenshot"
									>
										<img
											src="/api/import-tasks/{searchTask.id}/runs/{run.id}/screenshots/{log.screenshot_path}"
											alt="screenshot"
											class="h-12 w-auto rounded border border-[var(--dash-border)]"
											loading="lazy"
										/>
									</a>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/snippet}

<svelte:head>
	<title>
		{searchTaskDisplayName(searchTask.job_platform?.name, searchTask.note)} - Import Tasks - Smart Job
		Seeker
	</title>
</svelte:head>

<div class="space-y-6" use:armOn={noteField.arm}>
	<!-- Header -->
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
		<a
			href="/jobs/import/tasks"
			class="flex shrink-0 items-center gap-2 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
		>
			<FontAwesomeIcon icon={faArrowLeft} class="h-4 w-4" />
			<span class="text-sm">All Import Tasks</span>
		</a>
		<span class="hidden text-lg text-[var(--dash-text-muted)] sm:inline">·</span>
		<div class="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
			<div class="flex shrink-0 items-center gap-3">
				{#if searchTask.job_platform}
					<PlatformLogo platformUrl={searchTask.job_platform.url} size="w-5 h-5" />
					<span class="text-lg font-medium text-[var(--dash-text)]"
						>{searchTask.job_platform.name}</span
					>
				{/if}
				{#if !isEditingNote && !searchTask.note}
					<button
						onclick={() => {
							isEditingNote = true;
						}}
						class="shrink-0 p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
						title="Add note"
					>
						<FontAwesomeIcon icon={faPencil} class="h-3.5 w-3.5" />
					</button>
				{/if}
			</div>
			{#if isEditingNote}
				<span class="hidden text-lg text-[var(--dash-text-secondary)] sm:inline">—</span>
				<div class="flex min-w-0 flex-1 items-center gap-2">
					<input
						type="text"
						bind:value={editNoteInput}
						onblur={noteField.flush}
						autocomplete="off"
						placeholder="e.g., Remote only, senior roles"
						class="min-w-0 flex-1 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-base text-[var(--dash-text)] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === 'Escape') closeNoteEditor();
						}}
					/>
					<AutoSaveIndicator field={noteField} />
					<button
						onclick={closeNoteEditor}
						class="shrink-0 p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
						title="Done"
						aria-label="Done editing note"
					>
						<FontAwesomeIcon icon={faCheck} class="h-3.5 w-3.5" />
					</button>
				</div>
			{:else if searchTask.note}
				<div class="flex min-w-0 items-center gap-2">
					<span class="hidden text-lg text-[var(--dash-text-secondary)] sm:inline">—</span>
					<span class="truncate text-lg text-[var(--dash-text-secondary)]">{searchTask.note}</span>
					<button
						onclick={() => {
							isEditingNote = true;
						}}
						class="shrink-0 p-1 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text)]"
						title="Edit note"
					>
						<FontAwesomeIcon icon={faPencil} class="h-3.5 w-3.5" />
					</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Setup-needed banner: the task can't run until these are resolved. -->
	{#if blockers.length > 0}
		<Card padding="lg">
			<div class="flex items-start gap-3">
				<div
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--dash-warning-light)]"
				>
					<FontAwesomeIcon
						icon={faExclamationTriangle}
						class="h-4 w-4 text-[var(--dash-warning)]"
					/>
				</div>
				<div class="min-w-0 space-y-2">
					<div>
						<p class="font-medium text-[var(--dash-text)]">Finish setup to run this import</p>
						<p class="text-sm text-[var(--dash-text-secondary)]">
							Complete the {blockers.length === 1 ? 'step' : 'steps'} below before starting:
						</p>
					</div>
					<ImportTaskBlockerList {blockers} />
				</div>
			</div>
		</Card>
	{/if}

	<!-- Scrape Status -->
	<Card padding="lg">
		<div class="space-y-3">
			{#if errorMessage}
				<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-3">
					<p class="text-sm text-[var(--dash-error)]">{errorMessage}</p>
				</div>
			{/if}

			<div class="flex min-w-0 items-center gap-3">
				{#if searchTask.status === 'queued'}
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/20"
					>
						<FontAwesomeIcon icon={faClock} class="h-5 w-5 text-blue-500" />
					</div>
					<div class="min-w-0">
						<p class="font-medium text-[var(--dash-text)]">Queued</p>
						<p class="text-sm text-[var(--dash-text-secondary)]">Waiting in queue to start...</p>
					</div>
				{:else if searchTask.status === 'running'}
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--dash-primary-light)]"
					>
						<Spinner size="w-5 h-5" color="var(--dash-primary)" />
					</div>
					<div class="min-w-0">
						<p class="font-medium text-[var(--dash-text)]">
							{searchTask.status_message || 'Running...'}
						</p>
						<p class="text-sm text-[var(--dash-text-secondary)]">
							Scraping jobs from {searchTask.job_platform?.name || 'platform'}
						</p>
					</div>
				{:else if searchTask.status === 'blocked'}
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--dash-warning-light)]"
					>
						<FontAwesomeIcon
							icon={faExclamationTriangle}
							class="h-5 w-5 text-[var(--dash-warning)]"
						/>
					</div>
					<div class="min-w-0">
						<p class="font-medium text-[var(--dash-warning)]">
							{searchTask.status_message}
						</p>
						<p class="text-sm text-[var(--dash-text-secondary)]">
							{#if isMagicLink}
								Paste the login URL from your email below, then click Continue
							{:else}
								Complete the action in the browser view, then click Continue
							{/if}
						</p>
						{#if isVerification && verificationEmailAddress}
							<div
								class="mt-2 flex items-center gap-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] p-2"
							>
								<FontAwesomeIcon
									icon={faEnvelope}
									class="h-3.5 w-3.5 shrink-0 text-[var(--dash-primary)]"
								/>
								<span class="text-xs text-[var(--dash-text-secondary)]">
									Or forward the verification email to:
								</span>
								<code class="font-mono text-xs break-all text-[var(--dash-primary)] select-all"
									>{verificationEmailAddress}</code
								>
								<button
									onclick={copyVerificationEmail}
									class="shrink-0 p-1 transition-colors {copiedVerifyEmail
										? 'text-green-600'
										: 'text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]'}"
									title="Copy email address"
								>
									<FontAwesomeIcon icon={copiedVerifyEmail ? faCheck : faCopy} class="h-3 w-3" />
								</button>
								{#if copiedVerifyEmail}
									<span class="text-xs text-green-600">Copied!</span>
								{/if}
							</div>
						{/if}
					</div>
				{:else if searchTask.status === 'stopping'}
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--dash-error-light)]"
					>
						<Spinner size="w-5 h-5" color="var(--dash-error)" />
					</div>
					<div class="min-w-0">
						<p class="font-medium text-[var(--dash-text)]">Stopping...</p>
						<p class="text-sm text-[var(--dash-text-secondary)]">
							Waiting for the scraper to finish current action
						</p>
						{#if showForceStop}
							<button
								onclick={forceStop}
								class="mt-1 text-sm text-[var(--dash-error)] hover:underline"
							>
								Force stop
							</button>
						{/if}
					</div>
				{:else if searchTask.status === 'success'}
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--dash-success-light)]"
					>
						<FontAwesomeIcon icon={faCheck} class="h-5 w-5 text-[var(--dash-success)]" />
					</div>
					<div class="min-w-0">
						<p class="font-medium text-[var(--dash-text)]">Completed</p>
						<p class="mt-1 text-sm text-[var(--dash-text-secondary)]">
							{formatRelativeTime(searchTask.last_run)}{#if searchTask.last_run_jobs_found}
								&nbsp;•&nbsp; {searchTask.last_run_jobs_found} jobs found{/if}
						</p>
						<p class="text-xs text-[var(--dash-text-muted)]">
							{formatDate(searchTask.last_run)}
						</p>
					</div>
				{:else if searchTask.status === 'partial'}
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--dash-warning-light)]"
					>
						<FontAwesomeIcon
							icon={faExclamationTriangle}
							class="h-5 w-5 text-[var(--dash-warning)]"
						/>
					</div>
					<div class="min-w-0">
						<p class="font-medium text-[var(--dash-text)]">Completed with issues</p>
						<p class="mt-1 text-sm text-[var(--dash-text-secondary)]">
							{formatRelativeTime(searchTask.last_run)} &nbsp;•&nbsp; {searchTask.status_message}
						</p>
						<p class="text-xs text-[var(--dash-text-muted)]">
							{formatDate(searchTask.last_run)}
						</p>
					</div>
				{:else if searchTask.status === 'error'}
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--dash-error-light)]"
					>
						<FontAwesomeIcon icon={faTimes} class="h-5 w-5 text-[var(--dash-error)]" />
					</div>
					<div class="min-w-0">
						<p class="font-medium text-[var(--dash-error)]">Failed</p>
						<p class="text-sm text-[var(--dash-text-secondary)]">
							{searchTask.status_message}
						</p>
					</div>
				{:else if searchTask.status === 'cancelled'}
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--dash-error-light)]"
					>
						<FontAwesomeIcon icon={faTimes} class="h-5 w-5 text-[var(--dash-error)]" />
					</div>
					<div class="min-w-0">
						<p class="font-medium text-[var(--dash-text)]">Cancelled</p>
						<p class="text-sm text-[var(--dash-text-secondary)]">
							{searchTask.status_message || 'Cancelled by user'}
						</p>
					</div>
				{:else if searchTask.last_run}
					<!-- Idle but has run before -->
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--dash-border)] bg-[var(--dash-bg)]"
					>
						<FontAwesomeIcon icon={faCog} class="h-5 w-5 text-[var(--dash-text-muted)]" />
					</div>
					<div class="min-w-0">
						<p class="font-medium text-[var(--dash-text)]">Idle</p>
						<p class="mt-1 text-sm text-[var(--dash-text-secondary)]">
							Last run: {formatRelativeTime(
								searchTask.last_run
							)}{#if searchTask.last_run_jobs_found}
								&nbsp;•&nbsp; {searchTask.last_run_jobs_found} jobs found{/if}
						</p>
						<p class="text-xs text-[var(--dash-text-muted)]">
							{formatDate(searchTask.last_run)}
						</p>
					</div>
				{:else}
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--dash-border)] bg-[var(--dash-bg)]"
					>
						<FontAwesomeIcon icon={faCog} class="h-5 w-5 text-[var(--dash-text-muted)]" />
					</div>
					<div class="min-w-0">
						<p class="font-medium text-[var(--dash-text)]">Never run</p>
						<p class="text-sm text-[var(--dash-text-secondary)]">
							Click "Start" to begin importing jobs
						</p>
					</div>
				{/if}
			</div>

			{#if searchTask.auth_block_kind}
				<!-- The status line above says "Failed — Platform login failed"; this
				     says what to do about it, which is the part nobody can work out
				     from the error. -->
				<AuthBlockNotice
					kind={searchTask.auth_block_kind}
					disabled={!!searchTask.auto_disabled_at}
					platform={searchTask.job_platform?.name ?? 'the platform'}
					taskLabel={searchTask.note?.trim() || searchTask.search_term?.trim() || null}
				/>
			{/if}

			{#if searchTask.schedule_interval_hours}
				{@const intervalDays = searchTask.schedule_interval_hours / 24}
				{@const freqLabel =
					intervalDays >= 14
						? `every ${intervalDays / 7} weeks`
						: intervalDays >= 7
							? 'every week'
							: intervalDays > 1
								? `every ${intervalDays} days`
								: 'every day'}
				{@const prefHour = searchTask.schedule_preferred_hour ?? 9}
				{@const ampm = prefHour < 12 ? 'AM' : 'PM'}
				{@const h12 = prefHour === 0 ? 12 : prefHour > 12 ? prefHour - 12 : prefHour}
				<div class="mt-4 space-y-1.5">
					<h3 class="text-xs font-medium tracking-wide text-[var(--dash-text-secondary)] uppercase">
						Schedule
					</h3>
					<div class="space-y-1 text-xs text-[var(--dash-text-secondary)]">
						<div class="flex items-center gap-2">
							<FontAwesomeIcon icon={faCalendar} class="h-3 w-3" />
							<span
								>Auto-runs {freqLabel} at {h12}:00 {ampm}{data.userTimezone
									? ` (${data.userTimezone.split('/').pop()?.replace(/_/g, ' ')})`
									: ''}</span
							>
						</div>
						{#if searchTask.next_scheduled_run}
							{@const nextRun = new Date(searchTask.next_scheduled_run)}
							{@const diffMs = nextRun.getTime() - Date.now()}
							<div class="ml-5 flex items-center gap-2">
								<span>
									Next run {#if diffMs <= 0}due now{:else}{@const diffMins = Math.floor(
											diffMs / 60000
										)}{@const diffHours = Math.floor(diffMs / 3600000)}{@const diffDays =
											Math.floor(diffMs / 86400000)}{diffDays >= 1
											? `in ${diffDays}d ${diffHours % 24}h`
											: diffHours > 0
												? `in ${diffHours}h ${diffMins % 60}m`
												: `in ${diffMins}m`}{/if}
								</span>
								<span class="text-[var(--dash-text-muted)]"
									>{formatDate(searchTask.next_scheduled_run)}</span
								>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			{#if isTunnelMode && desktopStatusChecked}
				<div
					class="flex items-center gap-2 text-xs {isTunnelMode && !desktopConnected
						? 'text-amber-600'
						: 'text-[var(--dash-text-secondary)]'}"
				>
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
							class="underline hover:text-amber-700">Setup guide</a
						>
					{/if}
				</div>
			{/if}

			<div class="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
				{#if searchTask.status === 'blocked'}
					<button
						onclick={() => sendFeedback('continue')}
						disabled={isSendingFeedback || feedbackSent}
						class="flex items-center justify-center gap-2 rounded-lg bg-[var(--dash-success)] px-4 py-2 text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:justify-start"
					>
						{#if isSendingFeedback || feedbackSent}
							<Spinner size="w-4 h-4" />
						{:else}
							<FontAwesomeIcon icon={faCheck} class="h-4 w-4" />
						{/if}
						<span>{feedbackSent ? 'Resuming...' : 'Continue'}</span>
					</button>
					<button
						onclick={() => sendFeedback('skip')}
						disabled={isSendingFeedback || feedbackSent}
						class="flex items-center justify-center gap-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-border)] disabled:cursor-not-allowed disabled:opacity-50 sm:justify-start"
						title="Skip current action and move to next"
					>
						<FontAwesomeIcon icon={faForward} class="h-4 w-4" />
						<span>Skip</span>
					</button>
				{/if}

				{#if isRunning || isBlocked || isQueued || isStoppingStatus}
					<button
						onclick={stopScrape}
						disabled={isStopping || isStoppingStatus}
						class="flex items-center justify-center gap-2 rounded-lg bg-[var(--dash-error)] px-4 py-2 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:justify-start"
					>
						{#if isStopping || isStoppingStatus}
							<Spinner size="w-4 h-4" />
							<span>Stopping...</span>
						{:else}
							<FontAwesomeIcon icon={faStop} class="h-4 w-4" />
							<span>Stop</span>
						{/if}
					</button>
				{:else}
					<button
						onclick={startScrape}
						disabled={isStarting || blockers.length > 0}
						class="flex items-center justify-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:justify-start"
					>
						{#if isStarting}
							<Spinner size="w-4 h-4" />
							<span>{hasOtherRunning ? 'Enqueuing...' : 'Starting...'}</span>
						{:else}
							<FontAwesomeIcon icon={faPlay} class="h-4 w-4" />
							<span>{hasOtherRunning ? 'Enqueue' : 'Start'}</span>
						{/if}
					</button>
				{/if}

				{#if isTunnelMode && !browserLive}
					<button
						onclick={() => openBrowser()}
						disabled={isOpeningBrowser || (!searchTask.platform_id && !searchTask.search_url)}
						class="flex items-center justify-center gap-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:justify-start"
						title="Open the platform in your NAS Chrome for manual interaction (no scrape)"
					>
						{#if isOpeningBrowser}
							<Spinner size="w-4 h-4" />
							<span class="text-sm">Opening...</span>
						{:else}
							<FontAwesomeIcon icon={faExternalLinkAlt} class="h-4 w-4" />
							<span class="text-sm">Open Browser</span>
						{/if}
					</button>
				{/if}

				{#if !isTunnelMode || browserLive}
					<button
						onclick={() => (showBrowser = !showBrowser)}
						class="flex items-center justify-center gap-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg-hover)] sm:justify-start"
						title="{showBrowser ? 'Hide' : 'Show'} browser view"
					>
						<FontAwesomeIcon icon={showBrowser ? faEyeSlash : faEye} class="h-4 w-4" />
						<span class="text-sm">Browser View</span>
					</button>
				{/if}
			</div>

			{#if openBrowserMessage}
				<p class="text-sm text-[var(--dash-warning)]">{openBrowserMessage}</p>
			{/if}

			<!-- Active run details (jobs/logs) shown inline in status card -->
			{#if featuredRun}
				<div class="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)]">
					<span>Run</span>
					<span class="font-mono">#{featuredRun.id}</span>
					<button
						type="button"
						onclick={() => copyRunId(featuredRun!.id)}
						class="cursor-pointer p-0.5 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-primary)]"
						aria-label="Copy run ID"
					>
						<FontAwesomeIcon
							icon={copiedRunId === featuredRun.id ? faCheck : faCopy}
							class="h-3 w-3 {copiedRunId === featuredRun.id ? 'text-green-600' : ''}"
						/>
					</button>
					{#if copiedRunId === featuredRun.id}
						<span class="text-green-600">Copied!</span>
					{/if}
				</div>
				{@render runDetails(featuredRun, true)}
			{/if}

			<!-- Missing config warning: task needs either a platform (scraper
           drives the search form at runtime) or a legacy direct search_url. -->
			{#if !searchTask.platform_id && !searchTask.search_url}
				<p class="text-sm text-[var(--dash-warning)]">
					No platform selected. Please select a platform to start scraping.
				</p>
			{/if}
		</div>
	</Card>

	<!-- Search source: preset picker that owns search_url + search_term -->
	<Card padding="lg">
		{#key data.searchTask.id}
			<!-- Two short fields (Jobs URL display + Search keywords input) share
           the row on wide screens; the wider Filter preferences block sits
           full-width below. -->
			{@const jobsUrl = searchTask.search_url || searchTask.job_platform?.search_page_url || null}
			<div class="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-2">
				<!-- Read-only display of the URL the scraper will open. Per-task
             `search_url` (legacy flow) takes precedence over the platform's
             `search_page_url` (form-fill flow); both are platform-level
             config edited in admin, not here. -->
				<div>
					<h3 class="mb-1 text-xs font-medium text-[var(--dash-text-secondary)]">Jobs URL</h3>
					{#if jobsUrl}
						<a
							href={jobsUrl}
							target="_blank"
							rel="noopener"
							class="inline-flex items-center gap-1 text-sm break-all text-[var(--dash-primary)] hover:underline"
						>
							{jobsUrl}
							<FontAwesomeIcon icon={faExternalLinkAlt} class="h-3 w-3 flex-shrink-0" />
						</a>
					{:else}
						<p class="text-sm text-[var(--dash-text-muted)]">Not set</p>
					{/if}
					<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
						Page the scraper opens to find jobs.
					</p>
				</div>

				<SourceEditor
					taskId={searchTask.id}
					initial={{
						platform_id: searchTask.platform_id ?? null,
						search_term: searchTask.search_term ?? null,
						search_filters: (searchTask.search_filters as Record<string, string | string[]>) ?? {}
					}}
					onSaved={(saved) => {
						searchTask.platform_id = saved.platform_id;
						searchTask.search_term = saved.search_term;
						searchTask.search_filters = saved.search_filters;
					}}
				/>
			</div>

			<div class="mt-6 border-t border-[var(--dash-border)] pt-4">
				<h3 class="mb-1 text-sm font-medium text-[var(--dash-text)]">Filter preferences</h3>
				<p class="mb-3 text-xs text-[var(--dash-text-muted)]">
					The scraper applies these per-platform — translates each canonical option into the right
					widget on the platform's filter UI.
				</p>
				<FilterEditor
					taskId={searchTask.id}
					initial={(searchTask.search_filters as Record<string, string | string[]>) ?? {}}
					onSaved={(saved) => {
						searchTask.search_filters = saved;
					}}
				/>
			</div>
		{/key}
	</Card>

	<!-- Scrape Configuration -->
	<Card padding="lg">
		{#key data.searchTask.id}
			<SearchTaskFields
				mode="edit"
				localBrowserAllowed={data.localBrowserAllowed}
				serverBrowserProvider={data.browserProvider}
				{searchTask}
				searchTaskId={searchTask.id}
				profileId={data.profileId}
				platformCredentials={data.platformCredentials}
				browserCountryCode={data.browserCountryCode}
				defaultCountryCode={data.defaultCountryCode}
				browserFingerprint={data.browserFingerprint}
				browserFingerprintDefaults={data.browserFingerprintDefaults}
				uiPreferences={data.uiPreferences as Record<string, unknown>}
				desktopConnected={desktopStatusChecked ? desktopConnected : null}
				{preferredDevice}
				{devices}
				verificationEmailAddress={data.verificationEmailAddress}
				userTimezone={tz || ''}
				timeFormat={tf}
				hideSourceFields={true}
				canEditSignInPage={data.canEditSignInPage}
				onSignInNow={canSignInNow ? signInNow : null}
				signingInNow={isOpeningBrowser}
				isStaff={data.isStaff}
			/>
		{/key}
	</Card>

	<!-- Browser View popup -->
	{#if showBrowser}
		<div
			use:portalToBody={{
				onClose: () => {
					showBrowser = false;
					if (vncEnabled) stopVnc();
				}
			}}
			class="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:p-4"
		>
			<!-- Backdrop (hidden on mobile since popup is full-screen) -->
			<div
				class="absolute inset-0 hidden bg-black/60 sm:block"
				onclick={() => {
					showBrowser = false;
					if (vncEnabled) stopVnc();
				}}
				role="presentation"
			></div>
			<!-- Popup content: full-screen on mobile, constrained popup on desktop -->
			<Card
				class="relative flex h-[100dvh] w-full flex-col overflow-hidden !rounded-none !border-0 shadow-2xl sm:h-auto sm:max-h-[90vh] sm:max-w-5xl sm:!rounded-lg sm:!border"
			>
				<div
					class="flex shrink-0 items-center justify-between border-b border-[var(--dash-border)] px-3 py-2 sm:p-4"
				>
					<div class="flex items-center gap-2">
						<FontAwesomeIcon
							icon={isCloudMode ? faCloud : faDesktop}
							class="h-4 w-4 text-[var(--dash-text-secondary)]"
						/>
						<h2 class="hidden text-sm font-medium text-[var(--dash-text)] sm:block sm:text-base">
							Browser View
						</h2>
						{#if isCloudMode}
							<span
								class="rounded bg-[var(--dash-bg)] px-2 py-0.5 text-xs text-[var(--dash-text-muted)]"
							>
								Cloud
							</span>
						{/if}
						{#if isTunnelMode}
							<span
								class="rounded bg-[var(--dash-bg)] px-2 py-0.5 text-xs text-[var(--dash-text-muted)]"
							>
								{preferredDevice?.apiKeyName ?? 'Desktop'}
							</span>
						{/if}
					</div>
					<div class="flex items-center gap-2">
						{#if isTunnelMode}
							<div class="flex overflow-hidden rounded border border-[var(--dash-border)]">
								<button
									onclick={() => setViewMode('screenshot')}
									class="flex items-center gap-1 px-2 py-1 text-xs transition-colors {browserViewMode ===
									'screenshot'
										? 'bg-[var(--dash-primary)] text-white'
										: 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]'}"
									title="Screenshot mode (auto-refreshing)"
								>
									<FontAwesomeIcon icon={faCamera} class="h-3 w-3" />
									<span class="hidden sm:inline">Screenshot</span>
								</button>
								{#if !data.isDemo}
									<button
										onclick={() => setViewMode('vnc')}
										disabled={vncConnecting}
										class="flex items-center gap-1 border-l border-[var(--dash-border)] px-2 py-1 text-xs transition-colors {browserViewMode ===
										'vnc'
											? 'bg-[var(--dash-primary)] text-white'
											: 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]'}"
										title="Interactive VNC mode"
									>
										<FontAwesomeIcon icon={faDesktop} class="h-3 w-3" />
										<span class="hidden sm:inline"
											>{vncConnecting ? 'Connecting...' : 'Interactive'}</span
										>
									</button>
								{/if}
							</div>
							{#if browserViewMode === 'screenshot'}
								<!-- Inline (desktop) -->
								{#if !data.isDemo}
									<button
										onclick={() => {
											interactiveMode = !interactiveMode;
										}}
										class="hidden p-1 transition-colors sm:inline-flex {interactiveMode
											? 'text-[var(--dash-primary)]'
											: 'text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]'}"
										title="{interactiveMode ? 'Disable' : 'Enable'} interactive mode"
									>
										<FontAwesomeIcon icon={faHandPointer} class="h-3.5 w-3.5" />
									</button>
								{/if}
								<button
									onclick={fetchScreenshot}
									class="hidden p-1 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)] sm:inline-flex"
									title="Refresh screenshot"
								>
									<FontAwesomeIcon icon={faSync} class="h-3.5 w-3.5" />
								</button>
							{/if}
						{/if}
						{#if isCloudMode && liveUrl}
							<a
								href={liveUrl}
								target="_blank"
								rel="noopener"
								class="hidden p-1 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)] sm:inline-flex"
								title="Open in new tab"
							>
								<FontAwesomeIcon icon={faExternalLinkAlt} class="h-4 w-4" />
							</a>
						{/if}
						<button
							onclick={() => {
								showBrowserLogs = !showBrowserLogs;
								if (showBrowserLogs && featuredRunId && !runLogs[featuredRunId]) {
									loadRunLogs(featuredRunId);
								}
							}}
							class="
                rounded px-2 py-1 text-xs transition-colors {showBrowserLogs
								? 'bg-[var(--dash-primary)] text-white'
								: 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]'}
              "
							title={showBrowserLogs ? 'Hide logs' : 'Show logs'}
						>
							<FontAwesomeIcon icon={faTerminal} class="mr-1 h-3 w-3" />
							Logs
						</button>
						<!-- Kebab menu for situational buttons on small screens -->
						{#if (isTunnelMode && browserViewMode === 'screenshot') || (isCloudMode && liveUrl)}
							<div class="relative sm:hidden">
								<button
									onclick={() => {
										headerMenuOpen = !headerMenuOpen;
									}}
									class="p-1 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
									aria-label="More actions"
								>
									<FontAwesomeIcon icon={faEllipsisV} class="h-4 w-4" />
								</button>
								{#if headerMenuOpen}
									<!-- backdrop -->
									<button
										type="button"
										class="fixed inset-0 z-30 cursor-default"
										aria-label="Close menu"
										onclick={() => {
											headerMenuOpen = false;
										}}
									>
									</button>
									<div
										class="absolute top-full right-0 z-40 mt-1 min-w-[180px] rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] py-1 shadow-lg"
									>
										{#if isTunnelMode && browserViewMode === 'screenshot'}
											{#if !data.isDemo}
												<button
													onclick={() => {
														interactiveMode = !interactiveMode;
														headerMenuOpen = false;
													}}
													class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--dash-bg)] {interactiveMode
														? 'text-[var(--dash-primary)]'
														: 'text-[var(--dash-text)]'}"
												>
													<FontAwesomeIcon icon={faHandPointer} class="h-3.5 w-3.5" />
													{interactiveMode ? 'Disable' : 'Enable'} interactive
												</button>
											{/if}
											<button
												onclick={() => {
													fetchScreenshot();
													headerMenuOpen = false;
												}}
												class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
											>
												<FontAwesomeIcon icon={faSync} class="h-3.5 w-3.5" />
												Refresh screenshot
											</button>
										{/if}
										{#if isCloudMode && liveUrl}
											<a
												href={liveUrl}
												target="_blank"
												rel="noopener"
												onclick={() => {
													headerMenuOpen = false;
												}}
												class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
											>
												<FontAwesomeIcon icon={faExternalLinkAlt} class="h-3.5 w-3.5" />
												Open in new tab
											</a>
										{/if}
									</div>
								{/if}
							</div>
						{/if}
						<button
							onclick={() => {
								showBrowser = false;
								if (vncEnabled) stopVnc();
								stopScreenshotPolling();
							}}
							class="p-1 text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
						>
							<FontAwesomeIcon icon={faTimes} class="h-4 w-4" />
						</button>
					</div>
				</div>
				<!-- Action-needed banner — hard to miss when blocked, replaces a cramped header badge -->
				{#if isBlocked}
					<div
						class="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--dash-warning)]/30 bg-[var(--dash-warning-light)] px-3 py-2 text-sm"
					>
						<div class="flex min-w-0 items-center gap-2 font-medium text-[var(--dash-warning)]">
							<FontAwesomeIcon icon={faExclamationTriangle} class="h-4 w-4 shrink-0" />
							<span class="truncate">Action needed</span>
						</div>
						<button
							onclick={() => {
								showInterventionControls = !showInterventionControls;
							}}
							class="
                shrink-0 rounded px-3 py-1 text-xs transition-colors {showInterventionControls
								? 'bg-[var(--dash-warning)] text-white'
								: 'border border-[var(--dash-warning)]/40 bg-[var(--dash-card)] text-[var(--dash-warning)] hover:bg-[var(--dash-warning)] hover:text-white'}
              "
						>
							{showInterventionControls ? 'Hide controls' : 'Show controls'}
						</button>
					</div>
				{/if}
				<!-- Browser view: flex-fills on mobile, 16:9 aspect on desktop -->
				<div class="relative min-h-0 w-full flex-1 sm:aspect-video sm:flex-initial">
					{#if expectsCloudBrowser && browserViewUrl}
						<iframe
							src={browserViewUrl}
							class="absolute inset-0 h-full w-full border-0"
							title="Cloud browser view"
						></iframe>
					{:else if expectsCloudBrowser}
						<div class="absolute inset-0 flex items-center justify-center bg-[var(--dash-bg)]">
							<div class="text-center">
								<Spinner size="w-6 h-6" color="var(--dash-text-muted)" class="mb-2" />
								<p class="text-sm text-[var(--dash-text-muted)]">Starting cloud browser...</p>
							</div>
						</div>
					{:else if browserViewMode === 'screenshot'}
						{#if screenshotSrc}
							<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
							<div
								class="absolute inset-0 bg-black {interactiveMode ? 'cursor-crosshair' : ''}"
								role={interactiveMode ? 'application' : undefined}
								tabindex={interactiveMode ? 0 : undefined}
								onmousedown={handleInteractiveMouseDown}
								onmouseup={handleInteractiveMouseUp}
								onmousemove={handleInteractiveMouseMove}
								onwheel={handleInteractiveWheel}
								onkeydown={handleInteractiveKeyDown}
								onkeyup={handleInteractiveKeyUp}
								oncontextmenu={(e) => {
									if (interactiveMode) e.preventDefault();
								}}
							>
								<img
									bind:this={screenshotImgEl}
									src={screenshotSrc}
									alt="Browser screenshot"
									class="pointer-events-none h-full w-full object-contain select-none"
									draggable="false"
								/>
							</div>
						{:else if screenshotLoading}
							<div class="absolute inset-0 flex items-center justify-center bg-[var(--dash-bg)]">
								<div class="text-center">
									<Spinner size="w-6 h-6" color="var(--dash-text-muted)" class="mb-2" />
									<p class="text-sm text-[var(--dash-text-muted)]">Loading screenshot...</p>
								</div>
							</div>
						{:else}
							<div class="absolute inset-0 flex items-center justify-center bg-[var(--dash-bg)]">
								<div class="text-center">
									<FontAwesomeIcon
										icon={faCamera}
										class="mb-2 h-6 w-6 text-[var(--dash-text-muted)]"
									/>
									<p class="text-sm text-[var(--dash-text-muted)]">No screenshot available</p>
									<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
										Make sure a device is connected
									</p>
								</div>
							</div>
						{/if}
					{:else if vncEnabled && vncUrl}
						<iframe
							src={vncUrl}
							class="absolute inset-0 h-full w-full border-0"
							title="Interactive browser view (VNC)"
						></iframe>
					{:else if vncConnecting}
						<div class="absolute inset-0 flex items-center justify-center bg-[var(--dash-bg)]">
							<div class="text-center">
								<Spinner size="w-6 h-6" color="var(--dash-text-muted)" class="mb-2" />
								<p class="text-sm text-[var(--dash-text-muted)]">Connecting to browser...</p>
							</div>
						</div>
					{:else if browserViewUrl}
						<iframe
							src={browserViewUrl}
							class="absolute inset-0 h-full w-full border-0"
							title="Browser view for manual intervention"
						></iframe>
					{:else if isTunnelMode}
						<div class="absolute inset-0 flex items-center justify-center bg-[var(--dash-bg)]">
							<div class="text-center">
								<FontAwesomeIcon
									icon={faDesktop}
									class="mb-2 h-6 w-6 text-[var(--dash-text-muted)]"
								/>
								{#if vncError}
									<p class="text-sm text-[var(--dash-error)]">
										{vncError}
									</p>
									<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
										Check that the device is connected
									</p>
								{:else}
									<p class="text-sm text-[var(--dash-text-muted)]">
										Browser running on your device
									</p>
									<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
										Switch to "Interactive" for VNC browser control
									</p>
								{/if}
							</div>
						</div>
					{:else}
						<div class="absolute inset-0 flex items-center justify-center bg-[var(--dash-bg)]">
							<div class="text-center">
								<Spinner size="w-6 h-6" color="var(--dash-text-muted)" class="mb-2" />
								<p class="text-sm text-[var(--dash-text-muted)]">Starting cloud browser...</p>
							</div>
						</div>
					{/if}
					<!-- Logs overlay (on top of browser view, semi-transparent) -->
					{#if showBrowserLogs}
						<div class="absolute inset-0 z-10 flex flex-col bg-black/80 backdrop-blur-sm">
							<div
								class="flex shrink-0 items-center justify-between border-b border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5"
							>
								<div class="flex items-center gap-2">
									<select
										bind:value={logLevelFilter}
										onchange={() => {
											if (featuredRunId) {
												runLogs[featuredRunId] = [];
												loadRunLogs(featuredRunId);
											}
										}}
										class="rounded border border-[var(--dash-border)] bg-[var(--dash-card)] px-2 py-0.5 text-xs text-[var(--dash-text)]"
									>
										<option value="debug">Debug</option>
										<option value="info">Info</option>
										<option value="warn">Warn</option>
										<option value="error">Error</option>
									</select>
								</div>
								{#if featuredRunId && loadingLogs[featuredRunId]}
									<Spinner size="w-3 h-3" color="var(--dash-text-muted)" />
								{/if}
							</div>
							<div bind:this={browserLogRef} class="flex-1 overflow-y-auto">
								{#if !featuredRunId || !runLogs[featuredRunId] || runLogs[featuredRunId].length === 0}
									<div class="p-4 text-center text-sm text-[var(--dash-text-muted)]">
										{#if featuredRunId && loadingLogs[featuredRunId]}
											Loading logs...
										{:else}
											No logs available
										{/if}
									</div>
								{:else}
									<div class="divide-y divide-white/10 p-2 font-mono text-xs">
										{#each runLogs[featuredRunId] as log (log.id)}
											<div
												class="flex flex-wrap items-start gap-x-2 rounded px-1 py-1.5 hover:bg-white/10 sm:flex-nowrap"
											>
												<span class="whitespace-nowrap text-gray-400">
													{fmtTime(log.timestamp, tf, { timezone: tz || null })}
												</span>
												<span class={`w-12 uppercase ${getLogLevelColorOnDark(log.level)}`}>
													{log.level}
												</span>
												<span class="w-full min-w-0 break-all text-gray-100 sm:w-auto sm:flex-1">
													{log.message}
												</span>
												{#if log.screenshot_path}
													<a
														href="/api/import-tasks/{searchTask.id}/runs/{featuredRunId}/screenshots/{log.screenshot_path}"
														target="_blank"
														rel="noopener"
														class="flex-shrink-0"
														title="Open debug screenshot"
													>
														<img
															src="/api/import-tasks/{searchTask.id}/runs/{featuredRunId}/screenshots/{log.screenshot_path}"
															alt="screenshot"
															class="h-12 w-auto rounded border border-white/20"
															loading="lazy"
														/>
													</a>
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>
				<!-- Intervention controls — a bottom bar below the browser view (not an
             overlay) so the page stays visible while you fill fields. -->
				{#if isBlocked && showInterventionControls}
					<div
						class="max-h-[45vh] shrink-0 space-y-2 overflow-y-auto border-t border-[var(--dash-border)] bg-[var(--dash-card)] p-3"
					>
						<!-- Intervention message + action buttons -->
						<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<div class="text-sm text-[var(--dash-text-secondary)]">
								{#if isMagicLink}
									<p>
										Paste the login link from your email below and click Navigate, then click
										Continue.
									</p>
								{:else}
									<p>
										Complete the required action (login, CAPTCHA, or verification) in the browser
										above, then click Continue.
									</p>
								{/if}
								{#if isVerification && verificationEmailAddress}
									<p class="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
										<FontAwesomeIcon icon={faEnvelope} class="h-3 w-3 text-[var(--dash-primary)]" />
										<span>Auto-verify: forward the email to</span>
										<code class="font-mono text-[var(--dash-primary)] select-all"
											>{verificationEmailAddress}</code
										>
										<button
											onclick={copyVerificationEmail}
											class="transition-colors {copiedVerifyEmail
												? 'text-green-600'
												: 'text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]'}"
											title="Copy"
										>
											<FontAwesomeIcon
												icon={copiedVerifyEmail ? faCheck : faCopy}
												class="h-2.5 w-2.5"
											/>
										</button>
										{#if copiedVerifyEmail}
											<span class="text-green-600">Copied!</span>
										{/if}
									</p>
								{/if}
							</div>
							<div class="flex shrink-0 items-center gap-2">
								<button
									onclick={() => sendFeedback('continue')}
									disabled={isSendingFeedback || feedbackSent}
									class="flex items-center gap-2 rounded-lg bg-[var(--dash-success)] px-4 py-2 text-sm text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
								>
									{#if isSendingFeedback || feedbackSent}
										<Spinner size="w-3 h-3" />
									{:else}
										<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
									{/if}
									<span>{feedbackSent ? 'Resuming...' : 'Continue'}</span>
								</button>
								<button
									onclick={() => sendFeedback('skip')}
									disabled={isSendingFeedback || feedbackSent}
									class="flex items-center gap-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-2 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-border)] disabled:cursor-not-allowed disabled:opacity-50"
									title="Skip current action"
								>
									<FontAwesomeIcon icon={faForward} class="h-3 w-3" />
									<span>Skip</span>
								</button>
							</div>
						</div>
						<!-- Navigate URL (for magic link login) -->
						<div class="flex items-center gap-2 border-t border-[var(--dash-border)] pt-2">
							<input
								type="url"
								bind:value={navigateUrlValue}
								placeholder="Paste login URL from email"
								disabled={isNavigating}
								onkeydown={(e) => {
									if (e.key === 'Enter') sendNavigateUrl();
								}}
								class="flex-1 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-1.5 text-sm text-[var(--dash-text)] focus:ring-1 focus:ring-[var(--dash-primary)] focus:outline-none disabled:opacity-50 {isMagicLink
									? 'ring-1 ring-[var(--dash-warning)]'
									: ''}"
							/>
							<button
								onclick={() => sendNavigateUrl()}
								disabled={isNavigating || !navigateUrlValue.trim()}
								class="px-3 py-1.5 text-sm {isMagicLink
									? 'bg-[var(--dash-primary)] text-white'
									: 'border border-[var(--dash-border)] bg-[var(--dash-card)] text-[var(--dash-text)]'} rounded-lg transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
								title="Open URL in the scraper browser"
							>
								{#if isNavigating}
									<Spinner size="w-3 h-3" />
								{:else}
									Navigate
								{/if}
							</button>
							{#if navigateUrlMessage}
								<span class="text-xs text-[var(--dash-text-muted)]">{navigateUrlMessage}</span>
							{/if}
						</div>
						<!-- Type text into browser (2FA codes, or any focused field — username, password, etc.) -->
						<div class="flex flex-col gap-2 border-t border-[var(--dash-border)] pt-2">
							<p class="text-xs text-[var(--dash-text-muted)]">
								Auto-focuses the relevant field (verification code, then any empty input) before
								typing. If it picks the wrong field and interactive mode is on, click the field in
								the browser view first.
							</p>
							<div class="flex items-center gap-2">
								<input
									type="text"
									bind:value={typeTextValue}
									placeholder="Text to send (2FA code, username, password, …)"
									disabled={isTypingText}
									onkeydown={(e) => {
										if (e.key === 'Enter') sendTypeText(true);
									}}
									class="flex-1 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-1.5 text-sm text-[var(--dash-text)] focus:ring-1 focus:ring-[var(--dash-primary)] focus:outline-none disabled:opacity-50"
								/>
								<button
									onclick={() => sendTypeText(true)}
									disabled={isTypingText || !typeTextValue.trim()}
									class="rounded-lg bg-[var(--dash-primary)] px-3 py-1.5 text-sm whitespace-nowrap text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
									title="Type text and submit the form"
								>
									{#if typeTextAction === 'send'}
										<Spinner size="w-3 h-3" />
									{:else}
										Send
									{/if}
								</button>
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<button
									onclick={() => sendTypeText(false)}
									disabled={isTypingText || !typeTextValue.trim()}
									class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-1.5 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-border)] disabled:cursor-not-allowed disabled:opacity-50"
									title="Type text without submitting"
								>
									{#if typeTextAction === 'type'}
										<Spinner size="w-3 h-3" />
									{:else}
										Type only
									{/if}
								</button>
								<button
									onclick={() => submitBrowserForm()}
									disabled={isTypingText}
									class="rounded-lg bg-[var(--dash-success)] px-3 py-1.5 text-sm text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
									title="Click the submit button in the browser"
								>
									{#if typeTextAction === 'submit'}
										<Spinner size="w-3 h-3" />
									{:else}
										Submit
									{/if}
								</button>
								<button
									onclick={() => clearBrowserInput()}
									disabled={isTypingText}
									class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-1.5 text-sm text-[var(--dash-text-secondary)] transition-colors hover:bg-[var(--dash-border)] disabled:cursor-not-allowed disabled:opacity-50"
									title="Clear the input field in the browser"
								>
									{#if typeTextAction === 'clear'}
										<Spinner size="w-3 h-3" />
									{:else}
										Clear
									{/if}
								</button>
								{#if typeTextMessage}
									<span class="text-xs text-[var(--dash-text-muted)]">{typeTextMessage}</span>
								{/if}
							</div>
						</div>
					</div>
				{/if}
			</Card>
		</div>
	{/if}

	<!-- Runs History -->
	<Card>
		<div class="flex items-center gap-2 border-b border-[var(--dash-border)] p-4">
			<FontAwesomeIcon icon={faHistory} class="h-4 w-4 text-[var(--dash-text-secondary)]" />
			<h2 class="font-medium text-[var(--dash-text)]">Run History</h2>
		</div>

		{#if historyRuns.length === 0}
			<div class="p-8 text-center text-[var(--dash-text-secondary)]">
				<p>No completed runs yet.</p>
			</div>
		{:else}
			<div class="divide-y divide-[var(--dash-border)]">
				{#each historyRuns as run (run.id)}
					<div
						class="bg-[var(--dash-card)] {expandedRunId === run.id
							? 'border-l-2 border-l-[var(--dash-primary)]'
							: ''}"
					>
						<!-- Run header (clickable) -->
						<button
							onclick={() => toggleRunExpanded(run.id)}
							class="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--dash-bg)]"
						>
							{#if expandedRunId === run.id}
								<FontAwesomeIcon
									icon={faChevronDown}
									class="h-3 w-3 text-[var(--dash-text-muted)]"
								/>
							{:else}
								<FontAwesomeIcon
									icon={faChevronRight}
									class="h-3 w-3 text-[var(--dash-text-muted)]"
								/>
							{/if}

							<div
								class={`flex h-6 w-6 items-center justify-center rounded-full ${
									run.status === 'running' || run.status === 'queued'
										? 'bg-[var(--dash-primary-light)]'
										: run.status === 'success'
											? 'bg-[var(--dash-success-light)]'
											: run.status === 'blocked' || run.status === 'partial'
												? 'bg-[var(--dash-warning-light)]'
												: 'bg-[var(--dash-error-light)]'
								}`}
							>
								{#key run.status}
									{#if run.status === 'running' || run.status === 'queued'}
										<Spinner size="w-3 h-3" color="var(--dash-primary)" />
									{:else}
										<FontAwesomeIcon
											icon={getRunStatusIcon(run.status)}
											class="h-3 w-3 {getRunStatusColor(run.status)}"
										/>
									{/if}
								{/key}
							</div>

							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span class={`font-medium capitalize ${getRunStatusColor(run.status)}`}>
										{run.status}
									</span>
									{#if run.jobs_found !== null}
										<span class="text-sm text-[var(--dash-text-secondary)]">
											• {run.jobs_found} new {run.jobs_found === 1 ? 'job' : 'jobs'}
										</span>
									{/if}
									{#if run.error_message && run.status !== 'success'}
										<span
											class="inline-flex items-center rounded bg-[var(--dash-bg)] px-1.5 py-0 text-xs text-[var(--dash-text-muted)]"
										>
											{run.error_message}
										</span>
									{/if}
								</div>
								<div class="flex items-center gap-1 text-sm text-[var(--dash-text-muted)]">
									{formatRelativeTime(run.started_at)}
									<span class="text-[var(--dash-text-muted)]">•</span>
									<span class="capitalize">{run.triggered_by}</span>
									<span class="text-[var(--dash-text-muted)]">•</span>
									<span class="font-mono text-xs">#{run.id}</span>
									<span
										role="button"
										tabindex="0"
										onclick={(e) => {
											e.stopPropagation();
											copyRunId(run.id);
										}}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.stopPropagation();
												e.preventDefault();
												copyRunId(run.id);
											}
										}}
										class="cursor-pointer p-0.5 text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-primary)]"
										aria-label="Copy run ID"
									>
										<FontAwesomeIcon
											icon={copiedRunId === run.id ? faCheck : faCopy}
											class="h-3 w-3 {copiedRunId === run.id ? 'text-green-600' : ''}"
										/>
									</span>
									{#if copiedRunId === run.id}
										<span class="text-xs text-green-600">Copied!</span>
									{/if}
								</div>
								{#if run.settings}
									<div class="mt-0.5 flex flex-wrap items-center gap-1.5">
										{#if run.settings.max_jobs}
											<span
												class="inline-flex items-center rounded bg-[var(--dash-bg)] px-1.5 py-0 text-xs text-[var(--dash-text-muted)]"
											>
												max: {run.settings.max_jobs}
											</span>
										{/if}
										{#if run.settings.skip_first}
											<span
												class="inline-flex items-center rounded bg-[var(--dash-bg)] px-1.5 py-0 text-xs text-[var(--dash-text-muted)]"
											>
												skip first: {run.settings.skip_first}
											</span>
										{/if}
										{#if run.settings.skip_existing}
											<span
												class="inline-flex items-center rounded bg-[var(--dash-bg)] px-1.5 py-0 text-xs text-[var(--dash-text-muted)]"
											>
												skip duplicates
											</span>
										{/if}
										{#if run.settings.stop_after_duplicates}
											<span
												class="inline-flex items-center rounded bg-[var(--dash-bg)] px-1.5 py-0 text-xs text-[var(--dash-text-muted)]"
											>
												stop after: {run.settings.stop_after_duplicates}
												duplicates
											</span>
										{/if}
										{#if run.settings.browser_provider}
											<span
												class="inline-flex items-center rounded bg-[var(--dash-bg)] px-1.5 py-0 text-xs text-[var(--dash-text-muted)]"
											>
												{run.settings.browser_provider === 'hosted'
													? 'cloud'
													: run.settings.browser_provider}
											</span>
										{/if}
									</div>
								{/if}
							</div>
						</button>

						<!-- Expanded details (tabs: Items / Logs) -->
						{#if expandedRunId === run.id}
							{@render runDetails(run)}
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</Card>

	<!-- Settings -->
	<Card>
		<button
			type="button"
			onclick={toggleSettingsSection}
			class="flex w-full items-center gap-2 p-4 text-left"
		>
			{#if settingsOpen}
				<FontAwesomeIcon icon={faChevronDown} class="h-3 w-3 text-[var(--dash-text-muted)]" />
			{:else}
				<FontAwesomeIcon icon={faChevronRight} class="h-3 w-3 text-[var(--dash-text-muted)]" />
			{/if}
			<FontAwesomeIcon icon={faCog} class="h-4 w-4 text-[var(--dash-text-muted)]" />
			<h3 class="text-sm font-medium tracking-wide text-[var(--dash-text-muted)] uppercase">
				Settings
			</h3>
		</button>

		{#if settingsOpen}
			<div class="space-y-4 px-4 pb-4">
				<div class="border-t border-[var(--dash-border)] pt-2">
					<h4 class="mb-2 text-sm font-medium text-red-500">Danger Zone</h4>
					{#if showDeleteConfirm}
						<div class="flex flex-wrap items-center gap-3">
							<span class="text-sm text-[var(--dash-text)]">
								Are you sure? This will permanently delete this task and all its run history.
							</span>
							<div class="flex items-center gap-2">
								<button
									onclick={deleteTask}
									disabled={isDeleting}
									class="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
								>
									{#if isDeleting}
										<Spinner size="w-3 h-3" class="mr-1" />
									{/if}
									Yes, delete
								</button>
								<button
									onclick={() => (showDeleteConfirm = false)}
									class="rounded border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)]"
								>
									Cancel
								</button>
							</div>
						</div>
					{:else}
						<button
							onclick={() => (showDeleteConfirm = true)}
							class="flex items-center gap-2 rounded border border-red-300 px-3 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
						>
							<FontAwesomeIcon icon={faTrash} class="h-3.5 w-3.5" />
							Delete this search task
						</button>
					{/if}
				</div>
			</div>
		{/if}
	</Card>
</div>
