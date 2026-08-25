<script lang="ts">
	import type { PageData } from './$types';
	import { armOn } from '$lib/actions/arm-on';
	import { page } from '$app/stores';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCalendarAlt,
		faEnvelope,
		faPencil,
		faPenToSquare,
		faRotateLeft
	} from '@fortawesome/free-solid-svg-icons';
	import Card from '../../../components/Card.svelte';
	import Checkbox from '../../../components/Checkbox.svelte';
	import ToggleSwitch from '../../../components/ToggleSwitch.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { autoSaveField, diffPayload, recordsEqual } from '$lib/components/auto-save.svelte';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import { formatTzLabel, TIMEZONE_OPTIONS } from '$lib/timezone';
	import {
		buildHourOptions,
		formatDateShort as fmtDateShort,
		formatTimeShort
	} from '$lib/format-date';
	import type { TimeFormat } from '$lib/format-date';

	let { data }: { data: PageData } = $props();

	let digestEnabled = $state(data.emailDigest.enabled);
	let digestFrequency = $state(data.emailDigest.frequency_days);
	let digestMinScore = $state(data.emailDigest.min_score);
	let digestPreferredHour = $state(data.emailDigest.preferred_hour);
	let sendToProfile = $state(
		data.emailDigest.send_to === 'profile' || data.emailDigest.send_to === 'both'
	);
	let sendToAccount = $state(
		data.emailDigest.send_to === 'account' || data.emailDigest.send_to === 'both'
	);
	let digestTimezone = $state(data.emailDigest.timezone || '');
	let sendToExpanded = $state(false);
	let digestError = $state('');
	let sendingNow = $state(false);
	let sendNowResult = $state<{ sent_to: string[]; job_count: number } | null>(null);
	let resettingLastSent = $state(false);

	const hasEmail = $derived(!!data.emailDigest.email_address);
	const hasAnyEmail = $derived(hasEmail || !!data.emailDigest.account_email);
	const digestSendTo = $derived(
		sendToProfile && sendToAccount ? 'both' : sendToAccount ? 'account' : 'profile'
	);
	const canEnable = $derived(
		digestSendTo === 'account' ? !!data.emailDigest.account_email : hasEmail
	);
	const sendToSummary = $derived.by(() => {
		const emails: string[] = [];
		if (sendToProfile && data.emailDigest.email_address) {
			emails.push(data.emailDigest.email_address);
		}
		if (sendToAccount && data.emailDigest.account_email) {
			emails.push(data.emailDigest.account_email);
		}
		// deduplicate if same email
		return [...new Set(emails)].join(', ') || 'No email selected';
	});

	const lastSentDate = $derived(
		data.emailDigest.last_sent_at ? new Date(data.emailDigest.last_sent_at) : null
	);
	const nextSendDate = $derived.by(() => {
		if (!lastSentDate) return null;
		const next = new Date(lastSentDate);
		next.setDate(next.getDate() + digestFrequency);
		// Snap to the preferred hour in the user's timezone
		const tz = digestTimezone || undefined;
		try {
			// Get the current date parts in the user's timezone for the "next" date
			const parts = new Intl.DateTimeFormat('en-US', {
				timeZone: tz,
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				hour12: false
			}).formatToParts(next);
			const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
			// Build a date at the preferred hour in the user's timezone
			const probe = new Date(
				Date.UTC(get('year'), get('month') - 1, get('day'), digestPreferredHour)
			);
			// Adjust for timezone offset
			const utcStr = probe.toLocaleString('en-US', {
				timeZone: 'UTC',
				hour12: false
			});
			const tzStr = probe.toLocaleString('en-US', {
				timeZone: tz,
				hour12: false
			});
			const offsetMs = new Date(utcStr).getTime() - new Date(tzStr).getTime();
			const snapped = new Date(probe.getTime() + offsetMs);
			// If that's in the past, move to next day
			if (snapped <= new Date()) {
				return new Date(snapped.getTime() + 86400_000);
			}
			return snapped;
		} catch {
			// Fallback to browser timezone
			next.setHours(digestPreferredHour, 0, 0, 0);
			if (next <= new Date()) next.setDate(next.getDate() + 1);
			return next;
		}
	});

	function formatRelative(date: Date): string {
		const now = new Date();
		const diffMs = date.getTime() - now.getTime();
		const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Tomorrow';
		if (diffDays === -1) return 'Yesterday';
		if (diffDays < -1) return `${Math.abs(diffDays)} days ago`;
		return `In ${diffDays} days`;
	}

	const timeFormat = $derived(($page.data as { timeFormat: TimeFormat }).timeFormat);

	function formatTime(date: Date): string {
		return formatTimeShort(date, timeFormat, {
			timezone: digestTimezone || null
		});
	}

	function formatDateShort(date: Date): string {
		return fmtDateShort(date, { timezone: digestTimezone || null });
	}

	const FREQUENCY_OPTIONS = [
		{ value: 1, label: 'Every day' },
		{ value: 2, label: 'Every 2 days' },
		{ value: 3, label: 'Every 3 days' },
		{ value: 5, label: 'Every 5 days' },
		{ value: 7, label: 'Every week' },
		{ value: 14, label: 'Every 2 weeks' }
	];

	const SCORE_OPTIONS = [
		{ value: 50, label: '50+ (all decent matches)' },
		{ value: 60, label: '60+ (moderate matches)' },
		{ value: 70, label: '70+ (good matches)' },
		{ value: 80, label: '80+ (strong matches)' },
		{ value: 90, label: '90+ (excellent matches only)' }
	];

	const HOUR_OPTIONS = $derived(buildHourOptions(timeFormat));

	// Auto-detect timezone from browser if none is saved
	$effect(() => {
		if (!digestTimezone) {
			try {
				const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
				if (detected) digestTimezone = detected;
			} catch {
				// ignore
			}
		}
	});

	// The whole digest config is one PATCH, so it's one auto-saved field with a
	// single undo window rather than six racing indicators.
	type DigestSettings = {
		enabled: boolean;
		frequencyDays: number;
		minScore: number;
		preferredHour: number;
		sendTo: string;
		timezone: string;
	};
	/** Form state as the API expects it. Both sides of the diff go through here. */
	function digestBody(v: DigestSettings) {
		return {
			enabled: v.enabled,
			frequency_days: v.frequencyDays,
			min_score: v.minScore,
			preferred_hour: v.preferredHour,
			send_to: v.sendTo,
			timezone: v.timezone || undefined
		};
	}
	const digestField = autoSaveField<DigestSettings>({
		armOnInteraction: true,
		initial: {
			enabled: data.emailDigest.enabled,
			frequencyDays: data.emailDigest.frequency_days,
			minScore: data.emailDigest.min_score,
			preferredHour: data.emailDigest.preferred_hour,
			sendTo: data.emailDigest.send_to,
			timezone: data.emailDigest.timezone || ''
		},
		save: async (v, prev) => {
			const changed = diffPayload(digestBody(v), digestBody(prev));
			if (Object.keys(changed).length === 0) return;

			const res = await fetch(`/api/profile/${data.profileId}/email-digest`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(changed)
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.message || `Error ${res.status}`);
			}
		},
		onSaved: (v) => {
			digestEnabled = v.enabled;
			digestFrequency = v.frequencyDays;
			digestMinScore = v.minScore;
			digestPreferredHour = v.preferredHour;
			digestTimezone = v.timezone;
			sendToProfile = v.sendTo === 'profile' || v.sendTo === 'both';
			sendToAccount = v.sendTo === 'account' || v.sendTo === 'both';
		},
		equal: recordsEqual
	});
	$effect(() =>
		digestField.set({
			enabled: digestEnabled,
			frequencyDays: digestFrequency,
			minScore: digestMinScore,
			preferredHour: digestPreferredHour,
			sendTo: digestSendTo,
			timezone: digestTimezone
		})
	);

	async function sendDigestNow() {
		if (!confirm('Send email digest now?')) return;
		sendingNow = true;
		digestError = '';
		sendNowResult = null;

		try {
			const res = await fetch(`/api/profile/${data.profileId}/email-digest`, {
				method: 'POST'
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({
					message: 'Failed to send'
				}));
				digestError = body.message || `Error ${res.status}`;
				return;
			}

			const result = await res.json();
			sendNowResult = result;
			data.emailDigest.last_sent_at = new Date().toISOString();
			setTimeout(() => (sendNowResult = null), 5000);
		} catch {
			digestError = 'Network error, please try again';
		} finally {
			sendingNow = false;
		}
	}

	async function resetLastSent() {
		if (
			!confirm(
				`Reset last sent date to ${digestFrequency} day${digestFrequency === 1 ? '' : 's'} ago?`
			)
		)
			return;
		resettingLastSent = true;
		digestError = '';

		try {
			const res = await fetch(`/api/profile/${data.profileId}/email-digest`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ reset_last_sent: true })
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({
					message: 'Failed to reset'
				}));
				digestError = body.message || `Error ${res.status}`;
				return;
			}

			// Update the local state to reflect the reset
			const resetDate = new Date(Date.now() - digestFrequency * 86400_000);
			data.emailDigest.last_sent_at = resetDate.toISOString();
		} catch {
			digestError = 'Network error, please try again';
		} finally {
			resettingLastSent = false;
		}
	}
