import type {
  PresetFilterConfig,
  SearchFilterValue,
} from "./search-filters";

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
 * Filters: each entry in `filters` is { filter_name: value_key | value_keys[] }.
 * The preset's `params[filter_name]` declares whether it's single or multi
 * select; for single, the value_key maps to a full "key=value" URL fragment;
 * for multi, each value_key maps to a raw value that gets joined into a
 * single "param=v1,v2,..." fragment. Lookups that miss (e.g. user picked
 * "any") contribute nothing.
 */
export function fillSearchTemplate(
  template: string,
  keywords: string | null,
  location: string | null,
  filters: Record<string, SearchFilterValue> = {},
  params: Record<string, PresetFilterConfig> = {},
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

  // Append filter fragments. A filter selection contributes only if the
  // preset declares a config for that filter name. Misses (user picked
  // "any", value the site doesn't support, etc.) are silently dropped.
  for (const [filterName, selection] of Object.entries(filters)) {
    const config = params[filterName];
    if (!config) continue;
    if (config.multi) {
      const chosen = Array.isArray(selection) ? selection : [selection];
      const values = chosen
        .map((key) => config.options[key])
        .filter((v): v is string => typeof v === "string" && v.length > 0);
      if (values.length === 0) continue;
      parsed.searchParams.append(config.param, values.join(config.sep));
    } else {
      // Single-select: the selection is a value_key (or the first of an
      // array if the user accidentally passed one) mapping to a full
      // "key=value" fragment.
      const key = Array.isArray(selection) ? selection[0] : selection;
      const fragment = key ? config.options[key] : undefined;
      if (!fragment) continue;
      const fragmentParams = new URLSearchParams(fragment);
      for (const [k, v] of fragmentParams) {
        parsed.searchParams.append(k, v);
      }
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
