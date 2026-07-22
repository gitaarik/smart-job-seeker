/**
 * Word-level text diff via LCS.
 *
 * Extracted from the application-letter editor so the letter and application-
 * question editors can share one diff engine. Produces a flat list of
 * segments (same / added / removed) suitable for inline highlighting. Whitespace
 * is taken from the new text so the rendered "added"/"same" run reads naturally;
 * removed runs get a single separating space.
 */

export type DiffSegment = { type: "same" | "added" | "removed"; text: string };

export function computeDiff(oldText: string, newText: string): DiffSegment[] {
  // Split into words only (ignore whitespace for comparison)
  const oldWords = oldText.split(/\s+/).filter(Boolean);
  const newWords = newText.split(/\s+/).filter(Boolean);
  const m = oldWords.length, n = newWords.length;

  // LCS via DP
  const dp: number[][] = Array.from(
    { length: m + 1 },
    () => new Array(n + 1).fill(0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldWords[i - 1] === newWords[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to build word-level diff
  const raw: { type: DiffSegment["type"]; text: string }[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      raw.push({ type: "same", text: oldWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.push({ type: "added", text: newWords[j - 1] });
      j--;
    } else {
      raw.push({ type: "removed", text: oldWords[i - 1] });
      i--;
    }
  }
  raw.reverse();

  // Build whitespace map from new text: whitespace before each word
  const newParts = newText.split(/(\s+)/);
  const newSpaces: string[] = [];
  let ws = "";
  for (const part of newParts) {
    if (/^\s*$/.test(part)) ws += part;
    else {
      newSpaces.push(ws);
      ws = "";
    }
  }

  // Merge consecutive same-type words with new text's whitespace
  const segments: DiffSegment[] = [];
  let nIdx = 0; // position in new text words
  for (const seg of raw) {
    // Use new text's whitespace for added/same words; simple space for removed
    let space: string;
    if (seg.type === "removed") {
      space = segments.length > 0 ? " " : "";
    } else {
      space = nIdx > 0 ? (newSpaces[nIdx] || " ") : (newSpaces[0] || "");
      nIdx++;
    }

    if (
      segments.length > 0 && segments[segments.length - 1].type === seg.type
    ) {
      segments[segments.length - 1].text += space + seg.text;
    } else {
      segments.push({
        type: seg.type,
        text: (segments.length > 0 ? space : "") + seg.text,
      });
    }
  }
  return segments;
}

/** True when less than 30% of characters changed — used to auto-expand small diffs. */
export function isSmallDiff(segments: DiffSegment[]): boolean {
  let changedChars = 0;
  let totalChars = 0;
  for (const seg of segments) {
    totalChars += seg.text.length;
    if (seg.type !== "same") changedChars += seg.text.length;
  }
  return totalChars > 0 && changedChars / totalChars < 0.3;
}