</script>

<svelte:head>
	<title>Email Digest - Smart Job Seeker</title>
</svelte:head>

<Card padding="lg">
	{#if !hasAnyEmail}
		<div
			class="mb-4 rounded-lg border p-4"
			style="background-color: var(--dash-warning-light); border-color: var(--dash-warning-border);"
		>
			<p class="text-sm" style="color: var(--dash-warning);">
				No email address available. Add one in
				<a href="/profile/edit" class="font-medium underline">Profile Data</a>
				to enable email digests.
			</p>
		</div>
	{/if}

	<div class="space-y-5" style="max-width: 400px;" use:armOn={digestField.arm}>
		<ToggleSwitch
			bind:checked={digestEnabled}
			disabled={!canEnable}
			label="Email digest"
			description="Send periodic emails with your top job matches"
		/>

		{#if digestEnabled}
			<!-- Schedule overview -->
			{#if lastSentDate || nextSendDate}
				<div class="flex flex-col gap-3 rounded-lg border border-[var(--dash-border)] p-3 text-sm">
					{#if lastSentDate}
						<div class="flex items-center gap-2">
							<FontAwesomeIcon
								icon={faEnvelope}
								class="h-3.5 w-3.5 flex-shrink-0 text-[var(--dash-text-muted)]"
							/>
							<div>
								<p class="font-medium text-[var(--dash-text-secondary)]">
									Last sent
									<button
										type="button"
										onclick={resetLastSent}
										disabled={resettingLastSent}
										title="Reset last sent date"
										class="ml-1.5 font-normal text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-primary)] disabled:opacity-50"
										><FontAwesomeIcon
											icon={faRotateLeft}
											class="h-3 w-3 {resettingLastSent ? 'animate-spin' : ''}"
										/></button
									>
								</p>
								<p class="text-[var(--dash-text)]">
									{formatRelative(lastSentDate)}
									{formatTime(lastSentDate)}
									<span class="text-[var(--dash-text-secondary)]"
										>({formatDateShort(lastSentDate)})</span
									>
								</p>
							</div>
						</div>
					{/if}
					{#if nextSendDate}
						<div class="flex items-center gap-2">
							<FontAwesomeIcon
								icon={faCalendarAlt}
								class="h-3.5 w-3.5 flex-shrink-0 text-[var(--dash-primary)]"
							/>
							<div>
								<p class="font-medium text-[var(--dash-text-secondary)]">Next</p>
								<p class="text-[var(--dash-text)]">
									{formatRelative(nextSendDate)}
									{formatTime(nextSendDate)}
									<span class="text-[var(--dash-text-secondary)]"
										>({formatDateShort(nextSendDate)})</span
									>
								</p>
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Send to -->
			<div>
				<span class="mb-1.5 block text-sm font-medium text-[var(--dash-text)]">Send to</span>
				<button
					type="button"
					onclick={() => (sendToExpanded = !sendToExpanded)}
					class="inline-flex items-center gap-1.5 text-sm text-[var(--dash-text)] transition-colors hover:text-[var(--dash-primary)]"
				>
					<span>{sendToSummary}</span>
					<FontAwesomeIcon icon={faPencil} class="h-3 w-3 opacity-50" />
				</button>
				{#if sendToExpanded}
					<div class="mt-2 flex flex-col gap-2">
						{#if data.emailDigest.email_address}
							<div class="flex items-center gap-1.5">
								<Checkbox
									bind:checked={sendToProfile}
									label="{data.emailDigest.email_address} (profile)"
								/>
								<a
									href="/profile/edit#email_address"
									class="text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-primary)]"
									title="Edit profile email"
								>
									<FontAwesomeIcon icon={faPenToSquare} class="h-3 w-3" />
								</a>
							</div>
						{/if}
						{#if data.emailDigest.account_email}
							<div class="flex items-center gap-1.5">
								<Checkbox
									bind:checked={sendToAccount}
									label="{data.emailDigest.account_email} (account)"
								/>
								<a
									href="/settings#account-email"
									class="text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-primary)]"
									title="Edit account email"
								>
									<FontAwesomeIcon icon={faPenToSquare} class="h-3 w-3" />
								</a>
							</div>
						{/if}
					</div>
				{/if}
				{#if digestSendTo === 'profile' && !hasEmail}
					<p class="mt-1.5 text-xs" style="color: var(--dash-warning);">
						This profile doesn't have an email address. Add one in
						<a href="/profile/edit" class="underline">Profile Data</a>
						or switch to account email.
					</p>
				{/if}
			</div>

			<!-- Frequency -->
			<div>
				<label
					for="digest-frequency"
					class="mb-1.5 block text-sm font-medium text-[var(--dash-text)]"
				>
					Frequency
				</label>
				<select
					id="digest-frequency"
					bind:value={digestFrequency}
					class="w-full max-w-xs rounded-md border border-[var(--dash-border-input)] bg-[var(--dash-card)] px-3 py-2 text-sm text-[var(--dash-text)] focus:border-transparent focus:ring-2 focus:outline-none"
					style="--tw-ring-color: var(--dash-primary);"
				>
					{#each FREQUENCY_OPTIONS as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>

			<!-- Time & Timezone -->
			<div>
				<span class="mb-1.5 block text-sm font-medium text-[var(--dash-text)]">Time</span>
				<div class="flex max-w-xs flex-wrap gap-3">
					<select
						id="digest-hour"
						bind:value={digestPreferredHour}
						class="rounded-md border border-[var(--dash-border-input)] bg-[var(--dash-card)] px-3 py-2 text-sm text-[var(--dash-text)] focus:border-transparent focus:ring-2 focus:outline-none"
						style="--tw-ring-color: var(--dash-primary);"
					>
						{#each HOUR_OPTIONS as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
					<select
						id="digest-timezone"
						bind:value={digestTimezone}
						class="min-w-0 flex-1 truncate rounded-md border border-[var(--dash-border-input)] bg-[var(--dash-card)] px-3 py-2 text-sm text-[var(--dash-text)] focus:border-transparent focus:ring-2 focus:outline-none"
						style="--tw-ring-color: var(--dash-primary);"
					>
						<option value="">Select timezone...</option>
						{#each TIMEZONE_OPTIONS as group}
							<optgroup label={group.group}>
								{#each group.zones as tz}
									<option value={tz}>{formatTzLabel(tz)}</option>
								{/each}
							</optgroup>
						{/each}
					</select>
				</div>
				<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
					Timezone applies to all your profiles.
				</p>
			</div>

			<!-- Minimum Score -->
			<div>
				<label
					for="digest-min-score"
					class="mb-1.5 block text-sm font-medium text-[var(--dash-text)]"
				>
					Minimum match score
				</label>
				<select
					id="digest-min-score"
					bind:value={digestMinScore}
					class="w-full max-w-xs rounded-md border border-[var(--dash-border-input)] bg-[var(--dash-card)] px-3 py-2 text-sm text-[var(--dash-text)] focus:border-transparent focus:ring-2 focus:outline-none"
					style="--tw-ring-color: var(--dash-primary);"
				>
					{#each SCORE_OPTIONS as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
				<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
					Only jobs scoring at or above this threshold will be included.
				</p>
			</div>
		{/if}

		{#if digestError}
			<p class="text-sm" style="color: var(--dash-error);">{digestError}</p>
		{/if}

		<div class="flex items-center gap-3">
			<AutoSaveIndicator field={digestField} />

			{#if digestEnabled}
				<button
					type="button"
					onclick={sendDigestNow}
					disabled={sendingNow}
					class="flex items-center gap-2 rounded-lg border border-[var(--dash-border-input)] px-4 py-2 text-sm font-medium text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-hover)] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if sendingNow}
						<Spinner size="w-4 h-4" />
					{:else}
						<FontAwesomeIcon icon={faEnvelope} class="h-4 w-4" />
					{/if}
					Send now
				</button>
			{/if}
		</div>

		{#if sendNowResult}
			<p class="text-sm" style="color: var(--dash-success, #16a34a);">
				Sent {sendNowResult.job_count} job{sendNowResult.job_count === 1 ? '' : 's'} to {sendNowResult.sent_to.join(
					', '
				)}
			</p>
		{/if}
	</div>
</Card>
