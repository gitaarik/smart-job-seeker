import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import type { ComponentProps } from 'svelte';
import StructuredResume from './StructuredResume.svelte';

type Profile = ComponentProps<typeof StructuredResume>['profile'];

/**
 * The certificate block of the renderer every DB-backed template goes through.
 *
 * Until 2026-09-26 it printed contact details, work, education and skills, and
 * no certificate at all: a certificate reached the default layout only, so on a
 * branded CV the section simply did not exist.
 */

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/p/alex-morgan/cv') } }));

const profile = (certificates: NonNullable<Profile['certificates']>): Profile => ({
	name: 'Alex Morgan',
	title: null,
	subtitle: null,
	email_address: null,
	phone_number: null,
	location: null,
	personal_website: null,
	linkedin_profile: null,
	github_profile: null,
	summary: null,
	work_experiences: [],
	educations: [],
	tech_skill_categories: [],
	profile_versions: [],
	certificates
});

describe('StructuredResume — certificates', () => {
	test('prints each certificate on its own line, validity as years', () => {
		render(StructuredResume, {
			props: {
				config: {},
				profile: profile([
					{
						name: 'Certified Kubernetes Administrator',
						issuer: 'The Linux Foundation',
						date: '2023-03-15',
						expiry_date: '2025-03-15'
					},
					{ name: 'PRINCE2 Foundation', issuer: null, date: '2019-06-01', expiry_date: null }
				])
			}
		});

		expect(screen.getByText('Certificates')).toBeTruthy();
		expect(
			screen.getByText('Certified Kubernetes Administrator – The Linux Foundation, 2023 - 2025')
		).toBeTruthy();
		expect(screen.getByText('PRINCE2 Foundation – 2019')).toBeTruthy();
	});

	test('prints no section for a profile without certificates', () => {
		render(StructuredResume, { props: { config: {}, profile: profile([]) } });
		expect(screen.queryByText('Certificates')).toBeNull();
	});

	/**
	 * Tags, since 2026-10-05. Before, a certificate had none and this renderer
	 * printed every one on every document, so one meant for the CV could only be
	 * kept off a resume by deleting it.
	 */
	describe('tags', () => {
		const tagged = (tags: string[] | null): Profile => ({
			...profile([
				{ name: 'PRINCE2 Foundation', issuer: null, date: '2019-06-01', expiry_date: null, tags },
				{ name: 'AWS Solutions Architect', issuer: null, date: '2022-01-10', expiry_date: null }
			]),
			profile_versions: [{ id: 5, slug: 'senior', toggles: [], extension_links: [] }]
		});

		test('keeps one tagged for the CV off the resume, and prints it on the CV', () => {
			const { unmount } = render(StructuredResume, {
				props: { config: {}, type: 'resume', profile: tagged(['cv']) }
			});
			expect(screen.queryByText('PRINCE2 Foundation – 2019')).toBeNull();
			expect(screen.getByText('AWS Solutions Architect – 2022')).toBeTruthy();
			unmount();

			render(StructuredResume, { props: { config: {}, type: 'cv', profile: tagged(['cv']) } });
			expect(screen.getByText('PRINCE2 Foundation – 2019')).toBeTruthy();
		});

		test('prints one tagged onto a version on that version and not the plain document', () => {
			const { unmount } = render(StructuredResume, {
				props: { config: {}, type: 'resume', versionId: 5, profile: tagged(['senior']) }
			});
			expect(screen.getByText('PRINCE2 Foundation – 2019')).toBeTruthy();
			unmount();

			render(StructuredResume, {
				props: { config: {}, type: 'resume', profile: tagged(['senior']) }
			});
			expect(screen.queryByText('PRINCE2 Foundation – 2019')).toBeNull();
		});

		test('keeps one hidden from a version off that version only', () => {
			const { unmount } = render(StructuredResume, {
				props: { config: {}, type: 'resume', versionId: 5, profile: tagged(['!senior']) }
			});
			expect(screen.queryByText('PRINCE2 Foundation – 2019')).toBeNull();
			unmount();

			render(StructuredResume, {
				props: { config: {}, type: 'resume', profile: tagged(['!senior']) }
			});
			expect(screen.getByText('PRINCE2 Foundation – 2019')).toBeTruthy();
		});

		test('drops the heading when none of them prints', () => {
			const profileOnly: Profile = {
				...profile([
					{
						name: 'PRINCE2 Foundation',
						issuer: null,
						date: '2019-06-01',
						expiry_date: null,
						tags: ['!resume', '!cv']
					}
				])
			};
			render(StructuredResume, { props: { config: {}, type: 'resume', profile: profileOnly } });
			expect(screen.queryByText('Certificates')).toBeNull();
		});
	});
});

/**
 * The references block, added 2026-10-05. Before, this renderer printed none,
 * so a branded resume could not carry one even for a job that asked for them.
 * Same rule as the default layout: the CV prints them, the resume prints the
 * ones its version decided to show.
 */
