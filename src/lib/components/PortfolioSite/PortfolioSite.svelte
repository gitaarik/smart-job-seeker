<script lang="ts">
	/**
	 * The public portfolio site: one generic renderer over profile data,
	 * dressed by a `portfolio`-kind presentation template.
	 *
	 * Nothing here is specific to any theme. Colours, fonts and which sections
	 * appear in what order all come from the theme's config, the same division
	 * the document renderer keeps — so no branding lives in this repo.
	 *
	 * Version tags apply exactly as they do on a resume or CV, through the same
	 * `createProfileFilter`. An item hidden from documents by the `!resume`/
	 * `!cv` pair is NOT automatically hidden here: those tags name base
	 * document types, and a portfolio is a third one. What hides an item from
	 * the site is the version the site publishes, which is the applicant's own
	 * choice of what this audience sees.
	 *
	 * A section the profile cannot fill renders nothing at all rather than an
	 * empty heading, which is what lets a theme list a section the data has not
	 * caught up with yet.
	 */
	import { createProfileFilter } from '$lib/components/ProfileDisplay/profile-filter';
	import { themeSections, type PortfolioTheme } from '$lib/portfolio-themes';
	import { assetUrl } from '$lib/presentation-templates';
	import { formatDateRangeVerbose } from '$lib/tools/date-utils';

	interface Props {
		// The profile tree from PROFILE_INCLUDE. Typed loosely for the same
		// reason ProfileDisplay is: the include's inferred type is enormous and
		// every renderer that has tried to name it has gone stale instead.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		profile: any;
		theme: PortfolioTheme | null;
		versionId?: number | null;
	}

	let { profile, theme, versionId = null }: Props = $props();

	// One loose row type for the whole tree, for the same reason `profile` is
	// loose: spreading a `Record<string, unknown>` drops its index signature,
	// so every derived list below would lose the fields the markup reads.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type Row = Record<string, any>;

	const config = $derived(theme?.config ?? {});
	const sections = $derived(themeSections(config));
	const accent = $derived(config.accent ?? '#2563eb');
	const headingFont = $derived(config.fonts?.heading ?? 'Poppins');
	const bodyFont = $derived(config.fonts?.body ?? 'Noto Sans');

	// 'portfolio' as the base type, beside 'resume' and 'cv'. A version's own
	// slug still selects, so a version built for the site filters as usual.
	const filter = $derived(
		createProfileFilter(profile.profile_versions, 'portfolio', versionId, '')
	);

	const show = <T extends Row>(list: T[] | undefined, entity?: string): T[] =>
		list?.length ? filter.filterOnTags(list, entity) : [];

	const work = $derived(show(profile.work_experiences, 'work_experience'));
	const roleProjects: Row[] = $derived(
		work.flatMap((w: Row) =>
			((w.work_experience_projects ?? []) as Row[]).map((p) => ({ ...p, company: w.name }))
		)
	);
	const sideProjects = $derived(show(profile.side_projects, 'side_project'));
	const skillCategories: Row[] = $derived(
		show(profile.tech_skill_categories, 'skill_category')
			.map((c: Row) => ({ ...c, tech_skills: show((c.tech_skills ?? []) as Row[], 'skill') }))
			.filter((c: Row) => c.tech_skills.length > 0)
	);
	const educations = $derived(show(profile.educations, 'education'));
	const certificates = $derived(show(profile.certificates));
	const languages = $derived(show(profile.languages));
	const references = $derived(show(profile.references));
	const highlights = $derived(show(profile.highlights));

	/** Whether a section has anything to render, asked before its heading is. */
	function hasContent(section: string): boolean {
		switch (section) {
			case 'header':
				return true;
			case 'summary':
				return !!profile.summary;
			case 'highlights':
				return highlights.length > 0;
			case 'work':
				return work.length > 0;
			case 'projects':
				return roleProjects.length > 0;
			case 'sideProjects':
				return sideProjects.length > 0;
			case 'skills':
				return skillCategories.length > 0;
			case 'education':
				return educations.length > 0;
			case 'certificates':
				return certificates.length > 0;
			case 'languages':
				return languages.length > 0;
			case 'references':
				return references.length > 0;
			case 'about':
				return !!profile.about_me_text;
			default:
				return false;
		}
	}

	const TITLES: Record<string, string> = {
		summary: 'Summary',
		highlights: 'Highlights',
		work: 'Experience',
		projects: 'Projects',
		sideProjects: 'Side projects',
		skills: 'Skills',
		education: 'Education',
		certificates: 'Certificates',
		languages: 'Languages',
		references: 'References',
		about: 'About me'
	};

	const visible = $derived(sections.filter(hasContent));

	const contacts = $derived(
		[
			{ label: profile.email_address, href: `mailto:${profile.email_address}` },
			{ label: profile.personal_website, href: profile.personal_website },
			{ label: profile.github_profile, href: profile.github_profile },
			{ label: profile.linkedin_profile, href: profile.linkedin_profile }
		].filter((c) => c.label)
	);
