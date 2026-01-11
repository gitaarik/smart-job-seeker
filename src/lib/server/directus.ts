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
  // When running in Docker: use 'admin' as hostname (Docker service name)
  // When running on host: use 'localhost' to connect to the exposed port
  const url = isRunningInDocker()
    ? getEnv("SJS_ADMIN_URL")
    : getEnv("SJS_ADMIN_PUBLIC_URL");

  if (!url) {
    const envVar = isRunningInDocker()
      ? "SJS_ADMIN_URL"
      : "SJS_ADMIN_PUBLIC_URL";
    throw new Error(`${envVar} environment variable is not set`);
  }

  return url;
}

function getDirectusToken(): string {
  const token = getEnv("SJS_ADMIN_TOKEN");

  if (!token) {
    throw new Error(
      "SJS_ADMIN_TOKEN environment variable is not set",
    );
  }

  return token;
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
  // Detect if running on host or in Docker by checking if admin hostname resolves
  const isRunningInDocker = await (async () => {
    try {
      const dns = await import("dns/promises");
      await dns.lookup("admin");
      return true; // Successfully resolved, we're in Docker
    } catch {
      return false; // Failed to resolve, we're on host
    }
  })();

  if (isRunningInDocker) {
    // Running in Docker - use direct API call (try block for async operation)
    try {
      await directusRequest("POST", "/utils/cache/clear");
    } catch (error) {
      console.warn(
        "⚠️  Could not clear Directus cache via API (this is OK)",
      );
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
