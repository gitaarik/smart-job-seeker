<script lang="ts">
	/**
	 * The `showcase` portfolio layout: the standalone portfolio site's design,
	 * fed by the profile instead of a hand-written data file.
	 *
	 * Ported from that site's home page (a full-height header, the About me
	 * with the photo beside it, a band of quotes, a dark footer) and its
	 * `/portfolio` page (the career as cards), as one page. The markup and its
	 * spacing are kept close to the original on purpose: visual parity with it
	 * is the target, and a port that drifts cannot be compared against it. See
	 * planning/PORTFOLIO-SHOWCASE-LAYOUT.md in sjs-ops.
	 *
	 * No branding lives here. Colours come from the theme's palette as CSS
	 * custom properties (`paletteStyle`), images from its asset slots, and any
	 * wording the layout's own headings do not suit from its `titles`. Every
	 * one of those is a value; the theme never supplies markup.
	 *
	 * Contact details are not in `profile` at all. The load strips them and the
	 * "Get in touch" button fetches them past a Turnstile check; see
	 * server/profile/portfolio-contact.ts.
	 */
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faBook,
		faBuilding,
		faBullseye,
		faCalendarAlt,
		faCertificate,
		faCircleCheck,
		faCircleChevronDown,
		faCode,
		faCompass,
		faExternalLinkAlt,
		faGlobe,
		faGraduationCap,
		faLanguage,
		faLink,
		faLaptopCode,
		faMapMarkerAlt,
		faStar,
		faUserTie
	} from '@fortawesome/free-solid-svg-icons';
	import {
		faGithub,
		faLinkedin,
		faNpm,
		faPython,
		faStackOverflow
	} from '@fortawesome/free-brands-svg-icons';
	import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
	import {
		paletteStyle,
		themeSections,
		type PortfolioSection,
		type PortfolioTheme
	} from '$lib/portfolio-themes';
	import { assetUrl } from '$lib/presentation-templates';
	import { formatDateRangeVerbose } from '$lib/tools/date-utils';
	import { getProfilePhotoUrl } from '$lib/utils/profile-photo-url';
	import { getEducationLogoUrl, getWorkExperienceLogoUrl } from '$lib/utils/entity-media-url';
	import type { PortfolioContactGate } from '$lib/server/profile/portfolio-contact';
	import { siteLists, type Row } from '../site-lists';
	import { iconFor } from './icons';
	import Card from './Card.svelte';
	import InfoBoxes from './InfoBoxes.svelte';
	import TechTags from './TechTags.svelte';
	import ContactButton from './ContactButton.svelte';
	import SchemeSwitcher from './SchemeSwitcher.svelte';
	import { ContactState } from './contact-state.svelte';
	import { loadSchemePreference, saveSchemePreference, type SchemePreference } from './scheme';
	import 'aos/dist/aos.css';

	interface Props {
		// The profile tree, loose for the reason PortfolioSite gives.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		profile: any;
		theme: PortfolioTheme;
		versionId?: number | null;
		/** Null when the page carries the details itself, which a showcase never does. */
		contact: PortfolioContactGate | null;
		/** A share link's token, which the contact endpoint asks for. */
		accessToken?: string | null;
	}

	let { profile, theme, versionId = null, contact, accessToken = null }: Props = $props();

	const config = $derived(theme.config);
	const sections = $derived(themeSections(config));
	const headingFont = $derived(config.fonts?.heading ?? 'Noto Sans');
	const bodyFont = $derived(config.fonts?.body ?? 'Noto Sans');

	const lists = $derived(siteLists(profile, versionId));
	const show = $derived(lists.show);

	// One kind of row, three uses: `highlight` rows are the career card, and the
	// two box lists beside the About me are their own types.
	const highlights = $derived(lists.highlights.filter((h) => !h.type || h.type === 'highlight'));
	const keySkills = $derived(lists.highlights.filter((h) => h.type === 'key_skill'));
	const contactFor = $derived(lists.highlights.filter((h) => h.type === 'contact_for'));

	const aboutParagraphs = $derived(
		String(profile.about_me_text ?? '')
			.split(/\n\s*\n/)
			.map((p) => p.trim())
			.filter(Boolean)
	);

	const photo = $derived(assetUrl(config.assets?.photo) ?? getProfilePhotoUrl(profile));
	const logo = $derived(assetUrl(config.assets?.logo));
	const ogImage = $derived(assetUrl(config.assets?.ogImage) ?? profile.meta_image_url ?? null);

	const DEFAULT_TITLES: Record<PortfolioSection, string> = {
		header: '',
		summary: 'Summary',
		highlights: 'Highlights',
		work: 'Professional Experience',
		projects: 'Projects',
		sideProjects: 'Side Projects',
		skills: 'Skills',
		education: 'Education',
		certificates: 'Certificates',
		languages: 'Languages',
		references: 'What People Say',
		about: 'About me'
	};

	function title(section: PortfolioSection): string {
		return config.titles?.[section]?.trim() || DEFAULT_TITLES[section];
	}

	function hasContent(section: PortfolioSection): boolean {
		switch (section) {
			case 'header':
				return true;
			case 'about':
				return aboutParagraphs.length > 0 || keySkills.length > 0 || contactFor.length > 0;
			case 'references':
				return lists.references.length > 0;
			case 'summary':
				return !!profile.summary;
			case 'highlights':
				return highlights.length > 0;
			case 'work':
				return lists.work.length > 0;
			case 'projects':
				return lists.roleProjects.length > 0;
			case 'sideProjects':
				return lists.sideProjects.length > 0;
			case 'skills':
				return lists.skillCategories.length > 0;
			case 'education':
				return lists.educations.length > 0;
			case 'certificates':
				return lists.certificates.length > 0;
			case 'languages':
				return lists.languages.length > 0;
			default:
				return false;
		}
	}

	/** Full-width sections; everything else is a card in the column between them. */
	const BANDS: ReadonlySet<PortfolioSection> = new Set(['header', 'about', 'references']);

	type Block =
		{ kind: 'band'; section: PortfolioSection } | { kind: 'cards'; sections: PortfolioSection[] };

	// Consecutive cards share one column, so a theme that puts the quotes band
	// between two careers gets two columns rather than a band inside one.
	const blocks = $derived.by(() => {
		const out: Block[] = [];
		for (const section of sections.filter(hasContent)) {
			const last = out[out.length - 1];
			if (BANDS.has(section)) out.push({ kind: 'band', section });
			else if (last?.kind === 'cards') last.sections.push(section);
			else out.push({ kind: 'cards', sections: [section] });
		}
		return out;
	});

	// --- Scheme -----------------------------------------------------------

	let chosen = $state<SchemePreference | null>(null);
	let system = $state<'light' | 'dark'>('light');
	const preference = $derived<SchemePreference>(chosen ?? config.colorScheme ?? 'auto');
	const actual = $derived(preference === 'auto' ? system : preference);

	function setScheme(next: SchemePreference) {
		chosen = next;
		saveSchemePreference(next);
	}

	// --- Contact ----------------------------------------------------------

	const contactState = $derived(
		contact?.available
			? new ContactState(`/p/${profile.slug}/portfolio/contact`, contact.siteKey, accessToken)
			: null
	);

	// --- Animations and the "More info" button ---------------------------

	const aos = $derived<Record<string, string>>(config.animations ? { 'data-aos': 'fade' } : {});

	let moreInfo: HTMLElement | undefined = $state();
	let afterHeader: HTMLElement | undefined = $state();

	function scrollPastHeader(e: MouseEvent) {
		afterHeader?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		(e.currentTarget as HTMLElement).blur();
	}

	/** The button fades out as it rises past the middle of the screen. */
	function fadeMoreInfo() {
		if (!moreInfo) return;
		const half = window.innerHeight / 2;
		const opacity = 0.7 - (half - moreInfo.getBoundingClientRect().top) / half;
		moreInfo.style.opacity = `${Math.max(0, Math.min(1, opacity))}`;
	}

	onMount(() => {
		if (config.schemeSwitcher) chosen = loadSchemePreference();

		const media = window.matchMedia('(prefers-color-scheme: dark)');
		system = media.matches ? 'dark' : 'light';
		const onSystem = (e: MediaQueryListEvent) => (system = e.matches ? 'dark' : 'light');
		media.addEventListener('change', onSystem);

		if (config.animations) {
			void import('aos').then(({ default: AOS }) =>
				AOS.init({ duration: 800, easing: 'ease-out', once: true, offset: 120 })
			);
		}

		addEventListener('scroll', fadeMoreInfo, { passive: true });
		return () => {
			media.removeEventListener('change', onSystem);
			removeEventListener('scroll', fadeMoreInfo);
		};
	});

	// --- Small formatters -------------------------------------------------

	/**
	 * A link the profile or theme holds, if it is a web link. These are typed
	 * in by the owner and rendered as `href` on a public page, where a
	 * `javascript:` URL would run on this app's origin for every visitor.
	 */
	const web = (url: unknown): string | null =>
		typeof url === 'string' && /^https?:\/\//i.test(url.trim()) ? url.trim() : null;

	const bare = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

	/** A side project's link label: `owner/repo` for GitHub, the bare host and path otherwise. */
	function projectLink(url: string): { isGithub: boolean; label: string } {
		const isGithub = url.includes('github.com');
		let label = bare(url);
		if (isGithub && !/^.*\.github\.com/.test(label)) label = label.replace('github.com/', '');
		return { isGithub, label };
	}

	const footerLinks = $derived(
		(
			[
				[profile.linkedin_profile, faLinkedin, 'LinkedIn'],
				[profile.github_profile, faGithub, 'GitHub'],
				[profile.pypi_profile, faPython, 'PyPI'],
				[profile.npm_profile, faNpm, 'npm'],
				[profile.stackoverflow_profile, faStackOverflow, 'Stack Overflow'],
				[profile.personal_website, faGlobe, 'Website']
			] as [string | null, IconDefinition, string][]
		)
			.map(([href, icon, label]) => [web(href), icon, label] as const)
			.filter((link): link is readonly [string, IconDefinition, string] => !!link[0])
	);

	const year = new Date().getFullYear();
	const metaTitle = $derived([profile.name, profile.title].filter(Boolean).join(' - '));
	const metaDescription = $derived(profile.headline ?? profile.summary ?? '');

	const aboutBoxes = $derived(
		[
			{ label: 'Key skills:', rows: keySkills },
			{ label: 'Contact for:', rows: contactFor }
		].filter((box) => box.rows.length > 0)
	);

	const boxItems = (rows: Row[]) =>
		rows.map((r) => ({ key: r.id, description: r.text, icon: iconFor(r.icon_name || r.fa_icon) }));
