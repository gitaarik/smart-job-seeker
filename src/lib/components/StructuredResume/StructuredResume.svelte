<script lang="ts">
	import { page } from '$app/state';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faEnvelope, faGlobe, faLocationDot, faPhone } from '@fortawesome/free-solid-svg-icons';
	import { faGithub, faLinkedin } from '@fortawesome/free-brands-svg-icons';
	import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
	import { formatDateRangeCompact } from '$lib/tools/date-utils';
	import { createProfileFilter } from '../ProfileDisplay/profile-filter';
	import { isContactHidden } from '$lib/resume-contact-fields';
	import { assetUrl, type ResumeTemplateConfig } from '$lib/resume-templates';
	import { templateLabel } from '$lib/resume-template-labels';

	interface WorkExperience {
		name: string | null;
		location: string | null;
		position: string | null;
		start_date: string | null;
		end_date?: string | null;
		headline?: string | null;
		tags: string[] | unknown;
		work_experience_achievements?: Array<{ description: string | null; tags: string[] | unknown }>;
		work_experience_technologies?: Array<{ name: string | null }>;
	}
	interface SkillCategory {
		name: string | null;
		tags?: string[] | unknown;
		tech_skills: Array<{ name: string | null }>;
	}
	interface Education {
		area: string | null;
		study_type: string | null;
		institution: string | null;
		location: string | null;
		tags?: string[] | unknown;
	}
	interface Profile {
		name: string | null;
		title: string | null;
		email_address: string | null;
		phone_number: string | null;
		location: string | null;
		location_timezone?: string | null;
		personal_website: string | null;
		linkedin_profile: string | null;
		github_profile: string | null;
		summary: string | null;
		work_experiences: WorkExperience[];
		educations: Education[];
		tech_skill_categories: SkillCategory[];
		profile_versions: any[];
	}

	interface Props {
		profile: Profile;
		config: ResumeTemplateConfig;
		type?: string | null;
		versionId?: number | null;
		/** Render locale for template chrome (section headings, "Present"). */
		locale?: string | null;
	}
	let { profile, config, type = null, versionId = null, locale = null }: Props = $props();

	// --- template config → local branding values ---
	const accent = config.accent ?? '#ffd400';
	const headingFont = config.fonts?.heading ?? 'Poppins';
	const bodyFont = config.fonts?.body ?? 'Carlito';
	const A = config.assets ?? {};
	const badgeUrl = assetUrl(A.badge);
	const screenBgUrl = assetUrl(A.screenBackground);
	const printBgUrl = assetUrl(A.printBackground);
	const footerUrl = assetUrl(A.footer);
	const dividerUrl = assetUrl(A.divider);
	const appendLocation = config.rules?.appendLocationToHeadline ?? false;

	const rootStyle = [
		`--accent:${accent}`,
		`--heading-font:${headingFont}`,
		`--body-font:${bodyFont}`,
		screenBgUrl ? `--screen-bg:url('${screenBgUrl}')` : ''
	]
		.filter(Boolean)
		.join(';');

	const versionFromUrl = page.url.searchParams.get('version') || '';
	const { filterOnTags, toggles } = createProfileFilter(
		profile.profile_versions,
		type,
		versionId,
		versionFromUrl
	);

	// Categories whose skills are all hidden (all profile-only, say) drop out
	// entirely, so neither an empty category nor a lone heading gets printed.
	const skills = filterOnTags(profile.tech_skill_categories ?? [])
		.map((cat) => ({ ...cat, tech_skills: filterOnTags(cat.tech_skills ?? []) }))
		.filter((cat) => cat.tech_skills.length > 0);
	const work = filterOnTags(profile.work_experiences ?? []);
	const education = filterOnTags(profile.educations ?? []);

	// Work-experience lead line. The stored headline holds only the base text;
	// when the template opts in, the job location is appended ("… in {location}.").
	function lead(job: WorkExperience): string {
		const base = (job.headline ?? '').trim();
		if (!base) return '';
		if (appendLocation) {
			const loc = (job.location ?? '').trim();
			return base + (loc ? ` in ${loc}` : '') + '.';
		}
		return base.endsWith('.') ? base : base + '.';
	}
	function tech(job: WorkExperience): string {
		return filterOnTags(job.work_experience_technologies ?? [])
			.map((t) => t.name ?? '')
			.filter(Boolean)
			.join(', ');
	}
	function eduLine(e: Education): string {
		const head = [e.area, e.study_type].filter(Boolean).join(', ');
		const tail = [e.institution, e.location].filter(Boolean).join(', ');
		return [head, tail].filter(Boolean).join(' – ');
	}

	const contactLocation = [
		profile.location,
		profile.location_timezone ? `(${profile.location_timezone})` : ''
	]
		.filter(Boolean)
		.join(' ');

	// Template-level contact overrides (brand contact points, e.g. a consultancy
	// email) replace the profile's own value; the profile value is the fallback.
	const contactOverrides = config.contact ?? {};
	const contactText = (key: string, fallback: string | null) => contactOverrides[key] ?? fallback;

	const contacts = [
		{ icon: 'mail', key: 'email', text: contactText('email', profile.email_address) },
		{ icon: 'phone', key: 'phone', text: contactText('phone', profile.phone_number) },
		{ icon: 'pin', key: 'location', text: contactText('location', contactLocation || null) },
		{ icon: 'globe', key: 'website', text: contactText('website', profile.personal_website) },
		{ icon: 'linkedin', key: 'linkedin', text: contactText('linkedin', profile.linkedin_profile) },
		{ icon: 'github', key: 'github', text: contactText('github', profile.github_profile) }
	].filter((c) => !!c.text && !isContactHidden(c.key, toggles));
