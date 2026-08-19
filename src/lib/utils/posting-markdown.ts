/**
 * Make a job posting safe to render as markdown.
 *
 * A job's `job_description` has two authors and they write differently. The
 * scraper writes stripped HTML: paragraphs separated by blank lines, and lists
 * flattened to lines indented with the whitespace the `<li>` used to carry. The
 * assistant writes markdown — `**headings**` and `*   ` bullets — because it is
 * a language model and that is what one does.
 *
 * The field was rendered as plain text, so the assistant's output arrived on the
 * page as literal asterisks. Rendering it as markdown instead fixes that and
 * breaks the other author: four leading spaces is markdown's indented code
 * block, so every scraped list turns into a grey monospace slab.
 *
 * This is the one transform that lets both render: an indented run becomes a
 * list, which is what it was before the HTML was stripped.
 */

/**
 * Turn lines indented past markdown's code-block threshold into list items,
 * leaving everything else alone.
 *
 * Skipped entirely for text containing a fenced code block — that is someone
 * deliberately writing code, and the indentation inside it is content.
 *
 * A line already carrying a list marker keeps it and only loses the indent, so a
 * nested list flattens rather than doubling up. Flattening is the lesser wrong:
 * a posting's nesting is presentational, and "- - item" is not.
 */
export function normalizePostingMarkdown(text: string): string {
	if (text.includes('```') || text.includes('~~~')) return text;

	return text
		.split('\n')
		.map((line) => {
			// Four spaces or one tab is where markdown starts reading a line as code.
			const match = line.match(/^(?: {4,}|\t+)(\S.*)$/);
			if (!match) return line;

			const content = match[1];
			return /^(?:[-*+]|\d+[.)])\s/.test(content) ? content : `- ${content}`;
		})
		.join('\n');
}