</script>

<svelte:head>
	<title>{metaTitle || 'Portfolio'}</title>
	{#if metaDescription}
		<meta name="description" content={metaDescription} />
		<meta property="og:description" content={metaDescription} />
	{/if}
	<meta property="og:type" content="website" />
	<meta property="og:url" content={page.url.href} />
	<meta property="og:title" content={metaTitle} />
	{#if ogImage}
		<meta property="og:image" content={ogImage} />
		<meta name="twitter:card" content="summary_large_image" />
	{/if}
	{#if config.assets?.favicon}
		<link rel="icon" href={assetUrl(config.assets.favicon)} />
	{/if}
</svelte:head>

<div
	class="showcase"
	data-scheme={preference}
	style={paletteStyle(config)}
	style:--pf-heading-font={headingFont}
	style:--pf-body-font={bodyFont}
>
	{#if config.schemeSwitcher}
		<SchemeSwitcher {preference} {system} onchange={setScheme} />
	{/if}

	<main class="flex h-full min-h-screen flex-col justify-between">
		<article class="flex flex-col items-center">
			{#each blocks as block, b (b)}
				{#if block.kind === 'band' && block.section === 'header'}
					<header
						class="flex min-h-screen w-full flex-col items-center bg-(--pf-surface) pt-10 transition-colors min-[50rem]:pt-25"
						aria-labelledby="pf-name"
					>
						{#if logo}
							<div {...aos} class="px-5 min-[40rem]:px-10">
								{#if config.logoTint}
									<div
										class="logo-tint h-45 w-45"
										style:--pf-logo="url({logo})"
										role="img"
										aria-label={profile.name}
									></div>
								{:else}
									<img src={logo} alt={profile.name} class="h-45 w-45 object-contain" />
								{/if}
							</div>
						{/if}

						<div class="mt-5 px-5 text-center min-[40rem]:px-10">
							<div {...aos}>
								<h1 id="pf-name" class="text-3xl font-medium">{profile.name}</h1>
								{#if profile.title}<h2 class="mt-4 text-xl">{profile.title}</h2>{/if}
								{#if profile.subtitle}<h3 class="mt-4">{profile.subtitle}</h3>{/if}
							</div>
							{#if profile.headline}
								<h4 {...aos} class="mt-10 italic">{profile.headline}</h4>
							{/if}
						</div>

						{#if contactState}
							<div {...aos} class="mt-15 flex w-full justify-center px-4 min-[50rem]:mt-20">
								<ContactButton
									state={contactState}
									intro={config.contactIntro}
									panelClass="bg-(--pf-surface-raised)"
									scheme={actual}
								/>
							</div>
						{/if}

						<div class="flex-grow"></div>

						{#if blocks.length > 1}
							<div bind:this={moreInfo} class="mt-14 mb-15">
								<button
									type="button"
									class="flex scale-100 cursor-pointer items-center gap-2 p-2 transition hover:scale-110 hover:text-(--pf-highlight) focus:scale-110 focus:text-(--pf-highlight)"
									onclick={scrollPastHeader}
								>
									<FontAwesomeIcon icon={faCircleChevronDown} class="w-4" />
									<span class="text-md font-semibold">More Info</span>
								</button>
							</div>
						{/if}
					</header>
					<div bind:this={afterHeader} class="w-full"></div>
				{:else if block.kind === 'band' && block.section === 'about'}
					<section
						class="min-h-screen w-full bg-(--pf-shade) transition-colors"
						aria-labelledby="pf-about"
					>
						<div class="flex flex-col items-center px-5 min-[40rem]:px-10">
							<div class="max-w-[885px] overflow-hidden pt-10 min-[50rem]:pt-15">
								<h3
									{...aos}
									id="pf-about"
									class="mb-8 text-center text-3xl font-semibold capitalize min-[50rem]:mb-10"
								>
									{title('about')}
								</h3>

								{#if aboutParagraphs.length}
									<div
										{...aos}
										class="mb-15 flex justify-center gap-10 max-[50rem]:flex-col max-[50rem]:items-center"
									>
										<div class="text-base/7 tracking-[0.1px]">
											{#if photo}
												<div
													class="float-right w-full max-w-[200px] pb-3 pl-3 max-[30rem]:hidden min-[60rem]:max-w-[265px] min-[60rem]:pb-4 min-[60rem]:pl-4"
												>
													<img src={photo} alt={profile.name} class="w-full" />
												</div>
											{/if}
											{#each aboutParagraphs as paragraph, i (i)}
												<p class:mt-4={i > 0} class="whitespace-pre-line">{paragraph}</p>
												{#if i === 0 && photo}
													<div class="mt-4 flex justify-center min-[30rem]:hidden">
														<img src={photo} alt="" aria-hidden="true" class="w-[200px]" />
													</div>
												{/if}
											{/each}
										</div>
									</div>
								{/if}
							</div>
						</div>

						{#if keySkills.length || contactFor.length || contactState}
							<div class="flex flex-col items-center px-5 min-[40rem]:px-10">
								<div class="max-w-[885px] pb-15">
									{#if keySkills.length || contactFor.length}
										<div
											{...aos}
											class="mb-15 flex w-full flex-col items-center justify-evenly gap-6 min-[50rem]:flex-row"
										>
											{#each aboutBoxes as { label, rows } (label)}
												<div
													class="w-full overflow-hidden rounded-lg border-2 border-(--pf-bright) bg-(--pf-surface) transition-colors min-[20rem]:max-w-[340px] min-[40rem]:min-w-[340px]"
												>
													<h3
														class="bg-(--pf-bright) px-4 py-2 font-medium text-(--pf-text-on-dark) transition-colors"
													>
														{label}
													</h3>
													<ul class="space-y-4 p-4 font-bold min-[40rem]:space-y-5 min-[40rem]:p-5">
														{#each boxItems(rows) as item (item.key)}
															<li class="flex items-center gap-3">
																{#if item.icon}
																	<FontAwesomeIcon
																		icon={item.icon}
																		class="w-4 text-(--pf-highlight)"
																	/>
																{/if}
																{item.description}
															</li>
														{/each}
													</ul>
												</div>
											{/each}
										</div>
									{/if}

									{#if contactState}
										<div {...aos} class="flex justify-center">
											<ContactButton
												state={contactState}
												intro={config.contactIntro}
												panelClass="bg-(--pf-surface)"
												scheme={actual}
											/>
										</div>
									{/if}
								</div>
							</div>
						{/if}
					</section>
				{:else if block.kind === 'band' && block.section === 'references'}
					<section
						class="w-full bg-(--pf-dark-band) text-(--pf-text-on-dark) transition-colors"
						aria-labelledby="pf-references"
					>
						<div class="flex justify-center px-5 pt-20 pb-10 min-[40rem]:px-10">
							<div class="max-w-[600px]">
								<h3
									{...aos}
									id="pf-references"
									class="mb-8 text-center text-3xl font-semibold capitalize min-[50rem]:mb-10"
								>
									{title('references')}
								</h3>
								{#each lists.references as r (r.id)}
									<div {...aos}>
										<blockquote class="py-15 min-[40rem]:text-lg">
											<p class="leading-6 tracking-[0.5px] italic min-[40rem]:leading-8">
												“{r.text}”
											</p>
											<p class="mt-4 text-right font-semibold">
												{[r.author, r.author_position].filter(Boolean).join(' - ')}
											</p>
										</blockquote>
									</div>
								{/each}
							</div>
						</div>
					</section>
				{:else if block.kind === 'cards'}
					<div class="w-full bg-(--pf-shade) transition-colors print:bg-transparent">
						<div
							class="mx-auto flex max-w-[800px] flex-col gap-10 px-4 py-10 print:gap-7 print:p-0"
						>
							{#each block.sections as section (section)}
								{#if section === 'summary'}
									<Card title={title('summary')} icon={faCompass} {aos}>
										<p class="mb-4 leading-relaxed whitespace-pre-line">{profile.summary}</p>
									</Card>
								{:else if section === 'highlights'}
									<Card title={title('highlights')} icon={faStar} {aos}>
										<ul class="ml-1 space-y-4 print:space-y-2">
											{#each highlights as h (h.id)}
												{@const icon = iconFor(h.fa_icon || h.icon_name)}
												<li class="flex items-start">
													{#if icon}
														<FontAwesomeIcon {icon} class="mt-1 mr-3 h-4 w-4 flex-shrink-0" />
													{/if}
													<span>{h.text}</span>
												</li>
											{/each}
										</ul>
									</Card>
								{:else if section === 'skills'}
									<Card title={title('skills')} icon={faCode} {aos}>
										<InfoBoxes
											items={lists.skillCategories.map((c) => ({
												key: c.id,
												title: c.name,
												description: c.tech_skills.map((s: Row) => s.name).join(', '),
												icon: iconFor(c.fa_icon)
											}))}
										/>
									</Card>
								{:else if section === 'work'}
									<Card title={title('work')} icon={faGlobe} {aos}>
										{#each lists.work as role, i (role.id)}
											{@const achievements = show(role.work_experience_achievements, 'achievement')}
											{@const technologies = show(role.work_experience_technologies, 'technology')}
											{@const roleLogo = getWorkExperienceLogoUrl(role)}
											{@const roleSite = web(role.website)}
											<section class="break-inside-avoid" class:mt-12={i === 0}>
												<header class="mb-6 print:mb-4">
													<div class="flex items-start justify-between">
														<div class="flex-1">
															<h3 class="mb-2 text-2xl font-semibold text-(--pf-bright)">
																{role.name}
															</h3>
															<div
																class="grid grid-cols-1 gap-4 text-sm min-[50rem]:grid-cols-[max-content_1fr] min-[50rem]:gap-6"
															>
																<div class="space-y-2">
																	{#if role.position}
																		<div class="flex items-center">
																			<FontAwesomeIcon
																				icon={faUserTie}
																				class="mr-2 h-3 w-3 flex-shrink-0"
																			/>
																			<span>{role.position}</span>
																		</div>
																	{/if}
																	{#if role.description}
																		<div class="flex items-center">
																			<FontAwesomeIcon
																				icon={faBuilding}
																				class="mr-2 h-3 w-3 flex-shrink-0"
																			/>
																			<span>{role.description}</span>
																		</div>
																	{/if}
																	{#if roleSite}
																		<div class="flex items-center">
																			<FontAwesomeIcon
																				icon={faLink}
																				class="mr-2 h-3 w-3 flex-shrink-0"
																			/>
																			<!-- eslint-disable svelte/no-navigation-without-resolve -- a link the applicant typed into their profile -->
																			<a
																				href={roleSite}
																				target="_blank"
																				rel="noopener"
																				class="text-(--pf-bright) hover:text-(--pf-highlight)"
																				>{bare(roleSite)}</a
																			>
																			<!-- eslint-enable svelte/no-navigation-without-resolve -->
																		</div>
																	{/if}
																</div>
																<div class="space-y-2">
																	<div class="flex items-center">
																		<FontAwesomeIcon
																			icon={faCalendarAlt}
																			class="mr-2 h-3 w-3 flex-shrink-0"
																		/>
																		<span
																			>{formatDateRangeVerbose(
																				role.start_date,
																				role.end_date
																			)}</span
																		>
																	</div>
																	{#if role.location}
																		<div class="flex items-center">
																			<FontAwesomeIcon
																				icon={faMapMarkerAlt}
																				class="mr-2 h-3 w-3 flex-shrink-0"
																			/>
																			<span>{role.location}</span>
																		</div>
																	{/if}
																</div>
															</div>
														</div>
														{#if roleLogo}
															<div class="ml-4 flex-shrink-0">
																<img
																	src={roleLogo}
																	alt="{role.name} logo"
																	class="h-22 w-auto rounded border border-(--pf-bright-hover)"
																/>
															</div>
														{/if}
													</div>
												</header>

												<div class="space-y-4">
													{#if role.summary}
														<p class="leading-relaxed whitespace-pre-line print:text-sm">
															{role.summary}
														</p>
													{/if}
													{#if achievements.length}
														<div>
															<h4 class="mb-3 text-lg font-semibold print:mb-2 print:text-base">
																Key Achievements:
															</h4>
															<InfoBoxes
																items={achievements.map((a) => ({
																	key: a.id,
																	description: a.description,
																	icon: iconFor(a.fa_icon)
																}))}
															/>
														</div>
													{/if}
													<TechTags names={technologies.map((t) => t.name)} />
												</div>
											</section>
											{#if i < lists.work.length - 1}
												<hr class="my-12 border-(--pf-line)" />
											{/if}
										{/each}
									</Card>
								{:else if section === 'projects'}
									<Card title={title('projects')} icon={faLaptopCode} {aos}>
										<div class="space-y-6">
											{#each lists.roleProjects as p (p.id)}
												{@const technologies = show(p.work_experience_project_technologies)}
												{@const projectUrl = web(p.url)}
												<div
													class="rounded-lg border border-(--pf-bright)/20 bg-(--pf-surface) p-4 min-[40rem]:p-6"
												>
													<div class="mb-6">
														{#if p.company}
															<div class="mb-3 flex items-center text-xs opacity-60">
																<span>{title('work')}</span>
																<span class="mx-2">›</span>
																<span>{p.company}</span>
																<span class="mx-2">›</span>
																<span class="font-medium text-(--pf-highlight)">{p.name}</span>
															</div>
														{/if}
														<div
															class="mb-3 flex flex-col min-[40rem]:flex-row min-[40rem]:items-center min-[40rem]:justify-between"
														>
															<h3 class="text-xl font-bold">
																{#if projectUrl}
																	<!-- eslint-disable svelte/no-navigation-without-resolve -- a link the applicant typed into their profile -->
																	<a
																		href={projectUrl}
																		target="_blank"
																		rel="noopener"
																		class="hover:text-(--pf-highlight)">{p.name}</a
																	>
																	<!-- eslint-enable svelte/no-navigation-without-resolve -->
																{:else}
																	{p.name}
																{/if}
															</h3>
															{#if p.start_date || p.end_date}
																<div
																	class="mt-1 flex items-center text-sm text-(--pf-highlight) min-[40rem]:mt-0"
																>
																	<FontAwesomeIcon icon={faCalendarAlt} class="mr-1 h-3 w-3" />
																	<span>{formatDateRangeVerbose(p.start_date, p.end_date)}</span>
																</div>
															{/if}
														</div>
													</div>

													<div class="space-y-6">
														{#if p.description}
															<div>
																<h4 class="mb-3 flex items-center text-lg font-semibold">
																	<FontAwesomeIcon
																		icon={faBullseye}
																		class="mr-2 h-4 w-4 text-(--pf-bright)"
																	/>
																	Project Details
																</h4>
																<p class="leading-relaxed whitespace-pre-line">{p.description}</p>
															</div>
														{/if}
														{#if p.outcome}
															<div>
																<h4 class="mb-3 flex items-center text-lg font-semibold">
																	<FontAwesomeIcon
																		icon={faCircleCheck}
																		class="mr-2 h-4 w-4 text-emerald-500"
																	/>
																	Outcome & Impact
																</h4>
																<p class="leading-relaxed whitespace-pre-line">{p.outcome}</p>
															</div>
														{/if}
														<TechTags names={technologies.map((t) => t.name)} />
													</div>
												</div>
											{/each}
										</div>
									</Card>
								{:else if section === 'education'}
									<Card title={title('education')} icon={faGraduationCap} {aos}>
										{#each lists.educations as edu, i (edu.id)}
											{@const eduLogo = getEducationLogoUrl(edu)}
											{@const eduUrl = web(edu.url)}
											<div class="break-inside-avoid" class:mt-12={i === 0}>
												<header class="mb-6 print:mb-4">
													<div class="flex items-start justify-between">
														<div class="flex-1">
															<h3 class="mb-1 text-2xl font-semibold text-(--pf-bright)">
																{edu.institution}
															</h3>
															<ul
																class="inline-grid list-none grid-cols-2 gap-x-8 gap-y-2 p-0 text-sm"
															>
																{#if edu.area}
																	<li class="flex items-center">
																		<FontAwesomeIcon
																			icon={faBook}
																			class="mr-1 h-3 w-3 flex-shrink-0"
																		/>
																		<span>{edu.area}</span>
																	</li>
																{/if}
																{#if edu.graduation_year}
																	<li class="flex items-center">
																		<FontAwesomeIcon
																			icon={faGraduationCap}
																			class="mr-1 h-3 w-3 flex-shrink-0"
																		/>
																		<span>Graduated in {edu.graduation_year}</span>
																	</li>
																{/if}
																{#if edu.location}
																	<li class="flex items-center">
																		<FontAwesomeIcon
																			icon={faMapMarkerAlt}
																			class="mr-1 h-3 w-3 flex-shrink-0"
																		/>
																		<span>{edu.location}</span>
																	</li>
																{/if}
																{#if edu.start_date || edu.end_date}
																	<li class="flex items-center">
																		<FontAwesomeIcon
																			icon={faCalendarAlt}
																			class="mr-1 h-3 w-3 flex-shrink-0"
																		/>
																		<span
																			>{formatDateRangeVerbose(edu.start_date, edu.end_date)}</span
																		>
																	</li>
																{/if}
																{#if edu.study_type}
																	<li class="flex items-center">
																		<FontAwesomeIcon
																			icon={faBuilding}
																			class="mr-1 h-3 w-3 flex-shrink-0"
																		/>
																		<span>{edu.study_type}</span>
																	</li>
																{/if}
																{#if eduUrl}
																	<li class="flex items-center">
																		<FontAwesomeIcon
																			icon={faLink}
																			class="mr-1 h-3 w-3 flex-shrink-0"
																		/>
																		<!-- eslint-disable svelte/no-navigation-without-resolve -- a link the applicant typed into their profile -->
																		<a
																			href={eduUrl}
																			target="_blank"
																			rel="noopener"
																			class="text-(--pf-bright) hover:text-(--pf-highlight)"
																			>{bare(eduUrl)}</a
																		>
																		<!-- eslint-enable svelte/no-navigation-without-resolve -->
																	</li>
																{/if}
															</ul>
														</div>
														{#if eduLogo}
															<div class="ml-4 flex-shrink-0">
																<img
																	src={eduLogo}
																	alt="{edu.institution} logo"
																	class="h-22 w-auto rounded border border-(--pf-bright-hover)"
																/>
															</div>
														{/if}
													</div>
												</header>
												{#if edu.summary}
													<p class="leading-relaxed whitespace-pre-line print:text-sm">
														{edu.summary}
													</p>
												{/if}
											</div>
											{#if i < lists.educations.length - 1}
												<hr class="my-12 border-(--pf-line)" />
											{/if}
										{/each}
									</Card>
								{:else if section === 'sideProjects'}
									<Card title={title('sideProjects')} icon={faCode} {aos}>
										{#each lists.sideProjects as p, i (p.id)}
											{@const technologies = show(p.side_project_technologies)}
											{@const link = web(p.url) ?? web(p.repo_url)}
											<div class="break-inside-avoid" class:mt-10={i === 0}>
												<header class="mb-4">
													<h3 class="text-2xl font-semibold text-(--pf-bright)">{p.name}</h3>
												</header>
												{#if p.summary}
													<p class="leading-relaxed whitespace-pre-line print:text-sm">
														{p.summary}
													</p>
												{/if}
												{#if link}
													{@const { isGithub, label } = projectLink(link)}
													<div class="mt-6 flex justify-start">
														<!-- eslint-disable svelte/no-navigation-without-resolve -- a link the applicant typed into their profile -->
														<a
															href={link}
															target="_blank"
															rel="noopener"
															class="inline-flex items-center gap-2 rounded-lg bg-(--pf-bright) px-5 py-3 text-white transition-all hover:bg-(--pf-bright)/85"
														>
															<FontAwesomeIcon
																icon={isGithub ? faGithub : faExternalLinkAlt}
																size="lg"
															/>
															<span class="font-medium">{label}</span>
															{#if p.stars && isGithub}
																<span
																	class="ml-2 flex items-center gap-1 border-l border-white/30 pl-2"
																>
																	<FontAwesomeIcon icon={faStar} class="text-yellow-500" />
																	<span>{p.stars}</span>
																</span>
															{/if}
														</a>
														<!-- eslint-enable svelte/no-navigation-without-resolve -->
													</div>
												{/if}
												{#if p.side_project_achievements?.length}
													<h4 class="mt-6 mb-3 text-lg font-semibold">Highlights:</h4>
													<InfoBoxes
														items={p.side_project_achievements.map((a: Row) => ({
															key: a.id,
															description: a.description
														}))}
													/>
												{/if}
												{#if technologies.length}
													<div class="mt-4">
														<TechTags names={technologies.map((t) => t.name)} />
													</div>
												{/if}
											</div>
											{#if i < lists.sideProjects.length - 1}
												<hr class="my-12 border-(--pf-line)" />
											{/if}
										{/each}
									</Card>
								{:else if section === 'certificates'}
									<Card title={title('certificates')} icon={faCertificate} {aos}>
										<ul class="space-y-3">
											{#each lists.certificates as c (c.id)}
												{@const certUrl = web(c.url)}
												<li>
													<span class="font-semibold">
														{#if certUrl}
															<!-- eslint-disable svelte/no-navigation-without-resolve -- a link the applicant typed into their profile -->
															<a
																href={certUrl}
																target="_blank"
																rel="noopener"
																class="text-(--pf-bright) hover:text-(--pf-highlight)">{c.name}</a
															>
															<!-- eslint-enable svelte/no-navigation-without-resolve -->
														{:else}
															{c.name}
														{/if}
													</span>
													{#if c.issuer}<span class="text-sm"> · {c.issuer}</span>{/if}
												</li>
											{/each}
										</ul>
									</Card>
								{:else if section === 'languages'}
									<Card title={title('languages')} icon={faLanguage} {aos}>
										<ul class="grid grid-cols-2 gap-4">
											{#each lists.languages as l (l.id)}
												<li>
													<span class="font-semibold">{l.name}</span>{#if l.proficiency}: {l.proficiency}{/if}
												</li>
											{/each}
										</ul>
									</Card>
								{/if}
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</article>

		<footer
			class="flex w-full flex-col items-center gap-2 bg-(--pf-footer) px-5 pt-15 text-(--pf-text-on-dark) transition-colors min-[40rem]:px-10"
			aria-labelledby="pf-footer"
		>
			<div {...aos} class="flex w-full max-w-[885px] flex-col">
				<h4 class="mb-2 text-lg font-semibold" id="pf-footer">{profile.name}</h4>
				<div class="flex w-full justify-between max-[350px]:flex-col max-[350px]:gap-4">
					<div class="text-sm/6">
						{#if profile.title}<div>{profile.title}</div>{/if}
						{#if profile.location}<div>{profile.location}</div>{/if}
					</div>
					{#if footerLinks.length}
						<ul class="flex flex-col gap-2 text-right text-sm max-[350px]:self-end">
							{#each footerLinks as [href, icon, label] (label)}
								<li>
									<!-- eslint-disable svelte/no-navigation-without-resolve -- a profile URL the applicant typed in -->
									<a
										{href}
										target="_blank"
										rel="me noopener"
										title={label}
										class="flex items-center justify-end gap-2 text-nowrap transition hover:text-white hover:underline focus:text-(--pf-bright-hover)"
									>
										<FontAwesomeIcon {icon} class="w-3" />
										<span>{label}</span>
									</a>
									<!-- eslint-enable svelte/no-navigation-without-resolve -->
								</li>
							{/each}
						</ul>
					{/if}
				</div>

				<div
					class="mt-8 mb-4 flex w-full text-xs opacity-70 max-[420px]:flex-col min-[420px]:justify-between"
				>
					<div>Copyright © {year} {profile.name}</div>
					{#if config.footerNote}
						<div class="max-[420px]:mt-2">
							{#if web(config.footerNoteUrl)}
								<!-- eslint-disable svelte/no-navigation-without-resolve -- a URL the theme's owner typed in -->
								<a class="underline" href={web(config.footerNoteUrl)} target="_blank" rel="noopener"
									>{config.footerNote}</a
								>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{:else}
								{config.footerNote}
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</footer>
	</main>
</div>

<style>
	/*
	 * The palette arrives as `--pf-light-*` and `--pf-dark-*` on the root's
	 * inline style (see `paletteStyle`). These rules pick one set onto the
	 * names the markup uses: light by default, dark when the visitor or the
	 * theme chose it, and dark under "auto" when the system asks for it. The
	 * last is a media query, so it is right before any script has run.
	 */
	.showcase {
		--pf-text: var(--pf-light-text);
		--pf-text-on-dark: var(--pf-light-text-on-dark);
		--pf-highlight: var(--pf-light-highlight);
		--pf-shade: var(--pf-light-shade);
		--pf-line: var(--pf-light-line);
		--pf-surface: var(--pf-light-surface);
		--pf-surface-raised: var(--pf-light-surface-raised);
		--pf-bright: var(--pf-light-bright);
		--pf-bright-hover: var(--pf-light-bright-hover);
		--pf-dark-band: var(--pf-light-dark-band);
		--pf-footer: var(--pf-light-footer);
		--pf-error: #9a0909;
		--pf-glass-light: rgba(255, 255, 255, 0.3);
		--pf-glass: rgba(255, 255, 255, 0.5);

		color-scheme: light;
		background: var(--pf-shade);
		color: var(--pf-text);
		font-family: var(--pf-body-font), 'Noto Sans', sans-serif;
		min-height: 100vh;
	}

	.showcase[data-scheme='dark'] {
		--pf-text: var(--pf-dark-text);
		--pf-text-on-dark: var(--pf-dark-text-on-dark);
		--pf-highlight: var(--pf-dark-highlight);
		--pf-shade: var(--pf-dark-shade);
		--pf-line: var(--pf-dark-line);
		--pf-surface: var(--pf-dark-surface);
		--pf-surface-raised: var(--pf-dark-surface-raised);
		--pf-bright: var(--pf-dark-bright);
		--pf-bright-hover: var(--pf-dark-bright-hover);
		--pf-dark-band: var(--pf-dark-dark-band);
		--pf-footer: var(--pf-dark-footer);
		--pf-error: #ff4d4d;
		--pf-glass-light: rgba(255, 255, 255, 0.1);
		--pf-glass: rgba(255, 255, 255, 0.2);

		color-scheme: dark;
	}

	@media (prefers-color-scheme: dark) {
		.showcase[data-scheme='auto'] {
			--pf-text: var(--pf-dark-text);
			--pf-text-on-dark: var(--pf-dark-text-on-dark);
			--pf-highlight: var(--pf-dark-highlight);
			--pf-shade: var(--pf-dark-shade);
			--pf-line: var(--pf-dark-line);
			--pf-surface: var(--pf-dark-surface);
			--pf-surface-raised: var(--pf-dark-surface-raised);
			--pf-bright: var(--pf-dark-bright);
			--pf-bright-hover: var(--pf-dark-bright-hover);
			--pf-dark-band: var(--pf-dark-dark-band);
			--pf-footer: var(--pf-dark-footer);
			--pf-error: #ff4d4d;
			--pf-glass-light: rgba(255, 255, 255, 0.1);
			--pf-glass: rgba(255, 255, 255, 0.2);

			color-scheme: dark;
		}
	}

	.showcase :global(h1),
	.showcase :global(h2),
	.showcase :global(h3),
	.showcase :global(h4),
	.showcase :global(h5) {
		font-family: var(--pf-heading-font), 'Noto Sans', sans-serif;
	}

	.showcase :global(strong) {
		font-weight: 600;
	}

	/* A one-colour logo painted in the scheme's own bright colour. */
	.logo-tint {
		background: var(--pf-bright);
		mask: var(--pf-logo) center / contain no-repeat;
		transition:
			transform 0.5s,
			filter 0.5s;
	}

	.logo-tint:hover {
		transform: translate(-0.25rem, -0.25rem) scale(1.05);
		filter: brightness(1.25);
	}

	@media print {
		.showcase {
			background: none;
		}
	}
</style>
