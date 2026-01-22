import { config } from "$lib/server/config";

export interface ExportUrlOptions {
  route: string;
  version?: string;
  queryParams?: Record<string, string>;
}

export function getBaseUrl(): string {
  return config.publicSiteUrl;
}

export function buildExportUrl(options: ExportUrlOptions): string {
  const base = getBaseUrl();
  const { route, version, queryParams = {} } = options;

  let url = `${base}/${route.replace(/^\//, "")}`;

  const params = new URLSearchParams();
  if (version) params.set("version", version);
  Object.entries(queryParams).forEach(([key, value]) => {
    params.set(key, value);
  });

  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}
