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
	 * `createProfileFilter` (by way of `siteLists`, which the showcase layout
	 * reads too). An item hidden from documents by the `!resume`/
	 * `!cv` pair is NOT automatically hidden here: those tags name base
	 * document types, and a portfolio is a third one. What hides an item from
	 * the site is its own Site switch (`!portfolio`) or the version the site
	 * publishes, which is the applicant's own choice of what this audience sees.
	 * A project's technologies print here and nowhere else, so for them the
	 * switch is the whole of it.
	 *
	 * A section the profile cannot fill renders nothing at all rather than an
	 * empty heading, which is what lets a theme list a section the data has not
	 * caught up with yet.
	 */
	import { careerView, siteLists, splitAchievements } from './site-lists';
	import {
		briefRole,
		briefRoleProject,
		briefSideProject,
		hasDetails,
		type BriefEntry
	} from './brief-entries';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import { themeSections, type PortfolioTheme } from '$lib/portfolio-themes';
	import { assetUrl } from '$lib/presentation-templates';
	import { formatDateRangeVerbose } from '$lib/tools/date-utils';
	import { rolePlace } from '$lib/work-mode';

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

	const config = $derived(theme?.config ?? {});
	const sections = $derived(themeSections(config));
	const accent = $derived(config.accent ?? '#2563eb');
	const headingFont = $derived(config.fonts?.heading ?? 'Poppins');
	const bodyFont = $derived(config.fonts?.body ?? 'Noto Sans');

	const lists = $derived(siteLists(profile, versionId));
	const show = $derived(lists.show);
	const work = $derived(lists.work);
	const skillCategories = $derived(lists.skillCategories);
	const educations = $derived(lists.educations);
	const certificates = $derived(lists.certificates);
	const languages = $derived(lists.languages);
	const references = $derived(lists.references);
	const highlights = $derived(lists.highlights);
	// What the career prints in full and what it lists briefly; see site-lists.ts.
	const career = $derived(careerView(lists, config));

	/** Whether a section has anything to render, asked before its heading is. */
	function hasContent(section: string): boolean {
		switch (section) {
			case 'header':
				return true;
			case 'summary':
				return !!profile.summary;
			case 'highlights':
				return highlights.length > 0;
			case 'featured':
				return career.selectedWork;
			case 'work':
				return work.length > 0;
			case 'projects':
				return career.fullProjects.length + career.briefProjects.length > 0;
			case 'sideProjects':
				return career.fullSideProjects.length + career.briefSideProjects.length > 0;
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
		featured: 'Selected work',
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
				{:else if section === 'featured'}
					{#each lists.featured as { kind, project: p } (`${kind}-${p.id}`)}
						{@const technologies = show(
							kind === 'role' ? p.work_experience_project_technologies : p.side_project_technologies
						)}
						{@const meta = [
							kind === 'role' ? p.company : 'Side project',
							p.project_role,
							formatDateRangeVerbose(p.start_date, p.end_date)
						]
							.filter(Boolean)
							.join(' · ')}
						{@const link = p.url || (kind === 'side' ? p.repo_url : null)}
						<article class="entry featured">
							<h3>
								{#if link}<ExternalLink href={link}>{p.name}</ExternalLink>{:else}{p.name}{/if}
							</h3>
							{#if meta}<p class="meta">{meta}</p>{/if}
							{#if kind === 'role'}
								{#if p.description}<p class="prose">{p.description}</p>{/if}
								{#if p.outcome}<p class="prose outcome">{p.outcome}</p>{/if}
							{:else}
								{#if p.summary}<p class="prose">{p.summary}</p>{/if}
								{#if p.side_project_achievements?.length}
									<ul class="bullets">
										{#each p.side_project_achievements as a (a.id)}
											<li>{a.description}</li>
										{/each}
									</ul>
								{/if}
							{/if}
							{#if technologies.length}
								<ul class="tags">
									{#each technologies as t (t.id)}
										<li>{t.name}</li>
									{/each}
								</ul>
							{/if}
						</article>
					{/each}
				{:else if section === 'highlights'}
					<ul class="bullets">
						{#each highlights as h (h.id)}
							<li>{h.text}</li>
						{/each}
					</ul>
				{:else if section === 'work'}
					{#each career.fullRoles as role (role.id)}
						{@const technologies = show(role.work_experience_technologies, 'technology')}
						{@const place = rolePlace(role)}
						{@const achievements = splitAchievements(
							show(role.work_experience_achievements, 'achievement'),
							career.detail.achievementsPerRole
						)}
						<article class="entry">
							<!-- Each separator sits inside an expression: Svelte drops the
							     whitespace a block starts with, so a literal " · " inside
							     {#if} printed as "Engineer· TechCorp". -->
							<h3>
								{role.position}{#if role.name}{` · ${role.name}`}{/if}
							</h3>
							<p class="meta">
								{formatDateRangeVerbose(
									role.start_date,
									role.end_date
								)}{#if place}{` · ${place}`}{/if}
							</p>
							{#if role.summary}<p class="prose">{role.summary}</p>{/if}
							{#if achievements.shown.length}
								<ul class="bullets">
									{#each achievements.shown as a (a.id)}
										<li>{a.description}</li>
									{/each}
								</ul>
							{/if}
							{#if achievements.more.length}
								<details class="more">
									<summary>Show {achievements.more.length} more</summary>
									<ul class="bullets">
										{#each achievements.more as a (a.id)}
											<li>{a.description}</li>
										{/each}
									</ul>
								</details>
							{/if}
							{#if technologies.length}
								<ul class="tags">
									{#each technologies as t (t.id)}
										<li>{t.name}</li>
									{/each}
								</ul>
							{/if}
						</article>
					{/each}
					{@render briefList(career.briefRoles.map(briefRole), 'Earlier roles')}
				{:else if section === 'projects'}
					{#each career.fullProjects as p (p.id)}
						{@const technologies = show(p.work_experience_project_technologies)}
						<!-- A project's technologies print here and on no document, so
						     the site is the one place their tags are read. -->
						<article class="entry">
							<h3>
								{#if p.url}<a href={p.url} rel="noopener">{p.name}</a>{:else}{p.name}{/if}
							</h3>
							{#if p.project_role || p.company}
								<p class="meta">{[p.project_role, p.company].filter(Boolean).join(' · ')}</p>
							{/if}
							{#if p.description}<p class="prose">{p.description}</p>{/if}
							{#if p.outcome}<p class="prose outcome">{p.outcome}</p>{/if}
							{#if technologies.length}
								<ul class="tags">
									{#each technologies as t (t.id)}
										<li>{t.name}</li>
									{/each}
								</ul>
							{/if}
						</article>
					{/each}
					{@render briefList(career.briefProjects.map((p) => briefRoleProject(p, show)))}
				{:else if section === 'sideProjects'}
					{#each career.fullSideProjects as p (p.id)}
						{@const technologies = show(p.side_project_technologies)}
						{@const meta = [p.project_role, formatDateRangeVerbose(p.start_date, p.end_date)]
							.filter(Boolean)
							.join(' · ')}
						<article class="entry">
							<h3>
								{#if p.url}<a href={p.url} rel="noopener">{p.name}</a>{:else}{p.name}{/if}
							</h3>
							<p class="meta">
								{meta}{#if p.repo_url}{meta ? ' · ' : ''}<a href={p.repo_url} rel="noopener"
										>source</a
									>{/if}
							</p>
							{#if p.summary}<p class="prose">{p.summary}</p>{/if}
							{#if p.side_project_achievements?.length}
								<ul class="bullets">
									{#each p.side_project_achievements as a (a.id)}
										<li>{a.description}</li>
									{/each}
								</ul>
							{/if}
							{#if technologies.length}
								<ul class="tags">
									{#each technologies as t (t.id)}
										<li>{t.name}</li>
									{/each}
								</ul>
							{/if}
						</article>
					{/each}
					{@render briefList(career.briefSideProjects.map((p) => briefSideProject(p, show)))}
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

<!--
	An entry the career lists briefly (see brief-entries.ts): its line, and
	behind a native disclosure whatever else it holds. The separator sits in an
	expression because Svelte drops the whitespace a block starts with.
-->
{#snippet briefList(entries: BriefEntry[], heading?: string)}
	{#if entries.length}
		<div class="brief">
			{#if heading}<h3 class="brief-heading">{heading}</h3>{/if}
			<ul class="brief-list">
				{#each entries as entry (entry.key)}
					<li>
						{#if hasDetails(entry)}
							<details>
								<summary>{@render briefLine(entry)}</summary>
								{#each entry.paragraphs as text, i (i)}
									<p class="prose">{text}</p>
								{/each}
								{#if entry.bullets.length}
									<ul class="bullets">
										{#each entry.bullets as bullet, i (i)}
											<li>{bullet}</li>
										{/each}
									</ul>
								{/if}
								{#if entry.link}
									<p class="meta"><ExternalLink href={entry.link}>{entry.link}</ExternalLink></p>
								{/if}
								{#if entry.technologies.length}
									<ul class="tags">
										{#each entry.technologies as name, i (i)}
											<li>{name}</li>
										{/each}
									</ul>
								{/if}
							</details>
						{:else}
							{@render briefLine(entry)}
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}
{/snippet}

{#snippet briefLine(entry: BriefEntry)}
	<strong>{entry.name}</strong>{#if entry.meta.length}<span class="meta-inline"
			>{` · ${entry.meta.join(' · ')}`}</span
		>{/if}
{/snippet}

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

	.featured {
		border-left: 3px solid var(--accent);
		padding-left: 1rem;
	}

	.more summary,
	.brief-list summary {
		cursor: pointer;
	}

	.more summary {
		color: var(--accent);
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	.entry + .brief {
		margin-top: 1.75rem;
	}

	.brief-heading {
		color: var(--muted);
		font-size: 0.9rem;
		margin: 0 0 0.5rem;
	}

	.brief-list {
		border-top: 1px solid var(--line);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.brief-list > li {
		border-bottom: 1px solid var(--line);
		padding: 0.55rem 0;
	}

	.meta-inline {
		color: var(--muted);
		font-size: 0.875rem;
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
