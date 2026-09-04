<script lang="ts">
	import { onMount } from 'svelte';
	import { armOn } from '$lib/actions/arm-on';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCheck,
		faChevronDown,
		faChevronRight,
		faClock,
		faCopy,
		faDesktop,
		faEnvelope,
		faExternalLinkAlt,
		faEye,
		faEyeSlash,
		faGlobe,
		faKey,
		faPenToSquare,
		faRightToBracket
	} from '@fortawesome/free-solid-svg-icons';
	import CountrySelect from './CountrySelect.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import PlatformLogo from '$lib/components/PlatformLogo.svelte';
	import CredentialSelector from './CredentialSelector.svelte';
	import SignInPageField from './SignInPageField.svelte';
	import BrowserProviderToggle from './BrowserProviderToggle.svelte';
	import { autoSaveField } from '$lib/components/auto-save.svelte';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import { buildHourOptions } from '$lib/format-date';
	import { toLoginMode } from '$lib/import-tasks/sign-in';
	import type { TimeFormat } from '$lib/format-date';

	interface Props {
		mode: 'add' | 'edit';
		localBrowserAllowed: boolean;
		serverBrowserProvider: string;
		defaultBrowserProvider?: string;
		defaultMaxJobs?: number | null;
		// Add mode props
		searchUrl?: string;
		searchTerm?: string;
		loginPageUrl?: string;
		detectedPlatform?: {
			id: number;
			name: string;
			url: string;
			loginPageUrl: string | null;
			isNew: boolean;
		} | null;
		detectingPlatform?: boolean;
		existingCredentials?: Array<{
			id: number;
			username: string | null;
			status: string;
			shared?: boolean;
			owner_user_id?: string | null;
			owner_label?: string | null;
		}>;
		onsearchurlinput?: (e: Event) => void;
		// Edit mode props
		searchTask?: any;
		searchTaskId?: number;
		profileId?: number;
		platformCredentials?: Array<{
			id: number;
			username: string | null;
			shared?: boolean;
			owner_user_id?: string | null;
			owner_label?: string | null;
		}>;
		browserCountryCode?: string;
		defaultCountryCode?: string;
		browserFingerprint?: {
			language: string;
			timezone: string;
		};
		browserFingerprintDefaults?: { language: string; timezone: string };
		uiPreferences?: Record<string, unknown>;
		desktopConnected?: boolean | null;
		preferredDevice?: {
			apiKeyId: number;
			apiKeyName: string;
			isShared: boolean;
			ownerLabel: string | null;
		} | null;
		devices?: Array<{
			apiKeyId: number;
			apiKeyName: string;
			connected: boolean;
			owner_user_id?: string | null;
		}>;
		verificationEmailAddress?: string | null;
		userTimezone?: string;
		timeFormat?: TimeFormat;
		/** When true, hide the Search URL + Search Term inputs. The parent
		 *  page is rendering a SourceEditor that owns those fields, so we
		 *  don't show them here to avoid duplication. */
		hideSourceFields?: boolean;
		/**
		 * Whether this user may write `job_platforms.login_page_url` for the
		 * task's platform. Computed server-side with the same rule the PATCH
		 * endpoint enforces, so the field cannot render and then 403.
		 */
		canEditSignInPage?: boolean;
		/**
		 * Open the site in the task's own browser so the user can sign in by
		 * hand. Only the tunnel provider can do this outside a run (the cloud
		 * browser has no session to open), so the parent passes null when the
		 * button would not work and the section explains the alternative
		 * instead of offering a dead control.
		 */
		onSignInNow?: (() => void) | null;
		/** True while that request is in flight. */
		signingInNow?: boolean;
		/** Staff flag — unlocks the per-action debug screenshots toggle. */
		isStaff?: boolean;
	}

	let {
		mode,
		localBrowserAllowed,
		serverBrowserProvider,
		defaultBrowserProvider = 'tunnel',
		defaultMaxJobs = 25,
		// Add mode
		searchUrl = $bindable(''),
		searchTerm = $bindable(''),
		loginPageUrl = $bindable(''),
		detectedPlatform = null,
		detectingPlatform = false,
		existingCredentials = [],
		onsearchurlinput,
		// Edit mode
		searchTask = null,
		searchTaskId = 0,
		profileId = 0,
		platformCredentials: initialPlatformCredentials = [],
		browserCountryCode: initialBrowserCountryCode = '',
		defaultCountryCode = '',
		browserFingerprint = { language: '', timezone: '' },
		browserFingerprintDefaults = { language: '', timezone: '' },
		uiPreferences = {},
		desktopConnected = null,
		preferredDevice = null,
		devices = [],
		verificationEmailAddress = null,
		userTimezone = '',
		timeFormat = '12h',
		hideSourceFields = false,
		canEditSignInPage = false,
		onSignInNow = null,
		signingInNow = false,
		isStaff = false
	}: Props = $props();

	const isAdd = mode === 'add';
	const isEdit = mode === 'edit';

	// ── Verification email relay ──
	let copiedVerifyEmail = $state(false);
	function copyVerificationEmail() {
		if (!verificationEmailAddress) return;
		navigator.clipboard.writeText(verificationEmailAddress);
		copiedVerifyEmail = true;
		setTimeout(() => (copiedVerifyEmail = false), 2000);
	}

	// ── Add-mode credential state ──
	let addLoginMode = $state<string>('auto');
	let selectedCredentialId = $state<string>('none');
	let showNewCredentials = $state(false);
	let newCredUsername = $state('');
	let newCredPassword = $state('');
	let newCredSecurityAnswer = $state('');
	let showPassword = $state(false);
	let showAdvancedAuth = $state(false);

	// True only when the user explicitly picked "+ Add new credentials" — used
	// by the auto-select effect below so it can distinguish a real user choice
	// from the effect itself defaulting to "new" before detection runs.
	let userPickedNew = $state(false);

	function handleCredentialSelection(value: string) {
		selectedCredentialId = value;
		showNewCredentials = value === 'new';
		userPickedNew = value === 'new';
	}

	// Credential to default the picker to. Only ever auto-pick a credential the
	// user owns — never a shared one. A shared credential can only run on a
	// device owned by its owner (enforced server-side), so auto-selecting one
	// would silently dead-end the user at save time if no such device is
	// shared. Shared credentials still appear in the dropdown for deliberate
	// selection. Returns "new" when the user owns no credential for the
	// platform.
	function defaultCredentialId(): string {
		const owned = existingCredentials.find((c) => !c.shared);
		return owned ? String(owned.id) : 'new';
	}

	// Keep the credential selection in sync with platform detection. When
	// detection delivers an owned credential, default to it so the dropdown
	// shows a meaningful selection — matching what the Auto-login tab does on
	// click. Only override "new" when the user didn't pick it explicitly.
	$effect(() => {
		if (!isAdd) return;
		if (addLoginMode !== 'auto') return;
		if (userPickedNew) return;
		const matches = existingCredentials.some((c) => String(c.id) === selectedCredentialId);
		if (matches) return;
		const next = defaultCredentialId();
		selectedCredentialId = next;
		showNewCredentials = next === 'new';
	});

	// ── Add-mode browser provider ──
	let addBrowserProvider = $state<string | null>(defaultBrowserProvider || null);
	let addSjsBrowserApiKey = $state<number | null>(null);

	// ── Add-mode browser country ──
	let addBrowserCountryCode = $state(initialBrowserCountryCode);

	// ── Add-mode scraping options ──
	let addMaxJobsEnabled = $state(defaultMaxJobs != null);
	let addMaxJobsInput = $state(defaultMaxJobs?.toString() ?? '');
	let addSkipFirstEnabled = $state(false);
	let addSkipFirstInput = $state('');
	let addStopAfterDuplicatesEnabled = $state(true);
	let addStopAfterDuplicatesInput = $state('5');
	let addSkipExisting = $state(true);
	let addKeepMinimized = $state(true);
	let addScheduleInterval = $state('');

	// Schedule options (shared)
	const SCHEDULE_OPTIONS = [
		{ value: '24', label: 'Every day' },
		{ value: '48', label: 'Every 2 days' },
		{ value: '72', label: 'Every 3 days' },
		{ value: '120', label: 'Every 5 days' },
		{ value: '168', label: 'Every week' },
		{ value: '336', label: 'Every 2 weeks' }
	];

	const HOUR_OPTIONS = $derived(buildHourOptions(timeFormat));

	// ── Edit-mode state ──
	// Collapsible sections
	function loadSectionOpen(section: string, defaultOpen = true): boolean {
		const key = `task_sections_${section}`;
		const val = uiPreferences[key];
		return val === undefined ? defaultOpen : Boolean(val);
	}

	function toggleSection(section: string) {
		const isOpen = sectionOpen[section];
		sectionOpen[section] = !isOpen;
		if (isEdit && searchTaskId) {
			const key = `task_sections_${section}`;
			fetch(`/api/import-tasks/${searchTaskId}/ui-preferences`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ [key]: !isOpen })
			}).catch(() => {});
		}
	}

	let sectionOpen = $state<Record<string, boolean>>(
		isEdit
			? {
					search: loadSectionOpen('search'),
					auth: loadSectionOpen('auth'),
					options: loadSectionOpen('options'),
					schedule: loadSectionOpen('schedule'),
					browser: loadSectionOpen('browser'),
					advanced: loadSectionOpen('advanced', false)
				}
			: {
					search: true,
					auth: true,
					options: true,
					schedule: true,
					browser: true,
					advanced: true
				}
	);

	// Parse helpers
	function parseIntOrNull(val: unknown): number | null {
		if (val === undefined || val === null || val === '') return null;
		const n = typeof val === 'number' ? val : parseInt(String(val));
		return isNaN(n) || n < 1 ? null : n;
	}

	// ── Edit-mode field state ──
	// Each editable field on the edit page is wrapped in an `autoSaveField`
	// helper: it owns the debounced PATCH, the in-flight state, and the undo
	// window. The UI just binds inputs and renders <AutoSaveIndicator>.
	//
	// For toggle+number combos (max_jobs, stop_after_duplicates, skip_first) the
	// UI still owns two bindable strings/bools; a $effect feeds the computed
	// value into the helper, which short-circuits when nothing actually changed.

	// Patch helpers — defined up here so the autoSaveField factories can
	// capture them without forward references.
	async function patchSearchTask(body: Record<string, unknown>) {
		const res = await fetch(`/api/import-tasks/${searchTaskId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			throw new Error(data.message || data.error || `Save failed (${res.status})`);
		}
	}

	async function patchProfile(body: Record<string, unknown>) {
		const res = await fetch(`/api/profile/${profileId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			throw new Error(data.message || data.error || `Save failed (${res.status})`);
		}
	}

	// Search term — free text, debounced.
	let searchTermInput = $state<string>(searchTask?.search_term ?? '');
	// Arm every field on the first real interaction with the form, so a browser
	// reload/autofill that repopulates a bound input does not trigger a save.
	function armFields() {
		for (const f of [
			searchTermField,
			maxJobsField,
			skipExistingField,
			stopAfterDuplicatesField,
			skipFirstField,
			browserConfigField,
			keepMinimizedField,
			debugScreenshotsField,
			scheduleField,
			browserCountryField,
			fingerprintField
		]) {
			f.arm();
		}
	}

	const searchTermField = autoSaveField<string | null>({
		armOnInteraction: true,
		initial: searchTask?.search_term ?? null,
		save: (v) => patchSearchTask({ search_term: v }),
		onSaved: (v) => {
			if (searchTask) searchTask.search_term = v;
			searchTermInput = v ?? '';
		},
		equal: (a, b) => (a ?? '') === (b ?? ''),
		debounceMs: 700
	});
	$effect(() => {
		if (!isEdit) return;
		const v = searchTermInput.trim() || null;
		searchTermField.set(v);
	});

	let showAdvancedSearch = $state(false);

	// Max jobs — toggle + number.
	let maxJobsEnabled = $state<boolean>(searchTask?.max_jobs != null);
	let maxJobsInput = $state<string>(searchTask?.max_jobs?.toString() ?? '');
	const maxJobsField = autoSaveField<number | null>({
		armOnInteraction: true,
		initial: searchTask?.max_jobs ?? null,
		save: (v) => patchSearchTask({ max_jobs: v }),
		onSaved: (v) => {
			if (searchTask) searchTask.max_jobs = v;
			maxJobsEnabled = v != null;
			maxJobsInput = v?.toString() ?? '';
		},
		debounceMs: 400
	});
	$effect(() => {
		if (!isEdit) return;
		maxJobsField.set(maxJobsEnabled ? parseIntOrNull(maxJobsInput) : null);
	});

	// Skip existing — boolean toggle.
	let skipExisting = $state<boolean>(searchTask?.skip_existing ?? false);
	const skipExistingField = autoSaveField<boolean>({
		armOnInteraction: true,
		initial: searchTask?.skip_existing ?? false,
		save: (v) => patchSearchTask({ skip_existing: v }),
		onSaved: (v) => {
			if (searchTask) searchTask.skip_existing = v;
			skipExisting = v;
		}
	});
	$effect(() => {
		if (!isEdit) return;
		skipExistingField.set(skipExisting);
	});

	// Stop after N duplicates — toggle + number.
	let stopAfterDuplicatesEnabled = $state<boolean>(searchTask?.stop_after_duplicates != null);
	let stopAfterDuplicatesInput = $state<string>(
		searchTask?.stop_after_duplicates?.toString() ?? ''
	);
	const stopAfterDuplicatesField = autoSaveField<number | null>({
		armOnInteraction: true,
		initial: searchTask?.stop_after_duplicates ?? null,
		save: (v) => patchSearchTask({ stop_after_duplicates: v }),
		onSaved: (v) => {
			if (searchTask) searchTask.stop_after_duplicates = v;
			stopAfterDuplicatesEnabled = v != null;
			stopAfterDuplicatesInput = v?.toString() ?? '';
		},
		debounceMs: 400
	});
	$effect(() => {
		if (!isEdit) return;
		stopAfterDuplicatesField.set(
			stopAfterDuplicatesEnabled ? parseIntOrNull(stopAfterDuplicatesInput) : null
		);
	});

	// Skip first N — toggle + number.
	let skipFirstEnabled = $state<boolean>(searchTask?.skip_first != null);
	let skipFirstInput = $state<string>(searchTask?.skip_first?.toString() ?? '');
	const skipFirstField = autoSaveField<number | null>({
		armOnInteraction: true,
		initial: searchTask?.skip_first ?? null,
		save: (v) => patchSearchTask({ skip_first: v }),
		onSaved: (v) => {
			if (searchTask) searchTask.skip_first = v;
			skipFirstEnabled = v != null;
			skipFirstInput = v?.toString() ?? '';
		},
		debounceMs: 400
	});
	$effect(() => {
		if (!isEdit) return;
		skipFirstField.set(skipFirstEnabled ? parseIntOrNull(skipFirstInput) : null);
	});

	// Browser provider + tunnel device — saved as one PATCH since switching
	// provider can cascade a device pick, and we want a single Saved · Undo
	// pill rather than two racing indicators.
	type BrowserConfig = {
		provider: string | null;
		apiKey: number | null;
	};
	let browserProvider = $state<string | null>(searchTask?.browser_provider ?? null);
	let sjsBrowserApiKey = $state<number | null>(searchTask?.sjsbrowser_api_key ?? null);
	const browserConfigField = autoSaveField<BrowserConfig>({
		armOnInteraction: true,
		initial: {
			provider: searchTask?.browser_provider ?? null,
			apiKey: searchTask?.sjsbrowser_api_key ?? null
		},
		save: (v) =>
			patchSearchTask({
				browser_provider: v.provider,
				sjsbrowser_api_key: v.apiKey
			}),
		onSaved: (v) => {
			if (searchTask) {
				searchTask.browser_provider = v.provider;
				searchTask.sjsbrowser_api_key = v.apiKey;
			}
			browserProvider = v.provider;
			sjsBrowserApiKey = v.apiKey;
		},
		equal: (a, b) => a.provider === b.provider && a.apiKey === b.apiKey
	});
	$effect(() => {
		if (!isEdit) return;
		browserConfigField.set({
			provider: browserProvider,
			apiKey: sjsBrowserApiKey
		});
	});

	// Keep minimized — boolean toggle.
	let keepMinimized = $state<boolean>(searchTask?.keep_minimized ?? true);
	const keepMinimizedField = autoSaveField<boolean>({
		armOnInteraction: true,
		initial: searchTask?.keep_minimized ?? true,
		save: (v) => patchSearchTask({ keep_minimized: v }),
		onSaved: (v) => {
			if (searchTask) searchTask.keep_minimized = v;
			keepMinimized = v;
		}
	});
	$effect(() => {
		if (!isEdit) return;
		keepMinimizedField.set(keepMinimized);
	});

	// Debug screenshots — boolean toggle (staff-only). PATCH endpoint also
	// enforces the staff gate server-side, so a non-staff user with a hand-
	// crafted request still can't enable this.
	let debugScreenshots = $state<boolean>(Boolean(searchTask?.debug_screenshots));
	const debugScreenshotsField = autoSaveField<boolean>({
		armOnInteraction: true,
		initial: Boolean(searchTask?.debug_screenshots),
		save: (v) => patchSearchTask({ debug_screenshots: v }),
		onSaved: (v) => {
			if (searchTask) searchTask.debug_screenshots = v;
			debugScreenshots = v;
		}
	});
	$effect(() => {
		if (!isEdit) return;
		debugScreenshotsField.set(debugScreenshots);
	});

	// Schedule — enabled + interval + preferred hour, all in one PATCH.
	type ScheduleConfig = {
		intervalHours: number | null;
		preferredHour: number;
	};
	let scheduleEnabled = $state<boolean>(searchTask?.schedule_interval_hours != null);
	let scheduleIntervalInput = $state<string>(
		searchTask?.schedule_interval_hours?.toString() ?? '24'
	);
	let schedulePreferredHour = $state<number>(searchTask?.schedule_preferred_hour ?? 9);
	const scheduleField = autoSaveField<ScheduleConfig>({
		armOnInteraction: true,
		initial: {
			intervalHours: searchTask?.schedule_interval_hours ?? null,
			preferredHour: searchTask?.schedule_preferred_hour ?? 9
		},
		save: (v) =>
			patchSearchTask({
				schedule_interval_hours: v.intervalHours,
				schedule_preferred_hour: v.preferredHour
			}),
		onSaved: (v) => {
			if (searchTask) {
				searchTask.schedule_interval_hours = v.intervalHours;
				searchTask.schedule_preferred_hour = v.preferredHour;
			}
			scheduleEnabled = v.intervalHours != null;
			scheduleIntervalInput = (v.intervalHours ?? 24).toString();
			schedulePreferredHour = v.preferredHour;
		},
		equal: (a, b) => a.intervalHours === b.intervalHours && a.preferredHour === b.preferredHour
	});
	$effect(() => {
		if (!isEdit) return;
		scheduleField.set({
			intervalHours: scheduleEnabled ? parseInt(scheduleIntervalInput) : null,
			preferredHour: schedulePreferredHour
		});
	});

	// Browser country (edit) — patches the profile, not the task.
	let editBrowserCountryCode = $state(initialBrowserCountryCode);
	const browserCountryField = autoSaveField<string>({
		armOnInteraction: true,
		initial: initialBrowserCountryCode,
		save: (v) => patchProfile({ browser_country_code: v.trim().toUpperCase() || null }),
		onSaved: (v) => {
			editBrowserCountryCode = v;
		},
		equal: (a, b) => a.trim().toUpperCase() === b.trim().toUpperCase()
	});
	$effect(() => {
		if (!isEdit) return;
		browserCountryField.set(editBrowserCountryCode);
	});

	// Browser fingerprint (edit) — language + timezone, patches the profile.
	type Fingerprint = { language: string; timezone: string };
	let showAdvancedBrowser = $state(false);
	let browserLanguage = $state(browserFingerprint.language);
	let browserTimezone = $state(browserFingerprint.timezone);
	let defaultBrowserLanguage = browserFingerprintDefaults.language;
	let defaultBrowserTimezone = browserFingerprintDefaults.timezone;
	const fingerprintField = autoSaveField<Fingerprint>({
		armOnInteraction: true,
		initial: {
			language: browserFingerprint.language,
			timezone: browserFingerprint.timezone
		},
		save: (v) =>
			patchProfile({
				browser_language: v.language.trim() || null,
				browser_timezone: v.timezone.trim() || null
			}),
		onSaved: (v) => {
			browserLanguage = v.language;
			browserTimezone = v.timezone;
		},
		equal: (a, b) =>
			a.language.trim() === b.language.trim() && a.timezone.trim() === b.timezone.trim(),
		debounceMs: 700
	});
	$effect(() => {
		if (!isEdit) return;
		fingerprintField.set({
			language: browserLanguage,
			timezone: browserTimezone
		});
	});

	// Credentials (edit) — kept on manual save because picking a shared
	// credential can cascade a device change that we want to confirm
	// explicitly, and the combined PATCH surfaces a custom error.
	let editPlatformCredentials = $state(initialPlatformCredentials);
	const editInitialCredId = searchTask?.platform_credential_id?.toString() ?? 'none';
	let editSavedCredentialId = $state<string>(editInitialCredId);
	let editSelectedCredentialId = $state<string>(editInitialCredId);
	let credentialDirty = $derived(isEdit && editSelectedCredentialId !== editSavedCredentialId);
	let isSavingCredential = $state(false);

	// The platform's sign-in page. Mirrored into local state because
	// SignInPageField can add one while the page is open, and both the mode
	// chooser's copy and the "sign in now" target depend on it.
	let signInPageUrl = $state<string | null>(searchTask?.job_platform?.login_page_url ?? null);
	let hasSignInPage = $derived(!!signInPageUrl);

	// Login mode (edit)
	let editLoginMode = $state<string>(searchTask?.login_mode ?? 'auto');
	let editSavedLoginMode = $state<string>(searchTask?.login_mode ?? 'auto');
	let loginModeDirty = $derived(isEdit && editLoginMode !== editSavedLoginMode);
	let isSavingLoginMode = $state(false);

	// Computed: tunnel mode / hosted mode for conditional sections. In edit
	// mode this tracks the *saved* provider (what's actually live) rather than
	// the in-flight user pick.
	let effectiveBrowserProvider = $derived(
		isEdit ? browserConfigField.saved.provider : addBrowserProvider
	);
	let isHostedMode = $derived(
		effectiveBrowserProvider === 'hosted' ||
			(!effectiveBrowserProvider && serverBrowserProvider === 'goLogin')
	);
	let isTunnelMode = $derived(
		effectiveBrowserProvider === 'tunnel' ||
			(!effectiveBrowserProvider && serverBrowserProvider === 'tunnel')
	);

	let credentialSaveError = $state<string | null>(null);

	async function saveLoginAndCredential() {
		isSavingCredential = true;
		isSavingLoginMode = true;
		credentialSaveError = null;
		try {
			const body: Record<string, unknown> = {};
			if (loginModeDirty) body.login_mode = editLoginMode;
			let cascadedDeviceId: number | null | undefined = undefined;
			if (credentialDirty) {
				const credId =
					editSelectedCredentialId === 'none' ? null : parseInt(editSelectedCredentialId);
				body.platform_credential_id = credId;

				// If picking a credential shared by another user, the task's device
				// must be one owned by that credential's owner. Auto-pick a
				// compatible shared device when the current one doesn't match.
				if (credId !== null) {
					const cred = editPlatformCredentials.find((c) => c.id === credId);
					const credOwner = cred?.shared ? cred.owner_user_id : null;
					if (credOwner) {
						const currentDevice = devices.find((d) => d.apiKeyId === sjsBrowserApiKey);
						const matches = currentDevice?.owner_user_id === credOwner;
						if (!matches) {
							const compatible = devices.find((d) => d.owner_user_id === credOwner);
							if (!compatible) {
								throw new Error(
									`${
										cred?.owner_label ?? 'The owner'
									} hasn't shared a device with you for this credential — ask them to share one.`
								);
							}
							cascadedDeviceId = compatible.apiKeyId;
							body.sjsbrowser_api_key = compatible.apiKeyId;
						}
					}
				}
			}
			await patchSearchTask(body);
			if (loginModeDirty) {
				searchTask.login_mode = editLoginMode;
				editSavedLoginMode = editLoginMode;
			}
			if (credentialDirty) {
				searchTask.platform_credential_id = body.platform_credential_id as number | null;
				editSavedCredentialId = editSelectedCredentialId;
			}
			if (cascadedDeviceId !== undefined) {
				// The credential PATCH already wrote sjsbrowser_api_key, so just
				// re-seed the auto-save helper to match the new saved state — no
				// second PATCH, no stray Saved · Undo pill.
				sjsBrowserApiKey = cascadedDeviceId;
				browserConfigField.reset({
					provider: browserConfigField.saved.provider,
					apiKey: cascadedDeviceId
				});
				searchTask.sjsbrowser_api_key = cascadedDeviceId;
			}
		} catch (err) {
			credentialSaveError = err instanceof Error ? err.message : 'Failed to save';
		} finally {
			isSavingCredential = false;
			isSavingLoginMode = false;
		}
	}

	// Wrappers kept for callers (oncredentialadded auto-save) that target only
	// one field — they reuse the combined save.
	async function saveCredential() {
		await saveLoginAndCredential();
	}
	async function saveLoginMode() {
		await saveLoginAndCredential();
	}

	// Re-sync state when searchTask changes from outside (navigation)
	export function resetToData(newData: {
		searchTask: any;
		platformCredentials: any[];
		browserCountryCode: string;
		defaultCountryCode: string;
		browserFingerprint: {
			language: string;
			timezone: string;
		};
		browserFingerprintDefaults: { language: string; timezone: string };
		uiPreferences: Record<string, unknown>;
	}) {
		searchTermInput = newData.searchTask.search_term ?? '';
		maxJobsEnabled = newData.searchTask.max_jobs != null;
		maxJobsInput = newData.searchTask.max_jobs?.toString() ?? '';
		skipFirstEnabled = newData.searchTask.skip_first != null;
		skipFirstInput = newData.searchTask.skip_first?.toString() ?? '';
		stopAfterDuplicatesEnabled = newData.searchTask.stop_after_duplicates != null;
		stopAfterDuplicatesInput = newData.searchTask.stop_after_duplicates?.toString() ?? '';
		skipExisting = newData.searchTask.skip_existing ?? false;
		browserProvider = newData.searchTask.browser_provider ?? null;
		keepMinimized = newData.searchTask.keep_minimized ?? true;
		debugScreenshots = Boolean(newData.searchTask.debug_screenshots);
		scheduleEnabled = newData.searchTask.schedule_interval_hours != null;
		scheduleIntervalInput = newData.searchTask.schedule_interval_hours?.toString() ?? '24';
		schedulePreferredHour = newData.searchTask.schedule_preferred_hour ?? 9;
		editBrowserCountryCode = newData.browserCountryCode;
		browserLanguage = newData.browserFingerprint.language;
		browserTimezone = newData.browserFingerprint.timezone;
		defaultBrowserLanguage = newData.browserFingerprintDefaults.language;
		defaultBrowserTimezone = newData.browserFingerprintDefaults.timezone;
		editPlatformCredentials = newData.platformCredentials;

		// Re-seed the auto-save helpers with the new server-confirmed values so
		// the $effects that mirror UI → helper see "unchanged" and don't trigger
		// a save on navigation.
		searchTermField.reset(newData.searchTask.search_term ?? null);
		maxJobsField.reset(newData.searchTask.max_jobs ?? null);
		skipExistingField.reset(newData.searchTask.skip_existing ?? false);
		stopAfterDuplicatesField.reset(newData.searchTask.stop_after_duplicates ?? null);
		skipFirstField.reset(newData.searchTask.skip_first ?? null);
		browserConfigField.reset({
			provider: newData.searchTask.browser_provider ?? null,
			apiKey: newData.searchTask.sjsbrowser_api_key ?? null
		});
		keepMinimizedField.reset(newData.searchTask.keep_minimized ?? true);
		debugScreenshotsField.reset(Boolean(newData.searchTask.debug_screenshots));
		scheduleField.reset({
			intervalHours: newData.searchTask.schedule_interval_hours ?? null,
			preferredHour: newData.searchTask.schedule_preferred_hour ?? 9
		});
		browserCountryField.reset(newData.browserCountryCode);
		fingerprintField.reset({
			language: newData.browserFingerprint.language,
			timezone: newData.browserFingerprint.timezone
		});

		const credId = newData.searchTask.platform_credential_id?.toString() ?? 'none';
		editSavedCredentialId = credId;
		editSelectedCredentialId = credId;
		editLoginMode = newData.searchTask.login_mode ?? 'auto';
		editSavedLoginMode = newData.searchTask.login_mode ?? 'auto';
		signInPageUrl = newData.searchTask.job_platform?.login_page_url ?? null;
		sectionOpen = {
			search: (() => {
				const v = newData.uiPreferences['task_sections_search'];
				return v === undefined ? true : Boolean(v);
			})(),
			auth: (() => {
				const v = newData.uiPreferences['task_sections_auth'];
				return v === undefined ? true : Boolean(v);
			})(),
			options: (() => {
				const v = newData.uiPreferences['task_sections_options'];
				return v === undefined ? true : Boolean(v);
			})(),
			schedule: (() => {
				const v = newData.uiPreferences['task_sections_schedule'];
				return v === undefined ? true : Boolean(v);
			})(),
			browser: (() => {
				const v = newData.uiPreferences['task_sections_browser'];
				return v === undefined ? true : Boolean(v);
			})(),
			advanced: (() => {
				const v = newData.uiPreferences['task_sections_advanced'];
				return v === undefined ? false : Boolean(v);
			})()
		};
	}

	// Prevent browser form restoration from causing dirty state on page load/refresh.
	// Browsers can restore previous input values after Svelte hydration, which
	// bind:value picks up. Re-sync UI state from props after mount and re-seed
	// the auto-save helpers so the $effects don't trip a spurious save.
	onMount(() => {
		if (isEdit && searchTask) {
			searchTermInput = searchTask.search_term ?? '';
			maxJobsEnabled = searchTask.max_jobs != null;
			maxJobsInput = searchTask.max_jobs?.toString() ?? '';
			skipFirstEnabled = searchTask.skip_first != null;
			skipFirstInput = searchTask.skip_first?.toString() ?? '';
			stopAfterDuplicatesEnabled = searchTask.stop_after_duplicates != null;
			stopAfterDuplicatesInput = searchTask.stop_after_duplicates?.toString() ?? '';
			skipExisting = searchTask.skip_existing ?? false;
			browserProvider = searchTask.browser_provider ?? null;
			sjsBrowserApiKey = searchTask.sjsbrowser_api_key ?? null;
			keepMinimized = searchTask.keep_minimized ?? true;
			debugScreenshots = Boolean(searchTask.debug_screenshots);
			scheduleEnabled = searchTask.schedule_interval_hours != null;
			scheduleIntervalInput = searchTask.schedule_interval_hours?.toString() ?? '24';
			schedulePreferredHour = searchTask.schedule_preferred_hour ?? 9;
			editBrowserCountryCode = initialBrowserCountryCode;
			browserLanguage = browserFingerprint.language;
			browserTimezone = browserFingerprint.timezone;

			searchTermField.reset(searchTask.search_term ?? null);
			maxJobsField.reset(searchTask.max_jobs ?? null);
			skipExistingField.reset(searchTask.skip_existing ?? false);
			stopAfterDuplicatesField.reset(searchTask.stop_after_duplicates ?? null);
			skipFirstField.reset(searchTask.skip_first ?? null);
			browserConfigField.reset({
				provider: searchTask.browser_provider ?? null,
				apiKey: searchTask.sjsbrowser_api_key ?? null
			});
			keepMinimizedField.reset(searchTask.keep_minimized ?? true);
			debugScreenshotsField.reset(Boolean(searchTask.debug_screenshots));
			scheduleField.reset({
				intervalHours: searchTask.schedule_interval_hours ?? null,
				preferredHour: searchTask.schedule_preferred_hour ?? 9
			});
			browserCountryField.reset(initialBrowserCountryCode);
			fingerprintField.reset({
				language: browserFingerprint.language,
				timezone: browserFingerprint.timezone
			});

			const credId = searchTask.platform_credential_id?.toString() ?? 'none';
			editSavedCredentialId = credId;
			editSelectedCredentialId = credId;
			editLoginMode = searchTask.login_mode ?? 'auto';
			editSavedLoginMode = searchTask.login_mode ?? 'auto';
			signInPageUrl = searchTask.job_platform?.login_page_url ?? null;
		}
	});
</script>

{#snippet saveCancel(dirty: boolean, saving: boolean, onSave: () => void, onCancel: () => void)}
	{#if dirty}
		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={onSave}
				disabled={saving}
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
				onclick={onCancel}
				class="rounded-md border border-[var(--dash-border)] px-3 py-1 text-xs text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
			>
				Cancel
			</button>
		</div>
	{/if}
{/snippet}

{#snippet sectionToggle(section: string, label: string)}
	<button
		type="button"
		onclick={() => toggleSection(section)}
		class="flex w-full items-center gap-2 text-left"
	>
		{#if sectionOpen[section]}
			<FontAwesomeIcon icon={faChevronDown} class="h-3 w-3 text-[var(--dash-text-muted)]" />
		{:else}
			<FontAwesomeIcon icon={faChevronRight} class="h-3 w-3 text-[var(--dash-text-muted)]" />
		{/if}
		<h3 class="text-sm font-medium tracking-wide text-[var(--dash-text-muted)] uppercase">
			{label}
		</h3>
	</button>
{/snippet}

<div class="grid grid-cols-1 gap-6 lg:grid-cols-2" use:armOn={armFields}>
	<!-- Left column: Search, Credentials, Browser Control. Pairs the tallest
       section (Browser) with the shortest (Auth) so both columns end at
       roughly the same height on wide screens. -->
	<div class="space-y-4">
		{#if isAdd || searchTask?.platform_id}
			{#if !hideSourceFields}
				{#if isEdit}
					{@render sectionToggle('search', 'Search')}
				{/if}

				{#if isAdd || sectionOpen.search}
					<div class="space-y-3">
						<!-- Search URL -->
						{#if isAdd}
							<div>
								<h3 class="mb-1 text-xs font-medium text-[var(--dash-text-secondary)]">
									Search URL <span class="text-[var(--dash-error)]">*</span>
								</h3>
								<div class="relative">
									<input
										type="url"
										name="search_url"
										value={searchUrl}
										oninput={onsearchurlinput}
										placeholder="https://linkedin.com/jobs/search?keywords=frontend..."
										required
										class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
									/>
									{#if detectingPlatform}
										<div class="absolute top-1/2 right-3 -translate-y-1/2">
											<Spinner size="w-4 h-4" color="var(--dash-text-secondary)" />
										</div>
									{/if}
								</div>
								<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
									Paste a job search URL from LinkedIn, Indeed, or other job platforms
								</p>
							</div>

							<!-- Detected Platform Info -->
							{#if detectedPlatform}
								<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] p-3">
									<div class="flex items-center gap-2 text-sm">
										<PlatformLogo platformUrl={detectedPlatform.url} size="w-5 h-5" />
										{#if detectedPlatform.isNew}
											<span class="text-[var(--dash-text)]"
												>New platform:
												<strong>{detectedPlatform.name}</strong></span
											>
										{:else}
											<span class="text-[var(--dash-text)]"
												><strong>{detectedPlatform.name}</strong></span
											>
										{/if}
									</div>
									<input type="hidden" name="platform_id" value={detectedPlatform.id || ''} />
									<input type="hidden" name="platform_url" value={detectedPlatform.url} />
									<input type="hidden" name="platform_name" value={detectedPlatform.name} />
									<input type="hidden" name="platform_is_new" value={detectedPlatform.isNew} />
								</div>
							{/if}
						{/if}

						<!-- Search Term -->
						{#if isAdd}
							<div>
								<h3 class="mb-1 text-xs font-medium text-[var(--dash-text-secondary)]">
									Search Term
									<span class="font-normal text-[var(--dash-text-muted)]">(optional)</span>
								</h3>
								<input
									type="text"
									name="search_term"
									bind:value={searchTerm}
									placeholder="e.g., frontend developer amsterdam"
									class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
								/>
								<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
									For sites that don't support search in the URL. The scraper will type this into
									the search field.
								</p>
							</div>
						{:else}
							<!-- Edit: collapsible advanced search term -->
							<button
								type="button"
								onclick={() => (showAdvancedSearch = !showAdvancedSearch)}
								class="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text-secondary)]"
							>
								{#if showAdvancedSearch}
									<FontAwesomeIcon icon={faChevronDown} class="h-2.5 w-2.5" />
								{:else}
									<FontAwesomeIcon icon={faChevronRight} class="h-2.5 w-2.5" />
								{/if}
								Advanced
							</button>

							{#if showAdvancedSearch}
								<div>
									<h3 class="mb-1 text-xs font-medium text-[var(--dash-text-secondary)]">
										Search Term <span class="font-normal">(optional)</span>
									</h3>
									<input
										type="text"
										bind:value={searchTermInput}
										onblur={searchTermField.flush}
										autocomplete="off"
										placeholder="e.g., frontend developer amsterdam"
										class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
									/>
									<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
										For sites that don't support search in the URL. The scraper will type this into
										the search field.
									</p>
									<div class="mt-2">
										<AutoSaveIndicator field={searchTermField} />
									</div>
								</div>
							{/if}
						{/if}
					</div>
				{/if}
			{/if}

			<!-- Signing in -->
			<div class="space-y-3 border-t border-[var(--dash-border)] pt-4">
				{#if isEdit}
					{@render sectionToggle('auth', 'Signing in')}
				{:else}
					<h3 class="text-sm font-medium tracking-wide text-[var(--dash-text-muted)] uppercase">
						Signing in
					</h3>
				{/if}

				{#if isAdd || (isEdit && sectionOpen.auth)}
					<!-- Login URL (add mode only). The edit page renders
               SignInPageField instead: the column is platform-level, but it
               is also the thing that decides whether a task ever signs in,
               so hiding it there left users with no way to fix a task that
               silently skipped the login. -->
					{#if isAdd}
						<div>
							<h3 class="mb-1 text-xs font-medium text-[var(--dash-text-secondary)]">
								Login Page URL
								<span class="font-normal text-[var(--dash-text-muted)]">(optional)</span>
							</h3>
							<input
								type="url"
								name="login_page_url"
								bind:value={loginPageUrl}
								placeholder="https://linkedin.com/login"
								class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
							/>
							<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
								URL of the login page. Used to auto-fill credentials before scraping.
							</p>
						</div>
					{/if}

					<!-- Credentials -->
					{#if isAdd}
						<!-- Login Mode (add mode) -->
						<div class="border-t border-[var(--dash-border)] pt-3">
							<h3 class="mb-2 text-xs font-medium text-[var(--dash-text-secondary)]">Login Mode</h3>

							<div class="flex overflow-hidden rounded-md border border-[var(--dash-border)]">
								<button
									type="button"
									onclick={() => {
										addLoginMode = 'auto';
										if (selectedCredentialId === 'none') {
											selectedCredentialId = defaultCredentialId();
										}
										showNewCredentials = selectedCredentialId === 'new';
									}}
									class={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
										addLoginMode === 'auto'
											? 'bg-[var(--dash-primary)] text-white'
											: 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface)]'
									}`}
								>
									Auto-login
								</button>
								<button
									type="button"
									onclick={() => {
										addLoginMode = 'manual';
										selectedCredentialId = 'none';
										showNewCredentials = false;
									}}
									class={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
										addLoginMode === 'manual'
											? 'bg-[var(--dash-primary)] text-white'
											: 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface)]'
									}`}
								>
									Manual login
								</button>
								<button
									type="button"
									onclick={() => {
										addLoginMode = 'none';
										selectedCredentialId = 'none';
										showNewCredentials = false;
									}}
									class={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
										addLoginMode === 'none'
											? 'bg-[var(--dash-primary)] text-white'
											: 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface)]'
									}`}
								>
									No login
								</button>
							</div>
							<input type="hidden" name="login_mode" value={addLoginMode} />
							<p class="mt-1.5 text-xs text-[var(--dash-text-muted)]">
								{#if addLoginMode === 'auto'}
									The scraper will fill in credentials and log in automatically.
								{:else if addLoginMode === 'manual'}
									The scraper will navigate to the login page and wait for you to log in.
								{:else}
									The scraper will go directly to the search page without logging in.
								{/if}
							</p>
						</div>

						<!-- Credentials (only for auto-login) -->
						{#if addLoginMode === 'auto'}
							<div>
								<h3 class="mb-2 text-xs font-medium text-[var(--dash-text-secondary)]">
									Login Credentials
								</h3>

								<select
									name="credential_id"
									value={selectedCredentialId}
									onchange={(e) => handleCredentialSelection((e.target as HTMLSelectElement).value)}
									class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)]"
								>
									{#each existingCredentials as cred}
										<option value={String(cred.id)}>
											{cred.username}{cred.shared
												? ` (shared by ${cred.owner_label ?? 'a contact'})`
												: ''}
										</option>
									{/each}
									<option value="new">+ Add new credentials</option>
								</select>

								{#if showNewCredentials}
									<div class="mt-3 space-y-3 rounded-lg bg-[var(--dash-bg)] p-3">
										<div>
											<label
												for="add-cred-username"
												class="mb-1 block text-sm text-[var(--dash-text)]"
											>
												Username / Email
											</label>
											<input
												type="text"
												id="add-cred-username"
												name="new_credential_username"
												bind:value={newCredUsername}
												placeholder="your@email.com"
												class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
											/>
										</div>
										<div>
											<label
												for="add-cred-password"
												class="mb-1 block text-sm text-[var(--dash-text)]"
											>
												Password
											</label>
											<div class="relative">
												<input
													type={showPassword ? 'text' : 'password'}
													id="add-cred-password"
													name="new_credential_password"
													bind:value={newCredPassword}
													placeholder="Enter password"
													class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 pr-8 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
												/>
												<button
													type="button"
													onclick={() => (showPassword = !showPassword)}
													class="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
												>
													<FontAwesomeIcon
														icon={showPassword ? faEyeSlash : faEye}
														class="h-4 w-4"
													/>
												</button>
											</div>
										</div>
										<!-- Advanced: security answer -->
										<button
											type="button"
											onclick={() => (showAdvancedAuth = !showAdvancedAuth)}
											class="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text-secondary)]"
										>
											{#if showAdvancedAuth}
												<FontAwesomeIcon icon={faChevronDown} class="h-2.5 w-2.5" />
											{:else}
												<FontAwesomeIcon icon={faChevronRight} class="h-2.5 w-2.5" />
											{/if}
											Advanced
										</button>
										{#if showAdvancedAuth}
											<div>
												<label
													for="add-cred-security-answer"
													class="mb-1 block text-xs text-[var(--dash-text-secondary)]"
												>
													Security Question Answer <span
														class="font-normal text-[var(--dash-text-muted)]">(optional)</span
													>
												</label>
												<input
													type="text"
													id="add-cred-security-answer"
													name="new_credential_security_answer"
													bind:value={newCredSecurityAnswer}
													placeholder="e.g., your mother's maiden name"
													class="w-full rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
												/>
												<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
													Auto-filled when a site asks a security question after login.
												</p>
											</div>
										{/if}
									</div>
								{/if}
							</div>
						{/if}
					{:else}
						<!-- The platform's sign-in page, which decides whether any of
						     the settings below do anything at all. It used to be
						     absent from this page entirely, so a task whose platform
						     had no URL on file could be set to sign in and simply
						     never would. -->
						{#if searchTask?.platform_id}
							<SignInPageField
								platformId={searchTask.platform_id}
								platformName={searchTask?.job_platform?.name}
								value={signInPageUrl}
								canEdit={canEditSignInPage}
								promptForUrl={toLoginMode(editLoginMode) !== 'none'}
								onSaved={(url) => {
									signInPageUrl = url;
									if (searchTask?.job_platform) {
										searchTask.job_platform.login_page_url = url;
									}
								}}
							/>
						{/if}

						<CredentialSelector
							bind:credentials={editPlatformCredentials}
							bind:selectedId={editSelectedCredentialId}
							bind:loginMode={editLoginMode}
							platformId={searchTask?.platform_id}
							{profileId}
							{hasSignInPage}
							platformName={searchTask?.job_platform?.name}
							oncredentialadded={() => {
								// Auto-save credential selection when a new one is added via "Add & Select"
								saveCredential();
							}}
							oncredentialdeleted={(credId) => {
								if (searchTask?.platform_credential_id === credId) {
									searchTask.platform_credential_id = null;
									editSavedCredentialId = 'none';
								}
							}}
						/>

						{#if loginModeDirty || credentialDirty}
							<div class="mt-3">
								{@render saveCancel(
									true,
									isSavingLoginMode || isSavingCredential,
									saveLoginAndCredential,
									() => {
										editLoginMode = editSavedLoginMode;
										editSelectedCredentialId = editSavedCredentialId;
										credentialSaveError = null;
									}
								)}
							</div>
						{/if}

						{#if credentialSaveError}
							<p class="mt-2 text-xs text-[var(--dash-error)]" role="alert">
								{credentialSaveError}
							</p>
						{/if}

						<!-- Signing in by hand, without waiting for a run to ask.
						     The same Chrome scrapes and browses, so the session the
						     user creates here is the one the next run uses — which is
						     the whole reason "I sign in myself" is not a worse option
						     than storing a password, and nothing in the UI said it. -->
						{#if toLoginMode(editLoginMode) === 'manual' && hasSignInPage}
							<div class="border-t border-[var(--dash-border)] pt-3">
								{#if onSignInNow}
									<button
										type="button"
										onclick={onSignInNow}
										disabled={signingInNow}
										class="flex items-center gap-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-1.5 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)] disabled:opacity-50"
									>
										{#if signingInNow}
											<Spinner size="w-3.5 h-3.5" />
											Opening...
										{:else}
											<FontAwesomeIcon icon={faRightToBracket} class="h-3.5 w-3.5" />
											Sign in now
										{/if}
									</button>
									<p class="mt-1.5 text-xs text-[var(--dash-text-muted)]">
										Opens the sign-in page in this task's browser so you can sign in before the next
										run, instead of the run stopping to ask.
									</p>
								{:else}
									<p class="text-xs text-[var(--dash-text-muted)]">
										Start a run and it will stop at the sign-in page, where Browser View lets you
										sign in. Connect a device to sign in ahead of time instead.
									</p>
								{/if}
							</div>
						{/if}
					{/if}

					<!-- Email Verification Relay -->
					{#if verificationEmailAddress}
						<div class="border-t border-[var(--dash-border)] pt-3">
							<div class="mb-1.5 flex items-center gap-2">
								<FontAwesomeIcon
									icon={faEnvelope}
									class="h-3.5 w-3.5 text-[var(--dash-text-muted)]"
								/>
								<span class="text-sm text-[var(--dash-text-secondary)]"
									>Email verification relay</span
								>
							</div>
							<div class="flex items-center gap-2">
								<code
									class="flex-1 truncate rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1.5 font-mono text-xs text-[var(--dash-text)] select-all"
									>{verificationEmailAddress}</code
								>
								<button
									type="button"
									onclick={copyVerificationEmail}
									class="shrink-0 rounded border border-[var(--dash-border)] bg-[var(--dash-card)] px-2 py-1.5 text-xs transition-colors hover:bg-[var(--dash-border)]"
									title="Copy to clipboard"
								>
									{#if copiedVerifyEmail}
										<FontAwesomeIcon
											icon={faCheck}
											class="h-3.5 w-3.5 text-[var(--dash-success)]"
										/>
									{:else}
										<FontAwesomeIcon icon={faCopy} class="h-3.5 w-3.5" />
									{/if}
								</button>
							</div>
							<p class="mt-1.5 text-xs text-[var(--dash-text-muted)]">
								Forward verification emails from job sites to this address for auto-login.
							</p>
						</div>
					{/if}
				{/if}
			</div>
		{/if}

		<!-- Browser Control -->
		<hr class="mt-4 border-[var(--dash-border)]" />
		{#if isEdit}
			{@render sectionToggle('browser', 'Browser Control')}
		{:else}
			<h3 class="text-sm font-medium tracking-wide text-[var(--dash-text-muted)] uppercase">
				Browser Control
			</h3>
		{/if}

		{#if isAdd || sectionOpen.browser}
			<div class="space-y-3">
				{#if isAdd}
					<BrowserProviderToggle
						bind:value={addBrowserProvider}
						bind:sjsBrowserApiKey={addSjsBrowserApiKey}
						{localBrowserAllowed}
						{devices}
					/>
					<input type="hidden" name="browser_provider" value={addBrowserProvider ?? ''} />
					<input
						type="hidden"
						name="sjsbrowser_api_key"
						value={addBrowserProvider === 'tunnel' && addSjsBrowserApiKey != null
							? String(addSjsBrowserApiKey)
							: ''}
					/>
				{:else}
					<BrowserProviderToggle
						bind:value={browserProvider}
						bind:sjsBrowserApiKey
						{localBrowserAllowed}
						{devices}
					/>
					<div class="mt-1 min-h-[1rem]">
						<AutoSaveIndicator field={browserConfigField} />
					</div>
				{/if}

				<!-- Desktop connection status -->
				{#if isTunnelMode && desktopConnected !== null}
					<div
						class="
              flex items-center gap-2 text-xs {isTunnelMode && !desktopConnected
							? 'text-amber-600'
							: 'text-[var(--dash-text-secondary)]'}
            "
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
						{:else if desktopConnected}
							Device connected
						{:else}
							No device connected — <a
								href="/jobs/import/devices"
								class="underline hover:text-amber-700">Setup guide</a
							>
						{/if}
					</div>
				{/if}

				<!-- Browser Location (hosted mode) -->
				{#if isHostedMode}
					<div class="mt-2 border-t border-[var(--dash-border)] pt-3">
						<div class="mb-2 flex items-center gap-2">
							<FontAwesomeIcon
								icon={faGlobe}
								class="h-3.5 w-3.5 text-[var(--dash-text-secondary)]"
							/>
							<h3 class="text-xs font-medium text-[var(--dash-text-secondary)]">
								Browser Location
							</h3>
						</div>
						{#if isAdd}
							<div class="flex-1">
								<CountrySelect bind:value={addBrowserCountryCode} fallback={defaultCountryCode} />
							</div>
							<input type="hidden" name="browser_country_code" value={addBrowserCountryCode} />
						{:else}
							<div class="flex items-center gap-2">
								<div class="flex-1">
									<CountrySelect
										bind:value={editBrowserCountryCode}
										fallback={defaultCountryCode}
									/>
								</div>
								<AutoSaveIndicator field={browserCountryField} />
							</div>
						{/if}
						<p class="mt-2 text-xs text-[var(--dash-text-muted)]">
							The country the scraper will appear to browse from. Set this to match your actual
							location to avoid your account being flagged for logging in from unusual locations.{isEdit
								? " If empty, your profile's country is used."
								: ''}
						</p>

						<!-- Advanced: browser fingerprint -->
						{#if isEdit}
							<button
								type="button"
								onclick={() => (showAdvancedBrowser = !showAdvancedBrowser)}
								class="mt-3 flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text-secondary)]"
							>
								{#if showAdvancedBrowser}
									<FontAwesomeIcon icon={faChevronDown} class="h-2.5 w-2.5" />
								{:else}
									<FontAwesomeIcon icon={faChevronRight} class="h-2.5 w-2.5" />
								{/if}
								Advanced
							</button>

							{#if showAdvancedBrowser}
								<div class="mt-3 space-y-3 border-t border-[var(--dash-border)] pt-3">
									<div>
										<label
											for="browser_language"
											class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
										>
											Language
										</label>
										<input
											type="text"
											id="browser_language"
											bind:value={browserLanguage}
											onblur={fingerprintField.flush}
											autocomplete="off"
											placeholder={defaultBrowserLanguage}
											class="w-full rounded-md border border-[var(--dash-border)] px-2.5 py-1.5 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
										/>
										{#if !browserLanguage}
											<p class="mt-0.5 text-xs text-[var(--dash-text-muted)]">
												Defaults to <span class="font-mono">{defaultBrowserLanguage}</span> based on selected
												country
											</p>
										{/if}
									</div>

									<div>
										<label
											for="browser_timezone"
											class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
										>
											Timezone
										</label>
										<input
											type="text"
											id="browser_timezone"
											bind:value={browserTimezone}
											onblur={fingerprintField.flush}
											autocomplete="off"
											placeholder={defaultBrowserTimezone}
											class="w-full rounded-md border border-[var(--dash-border)] px-2.5 py-1.5 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
										/>
										{#if !browserTimezone}
											<p class="mt-0.5 text-xs text-[var(--dash-text-muted)]">
												Defaults to <span class="font-mono">{defaultBrowserTimezone}</span> based on selected
												country
											</p>
										{/if}
									</div>

									<div class="pt-1">
										<AutoSaveIndicator field={fingerprintField} />
									</div>
								</div>
							{/if}
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Right column: Scraping Options & Schedule -->
	<div class="space-y-4 lg:border-l lg:border-[var(--dash-border)] lg:pl-6">
		<hr class="border-[var(--dash-border)] lg:hidden" />

		<!-- Scraping Options -->
		{#if isEdit}
			{@render sectionToggle('options', 'Scraping Options')}
		{:else}
			<h3 class="text-sm font-medium tracking-wide text-[var(--dash-text-muted)] uppercase">
				Scraping Options
			</h3>
		{/if}

		{#if isAdd || sectionOpen.options}
			<div class="space-y-3">
				<!-- Max jobs -->
				<div class="flex flex-wrap items-center gap-3">
					<label class="flex cursor-pointer items-center gap-2">
						<input
							type="checkbox"
							checked={isAdd ? addMaxJobsEnabled : maxJobsEnabled}
							onchange={(e) => {
								if (isAdd) {
									addMaxJobsEnabled = (e.target as HTMLInputElement).checked;
								} else maxJobsEnabled = (e.target as HTMLInputElement).checked;
							}}
							class="h-4 w-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
						/>
						<span class="text-sm whitespace-nowrap text-[var(--dash-text-secondary)]"
							>Max jobs to process</span
						>
					</label>
					{#if isAdd}
						<input
							type="number"
							name="max_jobs"
							min="1"
							placeholder="No limit"
							bind:value={addMaxJobsInput}
							disabled={!addMaxJobsEnabled}
							class="w-24 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] disabled:opacity-40"
						/>
					{:else}
						<input
							type="number"
							min="1"
							placeholder="No limit"
							bind:value={maxJobsInput}
							onblur={maxJobsField.flush}
							autocomplete="off"
							disabled={!maxJobsEnabled}
							class="w-24 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] disabled:opacity-40"
						/>
						<AutoSaveIndicator field={maxJobsField} />
					{/if}
				</div>

				<!-- Duplicate jobs behavior -->
				<div class="flex flex-wrap items-center gap-3">
					<span class="text-sm whitespace-nowrap text-[var(--dash-text-secondary)]"
						>Duplicate jobs</span
					>
					<div class="flex overflow-hidden rounded-md border border-[var(--dash-border)]">
						<button
							type="button"
							onclick={() => {
								if (isAdd) addSkipExisting = false;
								else skipExisting = false;
							}}
							class={`px-3 py-1 text-xs font-medium transition-colors ${
								!(isAdd ? addSkipExisting : skipExisting)
									? 'bg-[var(--dash-primary)] text-white'
									: 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface)]'
							}`}
						>
							Update
						</button>
						<button
							type="button"
							onclick={() => {
								if (isAdd) addSkipExisting = true;
								else skipExisting = true;
							}}
							class={`px-3 py-1 text-xs font-medium transition-colors ${
								(isAdd ? addSkipExisting : skipExisting)
									? 'bg-[var(--dash-primary)] text-white'
									: 'bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface)]'
							}`}
						>
							Skip
						</button>
					</div>
					{#if isAdd}
						<input type="hidden" name="skip_existing" value={addSkipExisting ? 'true' : 'false'} />
					{:else}
						<AutoSaveIndicator field={skipExistingField} />
					{/if}
				</div>

				<!-- Stop after duplicates -->
				<div class="flex flex-wrap items-center gap-3">
					<label class="flex cursor-pointer items-center gap-2">
						<input
							type="checkbox"
							checked={isAdd ? addStopAfterDuplicatesEnabled : stopAfterDuplicatesEnabled}
							onchange={(e) => {
								if (isAdd) {
									addStopAfterDuplicatesEnabled = (e.target as HTMLInputElement).checked;
								} else stopAfterDuplicatesEnabled = (e.target as HTMLInputElement).checked;
							}}
							class="h-4 w-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
						/>
						<span class="text-sm whitespace-nowrap text-[var(--dash-text-secondary)]"
							>Stop after</span
						>
					</label>
					{#if isAdd}
						<input
							type="number"
							name="stop_after_duplicates"
							min="1"
							placeholder="Off"
							bind:value={addStopAfterDuplicatesInput}
							disabled={!addStopAfterDuplicatesEnabled}
							class="w-20 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] disabled:opacity-40"
						/>
					{:else}
						<input
							type="number"
							min="1"
							placeholder="Off"
							bind:value={stopAfterDuplicatesInput}
							onblur={stopAfterDuplicatesField.flush}
							autocomplete="off"
							disabled={!stopAfterDuplicatesEnabled}
							class="w-20 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] disabled:opacity-40"
						/>
					{/if}
					<span
						class="text-sm text-[var(--dash-text-secondary)]"
						class:opacity-40={isAdd ? !addStopAfterDuplicatesEnabled : !stopAfterDuplicatesEnabled}
						>duplicates in a row</span
					>
					{#if isEdit}
						<AutoSaveIndicator field={stopAfterDuplicatesField} />
					{/if}
				</div>

				<!-- Skip first -->
				<div class="flex flex-wrap items-center gap-3">
					<label class="flex cursor-pointer items-center gap-2">
						<input
							type="checkbox"
							checked={isAdd ? addSkipFirstEnabled : skipFirstEnabled}
							onchange={(e) => {
								if (isAdd) {
									addSkipFirstEnabled = (e.target as HTMLInputElement).checked;
								} else skipFirstEnabled = (e.target as HTMLInputElement).checked;
							}}
							class="h-4 w-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
						/>
						<span class="text-sm whitespace-nowrap text-[var(--dash-text-secondary)]"
							>Skip first</span
						>
					</label>
					{#if isAdd}
						<input
							type="number"
							name="skip_first"
							min="1"
							placeholder="Off"
							bind:value={addSkipFirstInput}
							disabled={!addSkipFirstEnabled}
							class="w-20 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] disabled:opacity-40"
						/>
					{:else}
						<input
							type="number"
							min="1"
							placeholder="Off"
							bind:value={skipFirstInput}
							onblur={skipFirstField.flush}
							autocomplete="off"
							disabled={!skipFirstEnabled}
							class="w-20 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] disabled:opacity-40"
						/>
					{/if}
					<span
						class="text-sm text-[var(--dash-text-secondary)]"
						class:opacity-40={isAdd ? !addSkipFirstEnabled : !skipFirstEnabled}>jobs</span
					>
					{#if isEdit}
						<AutoSaveIndicator field={skipFirstField} />
					{/if}
				</div>
			</div>
		{/if}

		<!-- Schedule -->
		<hr class="mt-4 border-[var(--dash-border)]" />
		{#if isEdit}
			{@render sectionToggle('schedule', 'Schedule')}
		{:else}
			<h3 class="text-sm font-medium tracking-wide text-[var(--dash-text-muted)] uppercase">
				Schedule
			</h3>
		{/if}

		{#if isAdd || sectionOpen.schedule}
			<div class="space-y-3">
				{#if isAdd}
					<!-- Add mode: simple toggle + options -->
					<label class="flex cursor-pointer items-center gap-2">
						<input
							type="checkbox"
							checked={addScheduleInterval !== ''}
							onchange={(e) => {
								const checked = (e.target as HTMLInputElement).checked;
								addScheduleInterval = checked ? '24' : '';
							}}
							class="h-4 w-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
						/>
						<span class="text-sm text-[var(--dash-text)]">Enable auto-run</span>
					</label>
					{#if addScheduleInterval}
						<div class="space-y-2 pl-6">
							<div class="flex items-center gap-2">
								<span class="text-sm whitespace-nowrap text-[var(--dash-text-secondary)]"
									>Frequency</span
								>
								<select
									name="schedule_interval_hours"
									bind:value={addScheduleInterval}
									class="rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)]"
								>
									{#each SCHEDULE_OPTIONS as opt}
										<option value={opt.value}>{opt.label}</option>
									{/each}
								</select>
							</div>
						</div>
					{/if}
				{:else}
					<!-- Edit mode: toggle + frequency + preferred hour -->
					<label class="flex cursor-pointer items-center gap-2">
						<input
							type="checkbox"
							bind:checked={scheduleEnabled}
							class="h-4 w-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
						/>
						<span class="text-sm text-[var(--dash-text)]">Enable auto-run</span>
					</label>
					{#if scheduleEnabled}
						<div class="space-y-3 pl-6">
							<div class="flex items-center gap-2">
								<span class="text-sm whitespace-nowrap text-[var(--dash-text-secondary)]"
									>Frequency</span
								>
								<select
									bind:value={scheduleIntervalInput}
									class="rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)]"
								>
									{#each SCHEDULE_OPTIONS as opt}
										<option value={opt.value}>{opt.label}</option>
									{/each}
								</select>
							</div>
							<div>
								<span class="mb-1 block text-sm text-[var(--dash-text-secondary)]"
									>Preferred time</span
								>
								<div class="flex items-center gap-2">
									<select
										bind:value={schedulePreferredHour}
										class="rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-sm text-[var(--dash-text)]"
									>
										{#each HOUR_OPTIONS as opt}
											<option value={opt.value}>{opt.label}</option>
										{/each}
									</select>
									{#if userTimezone}
										<span class="text-xs text-[var(--dash-text-muted)]"
											>{userTimezone.split('/').pop()?.replace(/_/g, ' ')}</span
										>
										<a
											href="/settings#timezone"
											class="text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-primary)]"
											title="Change timezone"
										>
											<FontAwesomeIcon icon={faPenToSquare} class="h-3 w-3" />
										</a>
									{:else}
										<a
											href="/settings#timezone"
											class="text-xs text-[var(--dash-text-muted)] underline hover:text-[var(--dash-primary)]"
											>Set timezone</a
										>
									{/if}
								</div>
							</div>
						</div>
					{/if}
					<AutoSaveIndicator field={scheduleField} />
				{/if}
			</div>
		{/if}

		<!-- Advanced (Background mode + staff debug). Only rendered when at least
         one toggle is applicable to this user/task. -->
		{#if isTunnelMode || (isEdit && isStaff)}
			<hr class="mt-4 border-[var(--dash-border)]" />
			{#if isEdit}
				{@render sectionToggle('advanced', 'Advanced')}
			{:else}
				<h3 class="text-sm font-medium tracking-wide text-[var(--dash-text-muted)] uppercase">
					Advanced
				</h3>
			{/if}

			{#if isAdd || sectionOpen.advanced}
				<div class="space-y-3">
					{#if isTunnelMode}
						<div class="flex flex-wrap items-center gap-3">
							<label class="flex cursor-pointer items-center gap-2">
								<input
									type="checkbox"
									checked={isAdd ? addKeepMinimized : keepMinimized}
									onchange={(e) => {
										if (isAdd) {
											addKeepMinimized = (e.target as HTMLInputElement).checked;
										} else keepMinimized = (e.target as HTMLInputElement).checked;
									}}
									class="h-4 w-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
								/>
								<span class="text-sm text-[var(--dash-text-secondary)]">Background mode</span>
							</label>
							{#if isAdd}
								<input
									type="hidden"
									name="keep_minimized"
									value={addKeepMinimized ? 'true' : 'false'}
								/>
							{:else}
								<AutoSaveIndicator field={keepMinimizedField} />
							{/if}
						</div>
						<p class="-mt-1 text-xs text-[var(--dash-text-muted)]">
							When enabled, Chrome won't steal focus while the scraper runs. Disable to watch tab
							switches in real-time via the browser view.
						</p>
					{/if}

					{#if isEdit && isStaff}
						<div class="flex flex-wrap items-center gap-3">
							<label class="flex cursor-pointer items-center gap-2">
								<input
									type="checkbox"
									bind:checked={debugScreenshots}
									class="h-4 w-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
								/>
								<span class="text-sm text-[var(--dash-text-secondary)]">
									Capture a screenshot after every action
									<span class="text-[var(--dash-text-muted)]">(staff debug)</span>
								</span>
							</label>
							<AutoSaveIndicator field={debugScreenshotsField} />
						</div>
						<p class="-mt-1 text-xs text-[var(--dash-text-muted)]">
							Screenshots show up inline in the run logs. Off by default — extra ~200ms per action
							and disk usage per run.
						</p>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</div>
