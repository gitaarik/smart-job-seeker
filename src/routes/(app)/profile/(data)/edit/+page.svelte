<script lang="ts">
	import type { PageData } from './$types';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCamera,
		faEnvelope,
		faGlobe,
		faMapMarkerAlt,
		faPhone,
		faUser
	} from '@fortawesome/free-solid-svg-icons';
	import {
		faGithub,
		faLinkedin,
		faNpm,
		faPython,
		faStackOverflow
	} from '@fortawesome/free-brands-svg-icons';
	import SectionHeader from '../../components/SectionHeader.svelte';
	import Card from '../../../components/Card.svelte';
	import MediaUpload from '$lib/components/MediaUpload.svelte';
	import { autoSaveField, diffPayload, recordsEqual } from '$lib/components/auto-save.svelte';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import TranslatableField from '$lib/components/TranslatableField.svelte';
	import AutoTranslateProfile from '$lib/components/AutoTranslateProfile.svelte';
	import CountrySelect from '../../../jobs/components/CountrySelect.svelte';
	import { getProfilePhotoUrl } from '$lib/utils/profile-photo-url';

	let { data }: { data: PageData } = $props();

	const profile = $derived(data.profile);
	let photoUrl = $state(getProfilePhotoUrl(data.profile));

	// Form values - Personal Information
	let name = $state(data.profile?.name || '');
	let slug = $state(data.profile?.slug || '');
	let title = $state(data.profile?.title || '');
	let subtitle = $state(data.profile?.subtitle || '');
	let headline = $state(data.profile?.headline || '');
	let summary = $state(data.profile?.summary || '');

	// Form values - Contact Information
	let email_address = $state(data.profile?.email_address || '');
	let phone_number = $state(data.profile?.phone_number || '');
	let location = $state(data.profile?.location || '');
	let location_url = $state(data.profile?.location_url || '');
	let location_timezone = $state(data.profile?.location_timezone || '');
	let country_code = $state(data.profile?.country_code || '');
	let personal_website = $state(data.profile?.personal_website || '');

	// Form values - Social Profiles
	let linkedin_profile = $state(data.profile?.linkedin_profile || '');
	let github_profile = $state(data.profile?.github_profile || '');
	let stackoverflow_profile = $state(data.profile?.stackoverflow_profile || '');
	let npm_profile = $state(data.profile?.npm_profile || '');
	let pypi_profile = $state(data.profile?.pypi_profile || '');

	async function saveSection(fields: Record<string, string>, prev: Record<string, string>) {
		const changed = diffPayload(fields, prev);
		if (Object.keys(changed).length === 0) return;

		const response = await fetch(`/api/profile/${profile.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(changed)
		});
		if (!response.ok) {
			const error = await response.json().catch(() => ({}));
			throw new Error(error.message || error.error || `Save failed (${response.status})`);
		}
	}

	// One auto-saved field per card rather than one per input: each card already
	// PATCHes its fields as a group, and 15 separate indicator pills in a dense
	// two-column grid would be unreadable. Undo therefore reverts the card's last
	// burst of edits, not a single input.
	const personalInfoField = autoSaveField<Record<string, string>>({
		initial: { name, slug, title, subtitle, headline, summary },
		save: saveSection,
		onSaved: (v) => {
			name = v.name;
			slug = v.slug;
			title = v.title;
			subtitle = v.subtitle;
			headline = v.headline;
			summary = v.summary;
		},
		equal: recordsEqual,
		debounceMs: 700
	});
	$effect(() => personalInfoField.set({ name, slug, title, subtitle, headline, summary }));

	const contactField = autoSaveField<Record<string, string>>({
		initial: {
			email_address,
			phone_number,
			location,
			location_url,
			location_timezone,
			country_code,
			personal_website
		},
		save: saveSection,
		onSaved: (v) => {
			email_address = v.email_address;
			phone_number = v.phone_number;
			location = v.location;
			location_url = v.location_url;
			location_timezone = v.location_timezone;
			country_code = v.country_code;
			personal_website = v.personal_website;
		},
		equal: recordsEqual,
		debounceMs: 700
	});
	$effect(() =>
		contactField.set({
			email_address,
			phone_number,
			location,
			location_url,
			location_timezone,
			country_code,
			personal_website
		})
	);

	const socialField = autoSaveField<Record<string, string>>({
		initial: {
			linkedin_profile,
			github_profile,
			stackoverflow_profile,
			npm_profile,
			pypi_profile
		},
		save: saveSection,
		onSaved: (v) => {
			linkedin_profile = v.linkedin_profile;
			github_profile = v.github_profile;
			stackoverflow_profile = v.stackoverflow_profile;
			npm_profile = v.npm_profile;
			pypi_profile = v.pypi_profile;
		},
		equal: recordsEqual,
		debounceMs: 700
	});
	$effect(() =>
		socialField.set({
			linkedin_profile,
			github_profile,
			stackoverflow_profile,
			npm_profile,
			pypi_profile
		})
	);
</script>

<svelte:head>
	<title>Basic Info - Profile - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<SectionHeader title="Basic Info" icon={faUser} />

	<!-- Profile Photo Section -->
	<Card padding="lg">
		<h2 class="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--dash-text)]">
			<FontAwesomeIcon icon={faCamera} class="h-5 w-5 text-[var(--dash-primary)]" />
			Profile Photo
		</h2>

		<MediaUpload
			entityType="profile"
			entityId={profile.id}
			field="profile_photo_path"
			currentUrl={photoUrl}
			label=""
			onUpload={(url) => (photoUrl = url)}
			onDelete={() => (photoUrl = null)}
		/>
	</Card>

	<!-- Personal Information -->
	<Card padding="lg">
		<h2 class="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--dash-text)]">
			<FontAwesomeIcon icon={faUser} class="h-5 w-5 text-[var(--dash-primary)]" />
			Personal Information
		</h2>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<label for="name" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
					Full Name <span class="text-[var(--dash-error)]">*</span>
				</label>
				<input
					type="text"
					id="name"
					bind:value={name}
					required
					class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				/>
			</div>

			<div>
				<label for="slug" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
					Profile URL
				</label>
				<div class="flex items-center gap-2">
					<span class="text-sm text-[var(--dash-text-secondary)]">/p/</span>
					<input
						type="text"
						id="slug"
						bind:value={slug}
						placeholder="your-profile-name"
						class="flex-1 rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				</div>
				<p class="mt-1 text-xs text-[var(--dash-text-secondary)]">
					Used in your public profile URL. Only lowercase letters, numbers, and hyphens.
				</p>
			</div>

			<div>
				<TranslatableField
					entity="profile"
					id={profile.id}
					field="title"
					label="Professional Title"
					bind:value={title}
					placeholder="e.g., Senior Software Engineer"
				/>
			</div>

			<div>
				<TranslatableField
					entity="profile"
					id={profile.id}
					field="subtitle"
					label="Subtitle"
					multiline
					rows={2}
					bind:value={subtitle}
					placeholder="e.g., Full-Stack Developer"
					hint="One sentence describing your role or specialty"
				/>
			</div>

			<div>
				<TranslatableField
					entity="profile"
					id={profile.id}
					field="headline"
					label="Headline"
					multiline
					rows={2}
					bind:value={headline}
					placeholder="A short tagline about yourself"
					hint="One sentence summarizing your professional focus"
				/>
			</div>

			<div class="md:col-span-2">
				<TranslatableField
					entity="profile"
					id={profile.id}
					field="summary"
					label="Professional Summary"
					multiline
					rows={4}
					bind:value={summary}
					placeholder="Write a brief professional summary..."
				/>
			</div>
		</div>

		<div class="mt-4 flex justify-end">
			<AutoSaveIndicator field={personalInfoField} />
		</div>
	</Card>

	<AutoTranslateProfile />

	<!-- Contact Information -->
	<Card padding="lg">
		<h2 class="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--dash-text)]">
			<FontAwesomeIcon icon={faEnvelope} class="h-5 w-5 text-[var(--dash-primary)]" />
			Contact Information
		</h2>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<label for="email_address" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
					<FontAwesomeIcon
						icon={faEnvelope}
						class="mr-1 h-4 w-4 text-[var(--dash-text-secondary)]"
					/>
					Email Address
				</label>
				<input
					type="email"
					id="email_address"
					bind:value={email_address}
					placeholder="you@example.com"
					class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				/>
			</div>

			<div>
				<label for="phone_number" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
					<FontAwesomeIcon icon={faPhone} class="mr-1 h-4 w-4 text-[var(--dash-text-secondary)]" />
					Phone Number
				</label>
				<input
					type="tel"
					id="phone_number"
					bind:value={phone_number}
					placeholder="+1 (555) 000-0000"
					class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				/>
			</div>

			<div>
				<label for="location" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
					<FontAwesomeIcon
						icon={faMapMarkerAlt}
						class="mr-1 h-4 w-4 text-[var(--dash-text-secondary)]"
					/>
					Location
				</label>
				<input
					type="text"
					id="location"
					bind:value={location}
					placeholder="Amsterdam, Netherlands"
					class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				/>
			</div>

			<div>
				<label for="location_url" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
					<FontAwesomeIcon
						icon={faMapMarkerAlt}
						class="mr-1 h-4 w-4 text-[var(--dash-text-secondary)]"
					/>
					Location URL
				</label>
				<input
					type="url"
					id="location_url"
					bind:value={location_url}
					placeholder="https://maps.google.com/?q=Amsterdam"
					class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				/>
				<p class="mt-1 text-xs text-[var(--dash-text-secondary)]">
					Optional link wrapped around the location on your resume (e.g. Google Maps).
				</p>
			</div>

			<div>
				<label
					for="location_timezone"
					class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
				>
					<FontAwesomeIcon
						icon={faMapMarkerAlt}
						class="mr-1 h-4 w-4 text-[var(--dash-text-secondary)]"
					/>
					Timezone
				</label>
				<input
					type="text"
					id="location_timezone"
					bind:value={location_timezone}
					placeholder="CET (UTC+1)"
					class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				/>
			</div>

			<div>
				<label for="country_code" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
					<FontAwesomeIcon
						icon={faMapMarkerAlt}
						class="mr-1 h-4 w-4 text-[var(--dash-text-secondary)]"
					/>
					Country
				</label>
				<CountrySelect bind:value={country_code} placeholder="Select country..." />
			</div>

			<div>
				<label
					for="personal_website"
					class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
				>
					<FontAwesomeIcon icon={faGlobe} class="mr-1 h-4 w-4 text-[var(--dash-text-secondary)]" />
					Personal Website
				</label>
				<input
					type="url"
					id="personal_website"
					bind:value={personal_website}
					placeholder="https://yourwebsite.com"
					class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				/>
			</div>
		</div>

		<div class="mt-4 flex justify-end">
			<AutoSaveIndicator field={contactField} />
		</div>
	</Card>

	<!-- Social Profiles -->
	<Card padding="lg">
		<h2 class="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--dash-text)]">
			<FontAwesomeIcon icon={faGlobe} class="h-5 w-5 text-[var(--dash-primary)]" />
			Social Profiles
		</h2>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<label
					for="linkedin_profile"
					class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
				>
					<FontAwesomeIcon icon={faLinkedin} class="mr-1 h-4 w-4 text-[#0A66C2]" />
					LinkedIn
				</label>
				<input
					type="url"
					id="linkedin_profile"
					bind:value={linkedin_profile}
					placeholder="https://linkedin.com/in/yourprofile"
					class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				/>
			</div>

			<div>
				<label for="github_profile" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
					<FontAwesomeIcon icon={faGithub} class="mr-1 h-4 w-4 text-[var(--dash-text)]" />
					GitHub
				</label>
				<input
					type="url"
					id="github_profile"
					bind:value={github_profile}
					placeholder="https://github.com/yourusername"
					class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				/>
			</div>

			<div>
				<label
					for="stackoverflow_profile"
					class="mb-1 block text-sm font-medium text-[var(--dash-text)]"
				>
					<FontAwesomeIcon icon={faStackOverflow} class="mr-1 h-4 w-4 text-[#F48024]" />
					Stack Overflow
				</label>
				<input
					type="url"
					id="stackoverflow_profile"
					bind:value={stackoverflow_profile}
					placeholder="https://stackoverflow.com/users/123456"
					class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				/>
			</div>

			<div>
				<label for="npm_profile" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
					<FontAwesomeIcon icon={faNpm} class="mr-1 h-4 w-4 text-[#CB3837]" />
					npm
				</label>
				<input
					type="url"
					id="npm_profile"
					bind:value={npm_profile}
					placeholder="https://npmjs.com/~yourusername"
					class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				/>
			</div>

			<div>
				<label for="pypi_profile" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
					<FontAwesomeIcon icon={faPython} class="mr-1 h-4 w-4 text-[#3776AB]" />
					PyPI
				</label>
				<input
					type="url"
					id="pypi_profile"
					bind:value={pypi_profile}
					placeholder="https://pypi.org/user/yourusername"
					class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				/>
			</div>
		</div>

		<div class="mt-4 flex justify-end">
			<AutoSaveIndicator field={socialField} />
		</div>
	</Card>
</div>
