import { getEnv } from "$lib/tools/get-env";

export interface ExportUrlOptions {
  route: string;
  version?: string;
  queryParams?: Record<string, string>;
}

export function getBaseUrl(): string {
  const appUrl = getEnv("SJS_APP_URL", { allowEmpty: true });
  if (appUrl) return appUrl;

  const appPort = getEnv("SJS_APP_PORT", "5173");
  return `http://localhost:${appPort}`;
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
