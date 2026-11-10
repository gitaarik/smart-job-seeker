import { describe, expect, test } from 'vitest';
import { siteLists, type Row } from '../site-lists';
import { hasStory, paragraphs, SLIDE_TECHNOLOGIES, workSlides } from './work-slides';

/** What a featured project holds once it is a slide, whichever list it came from. */

function slidesFor(profile: Row) {
	const lists = siteLists({ profile_versions: [], side_projects: [], ...profile }, null);
	return workSlides(lists.featured, lists.show, lists.work, 'Side project');
}

describe('workSlides', () => {
	test('a role project names its employer and keeps its paragraphs apart', () => {
		const [slide] = slidesFor({
			work_experiences: [
				{
					id: 1,
					name: 'NowCorp',
					logo_id: 'uuid-1',
					work_experience_projects: [
						{
							id: 10,
							name: 'Payments rewrite',
							featured: true,
							url: 'https://now.example',
							project_role: 'Lead',
							start_date: '2024-01-01',
							description: 'First part.\n\nSecond part.',
							outcome: 'Faster checkout.',
							work_experience_project_technologies: [
								{ id: 1, name: 'Django' },
								{ id: 2, name: 'Hidden', tags: ['!portfolio'] }
							]
						}
					]
				}
			]
		});

		expect(slide).toMatchObject({
			key: 'role-10',
			context: 'NowCorp',
			logo: '/assets/uuid-1',
			name: 'Payments rewrite',
			link: 'https://now.example',
			role: 'Lead',
			story: ['First part.', 'Second part.'],
			outcome: ['Faster checkout.'],
			points: [],
			// The site's own filter: a technology switched off the site stays off the slide.
			technologies: ['Django']
		});
		expect(slide.period).toContain('2024');
	});

	test('a featured role is titled by its position and told from its summary and achievements', () => {
		const [slide] = slidesFor({
			work_experiences: [
				{
					id: 3,
					name: 'ReviewCo',
					position: 'Code Reviewer',
					featured: true,
					logo_id: 'uuid-3',
					start_date: '2026-10-06',
					end_date: null,
					summary: 'Reviews code.\n\nFor model training.',
					work_experience_achievements: [
						{ id: 1, description: 'Graded the changes.' },
						{ id: 2, description: 'Kept off the site.', tags: ['!portfolio'] },
						{ id: 3, description: '  ' }
					],
					work_experience_technologies: [
						{ id: 1, name: 'Python' },
						{ id: 2, name: 'Hidden', tags: ['!portfolio'] }
					],
					work_experience_projects: [{ id: 30, name: 'Not featured' }]
				}
			]
		});

		expect(slide).toMatchObject({
			key: 'experience-3',
			context: 'ReviewCo',
			logo: '/assets/uuid-3',
			name: 'Code Reviewer',
			link: null,
			role: null,
			story: ['Reviews code.', 'For model training.'],
			outcome: [],
			// Read as the career reads them: what the site leaves out stays out.
			points: ['Graded the changes.'],
			technologies: ['Python']
		});
		expect(slide.period).toContain('2026');
		expect(hasStory(slide)).toBe(true);
	});

	test('a side project says so, links its repository and lists its highlights', () => {
		const [slide] = slidesFor({
			work_experiences: [],
			side_projects: [
				{
					id: 40,
					name: 'Side A',
					featured: true,
					repo_url: 'https://github.com/a/b',
					summary: 'A library.',
					side_project_achievements: [{ id: 1, description: '200 stars' }],
					side_project_technologies: []
				}
			]
		});

		expect(slide).toMatchObject({
			key: 'side-40',
			context: 'Side project',
			logo: null,
			link: 'https://github.com/a/b',
			story: ['A library.'],
			outcome: [],
			points: ['200 stars']
		});
	});

	test("a side project's slide shows its own logo, and never its image", () => {
		const project = {
			name: 'Side B',
			featured: true,
			// The image is a screenshot more often than not: no logo is better than that.
			image_id: 'uuid-image',
			side_project_achievements: [],
			side_project_technologies: []
		};
		const [withLogo] = slidesFor({
			work_experiences: [],
			side_projects: [{ ...project, id: 41, logo_id: 'uuid-logo' }]
		});
		const [withImageOnly] = slidesFor({
			work_experiences: [],
			side_projects: [{ ...project, id: 42 }]
		});

		expect(withLogo.logo).toBe('/assets/uuid-logo');
		expect(withImageOnly.logo).toBeNull();
	});
});

describe('hasStory', () => {
	const bare = {
		key: 'k',
		context: '',
		logo: null,
		name: 'X',
		link: null,
		role: null,
		period: null,
		story: [],
		outcome: [],
		points: [],
		technologies: []
	};

	test('any write-up opens a story, since the teaser clips it', () => {
		expect(hasStory({ ...bare, story: ['One line.'] })).toBe(true);
		expect(hasStory({ ...bare, outcome: ['Done.'] })).toBe(true);
	});

	test('a name and a short stack have nothing more to tell', () => {
		expect(hasStory({ ...bare, technologies: ['Go'] })).toBe(false);
		const long = Array.from({ length: SLIDE_TECHNOLOGIES + 1 }, (_, i) => `T${i}`);
		expect(hasStory({ ...bare, technologies: long })).toBe(true);
	});
});

describe('paragraphs', () => {
	test('splits on blank lines and drops the empty ones', () => {
		expect(paragraphs('a\n\n\n b \n\n')).toEqual(['a', 'b']);
		expect(paragraphs('one\nline')).toEqual(['one\nline']);
		expect(paragraphs(null)).toEqual([]);
	});
});
