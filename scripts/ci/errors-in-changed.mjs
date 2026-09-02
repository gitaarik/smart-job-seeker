/**
 * Filter an eslint JSON report down to the files a change touched.
 *
 * Reads the report on stdin and the changed-file list from CHANGED (newline
 * separated, repo-relative — see changed-files.sh). Prints one line per error
 * in those files, and nothing at all if it cannot match any.
 *
 * A file of its own rather than `node -e` inside check-lint.sh: the snippet
 * needs backticks, `${}` and quotes, every one of which the surrounding
 * double-quoted shell string also claims. The first version of this was
 * syntactically valid shell that passed a broken program to node.
 */
const changed = new Set((process.env.CHANGED || '').split('\n').filter(Boolean));

/** The changed-list path this absolute path ends with, or null. */
function matchPath(absolute, changed) {
	const normalised = absolute.replace(/\\/g, '/');
	if (changed.has(normalised)) return normalised;
	for (const candidate of changed) {
		if (normalised.endsWith('/' + candidate)) return candidate;
	}
	return null;
}

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
	let report;
	try {
		report = JSON.parse(raw);
	} catch {
		// Nothing printed means "cannot tell", and the caller falls back to
		// showing the whole list. Never let this be the reason a gate fails.
		process.exit(0);
	}

	const lines = [];
	for (const file of report) {
		// Matched by suffix rather than by stripping cwd. Both run in the same
		// container today, so cwd would work — but the same assumption in the
		// pre-push filter silently matched nothing and reported a file with two
		// fresh errors as clean, because eslint ran in the container and the
		// filter on the host. A gate that can pass silently is not worth the
		// two lines saved.
		const rel = matchPath(file.filePath, changed);
		if (!rel) continue;
		for (const m of file.messages) {
			if (m.severity !== 2) continue;
			lines.push(`  ${rel}:${m.line}:${m.column}  ${m.message}  ${m.ruleId || ''}`);
		}
	}
	if (lines.length) console.log(lines.join('\n'));
});
