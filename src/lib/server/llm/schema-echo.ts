/**
 * A structured reply that holds the schema's type names instead of an answer.
 *
 * On 2026-09-28 gemini-2.5-pro answered an application question with
 * `{"feedback":"string","text":"string"}`: 17 output tokens after 3,055 of
 * thinking, to a prompt that was complete and a schema that was right. Two
 * strings are exactly what that schema asks for, so the reply passed every
 * check there was. It was saved as the applicant's answer, and the response
 * cache handed it back when they asked for another. The identical request,
 * replayed three times, answered properly every time, and none of the other
 * 132,947 JSON replies then on dev held a single string equal to "string". So
 * it is a bad draw, and llm/langchain.ts fails it like one: retried, never
 * cached, never returned.
 *
 * The test is deliberately that narrow. Every string in the reply has to be the
 * word, and there has to be at least one, so a reply that echoed one field and
 * answered the rest still goes through. That would be a worse answer rather
 * than a missing one, and nothing has shown it happening.
 */
export function isSchemaEcho(reply: unknown): boolean {
	const strings = stringsIn(reply);
	return strings.length > 0 && strings.every((text) => text.trim().toLowerCase() === 'string');
}

/** Every string value in a parsed reply, at any depth. Keys are names, not answers. */
function stringsIn(value: unknown, found: string[] = []): string[] {
	if (typeof value === 'string') {
		found.push(value);
	} else if (Array.isArray(value)) {
		for (const item of value) stringsIn(item, found);
	} else if (value !== null && typeof value === 'object') {
		for (const item of Object.values(value)) stringsIn(item, found);
	}
	return found;
}