</script>

{#snippet icon(name: string)}
	{@const def = (
		{
			mail: faEnvelope,
			phone: faPhone,
			pin: faLocationDot,
			globe: faGlobe,
			linkedin: faLinkedin,
			github: faGithub
		} as Record<string, IconDefinition>
	)[name]}
	{#if def}<FontAwesomeIcon icon={def} />{/if}
{/snippet}

<div class="resume" style={rootStyle}>
	<!-- Background layers. An <img> (not a CSS background) is used for print
       because a fixed <img> reliably repeats on every printed page in Chrome,
       whereas a fixed CSS background does not. Screen tiles the decorative
       background; print uses the full (decoration + footer) image so the bar
       sits at the bottom of every page. -->
	<div class="bg">
		{#if printBgUrl}<img class="bg-print" src={printBgUrl} alt="" />{/if}
	</div>
	<table class="page">
		<thead>
			<tr
				><td class="badge-cell">
					{#if badgeUrl}<img class="badge" src={badgeUrl} alt="" />{/if}
				</td></tr
			>
		</thead>
		<tfoot>
			<tr
				><td class="footer-cell">
					{#if footerUrl}<img class="footer" src={footerUrl} alt="" />{/if}
				</td></tr
			>
		</tfoot>
		<tbody>
			<tr>
				<td>
					<h1>{profile.name}</h1>
					{#if profile.title}<div class="subtitle">{profile.title}</div>{/if}
					{#if dividerUrl}<div class="wave"><img src={dividerUrl} alt="" /></div>{/if}

					{#if profile.summary}
						<p class="summary">{profile.summary}</p>
					{/if}

					{#if skills.length > 0}
						<h2>{templateLabel('skills', locale)}</h2>
						<div class="skills">
							{#each skills as cat (cat.name)}
								<div class="skill">
									<h3>{cat.name}</h3>
									<p>
										{cat.tech_skills
											.map((s) => s.name ?? '')
											.filter(Boolean)
											.join(', ')}
									</p>
								</div>
							{/each}
						</div>
					{/if}

					<div class="exp">
						<aside class="sidebar">
							{#if contacts.length > 0}
								<div class="block">
									<h2>{templateLabel('contactDetails', locale)}</h2>
									{#each contacts as c (c.icon)}
										<div class="contact-row">
											<span class="ci">{@render icon(c.icon)}</span>
											<span>{c.text}</span>
										</div>
									{/each}
								</div>
							{/if}
							{#if education.length > 0}
								<div class="block">
									<h2>{templateLabel('education', locale)}</h2>
									{#each education as e (eduLine(e))}
										<div class="edu-item">
											<span class="tl"><span class="ydot"></span><span class="tline"></span></span>
											<p>{eduLine(e)}</p>
										</div>
									{/each}
								</div>
							{/if}
						</aside>

						{#if work.length > 0}
							<h2>{templateLabel('workExperience', locale)}</h2>
							{#each work as job, i (i)}
								{@const achievements = filterOnTags(job.work_experience_achievements ?? [])}
								{@const techLine = tech(job)}
								<div class="job">
									<div class="job-meta">
										<div class="job-title">{job.position}</div>
										<div class="job-co">{job.name}</div>
										<div class="job-date">
											{formatDateRangeCompact(
												job.start_date,
												job.end_date,
												templateLabel('present', locale)
											)}
										</div>
									</div>
									<div class="job-body">
										{#if lead(job)}<p class="lead">{lead(job)}</p>{/if}
										{#if achievements.length > 0}
											<ul>
												{#each achievements as a, ai (ai)}
													<li>{a.description}</li>
												{/each}
											</ul>
										{/if}
										{#if techLine}
											<p class="tech"><span>TECH:</span> {techLine}</p>
										{/if}
									</div>
								</div>
								{#if i < work.length - 1}<hr class="jdiv" />{/if}
							{/each}
						{/if}
					</div>
				</td>
			</tr>
		</tbody>
	</table>
</div>

<style>
	/* Bundled open fonts (generic, not template-specific); a template's config
     picks families by name via --heading-font / --body-font. */
	@font-face {
		font-family: 'Poppins';
		font-style: normal;
		font-weight: 800;
		font-display: block;
		src: url('/fonts/poppins-extrabold.woff2') format('woff2');
	}
	@font-face {
		font-family: 'Carlito';
		font-style: normal;
		font-weight: 400;
		font-display: block;
		src: url('/fonts/carlito-regular.woff2') format('woff2');
	}
	@font-face {
		font-family: 'Carlito';
		font-style: normal;
		font-weight: 700;
		font-display: block;
		src: url('/fonts/carlito-bold.woff2') format('woff2');
	}

	/* White canvas (dark-mode safe) on <html>; body stays transparent so it
     doesn't paint over the background layer below. */
	:global(html) {
		background: #fff !important;
		margin: 0;
	}
	:global(body) {
		background: transparent !important;
		margin: 0;
	}

	.resume {
		position: relative;
		font-family: var(--body-font, 'Carlito'), 'Calibri', sans-serif;
		color: #3a3a3a;
		font-size: 9.1pt;
		line-height: 1.45;
		letter-spacing: 0.2px;
		-webkit-print-color-adjust: exact;
		print-color-adjust: exact;
	}
	.resume * {
		box-sizing: border-box;
	}

	/* Screen background: tile the (A4) decorative image down the sheet at true
     scale — every A4-height repeats the same pattern the PDF paints per page. */
	.bg {
		position: absolute;
		inset: 0;
		z-index: 0;
		overflow: hidden;
		background-image: var(--screen-bg, none);
		background-repeat: repeat-y;
		background-position: top center;
		background-size: 100% auto;
	}
	.bg img {
		width: 100%;
	}
	.bg-print {
		display: none;
		height: 100%;
	}

	/* thead badge repeats on every printed page; tfoot holds the footer bar on
     screen (once, at the sheet bottom). Both reserve space so content clears
     the badge/footer. */
	.page {
		position: relative;
		z-index: 1;
		width: 100%;
		border-collapse: collapse;
	}
	.badge-cell {
		padding: 0 0 10mm;
		text-align: center;
	}
	.badge {
		height: 21mm;
		display: block;
		margin: 0 auto;
	}
	.footer-cell {
		height: 23mm;
		padding: 0;
		vertical-align: bottom;
	}
	.footer {
		width: 100%;
		display: block;
	}
	tbody td {
		padding: 0 15mm;
		vertical-align: top;
	}

	h1 {
		font-family: var(--heading-font, 'Poppins'), sans-serif;
		font-weight: 800;
		font-size: 31pt;
		color: #111;
		letter-spacing: -0.5px;
		line-height: 1;
		margin: 0;
	}
	.subtitle {
		font-weight: 700;
		font-size: 12pt;
		color: #111;
		margin-top: 2px;
		letter-spacing: 0.5px;
	}
	.wave {
		margin: 5px 0 12px;
	}
	.wave img {
		width: 48mm;
		height: 2.4mm;
		object-fit: fill;
	}
	.summary {
		margin-bottom: 18px;
		text-align: left;
	}
	h2 {
		font-weight: 700;
		font-size: 14pt;
		color: #111;
		margin: 0 0 9px;
	}
	.skills {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px 30px;
		margin-bottom: 20px;
	}
	.skill h3 {
		font-weight: 700;
		font-size: 9.9pt;
		color: #111;
		margin: 0 0 1px;
	}
	.skill p {
		font-size: 9.1pt;
		color: #444;
		margin: 0;
	}
	.exp {
		overflow: hidden;
	}
	.sidebar {
		float: right;
		width: 33%;
		padding-left: 20px;
	}
	.sidebar .block {
		margin-bottom: 15px;
	}
	.contact-row {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 9px;
		font-size: 9.1pt;
	}
	.ci {
		flex: 0 0 16px;
		width: 16px;
		color: #141414;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.ci :global(svg) {
		width: 14px;
		height: 14px;
	}
	.edu-item {
		display: flex;
		gap: 11px;
		align-items: stretch;
		min-height: 15mm;
	}
	.tl {
		flex: 0 0 10px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.ydot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--accent, #ffd400);
		margin-top: 2px;
		flex: 0 0 auto;
	}
	.tline {
		width: 1.5px;
		flex: 1 1 auto;
		background: #dcdcdc;
		margin-top: 3px;
	}
	.edu-item p {
		font-size: 9.1pt;
		margin: 0;
	}
	.job {
		display: flex;
		gap: 16px;
	}
	.job-meta {
		flex: 0 0 118px;
	}
	.job-title {
		font-weight: 700;
		font-size: 9.7pt;
		color: #111;
		line-height: 1.2;
	}
	.job-co {
		font-weight: 400;
		color: #444;
		margin-top: 1px;
	}
	.job-date {
		font-weight: 700;
		font-size: 9.1pt;
		color: #111;
		margin-top: 8px;
	}
	.job-body .lead {
		margin-bottom: 4px;
	}
	.job-body ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.job-body li {
		position: relative;
		padding-left: 14px;
		margin-bottom: 3px;
	}
	.job-body li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 5px;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #555;
	}
	.tech {
		margin-top: 5px;
		font-size: 8.5pt;
		color: #3a3a3a;
	}
	.tech span {
		font-weight: 700;
		color: #111;
	}
	.jdiv {
		border: 0;
		border-top: 1px solid #d9d9d9;
		margin: 13px 0;
		clear: both;
	}

	/* Media overrides last so they win over the base rules above. */
	@media screen {
		:global(html) {
			background: #e9e9ec !important;
		}
		.resume {
			max-width: 210mm;
			min-height: 297mm;
			margin: 24px auto;
			overflow: hidden;
			box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
		}
	}

	@media print {
		/* No `@page` rule here: it can't be Svelte-scoped and would leak onto the
       default renderer (same route bundle), zeroing its margins. Page size and
       the full-bleed zero margin are set on `page.pdf()` in generate-version-pdfs. */
		/* The fixed background layer renders a hair smaller than the sheet, leaving
       a white strip on the bottom and right. Extend the layer past those edges
       (top-left anchored) so the page clips the bleed. Keep `bottom` tiny: the
       footer bar sits at the image's bottom, so extra shift pushes it below the
       fold and clips it. `right` saturates ~2mm — Chrome clamps the fixed layer
       a sub-pixel short of the sheet, so a ~0.25mm residual is unreachable from
       CSS (would need a change to the page.pdf viewport/margins). */
		.bg {
			position: fixed;
			background-image: none;
			right: -3mm;
			bottom: -0.7mm;
		}
		.bg-print {
			display: block;
			height: 100%;
		}
		/* Badge meets the top edge with no visible seam. The asset's flat top is
       solid black to its first row; a hair of negative margin seats that black
       against the page edge, covering the ~0.4mm layout gap that would otherwise
       show as a white hairline. Only solid black is clipped — no logo is cut. */
		.badge {
			margin-top: -0.5mm;
		}
		.footer {
			display: none;
		}
	}
</style>
