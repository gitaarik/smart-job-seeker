/**
 * Helper utilities for fetching display labels from Directus field metadata
 */

import { directusRequest } from "./client.js";

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
 * @param collection - The Directus collection name (e.g., "jobs")
 * @param field - The field name (e.g., "import_source")
 * @param key - The choice value/key (e.g., "linkedin_jobs")
 * @returns The display label (e.g., "LinkedIn Jobs") or the key if not found
 *
 * @example
 * ```ts
 * const label = await getFieldChoiceLabel("jobs", "import_source", "linkedin_jobs");
 * // Returns: "LinkedIn Jobs"
 * ```
 */
export async function getFieldChoiceLabel(
  collection: string,
  field: string,
  key: string,
): Promise<string> {
  const cacheKey = `${collection}:${field}`;

  // Check cache first (outside try block)
  let choices = choicesCache.get(cacheKey);

  // Fetch from Directus if not cached (try block for async operation)
  if (!choices) {
    try {
      const response = await directusRequest(
        "GET",
        `/fields/${collection}/${field}`,
      ) as DirectusFieldResponse;

      choices = response?.data?.meta?.options?.choices;
    } catch (error) {
      console.error(
        `Failed to fetch label for ${collection}.${field}[${key}] from Directus:`,
        error,
      );
      return key;
    }

    // Cache the choices if found (outside try block)
    if (choices) {
      choicesCache.set(cacheKey, choices);
    }
  }

  // Find the matching choice (outside try block)
  if (choices) {
    const choice = choices.find((c) => c.value === key);
    if (choice) {
      return choice.text;
    }
  }

  // Fallback to the key itself if label not found
  return key;
}

/**
 * Get all choices for a dropdown field
 *
 * @param collection - The Directus collection name (e.g., "tech_skills")
 * @param field - The field name (e.g., "level")
 * @returns Array of { value, label } objects, or empty array if not found
 */
export async function getFieldChoices(
  collection: string,
  field: string,
): Promise<Array<{ value: string; label: string }>> {
  const cacheKey = `${collection}:${field}`;

  let choices = choicesCache.get(cacheKey);

  if (!choices) {
    try {
      const response = await directusRequest(
        "GET",
        `/fields/${collection}/${field}`,
      ) as DirectusFieldResponse;

      choices = response?.data?.meta?.options?.choices;
    } catch (error) {
      console.error(
        `Failed to fetch choices for ${collection}.${field} from Directus:`,
        error,
      );
      return [];
    }

    if (choices) {
      choicesCache.set(cacheKey, choices);
    }
  }

  return (choices || []).map((c) => ({ value: c.value, label: c.text }));
}

/**
 * Clear the choices cache (useful for testing or forcing refresh)
 */
export function clearChoicesCache(): void {
  choicesCache.clear();
}
