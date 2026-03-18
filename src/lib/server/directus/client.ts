import { createDirectus, rest, staticToken } from "@directus/sdk";
import { getEnv } from "$lib/tools/get-env";
import { isRunningInDocker } from "$lib/server/utils/docker";

// Define your Directus schema here (customize based on your collections)
export interface DirectusSchema {
  // Add your collection types here
  // Example:
  // users: DirectusUser[];
}

function getDirectusUrl(): string {
  // _DOCKER: container-to-container (uses 'admin' hostname)
  // _HOST: external access (uses 'localhost' with exposed port)
  return isRunningInDocker()
    ? getEnv("SJS_ADMIN_URL_DOCKER")
    : getEnv("SJS_ADMIN_URL_HOST");
}

function getDirectusToken(): string {
  return getEnv("SJS_ADMIN_TOKEN");
}

export function createDirectusClient() {
  const directusUrl = getDirectusUrl();
  const token = getDirectusToken();

  return createDirectus<DirectusSchema>(directusUrl)
    .with(rest())
    .with(staticToken(token));
}

export async function directusRequest(
  method: string,
  endpoint: string,
  body?: unknown,
): Promise<unknown> {
  const baseUrl = getDirectusUrl();
  const token = getDirectusToken();

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status} ${response.statusText}`,
    );
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function clearDirectusCache(): Promise<void> {
  if (isRunningInDocker()) {
    // Running in Docker - use direct API call (try block for async operation)
    try {
      await directusRequest("POST", "/utils/cache/clear");
      console.log("✅ Directus cache cleared");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️  Could not clear Directus cache: ${message}`);
    }
  } else {
    // Running on host - use npm script
    const { execSync } = await import("child_process");

    try {
      execSync("npm run docker:clear-directus-cache", {
        stdio: "inherit",
        cwd: process.cwd(),
      });
    } catch (error) {
      console.warn(
        "⚠️  Could not clear Directus cache via npm script (this is OK)",
      );
    }
  }
}
