<script lang="ts">
	/**
	 * The `showcase` portfolio layout: the standalone portfolio site's design,
	 * fed by the profile instead of a hand-written data file.
	 *
	 * Ported from that site's home page (a full-height header, the About me
	 * with the photo beside it, a band of quotes, a dark footer) and its
	 * `/portfolio` page (the career as cards), as one page. Its structure is
	 * still that site's; the look was redone on 2026-11-09 after a LinkedIn
	 * banner: condensed display type for the name and the section headings,
	 * flatter cards on thin rules, and optionally a code review drawn beside
	 * the header (`headerArt`: an agent trace or a code review). See
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
	 *
	 * A theme with `privateCv` splits the site in two (`page`): the public
	 * home page keeps the introduction, the quotes and Selected work, and the
	 * career goes on a CV page a portfolio share link opens. Without it the
	 * whole site is one page. A visitor who may open both gets a menu between
	 * them; see $lib/portfolio-themes.ts and server/profile/portfolio-key.ts.
	 */
	import { onMount } from 'svelte';
	import { page as appPage } from '$app/state';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faBook,
		faBuilding,
		faBullseye,
		faCalendarAlt,
		faCertificate,
		faCircleCheck,
		faChevronDown,
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
		isHeaderArt,
		pageSections,
		paletteStyle,
		type PortfolioPage,
		type PortfolioSection,
		type PortfolioTheme
	} from '$lib/portfolio-themes';
	import { assetUrl } from '$lib/presentation-templates';
	import { formatDateRangeVerbose } from '$lib/tools/date-utils';
	import { getProfilePhotoUrl } from '$lib/utils/profile-photo-url';
	import { getEducationLogoUrl, getWorkExperienceLogoUrl } from '$lib/utils/entity-media-url';
	import type { PortfolioContactGate } from '$lib/server/profile/portfolio-contact';
	import type { PortfolioBusiness } from '$lib/server/profile/portfolio-business';
	import { careerView, siteLists, splitAchievements, type Row } from '../site-lists';
	import { keySkillLines } from '../key-skills';
	import { briefRole, briefRoleProject, briefSideProject } from '../brief-entries';
	import { iconFor } from './icons';
	import Card from './Card.svelte';
	import AgentTrace from './AgentTrace.svelte';
	import CodeMinimap from './CodeMinimap.svelte';
	import InfoBoxes from './InfoBoxes.svelte';
	import TechTags from './TechTags.svelte';
	import SelectedWorkCarousel from './SelectedWorkCarousel.svelte';
	import { workSlides } from './work-slides';
	import PortfolioNav from './PortfolioNav.svelte';
	import BriefList from './BriefList.svelte';
	import ContactButton from './ContactButton.svelte';
	import SchemeSwitcher from './SchemeSwitcher.svelte';
	import { ContactState } from './contact-state.svelte';
	import { loadSchemePreference, saveSchemePreference, type SchemePreference } from './scheme';
	import { rolePlace } from '$lib/work-mode';
	import 'aos/dist/aos.css';

	interface Props {
		// The profile tree, loose for the reason PortfolioSite gives.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		profile: any;
		theme: PortfolioTheme;
		versionId?: number | null;
		/** Null when the page carries the details itself, which a showcase never does. */
		contact: PortfolioContactGate | null;
		/** The company details the theme prints in its footer; null prints the name, title and place. */
		business?: PortfolioBusiness | null;
		/** A share link's token, which the contact endpoint asks for. */
		accessToken?: string | null;
		/** The whole site, or one of its two pages when the theme has a private CV page. */
		page?: PortfolioPage;
		/** Both pages' links, for a visitor who may open both; null shows no menu. */
		homeHref?: string | null;
		cvHref?: string | null;
	}

	let {
		profile,
		theme,
		versionId = null,
		contact,
		business = null,
		accessToken = null,
		page = 'site',
		homeHref = null,
		cvHref = null
	}: Props = $props();

	const config = $derived(theme.config);
	const sections = $derived(pageSections(config, page));
	const headingFont = $derived(config.fonts?.heading ?? 'Noto Sans');
	const headerArt = $derived(isHeaderArt(config.headerArt) ? config.headerArt : null);
	const bodyFont = $derived(config.fonts?.body ?? 'Noto Sans');

	const lists = $derived(siteLists(profile, versionId));
	const show = $derived(lists.show);
	// What the career prints in full and what it lists briefly; see site-lists.ts.
	const career = $derived(careerView(lists, config, new Date(), page));
	const slides = $derived(workSlides(lists.featured, show, lists.work, 'Side project'));

	// The career card, and the two boxes beside the About me: Key skills from
	// the Skills (key-skills.ts), Contact for from its own highlight rows.
	const highlights = $derived(lists.highlights);
	const keySkills = $derived(keySkillLines(lists.skillCategories));
	const contactFor = $derived(lists.contactFor);

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
		featured: 'Selected Work',
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
			case 'featured':
				return career.selectedWork;
			case 'work':
				return lists.work.length > 0;
			case 'projects':
				return career.fullProjects.length + career.briefProjects.length > 0;
			case 'sideProjects':
				return career.fullSideProjects.length + career.briefSideProjects.length > 0;
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
	const BANDS: ReadonlySet<PortfolioSection> = new Set([
		'header',
		'about',
		'references',
		'featured'
	]);

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

	// The work and the quotes come after the About me's button, so the page
	// ends on one of its own, unless the About me is already the last thing.
	const closingContact = $derived.by(() => {
		const last = blocks[blocks.length - 1];
		return !!contactState && !(last?.kind === 'band' && last.section === 'about');
	});

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

	const achievementBoxes = (achievements: Row[]) =>
		achievements.map((a) => ({ key: a.id, description: a.description, icon: iconFor(a.fa_icon) }));

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

	// No `personal_website`: that column is how a CV points at the applicant's
	// site, and this is the site.
	const footerLinks = $derived(
		(
			[
				[profile.linkedin_profile, faLinkedin, 'LinkedIn'],
				[profile.github_profile, faGithub, 'GitHub'],
				[profile.pypi_profile, faPython, 'PyPI'],
				[profile.npm_profile, faNpm, 'npm'],
				[profile.stackoverflow_profile, faStackOverflow, 'Stack Overflow']
			] as [string | null, IconDefinition, string][]
		)
			.map(([href, icon, label]) => [web(href), icon, label] as const)
			.filter((link): link is readonly [string, IconDefinition, string] => !!link[0])
	);

	const year = new Date().getFullYear();
	const metaTitle = $derived(
		[profile.name, page === 'cv' ? 'Full CV' : profile.title].filter(Boolean).join(' - ')
	);
	const metaDescription = $derived(profile.headline ?? profile.summary ?? '');

	const aboutBoxes = $derived(
		[
			{
				label: 'Key skills:',
				items: keySkills.map((line) => ({
					key: line.key,
					description: line.text,
					icon: iconFor(line.icon)
				}))
			},
			{
				label: 'Contact for:',
				items: contactFor.map((r) => ({
					key: r.id,
					description: r.text,
					icon: iconFor(r.icon_name || r.fa_icon)
				}))
			}
		]
			.filter((box) => box.items.length > 0)
			// A box where only some entries have an icon keeps a gap where the
			// others' would be, so its text still starts in one column. Key skills
			// entries often wrap, so the markup keeps each icon level with the
			// first row of its text. A Key skills line names four skills and a
			// Contact for line a few words, so with both boxes Key skills takes the
			// wider column: at half each, most of its lines wrapped and the boxes
			// came out far apart in height.
			.map((box) => ({ ...box, iconColumn: box.items.some((item) => item.icon) }))
	);
