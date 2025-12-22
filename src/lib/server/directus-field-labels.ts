/**
 * Helper utilities for fetching display labels from Directus field metadata
 */

import { directusRequest } from "./directus";

/**
 * Directus field metadata response structure
 */
interface DirectusFieldResponse {
  data?: {
    meta?: {
      options?: {
        choices?: Array<{ text: string; value: string }>;
      };
    };
  };
}

/**
 * In-memory cache for field choices
 * Key format: "{collection}:{field}"
 */
const choicesCache = new Map<string, Array<{ text: string; value: string }>>();

/**
 * Get the display label for a dropdown field choice value
 *
 * @param collection - The Directus collection name (e.g., "vacancies")
 * @param field - The field name (e.g., "import_source")
 * @param key - The choice value/key (e.g., "linkedin_jobs")
 * @returns The display label (e.g., "LinkedIn Jobs") or the key if not found
 *
 * @example
 * ```ts
 * const label = await getFieldChoiceLabel("vacancies", "import_source", "linkedin_jobs");
 * // Returns: "LinkedIn Jobs"
 * ```
 */
export async function getFieldChoiceLabel(
  collection: string,
  field: string,
  key: string,
): Promise<string> {
  const cacheKey = `${collection}:${field}`;

  try {
    // Check cache first
    let choices = choicesCache.get(cacheKey);

    // Fetch from Directus if not cached
    if (!choices) {
      const response = await directusRequest(
        "GET",
        `/fields/${collection}/${field}`,
      ) as DirectusFieldResponse;

      choices = response?.data?.meta?.options?.choices;

      // Cache the choices if found
      if (choices) {
        choicesCache.set(cacheKey, choices);
      }
    }

    // Find the matching choice
    if (choices) {
      const choice = choices.find((c) => c.value === key);
      if (choice) {
        return choice.text;
      }
    }
  } catch (error) {
    console.error(
      `Failed to fetch label for ${collection}.${field}[${key}] from Directus:`,
      error,
    );
  }

  // Fallback to the key itself if label not found
  return key;
}

/**
 * Clear the choices cache (useful for testing or forcing refresh)
 */
export function clearChoicesCache(): void {
  choicesCache.clear();
}
