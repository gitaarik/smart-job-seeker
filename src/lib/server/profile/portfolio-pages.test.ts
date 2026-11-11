import { describe, expect, test } from 'vitest';
import { featuredKey, siteLists, type Row } from '$lib/components/PortfolioSite/site-lists';
import { keySkillLines } from '$lib/components/PortfolioSite/key-skills';
import { homePageProfile, portfolioHrefs } from './portfolio-pages';

/**
 * The public half of a site with a private CV page carries only what it
 * renders. Its data is serialised into the HTML, so anything left in the tree
 * is published whether or not the page prints it: these check the career is
 * not there at all, and that what is there still renders what it did.
 */

function tree(): Row {
	return {
		id: 1,
		name: 'Alex Morgan',
		summary: 'A CV summary.',
		about_me_text: 'About me.',
		profile_versions: [],
		highlights: [
			{ id: 1, type: 'highlight', text: 'Ten years of Python' },
			{ id: 2, type: 'key_skill', text: 'Python, Django' },
			{ id: 3, type: 'contact_for', text: 'Consulting' }
		],
		references: [{ id: 5, author: 'Sam', text: 'Great to work with.' }],
		languages: [{ id: 6, name: 'Dutch' }],
		educations: [{ id: 7, institution: 'Nova College' }],
		certificates: [{ id: 8, name: 'EF SET' }],
		tech_skill_categories: [{ id: 9, name: 'Backend', tech_skills: [{ id: 90, name: 'Go' }] }],
		work_experiences: [
			{
				id: 10,
				name: 'NowCorp',
				position: 'Lead',
				summary: 'Led the team.',
				logo_id: 'logo-uuid',
				tags: null,
				work_experience_achievements: [{ id: 100, description: 'Cut costs 40%' }],
				work_experience_technologies: [{ id: 101, name: 'Celery' }],
				work_experience_projects: [
					{
						id: 11,
						name: 'Payments rewrite',
						description: 'Rewrote the payments.',
						featured: true,
						work_experience_project_technologies: [{ id: 110, name: 'Stripe' }]
					},
					{ id: 12, name: 'Admin cleanup', description: 'Tidied the admin.' }
				]
			},
			{
				id: 20,
				name: 'OldCorp',
				work_experience_achievements: [{ id: 200, description: 'Shipped v1' }],
				work_experience_projects: [{ id: 21, name: 'Legacy port' }]
			}
		],
		side_projects: [
			{ id: 30, name: 'Side A', featured: true, summary: 'A library.' },
			{ id: 31, name: 'Side B', summary: 'A toy.' }
		]
	};
}

