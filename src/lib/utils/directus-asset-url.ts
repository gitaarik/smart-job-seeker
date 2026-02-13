/**
 * Generate URL for Directus asset, served via the app's own domain
 * @param fileUuid - UUID of the file in Directus
 * @param options - Optional transformation parameters (width, height, quality, etc.)
 * @returns Relative URL to the asset (proxied to Directus via Caddy)
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

  let url = `/assets/${fileUuid}`;

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
