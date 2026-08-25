<script lang="ts">
	import { page } from '$app/state';
	import { formatDateRangeCompact } from '$lib/tools/date-utils';
	import {
		proficiencyLabel,
		templateLabel,
		type TemplateLabelKey
	} from '$lib/resume-template-labels';
	import ContactItem from './ContactItem.svelte';
	import { createProfileFilter } from './profile-filter';
	import { isContactHidden } from '$lib/resume-contact-fields';
	import { OVERRIDE_ENTITIES } from '$lib/version-overrides';
	import { resumeDocumentDescription, resumeDocumentTitle } from '$lib/resume-head';

	interface Profile {
		name: string | null;
		title: string | null;
		subtitle: string | null;
		email_address: string | null;
		phone_number: string | null;
		location: string | null;
		location_url: string | null;
		location_timezone?: string | null;
		personal_website: string | null;
		linkedin_profile: string | null;
		github_profile: string | null;
		summary: string | null;
		work_experiences: Array<{
			name: string | null;
			location: string | null;
			position: string | null;
			// Drizzle `date()` columns return strings; `timestamp()` returns Date.
			// The relevant columns are `date()`, so the wire type is string.
			start_date: string | null;
			end_date?: string | null;
			note?: string | null;
			work_experience_achievements?: Array<{
				description: string | null;
				tags: string[] | unknown;
			}>;
			// Drizzle `json()` columns surface as `unknown` until validated; the
			// template uses filterOnTags() which accepts both shapes.
			tags: string[] | unknown;
		}>;
		// Drizzle relation is `educations` (plural); singular was a stale name.
		educations: Array<{
			area: string | null;
			study_type: string | null;
			institution: string | null;
			location: string | null;
			summary: string | null;
			// Drizzle `date()` columns return strings; `timestamp()` returns Date.
			// The relevant columns are `date()`, so the wire type is string.
			start_date: string | null;
			end_date?: string | null;
			graduation_year?: number | null;
			tags?: string[] | unknown;
		}>;
		languages: Array<{
			name: string | null;
			language_code: string | null;
			proficiency: string | null;
		}>;
		nationality?: string | null;
		certificates: Array<{
			name: string;
			issuer: string | null;
			date: string | null;
			url: string | null;
		}>;
		references: Array<{
			author: string | null;
			text: string | null;
		}>;
		tech_skill_categories: Array<{
			name: string | null;
			tags?: string[] | unknown;
			tech_skills: Array<{ name: string | null }>;
		}>;
		side_projects: Array<{
			name: string | null;
			url: string | null;
			repo_url: string | null;
			stars: number | null;
			start_date: string | null;
			end_date?: string | null;
			summary: string | null;
			tags: string[] | unknown;
		}>;
		// `highlights` rows are loaded for the dashboard but the resume/CV
		// template doesn't render them. Type as unknown[] so we accept whatever
		// shape Drizzle returns without requiring this stale title/description
		// contract.
		highlights: unknown[];
		profile_versions: Array<{
			id: number;
			slug: string | null;
			toggles: string[] | unknown;
			// Drizzle relation rows from `profile_version_extensions` keyed on
			// extender_id. Each junction row has the extended_id (the parent
			// version this version extends).
			extension_links: Array<{
				id: number;
				extended_id: number | null;
				extender_id: number | null;
			}>;
		}>;
	}

	interface Props {
		profile: Profile;
		type?: string | null;
		versionId?: number | null;
		/** Render locale for the template chrome (headings, labels, "Present"). */
		locale?: string | null;
	}

	let { profile, type = null, versionId = null, locale = null }: Props = $props();

	// The profile tree arrives already overlaid with the locale's translations;
	// the chrome around it is localized from the static dictionary.
	const t = (key: TemplateLabelKey) => templateLabel(key, locale);
	const heading = (key: TemplateLabelKey) => t(key).toUpperCase();
	const presentLabel = t('present');

	// Use versionId prop if provided, otherwise fall back to URL query param
	const versionFromUrl: string = page.url.searchParams.get('version') || '';
	const { filterOnTags, toggles } = createProfileFilter(
		profile.profile_versions,
		type,
		versionId,
		versionFromUrl
	);

	const work_experiences = filterOnTags(profile.work_experiences, OVERRIDE_ENTITIES.workExperience);

	// Resolve visible skills per category up front: a category whose skills are
	// all hidden (all profile-only, say) must not print an empty bullet — nor
	// keep the SKILLS heading alive when it's the only category left.
	const skillGroups = filterOnTags(
		profile.tech_skill_categories ?? [],
		OVERRIDE_ENTITIES.skillCategory
	)
		.map((group) => ({
			name: group.name,
			skills: filterOnTags(group.tech_skills ?? [], OVERRIDE_ENTITIES.skill)
		}))
		.filter((group) => group.skills.length > 0);

	// Contact fields show when set and not hidden by a `hide:<key>` version toggle.
	const showContact = (key: string, value: string | null | undefined) =>
		!!value && !isContactHidden(key, toggles);
	const contactVisible = {
		email: showContact('email', profile.email_address),
		phone: showContact('phone', profile.phone_number),
		location: showContact('location', profile.location),
		website: showContact('website', profile.personal_website),
		linkedin: showContact('linkedin', profile.linkedin_profile),
		github: showContact('github', profile.github_profile)
	};
	const anyContact = Object.values(contactVisible).some(Boolean);

	// Share-link preview (LinkedIn, Slack, WhatsApp) is built from these two.
	const headTitle = $derived(resumeDocumentTitle(profile));
	const headDescription = $derived(resumeDocumentDescription(profile));
