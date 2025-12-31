import { authentication, createDirectus, rest } from "@directus/sdk";
import { getEnv } from "$lib/tools/get-env";

// Define your Directus schema here (customize based on your collections)
export interface DirectusSchema {
  // Add your collection types here
  // Example:
  // users: DirectusUser[];
}

function getDirectusUrl(): string {
  const url = getEnv("SJS_ADMIN_URL");

  if (!url) {
    throw new Error(
      "SJS_ADMIN_URL environment variable is not set",
    );
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
    .with(authentication("json"))
    .setToken(token);
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
    // Running in Docker - use direct API call
    await directusRequest("POST", "/utils/cache/clear");
  } else {
    // Running on host - use Docker CLI
    const { execSync } = await import("child_process");
    const token = getDirectusToken();

    try {
      execSync(
        `docker compose exec -T admin curl -s -X POST http://localhost:8085/utils/cache/clear -H "Authorization: Bearer ${token}"`,
        { stdio: "ignore" },
      );
    } catch (error) {
      // Ignore errors - cache clearing is best-effort
      console.warn(
        "⚠️  Could not clear Directus cache via Docker CLI (this is OK)",
      );
    }
  }
}
