import { env } from "$env/dynamic/public";

/**
 * Generate public URL for Directus asset
 * @param fileUuid - UUID of the file in Directus
 * @param options - Optional transformation parameters (width, height, quality, etc.)
 * @returns Public URL to the asset
 */
export function getDirectusAssetUrl(
  fileUuid: string | null | undefined,
  options?: {
    width?: number;
    height?: number;
    quality?: number;
    fit?: "cover" | "contain" | "inside" | "outside";
  },
): string | null {
  if (!fileUuid) return null;

  const baseUrl = env.PUBLIC_DIRECTUS_URL || "http://localhost:8055";
  let url = `${baseUrl}/assets/${fileUuid}`;

  // Add transformation parameters if provided
  if (options) {
    const params = new URLSearchParams();
    if (options.width) params.set("width", options.width.toString());
    if (options.height) params.set("height", options.height.toString());
    if (options.quality) params.set("quality", options.quality.toString());
    if (options.fit) params.set("fit", options.fit);

    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
  }

  return url;
}