describe('StructuredResume — references', () => {
	const references = [
		{
			id: 13,
			author: 'Elmar Krack',
			author_position: 'Co-founder of Tender-it',
			text: 'Rik took ownership of our platform.'
		},
		{ id: 14, author: 'Michaël de Groot', author_position: null, text: 'A pleasure to work with.' }
	];
	const withReferences = (overrides: Array<Record<string, unknown>> = []): Profile => ({
		...profile([]),
		references,
		profile_versions: [{ id: 5, slug: 'app-91', toggles: [], extension_links: [], overrides }]
	});

	test('prints none on a resume whose version decided nothing about them', () => {
		render(StructuredResume, {
			props: { config: {}, type: 'resume', versionId: 5, profile: withReferences() }
		});
		expect(screen.queryByText('References')).toBeNull();
		expect(screen.queryByText('Elmar Krack, Co-founder of Tender-it')).toBeNull();
	});

	test('prints every reference on a CV, with the note that contact details are on request', () => {
		render(StructuredResume, {
			props: { config: {}, type: 'cv', versionId: 5, profile: withReferences() }
		});
		expect(screen.getByText('References')).toBeTruthy();
		expect(screen.getByText('Elmar Krack, Co-founder of Tender-it')).toBeTruthy();
		expect(screen.getByText('“Rik took ownership of our platform.”')).toBeTruthy();
		// No position, no dangling comma.
		expect(screen.getByText('Michaël de Groot')).toBeTruthy();
		expect(screen.getByText('Contact details available upon request')).toBeTruthy();
	});

	test('prints the one this resume’s version put on, in the document’s language', () => {
		render(StructuredResume, {
			props: {
				config: {},
				type: 'resume',
				versionId: 5,
				locale: 'nl',
				profile: withReferences([{ entity_type: 'reference', entity_id: 13, action: 'include' }])
			}
		});
		expect(screen.getByText('Referenties')).toBeTruthy();
		expect(screen.getByText('Elmar Krack, Co-founder of Tender-it')).toBeTruthy();
		expect(screen.queryByText('Michaël de Groot')).toBeNull();
	});
});

/**
 * The optional parts a template prints, read from its config (DocumentSections)
 * the way tailoring and coverage read them. Until 2026-10-11 this renderer had
 * no projects section, and the TECH line printed on every template; a template
 * that says nothing now prints both.
 */
describe('StructuredResume — the parts a template prints', () => {
	const withWork = (): Profile => ({
		...profile([]),
		work_experiences: [
			{
				name: 'Chipta',
				location: null,
				position: 'Lead Engineer',
				start_date: '2015-09-01',
				end_date: '2025-03-01',
				headline: null,
				tags: null,
				work_experience_achievements: [],
				work_experience_technologies: [{ name: 'Django' }, { name: 'React' }]
			}
		],
		side_projects: [
			{
				name: 'LitState',
				url: 'https://github.com/gitaarik/lit-state',
				start_date: '2020-04-01',
				end_date: null,
				summary: 'State management for Lit web components.',
				tags: null
			},
			{
				name: 'Jazzchords',
				url: null,
				start_date: '2012-01-01',
				end_date: '2013-01-01',
				summary: 'A chord trainer.',
				tags: ['!resume']
			}
		]
	});

	test('prints the TECH line and the side projects when the config says nothing', () => {
		render(StructuredResume, { props: { config: {}, type: 'resume', profile: withWork() } });
		expect(screen.getByText('Django, React')).toBeTruthy();
		expect(screen.getByText('Side projects')).toBeTruthy();
		expect(screen.getByText('LitState')).toBeTruthy();
	});

	test('leaves the side projects off a template that says so, as Citrus does', () => {
		render(StructuredResume, {
			props: {
				config: { sections: { technologies: true, sideProjects: false } },
				type: 'resume',
				profile: withWork()
			}
		});
		expect(screen.getByText('Django, React')).toBeTruthy();
		expect(screen.queryByText('Side projects')).toBeNull();
		expect(screen.queryByText('LitState')).toBeNull();
	});

	test('prints them through the same tags, in the document’s language', () => {
		render(StructuredResume, {
			props: {
				config: { sections: { sideProjects: true } },
				type: 'resume',
				locale: 'nl',
				profile: withWork()
			}
		});
		expect(screen.getByText('Nevenprojecten')).toBeTruthy();
		expect(screen.getByText('LitState')).toBeTruthy();
		expect(screen.getByText('04/2020 - Heden')).toBeTruthy();
		expect(screen.getByText('State management for Lit web components.')).toBeTruthy();
		expect(screen.getByText('https://github.com/gitaarik/lit-state')).toBeTruthy();
		// Kept off resumes by its own tag, as the default layout keeps it off.
		expect(screen.queryByText('Jazzchords')).toBeNull();
	});

	test('leaves the TECH line off a template that turns it off', () => {
		render(StructuredResume, {
			props: {
				config: { sections: { technologies: false } },
				type: 'resume',
				profile: withWork()
			}
		});
		expect(screen.getByText('Lead Engineer')).toBeTruthy();
		expect(screen.queryByText('Django, React')).toBeNull();
		expect(screen.queryByText('TECH:')).toBeNull();
	});
});