describe('homePageProfile', () => {
	test('carries none of the career the CV page keeps', () => {
		const json = JSON.stringify(homePageProfile(tree(), null));
		for (const kept of [
			'A CV summary.',
			'Ten years of Python',
			'Dutch',
			'Nova College',
			'EF SET',
			'Backend',
			'Led the team.',
			'Cut costs 40%',
			'Celery',
			'Admin cleanup',
			'OldCorp',
			'Legacy port',
			'Side B'
		]) {
			expect(json, kept).not.toContain(kept);
		}
	});

	test('keeps the introduction, the quotes and the featured projects whole', () => {
		const home = homePageProfile(tree(), null);
		expect(home.about_me_text).toBe('About me.');
		expect(home.references).toHaveLength(1);
		expect(home.highlights.map((h: Row) => h.type)).toEqual(['contact_for']);
		expect(home.work_experiences).toEqual([
			{
				id: 10,
				name: 'NowCorp',
				sort: undefined,
				tags: null,
				logo_id: 'logo-uuid',
				logo_path: undefined,
				work_experience_projects: [tree().work_experiences[0].work_experience_projects[0]]
			}
		]);
		expect(home.side_projects.map((p: Row) => p.name)).toEqual(['Side A']);
	});

	test('the page still finds the same featured work in what is left', () => {
		const t = tree();
		t.work_experiences[1].featured = true;
		const before = siteLists(t, null).featured;
		const after = siteLists(homePageProfile(t, null), null).featured;
		expect(after.map(featuredKey)).toEqual(['role-11', 'experience-20', 'side-30']);
		expect(after.map(featuredKey)).toEqual(before.map(featuredKey));
		const companies = (featured: typeof before) =>
			featured.flatMap((f) => (f.kind === 'role' ? [f.project.company] : []));
		expect(companies(after)).toEqual(['NowCorp']);
	});

	test('the page keeps the order Selected work was given by hand', () => {
		const t = tree();
		t.work_experiences[1].featured = true;
		t.work_experiences[1].featured_sort = 0;
		t.side_projects[0].featured_sort = 1;
		t.work_experiences[0].work_experience_projects[0].featured_sort = 2;
		const after = siteLists(homePageProfile(t, null), null).featured;
		expect(after.map(featuredKey)).toEqual(['experience-20', 'side-30', 'role-11']);
	});

	test('a featured role keeps what its slide prints, and none of its other projects', () => {
		const t = tree();
		Object.assign(t.work_experiences[1], {
			featured: true,
			position: 'Engineer',
			start_date: '2010-01-01',
			end_date: '2014-08-08',
			summary: 'Built the first version.',
			location: 'Utrecht',
			work_experience_technologies: [{ id: 201, name: 'Perl' }]
		});
		const home = homePageProfile(t, null);
		const role = home.work_experiences.find((r: Row) => r.id === 20);

		expect(role).toMatchObject({
			featured: true,
			position: 'Engineer',
			start_date: '2010-01-01',
			end_date: '2014-08-08',
			summary: 'Built the first version.',
			work_experience_achievements: [{ id: 200, description: 'Shipped v1' }],
			work_experience_technologies: [{ id: 201, name: 'Perl' }],
			work_experience_projects: []
		});
		const json = JSON.stringify(home);
		for (const kept of ['Legacy port', 'Utrecht', 'Led the team.', 'Cut costs 40%', 'Celery']) {
			expect(json, kept).not.toContain(kept);
		}
	});

	test('what a featured entry switched off the site stays on the server', () => {
		const t = tree();
		Object.assign(t.work_experiences[1], {
			featured: true,
			work_experience_achievements: [
				{ id: 200, description: 'Shipped v1', fa_icon: 'rocket' },
				{ id: 201, description: 'A confidential detail', tags: ['!portfolio'] }
			],
			work_experience_technologies: [
				{ id: 202, name: 'Perl' },
				{ id: 203, name: 'InternalTool', tags: ['!portfolio'] }
			]
		});
		t.work_experiences[0].work_experience_projects[0].work_experience_project_technologies.push({
			id: 111,
			name: 'SecretVendor',
			tags: ['!portfolio']
		});
		t.side_projects[0].side_project_technologies = [
			{ id: 300, name: 'Rust' },
			{ id: 301, name: 'HiddenLib', tags: ['!portfolio'] }
		];

		const home = homePageProfile(t, null);
		const json = JSON.stringify(home);
		for (const kept of ['A confidential detail', 'InternalTool', 'SecretVendor', 'HiddenLib']) {
			expect(json, kept).not.toContain(kept);
		}
		const role = home.work_experiences.find((r: Row) => r.id === 20);
		expect(role.work_experience_achievements).toEqual([{ id: 200, description: 'Shipped v1' }]);
		expect(role.work_experience_technologies).toEqual([{ id: 202, name: 'Perl' }]);
		// And the page shows from that what it showed from the whole tree.
		const slides = (tree: Row) =>
			siteLists(tree, null).featured.map((f) => {
				if (f.kind !== 'experience') return featuredKey(f);
				return [featuredKey(f), f.role.work_experience_achievements.length];
			});
		expect(slides(home)).toEqual(['role-11', ['experience-20', 1], 'side-30']);
	});

	test('a featured project switched off the site does not ride along', () => {
		const t = tree();
		t.work_experiences[0].work_experience_projects[0].tags = ['!portfolio'];
		const home = homePageProfile(t, null);
		expect(home.work_experiences).toEqual([]);
		expect(JSON.stringify(home)).not.toContain('Payments rewrite');
	});

	test('carries the skills the Key skills box names, and nothing else of the Skills', () => {
		const t = tree();
		t.tech_skill_categories = [
			{
				id: 9,
				name: 'Backend',
				note: 'A private hint',
				fa_icon: 'python',
				tech_skills: [
					{ id: 90, name: 'Go', level: 'Expert', years_experience: 9 },
					{ id: 91, name: 'Secret framework', tags: ['!portfolio'] },
					{ id: 92, name: 'Rust' },
					{ id: 93, name: 'Zig', tags: ['!resume', '!cv'] },
					{ id: 94, name: 'Elixir' },
					{ id: 95, name: 'Flask' }
				]
			},
			{
				id: 8,
				name: 'Off the site',
				tags: ['!portfolio'],
				tech_skills: [{ id: 80, name: 'Cobol' }]
			}
		];
		const home = homePageProfile(t, null);
		expect(home.tech_skill_categories).toEqual([
			{
				id: 9,
				fa_icon: 'python',
				tech_skills: [
					{ id: 90, name: 'Go' },
					{ id: 92, name: 'Rust' },
					{ id: 93, name: 'Zig', tags: ['!resume', '!cv'] },
					{ id: 94, name: 'Elixir' }
				]
			}
		]);
		const json = JSON.stringify(home);
		for (const kept of [
			'Backend',
			'A private hint',
			'Expert',
			'Secret framework',
			'Flask',
			'Cobol'
		]) {
			expect(json, kept).not.toContain(kept);
		}
		// And the box says from that what it said from the whole tree.
		const box = (tree: Row) => keySkillLines(siteLists(tree, null).skillCategories);
		expect(box(home)).toEqual([{ key: 9, text: 'Go, Rust, Zig, Elixir', icon: 'python' }]);
		expect(box(home)).toEqual(box(t));
	});
});

describe('portfolioHrefs', () => {
	test('keeps the language for everyone and the preview only for the owner', () => {
		const url = new URL('https://x/p/alex/portfolio?lang=nl&theme=draft&version=ai&t=secret');
		expect(portfolioHrefs('alex', url, false)).toEqual({
			home: '/p/alex/portfolio?lang=nl',
			cv: '/p/alex/portfolio/cv?lang=nl'
		});
		expect(portfolioHrefs('alex', url, true)).toEqual({
			home: '/p/alex/portfolio?lang=nl&theme=draft&version=ai',
			cv: '/p/alex/portfolio/cv?lang=nl&theme=draft&version=ai'
		});
	});

	test('never carries a token along', () => {
		const url = new URL('https://x/p/alex/portfolio?t=secret');
		expect(portfolioHrefs('alex', url, true).cv).toBe('/p/alex/portfolio/cv');
	});
});
