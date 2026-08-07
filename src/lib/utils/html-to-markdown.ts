/**
 * Minimal HTML → Markdown converter for legacy rich-text content.
 *
 * Profile-level interview cheat sheets used to be authored in a TipTap
 * rich-text editor and stored as HTML (`<h1>`, `<p>`, nested `<ul>/<li>`, bold,
 * links). The conversational cheat-sheet editor stores everything as Markdown
 * instead, so this normalizes any still-HTML row on read — non-destructively:
 * the stored HTML is left untouched until the row is next saved, at which point
 * it persists as Markdown.
 *
 * Scope is deliberately the TipTap output tag set, not arbitrary HTML: headings
 * (h1–h6), paragraphs, ordered/unordered lists with nesting, bold, italic, and
 * links. Anything else degrades to its text content. `renderSafeMarkdown`
 * escapes raw HTML, so leaving legacy markup unconverted would show the tags
 * verbatim — hence this pass.
 */

/** Heuristic: does this string contain block/inline HTML we should convert? */
export function isLikelyHtml(value: string | null | undefined): boolean {
	if (!value) return false;
	return /<(h[1-6]|p|ul|ol|li|strong|em|b|i|a|br)\b[^>]*>/i.test(value);
}

const ENTITIES: Record<string, string> = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&#39;': "'",
	'&apos;': "'",
	'&nbsp;': ' '
};

function decodeEntities(text: string): string {
	return text
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
		.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
		.replace(/&[a-z]+;|&#\d+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

/** Convert inline formatting tags to Markdown, before block parsing. */
function inlinePass(html: string): string {
	return html
		.replace(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
		.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
		.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
		.replace(/<br\s*\/?>/gi, '\n');
}

/** Strip any remaining tags from a leaf run and decode entities. */
function leafText(html: string): string {
	return decodeEntities(html.replace(/<[^>]+>/g, ''))
		.replace(/\s+/g, ' ')
		.trim();
}

/** Index just past the `</ul>`/`</ol>` that closes the list opened at `from`. */
function findListEnd(html: string, from: number): number {
	const tag = /<(\/?)(ul|ol)\b[^>]*>/gi;
	tag.lastIndex = from;
	let depth = 1;
	let m: RegExpExecArray | null;
	while ((m = tag.exec(html))) {
		depth += m[1] ? -1 : 1;
		if (depth === 0) return tag.lastIndex;
	}
	return html.length;
}

/** Split a list's inner HTML into its direct `<li>` children's inner HTML. */
function directListItems(inner: string): string[] {
	const items: string[] = [];
	const tag = /<(\/?)(ul|ol|li)\b[^>]*>/gi;
	let depth = 0; // nested-list depth; direct <li> live at depth 0
	let liStart = -1;
	let m: RegExpExecArray | null;
	while ((m = tag.exec(inner))) {
		const closing = !!m[1];
		const name = m[2].toLowerCase();
		if (name === 'ul' || name === 'ol') {
			depth += closing ? -1 : 1;
		} else if (name === 'li' && depth === 0) {
			if (!closing) {
				liStart = tag.lastIndex;
			} else if (liStart >= 0) {
				items.push(inner.slice(liStart, m.index));
				liStart = -1;
			}
		}
	}
	return items;
}

/** Render a `<ul>`/`<ol>` (given its inner HTML) as Markdown list lines. */
function renderList(inner: string, ordered: boolean, depth: number): string {
	const indent = '  '.repeat(depth);
	let out = '';
	let n = 1;
	for (const item of directListItems(inner)) {
		// Split the item into its own text (before any nested list) and the nested
		// lists that follow — TipTap emits `<p>text</p><ul>…</ul>` inside each <li>.
		const nestedAt = item.search(/<(ul|ol)\b[^>]*>/i);
		const lead = nestedAt === -1 ? item : item.slice(0, nestedAt);
		const marker = ordered ? `${n}. ` : '- ';
		const text = leafText(lead);
		if (text) out += `${indent}${marker}${text}\n`;

		let rest = nestedAt === -1 ? '' : item.slice(nestedAt);
		while (rest) {
			const open = rest.match(/<(ul|ol)\b[^>]*>/i);
			if (!open || open.index === undefined) break;
			const start = open.index + open[0].length;
			out += renderList(
				rest.slice(start, findCloseStart(rest, start)),
				open[1].toLowerCase() === 'ol',
				depth + 1
			);
			rest = rest.slice(findListEnd(rest, start));
		}
		n++;
	}
	return out + (depth === 0 ? '\n' : '');
}

/** Start index of the `</ul>`/`</ol>` closing the list opened at `from`. */
function findCloseStart(html: string, from: number): number {
	const tag = /<(\/?)(ul|ol)\b[^>]*>/gi;
	tag.lastIndex = from;
	let depth = 1;
	let m: RegExpExecArray | null;
	while ((m = tag.exec(html))) {
		depth += m[1] ? -1 : 1;
		if (depth === 0) return m.index;
	}
	return html.length;
}

/**
 * Convert legacy TipTap HTML to Markdown. Returns the input unchanged when it
 * doesn't look like HTML, so it's safe to call on content that's already
 * Markdown (idempotent for the non-HTML case).
 */
export function htmlToMarkdown(html: string | null | undefined): string {
	if (!html) return '';
	if (!isLikelyHtml(html)) return html;

	const src = inlinePass(html);
	let out = '';
	let i = 0;
	const block = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>|<p\b[^>]*>([\s\S]*?)<\/p>|<(ul|ol)\b[^>]*>/gi;
	block.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = block.exec(src))) {
		if (m.index < i) continue; // inside a list we already consumed
		if (m[1]) {
			// Heading
			out += `${'#'.repeat(Number(m[1]))} ${leafText(m[2])}\n\n`;
			i = block.lastIndex;
		} else if (m[3] !== undefined) {
			// Paragraph
			const text = leafText(m[3]);
			if (text) out += `${text}\n\n`;
			i = block.lastIndex;
		} else if (m[4]) {
			// List — consume the whole balanced block and skip the parser past it.
			const start = block.lastIndex;
			const end = findCloseStart(src, start);
			out += renderList(src.slice(start, end), m[4].toLowerCase() === 'ol', 0);
			i = findListEnd(src, start);
			block.lastIndex = i;
		}
	}

	return out.replace(/\n{3,}/g, '\n\n').trim();
}