</script>

<svelte:head>
	<title>{metaTitle || 'Portfolio'}</title>
	{#if page === 'cv'}
		<!-- The private page: the load sends X-Robots-Tag too, this is for crawlers that read only the HTML. -->
		<meta name="robots" content="noindex, nofollow" />
	{:else}
		{#if metaDescription}
			<meta name="description" content={metaDescription} />
			<meta property="og:description" content={metaDescription} />
		{/if}
		<meta property="og:type" content="website" />
		<meta property="og:url" content={appPage.url.href} />
		<meta property="og:title" content={metaTitle} />
		{#if ogImage}
			<meta property="og:image" content={ogImage} />
			<meta name="twitter:card" content="summary_large_image" />
		{/if}
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
	{#if page !== 'site' && homeHref && cvHref}
		<PortfolioNav {page} {homeHref} {cvHref} />
	{/if}

	<main class="flex h-full min-h-screen flex-col justify-between">
		<article class="flex flex-col items-center">
			{#if page === 'cv'}
				<!-- The CV page's own header: who this is, without the home page's introduction. -->
				<header class="cv-head transition-colors" aria-labelledby="pf-name">
					<div class="w-full max-w-[885px]">
						<p class="hero-kicker">Full CV</p>
						<h1 id="pf-name" class="cv-name">{profile.name}</h1>
						{#if profile.title}<p class="hero-lede">{profile.title}</p>{/if}
						{#if contactState}
							<div class="mt-9 flex">
								<ContactButton
									state={contactState}
									intro={config.contactIntro}
									panelClass="bg-(--pf-surface-raised)"
									scheme={actual}
								/>
							</div>
						{/if}
					</div>
				</header>
			{/if}
			{#each blocks as block, b (b)}
				{#if block.kind === 'band' && block.section === 'header'}
					<header
						class="hero transition-colors"
						class:with-art={!!headerArt}
						aria-labelledby="pf-name"
					>
						{#if headerArt === 'trace'}
							<div class="hero-art"><AgentTrace /></div>
						{:else if headerArt === 'code'}
							<div class="hero-art"><CodeMinimap /></div>
						{/if}

						<div class="hero-body">
							<div {...aos}>
								{#if profile.title}<p class="hero-kicker">{profile.title}</p>{/if}
								<h1 id="pf-name" class="hero-name">{profile.name}</h1>
								{#if profile.subtitle}<p class="hero-lede">{profile.subtitle}</p>{/if}
							</div>

							{#if contactState}
								<div {...aos} class="mt-10 flex w-full">
									<ContactButton
										state={contactState}
										intro={config.contactIntro}
										panelClass="bg-(--pf-surface-raised)"
										scheme={actual}
									/>
								</div>
							{/if}
						</div>

						{#if blocks.length > 1}
							<div bind:this={moreInfo} class="hero-more">
								<button
									type="button"
									class="group flex cursor-pointer items-center gap-2.5 py-2 text-[0.9375rem] font-medium text-(--pf-muted) transition-colors hover:text-(--pf-accent-text) focus-visible:text-(--pf-accent-text)"
									onclick={scrollPastHeader}
								>
									<span>More about me</span>
									<FontAwesomeIcon
										icon={faChevronDown}
										class="h-3 w-3 transition-transform group-hover:translate-y-0.5"
									/>
								</button>
							</div>
						{/if}
					</header>
					<div bind:this={afterHeader} class="w-full"></div>
				{:else if block.kind === 'band' && block.section === 'about'}
					<section class="w-full bg-(--pf-shade) transition-colors" aria-labelledby="pf-about">
						<div class="flex flex-col items-center px-5 min-[40rem]:px-10">
							<div class="w-full max-w-[885px] overflow-hidden pt-16 min-[50rem]:pt-24">
								<h2
									{...aos}
									id="pf-about"
									class="pf-display mb-8 text-[2.75rem] text-(--pf-strong) capitalize min-[50rem]:mb-12 min-[50rem]:text-[4rem]"
								>
									{title('about')}
								</h2>

								{#if aboutParagraphs.length}
									<div
										{...aos}
										class="mb-16 flex gap-10 max-[50rem]:flex-col max-[50rem]:items-center"
									>
										<div class="text-[1.0625rem]/[1.75]">
											{#if photo}
												<div
													class="float-right w-full max-w-[200px] pb-4 pl-6 max-[30rem]:hidden min-[60rem]:max-w-[280px] min-[60rem]:pl-10"
												>
													<img
														src={photo}
														alt={profile.name}
														class="w-full rounded-sm ring-1 ring-(--pf-line)"
													/>
												</div>
											{/if}
											{#each aboutParagraphs as paragraph, i (i)}
												<p class:mt-5={i > 0} class="whitespace-pre-line">{paragraph}</p>
												{#if i === 0 && photo}
													<div class="mt-5 flex justify-center min-[30rem]:hidden">
														<img
															src={photo}
															alt=""
															aria-hidden="true"
															class="w-[220px] rounded-sm ring-1 ring-(--pf-line)"
														/>
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
								<div class="w-full max-w-[885px] pb-20">
									{#if keySkills.length || contactFor.length}
										<div
											{...aos}
											class={[
												'mb-16 grid w-full grid-cols-1 gap-6',
												aboutBoxes.length > 1
													? 'min-[50rem]:grid-cols-[3fr_2fr]'
													: 'min-[50rem]:grid-cols-2'
											]}
										>
											{#each aboutBoxes as { label, items, iconColumn } (label)}
												<div
													class="w-full overflow-hidden rounded-sm border border-(--pf-line) bg-(--pf-surface-raised) transition-colors"
												>
													<h3
														class="border-b border-(--pf-line) px-6 py-4 text-xl font-semibold text-(--pf-accent-text) [font-stretch:88%]"
													>
														{label}
													</h3>
													<ul class="space-y-4 px-6 py-5 font-semibold">
														{#each items as item (item.key)}
															<li class="flex items-start gap-3">
																{#if item.icon}
																	<FontAwesomeIcon
																		icon={item.icon}
																		class="mt-1 w-4 shrink-0 text-(--pf-accent-text)"
																	/>
																{:else if iconColumn}
																	<span class="w-4 shrink-0" aria-hidden="true"></span>
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
										<div {...aos} class="flex">
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
				{:else if block.kind === 'band' && block.section === 'featured'}
					<SelectedWorkCarousel
						{slides}
						title={title('featured')}
						{aos}
						moreHref={page === 'home' ? cvHref : null}
					/>
				{:else if block.kind === 'band' && block.section === 'references'}
					<section
						class="w-full bg-(--pf-dark-band) text-(--pf-text-on-dark) transition-colors"
						aria-labelledby="pf-references"
					>
						<div class="flex justify-center px-5 pt-20 pb-16 min-[40rem]:px-10 min-[50rem]:pt-28">
							<div class="w-full max-w-[885px]">
								<h2
									{...aos}
									id="pf-references"
									class="pf-display mb-6 text-[2.75rem] capitalize min-[50rem]:text-[4rem]"
								>
									{title('references')}
								</h2>
								{#each lists.references as r (r.id)}
									<div {...aos}>
										<blockquote
											class="quote border-t border-(--pf-text-on-dark)/15 py-10 min-[50rem]:grid min-[50rem]:grid-cols-[4rem_1fr] min-[50rem]:py-14"
										>
											<span class="quote-mark" aria-hidden="true">“</span>
											<div>
												<p class="text-lg/8 min-[50rem]:text-[1.375rem]/[1.6]">{r.text}</p>
												<p class="mt-6 font-semibold text-(--pf-band-accent) [font-stretch:90%]">
													{[r.author, r.author_position].filter(Boolean).join(', ')}
												</p>
											</div>
										</blockquote>
									</div>
								{/each}
							</div>
						</div>
					</section>
				{:else if block.kind === 'cards'}
					<div class="w-full bg-(--pf-shade) transition-colors print:bg-transparent">
						<div
							class="mx-auto flex max-w-[885px] flex-col gap-8 px-4 py-16 min-[40rem]:px-10 print:gap-7 print:p-0"
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
										{#each career.fullRoles as role, i (role.id)}
											{@const achievements = show(role.work_experience_achievements, 'achievement')}
											{@const technologies = show(role.work_experience_technologies, 'technology')}
											{@const roleLogo = getWorkExperienceLogoUrl(role)}
											{@const roleSite = web(role.website)}
											{@const place = rolePlace(role)}
											<section class="break-inside-avoid" class:mt-12={i === 0}>
												<header class="mb-6 print:mb-4">
													<div class="flex items-start justify-between">
														<div class="flex-1">
															<h3 class="pf-subhead mb-2 text-(--pf-accent-text)">
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
																				class="text-(--pf-accent-text) underline-offset-4 hover:underline"
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
																	{#if place}
																		<div class="flex items-center">
																			<FontAwesomeIcon
																				icon={faMapMarkerAlt}
																				class="mr-2 h-3 w-3 flex-shrink-0"
																			/>
																			<span>{place}</span>
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
																	class="h-20 w-auto rounded-sm border border-(--pf-line)"
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
														{@const split = splitAchievements(
															achievements,
															career.detail.achievementsPerRole
														)}
														<div>
															<h4 class="mb-3 text-lg font-semibold print:mb-2 print:text-base">
																Key Achievements:
															</h4>
															<InfoBoxes items={achievementBoxes(split.shown)} />
															{#if split.more.length}
																<details class="more-achievements group mt-4">
																	<summary
																		class="cursor-pointer list-none text-sm font-medium text-(--pf-accent-text) underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden"
																	>
																		<span class="group-open:hidden"
																			>Show {split.more.length} more</span
																		>
																		<span class="hidden group-open:inline">Show fewer</span>
																	</summary>
																	<div class="mt-4">
																		<InfoBoxes items={achievementBoxes(split.more)} />
																	</div>
																</details>
															{/if}
														</div>
													{/if}
													<TechTags names={technologies.map((t) => t.name)} />
												</div>
											</section>
											{#if i < career.fullRoles.length - 1}
												<hr class="my-12 border-(--pf-line)" />
											{/if}
										{/each}
										{#if career.briefRoles.length}
											<div class:mt-12={career.fullRoles.length > 0}>
												<BriefList
													entries={career.briefRoles.map(briefRole)}
													heading="Earlier roles"
												/>
											</div>
										{/if}
									</Card>
								{:else if section === 'projects'}
									<Card title={title('projects')} icon={faLaptopCode} {aos}>
										<div class="space-y-6">
											{#each career.fullProjects as p (p.id)}
												{@const technologies = show(p.work_experience_project_technologies)}
												{@const projectUrl = web(p.url)}
												<div
													class="role-project rounded-sm border border-(--pf-line) bg-(--pf-shade) p-5 min-[40rem]:p-7"
												>
													<div class="mb-6">
														{#if p.company}
															<div class="mb-3 flex items-center text-xs opacity-60">
																<span>{title('work')}</span>
																<span class="mx-2">›</span>
																<span>{p.company}</span>
																<span class="mx-2">›</span>
																<span class="font-medium text-(--pf-accent-text)">{p.name}</span>
															</div>
														{/if}
														<div
															class="mb-3 flex flex-col min-[40rem]:flex-row min-[40rem]:items-center min-[40rem]:justify-between"
														>
															<h3 class="pf-subhead text-[1.5rem]">
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
																	class="mt-1 flex items-center text-sm text-(--pf-muted) min-[40rem]:mt-0"
																>
																	<FontAwesomeIcon icon={faCalendarAlt} class="mr-1 h-3 w-3" />
																	<span>{formatDateRangeVerbose(p.start_date, p.end_date)}</span>
																</div>
															{/if}
														</div>
														{#if p.project_role}
															<div class="flex items-center text-sm">
																<FontAwesomeIcon
																	icon={faUserTie}
																	class="mr-2 h-3 w-3 flex-shrink-0"
																/>
																<span>{p.project_role}</span>
															</div>
														{/if}
													</div>

													<div class="space-y-6">
														{#if p.description}
															<div>
																<h4 class="mb-3 flex items-center text-lg font-semibold">
																	<FontAwesomeIcon
																		icon={faBullseye}
																		class="mr-2 h-4 w-4 text-(--pf-accent-text)"
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
										{#if career.briefProjects.length}
											<div class:mt-8={career.fullProjects.length > 0}>
												<BriefList
													entries={career.briefProjects.map((p) => briefRoleProject(p, show))}
												/>
											</div>
										{/if}
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
															<h3 class="pf-subhead mb-1 text-(--pf-accent-text)">
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
																			class="text-(--pf-accent-text) underline-offset-4 hover:underline"
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
																	class="h-20 w-auto rounded-sm border border-(--pf-line)"
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
										{#each career.fullSideProjects as p, i (p.id)}
											{@const technologies = show(p.side_project_technologies)}
											{@const link = web(p.url) ?? web(p.repo_url)}
											<div class="break-inside-avoid" class:mt-10={i === 0}>
												<header class="mb-4">
													<h3 class="pf-subhead text-(--pf-accent-text)">{p.name}</h3>
													{#if p.project_role}
														<div class="mt-2 flex items-center text-sm">
															<FontAwesomeIcon
																icon={faUserTie}
																class="mr-2 h-3 w-3 flex-shrink-0"
															/>
															<span>{p.project_role}</span>
														</div>
													{/if}
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
															class="inline-flex items-center gap-2 rounded-sm bg-(--pf-bright) px-5 py-3 text-white transition-all hover:bg-(--pf-bright)/85"
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
											{#if i < career.fullSideProjects.length - 1}
												<hr class="my-12 border-(--pf-line)" />
											{/if}
										{/each}
										{#if career.briefSideProjects.length}
											<div class:mt-8={career.fullSideProjects.length > 0}>
												<BriefList
													entries={career.briefSideProjects.map((p) => briefSideProject(p, show))}
												/>
											</div>
										{/if}
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
																class="text-(--pf-accent-text) underline-offset-4 hover:underline"
																>{c.name}</a
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

			{#if closingContact && contactState}
				<section
					class="flex w-full justify-center bg-(--pf-surface) px-5 py-20 transition-colors min-[40rem]:px-10 min-[50rem]:py-28 print:hidden"
					aria-labelledby="pf-closing"
				>
					<div class="w-full max-w-[885px]">
						<h2
							{...aos}
							id="pf-closing"
							class="pf-display mb-10 text-[2.25rem] text-(--pf-strong) min-[50rem]:text-[3rem]"
						>
							Want to work together?
						</h2>
						<div {...aos} class="flex">
							<ContactButton
								state={contactState}
								intro={config.contactIntro}
								panelClass="bg-(--pf-surface-raised)"
								scheme={actual}
							/>
						</div>
					</div>
				</section>
			{/if}
		</article>

		<footer
			class="flex w-full flex-col items-center gap-2 bg-(--pf-footer) px-5 pt-16 text-(--pf-text-on-dark) transition-colors min-[40rem]:px-10"
			aria-labelledby="pf-footer"
		>
			<div {...aos} class="flex w-full max-w-[885px] flex-col">
				<div class="mb-3 flex items-center gap-3">
					{#if logo}
						{#if config.logoTint}
							<div
								class="logo-tint on-band h-9 w-9 shrink-0"
								style:--pf-logo="url({logo})"
								aria-hidden="true"
							></div>
						{:else}
							<img src={logo} alt="" aria-hidden="true" class="h-9 w-9 shrink-0 object-contain" />
						{/if}
					{/if}
					<h4 class="pf-display text-[2rem]" id="pf-footer">{business?.name ?? profile.name}</h4>
				</div>
				<div class="flex w-full justify-between max-[350px]:flex-col max-[350px]:gap-4">
					<div class="text-sm/6">
						{#if business}
							{#if business.street}<div>{business.street}</div>{/if}
							{#if business.place}<div>{business.place}</div>{/if}
							{#if business.country}<div>{business.country}</div>{/if}
							{#if business.vatId || business.registration}
								<div class="mt-2">
									{#if business.vatId}<div>VAT ID: {business.vatId}</div>{/if}
									{#if business.registration}
										<div>{business.registrationLabel}: {business.registration}</div>
									{/if}
								</div>
							{/if}
						{:else}
							{#if profile.title}<div>{profile.title}</div>{/if}
							{#if profile.location}<div>{profile.location}</div>{/if}
						{/if}
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
										class="flex items-center justify-end gap-2 text-nowrap transition hover:text-(--pf-band-accent) hover:underline focus:text-(--pf-band-accent)"
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
					<div>Copyright © {year} {business?.name ?? profile.name}</div>
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
		--pf-marker: var(--pf-light-marker);
		/* Text in the accent, and the strongest text: on light, the accent itself and the body colour. */
		--pf-accent-text: var(--pf-bright);
		--pf-strong: var(--pf-text);
		--pf-hero-edge: color-mix(in srgb, var(--pf-surface) 93%, var(--pf-bright));
		--pf-hero-glow: 6%;
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
		--pf-marker: var(--pf-dark-marker);
		/* On dark, the button colour is too dim for text: the hover colour reads. */
		--pf-accent-text: var(--pf-bright-hover);
		--pf-strong: var(--pf-highlight);
		--pf-hero-edge: color-mix(in srgb, var(--pf-surface) 62%, #000);
		--pf-hero-glow: 14%;
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
			--pf-marker: var(--pf-dark-marker);
			--pf-accent-text: var(--pf-bright-hover);
			--pf-strong: var(--pf-highlight);
			--pf-hero-edge: color-mix(in srgb, var(--pf-surface) 62%, #000);
			--pf-hero-glow: 14%;
			--pf-error: #ff4d4d;
			--pf-glass-light: rgba(255, 255, 255, 0.1);
			--pf-glass: rgba(255, 255, 255, 0.2);

			color-scheme: dark;
		}
	}

	/*
	 * Derived once from whichever palette is active. A custom property resolves
	 * on the element it is used on, so these follow the scheme blocks above.
	 */
	.showcase {
		--pf-muted: color-mix(in srgb, var(--pf-text) 72%, var(--pf-surface));
		--pf-band-accent: color-mix(in srgb, var(--pf-text-on-dark) 62%, var(--pf-bright-hover));
		/* The picture beside the header: two of the accents, and three mixes toward the page. */
		--pf-art-0: var(--pf-bright);
		--pf-art-1: color-mix(in srgb, var(--pf-bright) 55%, var(--pf-surface));
		--pf-art-2: var(--pf-bright-hover);
		--pf-art-3: color-mix(in srgb, var(--pf-text) 35%, var(--pf-surface));
		--pf-art-4: color-mix(in srgb, var(--pf-bright-hover) 55%, var(--pf-text));
		--pf-art-rule: var(--pf-accent-text);
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

	/*
	 * Display type: bold and narrow where the heading font has a width axis
	 * (Instrument Sans does), plain bold where it has not.
	 */
	.showcase :global(.pf-display) {
		font-weight: 700;
		font-stretch: 78%;
		letter-spacing: -0.02em;
		line-height: 0.95;
	}

	.showcase :global(.pf-subhead) {
		font-size: 1.75rem;
		font-weight: 650;
		font-stretch: 86%;
		letter-spacing: -0.01em;
		line-height: 1.1;
	}

	/* The header: text over the page on a phone, beside the code from 60rem. */
	.hero {
		--hero-text-left: 1.5rem;

		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		min-height: 100svh;
		overflow: hidden;
		background:
			radial-gradient(
				60rem 32rem at 74% 44%,
				color-mix(in srgb, var(--pf-bright) var(--pf-hero-glow), transparent),
				transparent 70%
			),
			linear-gradient(
				90deg,
				var(--pf-hero-edge) 0%,
				var(--pf-surface) 55%,
				color-mix(in srgb, var(--pf-surface) 94%, var(--pf-bright)) 100%
			);
	}

	.hero-art {
		position: absolute;
		inset: 0 0 auto 0;
		height: 11rem;
		overflow: hidden;
		mask-image: linear-gradient(180deg, #000 35%, transparent 100%);
	}

	/* On a phone, drawn at minimap size, so both panes and the comment fit. */
	.hero-art :global(svg) {
		transform: scale(0.55);
		transform-origin: 0 0;
	}

	.hero-body {
		position: relative;
		display: flex;
		flex: 1;
		flex-direction: column;
		justify-content: center;
		padding: 5rem 1.5rem 7rem var(--hero-text-left);
	}

	.hero.with-art .hero-body {
		justify-content: flex-start;
		padding-top: 10rem;
	}

	.hero-kicker {
		margin: 0 0 0.15em 0.05em;
		font-family: var(--pf-heading-font), 'Noto Sans', sans-serif;
		font-size: clamp(1.375rem, 2.6vw, 2.5rem);
		font-weight: 500;
		font-stretch: 90%;
		line-height: 1.1;
		color: var(--pf-accent-text);
	}

	.hero-name {
		font-size: clamp(4rem, 9.5vw, 9.5rem);
		font-weight: 700;
		font-stretch: 78%;
		letter-spacing: -0.025em;
		line-height: 0.9;
		color: var(--pf-strong);
	}

	.hero-lede {
		max-width: 42ch;
		text-wrap: pretty;
		margin-top: 1.5rem;
		font-size: clamp(1.125rem, 1.5vw, 1.375rem);
		line-height: 1.45;
		color: var(--pf-muted);
	}

	.hero-more {
		position: absolute;
		bottom: 1.5rem;
		left: var(--hero-text-left);
	}

	@media (min-width: 60rem) {
		.hero {
			--hero-text-left: max(3rem, 8vw);
		}

		.hero.with-art {
			--hero-text-left: 48%;
		}

		.hero-art {
			inset: 0 auto 0 0;
			width: 46%;
			height: auto;
			mask-image: linear-gradient(90deg, #000 62%, transparent 100%);
		}

		.hero-art :global(svg) {
			transform: none;
		}

		.hero.with-art .hero-body {
			justify-content: center;
			padding-top: 5rem;
		}
	}

	/* The CV page's header: the hero's light, at the height of a heading. */
	.cv-head {
		display: flex;
		justify-content: center;
		width: 100%;
		padding: 7.5rem 1.25rem 4rem;
		background: linear-gradient(
			90deg,
			var(--pf-hero-edge, var(--pf-surface)) 0%,
			var(--pf-surface) 55%,
			color-mix(in srgb, var(--pf-surface) 94%, var(--pf-bright)) 100%
		);
	}

	@media (min-width: 40rem) {
		.cv-head {
			padding-inline: 2.5rem;
		}
	}

	@media (min-width: 50rem) {
		.cv-head {
			padding-top: 9rem;
			padding-bottom: 5rem;
		}
	}

	.cv-name {
		font-size: clamp(3.25rem, 7vw, 6rem);
		font-weight: 700;
		font-stretch: 78%;
		letter-spacing: -0.025em;
		line-height: 0.92;
		color: var(--pf-strong);
	}

	.quote-mark {
		display: block;
		height: 3.25rem;
		font-family: var(--pf-heading-font), 'Noto Sans', sans-serif;
		font-size: 5rem;
		font-weight: 700;
		line-height: 1;
		color: var(--pf-band-accent);
	}

	/* A one-colour logo painted in the scheme's own bright colour. */
	.logo-tint {
		background: var(--pf-bright);
		mask: var(--pf-logo) center / contain no-repeat;
		transition:
			transform 0.5s,
			filter 0.5s;
	}

	/* On the footer's dark band, in the band's own accent. */
	.logo-tint.on-band {
		background: var(--pf-band-accent);
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