</script>

<svelte:head>
	<title>{headTitle}</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta name="description" content={headDescription} />
	<meta property="og:title" content={headTitle} />
	<meta property="og:description" content={headDescription} />
</svelte:head>

<article
	class="mx-auto w-[782px] bg-white px-8 py-8 text-xs leading-relaxed text-black print:w-[initial] print:px-0 print:py-0"
>
	<!-- Header Section -->
	<header>
		<h1 class="h-9 text-2xl font-bold">{profile.name}<br /><br /></h1>
		<h2 class="h-5 text-sm">{profile.title}<br /><br /></h2>
		<h2 class="mt-1 h-5 text-xs">{profile.subtitle}<br /><br /></h2>
	</header>

	<!-- Contact Details -->
	{#if anyContact}
		<section class="mt-1 mb-[-15px]">
			<ul class="ml-3 list-disc print:ml-4">
				{#if contactVisible.email}
					<li class="print:indent-[-3px]">
						<ContactItem
							label={t('contactEmail')}
							href={profile.email_address}
							content={profile.email_address}
							type="email"
						/>
					</li>
				{/if}

				{#if contactVisible.phone}
					<li class="print:indent-[-3px]">
						<ContactItem
							label={t('contactPhone')}
							href={profile.phone_number}
							content={profile.phone_number}
							type="phone"
						/>
					</li>
				{/if}

				{#if contactVisible.location}
					<li class="print:indent-[-3px]">
						<ContactItem
							label={t('contactLocation')}
							href={profile.location_url}
							content={profile.location}
						>
							{#if profile.location_timezone}
								({profile.location_timezone})
							{/if}
						</ContactItem>
					</li>
				{/if}

				{#if contactVisible.website}
					<li class="print:indent-[-3px]">
						<ContactItem
							label={t('contactWebsite')}
							href={profile.personal_website}
							content={profile.personal_website}
						/>
					</li>
				{/if}

				{#if contactVisible.linkedin}
					<li class="print:indent-[-3px]">
						<ContactItem
							label="LinkedIn"
							href={profile.linkedin_profile}
							content={profile.linkedin_profile}
						/>
					</li>
				{/if}

				{#if contactVisible.github}
					<li class="print:indent-[-3px]">
						<ContactItem
							label="GitHub"
							href={profile.github_profile}
							content={profile.github_profile}
						/>
					</li>
				{/if}
			</ul>
			<br />
		</section>
	{/if}

	<!-- Summary -->
	{#if profile.summary}
		<section class="my-4">
			<h2 class="text-sm font-bold">{heading('summary')}</h2>

			<hr class="mt-1 mb-2" />

			<p class="mt-1 mb-[-30px] text-xs">{profile.summary}<br /><br /><br /></p>
		</section>
	{/if}

	<!-- Work Experience -->
	{#if work_experiences.length > 0}
		<section class="my-4 mb-[-20px]">
			<h2 class="h-5 text-sm font-bold">{heading('workExperience')}<br /><br /></h2>

			<hr class="mt-1 mb-2" />

			{#each work_experiences as job, index (index)}
				<div class="mb-[-10px]">
					<div class="mb-1 text-xs font-bold">
						{job.name} |
						{job.location} |
						{job.position} |
						{formatDateRangeCompact(job.start_date, job.end_date, presentLabel)}
					</div>

					{#if job.note}
						<p class="text-sm italic"><strong>{t('note')}:</strong> {job.note}</p>
					{/if}

					{#if job.work_experience_achievements && job.work_experience_achievements.length > 0}
						{@const filteredHighlights = filterOnTags(
							job.work_experience_achievements,
							OVERRIDE_ENTITIES.achievement
						)}
						{#if filteredHighlights.length > 0}
							<ul class="ml-3 list-disc print:ml-[18px] print:[&>li]:[text-indent:-6px]">
								{#each filteredHighlights as highlight, index (index)}
									<li>{highlight.description}</li>
								{/each}
							</ul>
						{/if}
					{/if}
					<br />
				</div>
			{/each}
		</section>
	{/if}

	<!-- Skills -->
	{#if skillGroups.length > 0}
		<section class="my-4 mb-[-20px] break-inside-avoid">
			<h2 class="text-sm font-bold">{heading('skills')}</h2>

			<hr class="mt-1 mb-2" />

			<ul class="ml-3 list-disc print:ml-[18px] print:[&>li]:[text-indent:-6px]">
				{#each skillGroups as skillGroup, index (index)}
					<li>
						<span class="mr-1 font-bold">{skillGroup.name}:</span>
						<span class="text-xs">
							{skillGroup.skills.map((s: { name: string | null }) => s.name ?? '').join(' | ')}
						</span>
					</li>
				{/each}
			</ul>
			<br />
		</section>
	{/if}

	<!-- Side Projects -->
	{#if filterOnTags(profile.side_projects, OVERRIDE_ENTITIES.sideProject).length > 0}
		<section class="my-4 break-inside-avoid">
			<h2 class="h-5 text-sm font-bold">{heading('sideProjects')}<br /><br /></h2>

			<hr class="mt-1 mb-2" />

			{#each filterOnTags(profile.side_projects, OVERRIDE_ENTITIES.sideProject) as project, index (index)}
				<div class="mb-3">
					<div class="mb-0 text-xs font-bold">
						{project.name} | {formatDateRangeCompact(
							project.start_date,
							project.end_date,
							presentLabel
						)}
					</div>

					<div>
						<a
							href={project.url}
							target="_blank"
							class="whitespace-nowrap underline hover:text-slate-600"
						>
							{project.url}
						</a>
					</div>

					<div class="mb-[-31px] text-xs">{project.summary}<br /><br /><br /></div>
				</div>
			{/each}
		</section>
	{/if}

	<!-- Education -->
	{#if filterOnTags(profile.educations, OVERRIDE_ENTITIES.education).length > 0}
		<section class="my-3 mb-[-45px] break-inside-avoid">
			<h2 class="h-5 text-sm font-bold">{heading('education')}<br /><br /></h2>

			<hr class="mt-1 mb-2" />

			{#each filterOnTags(profile.educations, OVERRIDE_ENTITIES.education) as education, index (index)}
				<div class="mb-2">
					<div class="font-bold">
						{education.area}, {education.study_type}{#if type === 'cv'},

							{#if education.graduation_year}
								{t('graduationYear')} {education.graduation_year}
							{:else}
								{formatDateRangeCompact(education.start_date, education.end_date, presentLabel)}
							{/if}
						{/if} |
						{education.institution}, {education.location}
					</div>

					<div>
						{education.summary}
					</div>
				</div>
			{/each}
			<br /><br />
		</section>
	{/if}

	{#if profile.certificates && profile.certificates.length > 0}
		<!-- Certificates -->
		<section class="my-3 break-inside-avoid">
			<h2 class="h-5 text-sm font-bold">{heading('certificates')}<br /><br /></h2>

			<hr class="mt-1 mb-2" />

			{#each profile.certificates as cert, index (index)}
				<div>
					<span class="font-bold">{cert.name}</span>{#if cert.issuer}
						— {cert.issuer}{/if}{#if cert.date}, {new Date(cert.date).getFullYear()}{/if}
				</div>
			{/each}
		</section>
	{/if}

	<!-- Languages -->
	{#if profile.languages && profile.languages.length > 0}
		<section class="my-3 break-inside-avoid">
			<h2 class="h-5 text-sm font-bold">{heading('languages')}<br /><br /></h2>

			<hr class="mt-1 mb-2" />

			{#each profile.languages as language, index (index)}
				<div>
					{language.name}: {proficiencyLabel(language.proficiency, locale)}
				</div>
			{/each}
		</section>
	{/if}

	{#if toggles.includes('nationality')}
		<!-- Nationality -->
		<section class="my-3 break-inside-avoid">
			<h2 class="text-sm font-bold">{heading('nationality')}</h2>

			<hr class="mt-1 mb-2" />

			<div>
				{profile.nationality}
			</div>
		</section>
	{/if}

	{#if type === 'cv' && profile.references && profile.references.length > 0}
		<section class="mb-6">
			<h2 class="text-sm font-bold">{heading('references')}</h2>

			<hr class="mt-1 mb-2" />

			{#each profile.references as reference, index (index)}
				<div class="mb-2">
					<h3 class="font-bold">{reference.author}</h3>
					<p class="italic">"{reference.text}"</p>
				</div>
			{/each}
			<p class="mt-2 font-semibold">{t('referencesOnRequest')}</p>
		</section>
	{/if}
</article>
