import { describe, expect, it } from 'vitest';
import {
	BUILT_IN_SECTIONS,
	documentSections,
	LEGACY_TEMPLATE_SECTIONS,
	TEMPLATE_DEFAULT_SECTIONS,
	withSections
} from '$lib/resume-templates';

/**
 * What a document prints in a template (documentSections): the one answer the
 * renderer, coverage and tailoring all read, so none of them weighs a part the
 * page leaves out.
 */
describe('documentSections', () => {
	it('answers for the built-in layout when there is no template', () => {
		expect(documentSections(null)).toEqual({ technologies: false, sideProjects: true });
		expect(documentSections(undefined)).toEqual(BUILT_IN_SECTIONS);
	});

	it('gives a template that says nothing every part, side projects included', () => {
		expect(documentSections({ config: {} })).toEqual({ technologies: true, sideProjects: true });
		expect(documentSections({ config: null })).toEqual(TEMPLATE_DEFAULT_SECTIONS);
	});

	it('takes each part the config chooses, and the default for the rest', () => {
		// Citrus, and every template made before a template could choose.
		expect(documentSections({ config: { sections: { sideProjects: false } } })).toEqual({
			technologies: true,
			sideProjects: false
		});
		expect(documentSections({ config: { sections: { technologies: false } } })).toEqual({
			technologies: false,
			sideProjects: true
		});
	});

	it('reads anything but a boolean as unset, since the config is jsonb', () => {
		const config = { sections: { sideProjects: 'no', technologies: null } } as never;
		expect(documentSections({ config })).toEqual(TEMPLATE_DEFAULT_SECTIONS);
	});

	it('hands out a copy, so a caller cannot change the defaults', () => {
		const sections = documentSections(null);
		sections.sideProjects = false;
		expect(documentSections(null).sideProjects).toBe(true);
	});
});

/**
 * Sections across the archive boundary. The export writes in what a template
 * prints, so a config without `sections` can only come from an archive written
 * before templates could choose, when the renderer had no projects section.
 */
describe('withSections', () => {
	const exported = (config: Record<string, unknown>) =>
		withSections(config, documentSections({ config }));
	const imported = (config: unknown) => withSections(config, LEGACY_TEMPLATE_SECTIONS);

	it('brings an old archive’s template back printing what it printed then', () => {
		expect(imported({ accent: '#FFD400' })).toEqual({
			accent: '#FFD400',
			sections: { technologies: true, sideProjects: false }
		});
		expect(imported(null)).toEqual({ sections: LEGACY_TEMPLATE_SECTIONS });
	});

	it('keeps a template that leans on today’s defaults printing them after a round trip', () => {
		const archived = exported({ accent: '#2a9d8f' });
		expect(archived).toEqual({
			accent: '#2a9d8f',
			sections: { technologies: true, sideProjects: true }
		});
		expect(documentSections({ config: imported(archived) as never })).toEqual({
			technologies: true,
			sideProjects: true
		});
	});

	it('leaves a config that has chosen exactly as it is', () => {
		const chosen = { sections: { technologies: false } };
		expect(withSections(chosen, LEGACY_TEMPLATE_SECTIONS)).toBe(chosen);
	});

	it('leaves a config that is not an object alone', () => {
		expect(withSections('broken', LEGACY_TEMPLATE_SECTIONS)).toBe('broken');
		expect(withSections([1], LEGACY_TEMPLATE_SECTIONS)).toEqual([1]);
	});
});
