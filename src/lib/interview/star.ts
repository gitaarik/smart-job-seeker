/**
 * STAR project-story <-> markdown bridge.
 *
 * A `project_stories` row keeps the five STAR sections in separate columns, but
 * the conversational editor (ConversationTimeline + the version engine) works on
 * a single `content` string per version. So a story's narrative is carried
 * through the AI thread as ONE canonical markdown document with fixed headings,
 * and split back into columns when a version is committed.
 *
 * `serializeStarMarkdown` and `parseStarMarkdown` round-trip: parsing the output
 * of serialize returns the same fields, and serializing already-canonical
 * markdown returns it unchanged. AI output is normalized through
 * parse→serialize before it is stored, so every stored version is canonical and
 * the "current story" highlight can match a version by exact string compare.
 *
 * Parsing is deliberately tolerant (accepts `## Situation`, `**Situation**`,
 * `Situation:`) and never drops text: markdown with no recognizable STAR heading
 * degrades to the whole blob in `situation`, mirroring the app's degrade-to-
 * verbatim philosophy elsewhere.
 *
 * Title and category are NOT part of this markdown — they are edited as their
 * own fields on the editor, the same way the question editor treats the question
 * text separately from the answer versions.
 */

/** The five STAR sections, in canonical order. */
export const STAR_SECTIONS = ['situation', 'task', 'action', 'result', 'reflection'] as const;

export type StarSection = (typeof STAR_SECTIONS)[number];

export type StarFields = Record<StarSection, string | null>;

/** Human heading for each section, used when serializing. */
const SECTION_HEADING: Record<StarSection, string> = {
	situation: 'Situation',
	task: 'Task',
	action: 'Action',
	result: 'Result',
	reflection: 'Reflection'
};

/** Match a line that is *only* a STAR label (heading, bold, or trailing colon). */
const HEADING_RE =
	/^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(situation|task|action|result|reflection)\s*:?\s*(?:\*\*)?\s*$/i;

/**
 * Serialize STAR columns into one canonical markdown document. Empty sections
 * are skipped (their heading is omitted). Returns "" when every section is
 * empty, so a blank story has no committed content to compare against.
 */
export function serializeStarMarkdown(fields: Partial<StarFields>): string {
	const blocks: string[] = [];
	for (const section of STAR_SECTIONS) {
		const value = fields[section]?.trim();
		if (value) blocks.push(`## ${SECTION_HEADING[section]}\n${value}`);
	}
	return blocks.join('\n\n');
}

/**
 * Parse a STAR markdown document back into columns. Text under each recognized
 * heading becomes that section; any leading text before the first heading (or
 * the whole document, when no heading is present) is kept in `situation` so
 * nothing the model or user wrote is ever lost.
 */
export function parseStarMarkdown(markdown: string | null): StarFields {
	const fields: StarFields = {
		situation: null,
		task: null,
		action: null,
		result: null,
		reflection: null
	};
	if (!markdown?.trim()) return fields;

	const lines = markdown.replace(/\r\n/g, '\n').split('\n');
	// `preamble` collects any lines before the first heading (usually none).
	const preamble: string[] = [];
	let current: StarSection | null = null;
	const buffers: Record<StarSection, string[]> = {
		situation: [],
		task: [],
		action: [],
		result: [],
		reflection: []
	};

	for (const line of lines) {
		const match = line.match(HEADING_RE);
		if (match) {
			current = match[1].toLowerCase() as StarSection;
			continue;
		}
		if (current) buffers[current].push(line);
		else preamble.push(line);
	}

	for (const section of STAR_SECTIONS) {
		const text = buffers[section].join('\n').trim();
		if (text) fields[section] = text;
	}

	// No heading matched at all → keep the entire blob verbatim in `situation`.
	const leftover = preamble.join('\n').trim();
	if (leftover) {
		fields.situation = fields.situation ? `${leftover}\n\n${fields.situation}` : leftover;
	}

	return fields;
}
