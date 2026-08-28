/**
 * Undo the HTML-entity encoding TipTap's markdown serializer applies to text.
 *
 * `getMarkdown()` runs every text node through `encodeHtmlEntities` (`&` →
 * `&amp;`, `<` → `&lt;`, `>` → `&gt;`) before writing it out. That is valid
 * markdown — a markdown renderer decodes it again — but the app does not treat
 * this content as markdown everywhere. The application-texts list prints a
 * question's answer as plain text, exports and LLM prompts take the stored
 * string as-is, and so a `&` the applicant typed reaches them as the five
 * characters `&amp;`. It is the editor-side twin of the entity the agent path
 * already refuses (`htmlEntityError` in `ai-chat/capabilities.ts`), and it is
 * quieter: nothing fails, and the timeline editor itself renders it correctly
 * because it parses the markdown back before showing it.
 *
 * Decoding is the exact inverse of that encode, so it survives text that is
 * *about* entities: `&` serializes to `&amp;` and comes back `&`, while a
 * literal `&amp;` serializes to `&amp;amp;` and comes back `&amp;`. `&amp;`
 * must be decoded last for that to hold — the order here mirrors TipTap's own
 * `decodeHtmlEntities`.
 *
 * Code is skipped, mirroring the serializer's `isInsideCode` guard: it leaves
 * code text raw, so an `&amp;` inside a fence or a code span is one the author
 * wrote and decoding it would be the corruption. Fenced blocks and backtick
 * spans are what the serializer emits; indented code blocks are not, so they
 * are out of scope.
 */

/**
 * A fenced block or a code span, in that order.
 *
 * A fence must open a line, which is what separates it from a code span that
 * happens to use three backticks (`` ```a & b``` `` inline). An unterminated
 * fence runs to the end, as a renderer would treat it; an unterminated span is
 * not a span at all and stays ordinary text.
 */
const CODE_SEGMENT = /(^|\n)(```+|~~~+)[^\n]*\n[\s\S]*?(?:\n\2|$)|(`+)[\s\S]*?\3/g;

function decodeSegment(text: string): string {
	return text
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, '&');
}

/** Decode the entities TipTap encoded, outside code blocks and code spans. */
export function decodeMarkdownEntities(markdown: string): string {
	let out = '';
	let last = 0;
	CODE_SEGMENT.lastIndex = 0;
	for (let m = CODE_SEGMENT.exec(markdown); m; m = CODE_SEGMENT.exec(markdown)) {
		out += decodeSegment(markdown.slice(last, m.index)) + m[0];
		last = m.index + m[0].length;
	}
	return out + decodeSegment(markdown.slice(last));
}
