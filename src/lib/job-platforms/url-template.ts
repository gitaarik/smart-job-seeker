/**
 * Substitute {KEYWORDS} and {LOCATION} placeholders in a search URL template,
 * then append any filter URL-fragments declared by the preset.
 *
 * Shared between the suggest endpoint (server-side substitution from the
 * LLM's preset_id + keywords + location response) and the add-task form's
 * live URL preview (client-side, same logic so the preview matches what the
 * scraper actually receives).
 *
 * Edge cases handled:
 *  - {KEYWORDS}/{LOCATION} in the URL path: substituted directly in the
 *    raw template before URL parsing, because `new URL(...)` percent-
 *    encodes `{` and `}` and would break naive path-substitution.
 *  - {KEYWORDS}/{LOCATION} as a query-param value with a null/empty input:
 *    the entire param is dropped (so we don't send `?keyword=` to the
 *    upstream platform).
 *  - Literal URLs with no placeholders: returned unchanged.
 *  - Non-URL templates (relative paths etc.): falls back to a straight
 *    string substitution. Filter fragments are skipped in this fallback.
 *
 * Filters: each entry in `filters` is { filter_name: value_key }. The
 * preset's `params[filter_name][value_key]` lookup yields a URL fragment
 * like "sortBy=DD" which is appended as additional query params. Lookups
 * that miss (e.g. user picked "any") contribute nothing.
 */
export function fillSearchTemplate(
  template: string,
  keywords: string | null,
  location: string | null,
  filters: Record<string, string> = {},
  params: Record<string, Record<string, string>> = {},
): string {
  const replacements: Array<[string, string | null]> = [
    ["{KEYWORDS}", keywords],
    ["{LOCATION}", location],
  ];

  const queryStart = template.indexOf("?");
  const rawPath = queryStart >= 0 ? template.slice(0, queryStart) : template;
  const rawQuery = queryStart >= 0 ? template.slice(queryStart) : "";

  let substitutedPath = rawPath;
  for (const [placeholder, raw] of replacements) {
    substitutedPath = substitutedPath.replaceAll(
      placeholder,
      raw && raw.trim() ? encodeURIComponent(raw.trim()) : "",
    );
  }

  const reassembled = substitutedPath + rawQuery;

  let parsed: URL;
  try {
    parsed = new URL(reassembled);
  } catch {
    let url = template;
    for (const [placeholder, raw] of replacements) {
      url = url.replaceAll(
        placeholder,
        raw && raw.trim() ? encodeURIComponent(raw.trim()) : "",
      );
    }
    return url;
  }

  const keysToDelete: string[] = [];
  for (const [key, value] of parsed.searchParams.entries()) {
    let replaced = value;
    let wasOnlyPlaceholder = false;
    for (const [placeholder, raw] of replacements) {
      if (replaced !== placeholder) continue;
      if (raw && raw.trim()) {
        replaced = raw.trim();
      } else {
        wasOnlyPlaceholder = true;
      }
    }
    if (wasOnlyPlaceholder) {
      keysToDelete.push(key);
    } else if (replaced !== value) {
      parsed.searchParams.set(key, replaced);
    }
  }
  for (const key of keysToDelete) parsed.searchParams.delete(key);

  // Append filter fragments. Each fragment is a `key=value` string (or
  // multi-key like `a=1&b=2`) that we merge into the URL's query string.
  // A filter selection only contributes if the preset declares a mapping
  // for that (filter_name, value_key) pair — otherwise it's silently
  // dropped (e.g. user picked "any" or a value the site doesn't support).
  for (const [filterName, valueKey] of Object.entries(filters)) {
    const fragment = params[filterName]?.[valueKey];
    if (!fragment) continue;
    const fragmentParams = new URLSearchParams(fragment);
    for (const [k, v] of fragmentParams) {
      parsed.searchParams.append(k, v);
    }
  }

  return parsed.toString();
}

/** Lightweight introspection: which placeholders does this template use? */
export function templatePlaceholders(template: string): {
  hasKeywords: boolean;
  hasLocation: boolean;
} {
  return {
    hasKeywords: template.includes("{KEYWORDS}"),
    hasLocation: template.includes("{LOCATION}"),
  };
}
