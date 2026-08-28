/**
 * Pins the one thing `decodeMarkdownEntities` exists for: what TipTap's
 * markdown serializer actually does to a `&` the applicant typed.
 *
 * The unit tests next to the helper cover the decode in isolation; they would
 * keep passing if a TipTap upgrade stopped encoding, or started encoding
 * something else. This drives the real editor, so the assumption stays checked
 * against the library rather than against a comment about it.
 *
 * Typing is modelled by building the document from a text node rather than by
 * parsing markdown, because the two directions are separate: the parser decodes
 * entities on the way in, so seeding markdown would measure the round trip and
 * not the serializer this helper inverts.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { Content, Editor as EditorType, Extensions } from '@tiptap/core';
import { decodeMarkdownEntities } from '$lib/utils/markdown-entities';

let Editor: typeof EditorType;
let extensions: Extensions;

beforeAll(async () => {
	Editor = (await import('@tiptap/core')).Editor;
	const StarterKit = (await import('@tiptap/starter-kit')).default;
	const { Markdown } = await import('@tiptap/markdown');
	extensions = [StarterKit, Markdown];
});

/** Serialize a markdown editor configured the way SimpleEditor configures one. */
function serialize(content: Content, contentType?: 'markdown'): string {
	const element = document.createElement('div');
	document.body.appendChild(element);
	const editor = new Editor({ element, extensions, content, ...(contentType && { contentType }) });
	const markdown = editor.getMarkdown();
	editor.destroy();
	element.remove();
	return markdown;
}

/** What the editor writes out for a paragraph the applicant typed. */
function typed(text: string): { raw: string; decoded: string } {
	const raw = serialize({
		type: 'doc',
		content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
	});
	return { raw, decoded: decodeMarkdownEntities(raw) };
}

describe('SimpleEditor markdown output', () => {
	it('still encodes HTML entities, which is why the decode is needed', () => {
		expect(typed('Groq & Gemini').raw).toContain('&amp;');
	});

	it('gives back the characters the applicant typed', () => {
		expect(typed('Groq & Gemini').decoded).toBe('Groq & Gemini');
		expect(typed('scale from 1 to <10 people').decoded).toBe('scale from 1 to <10 people');
		expect(typed('he said "no"').decoded).toBe('he said "no"');
	});

	it('keeps an entity the applicant typed out as five characters', () => {
		expect(typed('type &amp; for an ampersand').decoded).toBe('type &amp; for an ampersand');
	});

	it('does not touch entities inside a code fence', () => {
		expect(decodeMarkdownEntities(serialize('```\n<p>a &amp; b</p>\n```', 'markdown'))).toContain(
			'&amp;'
		);
	});

	it('normalizes an already-corrupted answer when it is edited and saved again', () => {
		// The parser reads stored markdown as markdown, where `&amp;` means `&`.
		// So reopening one of the answers this bug produced and saving it repairs
		// it, rather than encoding it a second time.
		expect(decodeMarkdownEntities(serialize('Groq &amp; Gemini', 'markdown'))).toBe(
			'Groq & Gemini'
		);
	});
});