</script>

<svelte:head>
	<title>{profile.name ?? 'Portfolio'}</title>
	{#if profile.headline}<meta name="description" content={profile.headline} />{/if}
	{#if config.assets?.ogImage}
		<meta property="og:image" content={assetUrl(config.assets.ogImage)} />
	{/if}
	{#if config.assets?.favicon}
		<link rel="icon" href={assetUrl(config.assets.favicon)} />
	{/if}
</svelte:head>

<div
	class="portfolio"
	style:--accent={accent}
	style:--heading-font={headingFont}
	style:--body-font={bodyFont}
	style:color-scheme={config.colorScheme ?? 'light dark'}
	class:force-light={config.colorScheme === 'light'}
	class:force-dark={config.colorScheme === 'dark'}
>
	{#each visible as section (section)}
		{#if section === 'header'}
			<header class="hero">
				{#if config.assets?.hero}
					<img class="hero-bg" src={assetUrl(config.assets.hero)} alt="" />
				{/if}
				<div class="hero-inner">
					{#if config.assets?.logo}
						<img class="logo" src={assetUrl(config.assets.logo)} alt="" />
					{/if}
					<h1>{profile.name}</h1>
					{#if profile.title}<p class="title">{profile.title}</p>{/if}
					{#if profile.subtitle}<p class="subtitle">{profile.subtitle}</p>{/if}
					{#if profile.headline}<p class="headline">{profile.headline}</p>{/if}
					{#if contacts.length}
						<ul class="contacts">
							{#each contacts as c (c.href)}
								<li><a href={c.href} rel="me noopener">{c.label}</a></li>
							{/each}
						</ul>
					{/if}
				</div>
			</header>
		{:else}
			<section>
				<h2>{TITLES[section] ?? section}</h2>

				{#if section === 'summary'}
					<p class="prose">{profile.summary}</p>
				{:else if section === 'about'}
					<p class="prose">{profile.about_me_text}</p>
				{:else if section === 'highlights'}
					<ul class="bullets">
						{#each highlights as h (h.id)}
							<li>{h.text}</li>
						{/each}
					</ul>
				{:else if section === 'work'}
					{#each work as role (role.id)}
						<article class="entry">
							<h3>
								{role.position}{#if role.name}
									· {role.name}{/if}
							</h3>
							<p class="meta">
								{formatDateRangeVerbose(role.start_date, role.end_date)}{#if role.location}
									· {role.location}{/if}
							</p>
							{#if role.summary}<p class="prose">{role.summary}</p>{/if}
							{#if role.work_experience_achievements?.length}
								<ul class="bullets">
									{#each show(role.work_experience_achievements, 'achievement') as a (a.id)}
										<li>{a.description}</li>
									{/each}
								</ul>
							{/if}
							{#if role.work_experience_technologies?.length}
								<ul class="tags">
									{#each show(role.work_experience_technologies, 'technology') as t (t.id)}
										<li>{t.name}</li>
									{/each}
								</ul>
							{/if}
						</article>
					{/each}
				{:else if section === 'projects'}
					{#each roleProjects as p (p.id)}
						<article class="entry">
							<h3>
								{#if p.url}<a href={p.url} rel="noopener">{p.name}</a>{:else}{p.name}{/if}
							</h3>
							{#if p.company}<p class="meta">{p.company}</p>{/if}
							{#if p.description}<p class="prose">{p.description}</p>{/if}
							{#if p.outcome}<p class="prose outcome">{p.outcome}</p>{/if}
							{#if p.work_experience_project_technologies?.length}
								<ul class="tags">
									{#each p.work_experience_project_technologies as t (t.id)}
										<li>{t.name}</li>
									{/each}
								</ul>
							{/if}
						</article>
					{/each}
				{:else if section === 'sideProjects'}
					{#each sideProjects as p (p.id)}
						<article class="entry">
							<h3>
								{#if p.url}<a href={p.url} rel="noopener">{p.name}</a>{:else}{p.name}{/if}
							</h3>
							<p class="meta">
								{formatDateRangeVerbose(p.start_date, p.end_date)}{#if p.repo_url}
									· <a href={p.repo_url} rel="noopener">source</a>{/if}
							</p>
							{#if p.summary}<p class="prose">{p.summary}</p>{/if}
							{#if p.side_project_achievements?.length}
								<ul class="bullets">
									{#each p.side_project_achievements as a (a.id)}
										<li>{a.description}</li>
									{/each}
								</ul>
							{/if}
							{#if p.side_project_technologies?.length}
								<ul class="tags">
									{#each p.side_project_technologies as t (t.id)}
										<li>{t.name}</li>
									{/each}
								</ul>
							{/if}
						</article>
					{/each}
				{:else if section === 'skills'}
					{#each skillCategories as cat (cat.id)}
						<div class="entry">
							<h3>{cat.name}</h3>
							<ul class="tags">
								{#each cat.tech_skills as s (s.id)}
									<li>{s.name}</li>
								{/each}
							</ul>
						</div>
					{/each}
				{:else if section === 'education'}
					{#each educations as e (e.id)}
						<article class="entry">
							<h3>
								{e.study_type}{#if e.area}
									· {e.area}{/if}
							</h3>
							<p class="meta">
								{e.institution}{#if e.start_date || e.end_date}
									· {formatDateRangeVerbose(e.start_date, e.end_date)}{/if}
							</p>
							{#if e.summary}<p class="prose">{e.summary}</p>{/if}
						</article>
					{/each}
				{:else if section === 'certificates'}
					<ul class="bullets">
						{#each certificates as c (c.id)}
							<li>
								{#if c.url}<a href={c.url} rel="noopener">{c.name}</a>{:else}{c.name}{/if}
								{#if c.issuer}<span class="meta"> · {c.issuer}</span>{/if}
							</li>
						{/each}
					</ul>
				{:else if section === 'languages'}
					<ul class="tags">
						{#each languages as l (l.id)}
							<li>
								{l.name}{#if l.proficiency}
									· {l.proficiency}{/if}
							</li>
						{/each}
					</ul>
				{:else if section === 'references'}
					{#each references as r (r.id)}
						<blockquote class="entry">
							<p class="prose">{r.text}</p>
							<footer class="meta">
								{r.author}{#if r.author_position}
									· {r.author_position}{/if}
							</footer>
						</blockquote>
					{/each}
				{/if}
			</section>
		{/if}
	{/each}
</div>

<style>
	/*
	 * Theme-aware by default: the visitor's setting decides, unless the theme
	 * commits to light or dark. Every colour is a token so the two overrides
	 * below are the only places a palette is restated.
	 */
	.portfolio {
		--bg: #ffffff;
		--fg: #16181d;
		--muted: #5b6270;
		--line: #e4e7ec;
		--card: #f7f8fa;

		background: var(--bg);
		color: var(--fg);
		font-family: var(--body-font), system-ui, sans-serif;
		margin: 0 auto;
		max-width: 48rem;
		padding: 0 1rem 4rem;
	}

	@media (prefers-color-scheme: dark) {
		.portfolio:not(.force-light) {
			--bg: #101216;
			--fg: #e9ecf1;
			--muted: #9aa2b1;
			--line: #262a33;
			--card: #171a20;
		}
	}

	.portfolio.force-dark {
		--bg: #101216;
		--fg: #e9ecf1;
		--muted: #9aa2b1;
		--line: #262a33;
		--card: #171a20;
	}

	h1,
	h2,
	h3 {
		font-family: var(--heading-font), system-ui, sans-serif;
		line-height: 1.2;
	}

	.hero {
		position: relative;
		margin: 0 -1rem 2.5rem;
		padding: 3rem 1rem 2rem;
		overflow: hidden;
	}

	.hero-bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0.18;
	}

	.hero-inner {
		position: relative;
	}

	.logo {
		max-height: 3rem;
		max-width: 100%;
		margin-bottom: 1rem;
	}

	h1 {
		font-size: clamp(2rem, 6vw, 3rem);
		margin: 0;
	}

	.title {
		color: var(--accent);
		font-size: 1.15rem;
		font-weight: 600;
		margin: 0.35rem 0 0;
	}

	.subtitle,
	.headline {
		color: var(--muted);
		margin: 0.35rem 0 0;
	}

	.contacts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		list-style: none;
		margin: 1.25rem 0 0;
		padding: 0;
		font-size: 0.9rem;
	}

	section {
		border-top: 1px solid var(--line);
		padding-top: 1.75rem;
		margin-top: 2rem;
	}

	h2 {
		font-size: 0.8rem;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--accent);
		margin: 0 0 1.25rem;
	}

	h3 {
		font-size: 1.05rem;
		margin: 0;
	}

	.entry {
		margin: 0 0 1.75rem;
	}

	.entry:last-child {
		margin-bottom: 0;
	}

	.meta {
		color: var(--muted);
		font-size: 0.875rem;
		margin: 0.2rem 0 0;
	}

	.prose {
		margin: 0.6rem 0 0;
		line-height: 1.65;
		white-space: pre-wrap;
	}

	.outcome {
		color: var(--muted);
	}

	.bullets {
		margin: 0.6rem 0 0;
		padding-left: 1.1rem;
		line-height: 1.6;
	}

	.bullets li {
		margin-bottom: 0.3rem;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		list-style: none;
		margin: 0.7rem 0 0;
		padding: 0;
	}

	.tags li {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 999px;
		font-size: 0.8rem;
		padding: 0.15rem 0.6rem;
	}

	blockquote {
		border-left: 3px solid var(--accent);
		padding-left: 1rem;
	}

	a {
		color: inherit;
		text-decoration-color: var(--accent);
		text-underline-offset: 2px;
	}

	a:hover {
		color: var(--accent);
	}
</style>
