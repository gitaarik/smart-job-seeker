<script lang="ts">
	import type { PageData } from './$types';
	import { untrack } from 'svelte';
	import { armOn } from '$lib/actions/arm-on';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faBuilding, faLock, faMapMarkerAlt } from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../components/SectionHeader.svelte';
	import Card from '../../../components/Card.svelte';
	import CopyButton from '../../../components/CopyButton.svelte';
	import { autoSaveField, diffPayload, recordsEqual } from '$lib/components/auto-save.svelte';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import TranslatableField from '$lib/components/TranslatableField.svelte';
	import { BASE_LOCALE } from '$lib/resume-translations';
	import { translations } from '$lib/stores/translations.svelte';

	let { data }: { data: PageData } = $props();

	// Seeded once, like Basic Info: each card owns its values after mount and
	// saves itself. Nothing else writes these columns while the page is open
	// (the assistant reads them but proposes no edits to them), so there is no
	// applied change to remount on.
	const loaded = untrack(() => data.profile);
	const profileId = loaded.id;

	const loadedCompany = {
		company_name: loaded.company_name || '',
		kvk_number: loaded.kvk_number || '',
		vat_id: loaded.vat_id || '',
		business_activities: loaded.business_activities || ''
	};
	let company_name = $state(loadedCompany.company_name);
	let kvk_number = $state(loadedCompany.kvk_number);
	let vat_id = $state(loadedCompany.vat_id);
	let business_activities = $state(loadedCompany.business_activities);
	// The copy button and the count follow the language tab the field is on:
	// the Dutch text is the one the KvK form takes.
	const shownActivities = $derived(
		translations.activeLocale === BASE_LOCALE
			? business_activities
			: translations.get('profile', profileId, 'business_activities')
	);

	const loadedAddress = {
		street_address: loaded.street_address || '',
		postal_code: loaded.postal_code || '',
		city: loaded.city || ''
	};
	let street_address = $state(loadedAddress.street_address);
	let postal_code = $state(loadedAddress.postal_code);
	let city = $state(loadedAddress.city);

	async function saveSection(fields: Record<string, string>, prev: Record<string, string>) {
		const changed = diffPayload(fields, prev);
		if (Object.keys(changed).length === 0) return;

		const response = await fetch(`/api/profile/${profileId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(changed)
		});
		if (!response.ok) {
			const error = await response.json().catch(() => ({}));
			throw new Error(error.message || error.error || `Save failed (${response.status})`);
		}
	}

	// Armed on interaction for the reason Basic Info gives: browser autofill
	// fills address inputs above all, with no keystroke behind it.
	const companyField = autoSaveField<Record<string, string>>({
		armOnInteraction: true,
		initial: { ...loadedCompany },
		save: saveSection,
		onSaved: (v) => {
			company_name = v.company_name;
			kvk_number = v.kvk_number;
			vat_id = v.vat_id;
			business_activities = v.business_activities;
		},
		equal: recordsEqual,
		debounceMs: 700
	});
	$effect(() => companyField.set({ company_name, kvk_number, vat_id, business_activities }));

	const addressField = autoSaveField<Record<string, string>>({
		armOnInteraction: true,
		initial: { ...loadedAddress },
		save: saveSection,
		onSaved: (v) => {
			street_address = v.street_address;
			postal_code = v.postal_code;
			city = v.city;
		},
		equal: recordsEqual,
		debounceMs: 700
	});
	$effect(() => addressField.set({ street_address, postal_code, city }));

	const inputClass =
		'w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none';
</script>

<svelte:head>
	<title>Business - Profile - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<SectionHeader title="Business" icon={faBuilding} />

	<p class="flex items-start gap-2 text-sm text-[var(--dash-text-secondary)]">
		<FontAwesomeIcon icon={faLock} class="mt-0.5 h-4 w-4 shrink-0" />
		<span>
			For freelancers and anyone with their own company. None of this prints on a resume, CV or
			public page, except in a portfolio site's footer when its theme says to. The assistant knows
			the company name, registration number and activities, so it can help with things like a
			side-work notice to an employer.
		</span>
	</p>

	<Card padding="lg">
		<h2 class="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--dash-text)]">
			<FontAwesomeIcon icon={faBuilding} class="h-5 w-5 text-[var(--dash-primary)]" />
			Company
		</h2>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2" use:armOn={companyField.arm}>
			<div class="md:col-span-2">
				<label for="company_name" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
					Company Name
				</label>
				<input
					type="text"
					id="company_name"
					bind:value={company_name}
					autocomplete="off"
					placeholder="e.g., Jane Doe Software"
					class={inputClass}
				/>
			</div>

			<div>
				<label for="kvk_number" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
					Registration Number
				</label>
				<input
					type="text"
					id="kvk_number"
					bind:value={kvk_number}
					autocomplete="off"
					placeholder="e.g., 12345678"
					class={inputClass}
				/>
				<p class="mt-1 text-xs text-[var(--dash-text-secondary)]">
					Your chamber of commerce number (KvK in the Netherlands).
				</p>
			</div>

			<div>
				<label for="vat_id" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
					VAT ID
				</label>
				<input
					type="text"
					id="vat_id"
					bind:value={vat_id}
					autocomplete="off"
					placeholder="e.g., NL001234567B01"
					class={inputClass}
				/>
			</div>

			<!--
				The registered description of what the business does. Copyable for the
				same reason as About Me: its real home is a form somewhere else (the
				KvK register, a contract, a notice), and this is where it is kept.
			-->
			<div class="md:col-span-2">
				<TranslatableField
					entity="profile"
					id={profileId}
					field="business_activities"
					autocomplete="off"
					label="Business Activities"
					multiline
					rows={4}
					bind:value={business_activities}
					placeholder="What your business does, as registered with the chamber of commerce"
				/>
				{#if shownActivities.trim()}
					<div class="mt-1 flex items-center justify-between gap-3">
						<span class="text-xs text-[var(--dash-text-secondary)]">
							{shownActivities.length.toLocaleString()} characters
						</span>
						<CopyButton
							text={shownActivities}
							size="sm"
							label="Copy"
							title="Copy the business activities"
						/>
					</div>
				{/if}
			</div>
		</div>

		<div class="mt-4 flex justify-end">
			<AutoSaveIndicator field={companyField} />
		</div>
	</Card>

	<Card padding="lg">
		<h2 class="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--dash-text)]">
			<FontAwesomeIcon icon={faMapMarkerAlt} class="h-5 w-5 text-[var(--dash-primary)]" />
			Business Address
		</h2>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2" use:armOn={addressField.arm}>
			<div class="md:col-span-2">
				<label for="street_address" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
					Street Address
				</label>
				<input
					type="text"
					id="street_address"
					bind:value={street_address}
					autocomplete="off"
					placeholder="e.g., Main Street 12"
					class={inputClass}
				/>
			</div>

			<div>
				<label for="postal_code" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
					Postal Code
				</label>
				<input
					type="text"
					id="postal_code"
					bind:value={postal_code}
					autocomplete="off"
					placeholder="e.g., 1234 AB"
					class={inputClass}
				/>
			</div>

			<div>
				<label for="city" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
					City
				</label>
				<input
					type="text"
					id="city"
					bind:value={city}
					autocomplete="off"
					placeholder="e.g., Haarlem"
					class={inputClass}
				/>
			</div>
		</div>

		<div class="mt-4 flex justify-end">
			<AutoSaveIndicator field={addressField} />
		</div>
	</Card>
</div>
