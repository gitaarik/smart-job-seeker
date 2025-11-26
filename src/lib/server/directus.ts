import {
  authentication,
  createDirectus,
  rest,
  staticToken,
} from "@directus/sdk";
import { getEnv } from "$lib/tools/get-env";

// Define your Directus schema here (customize based on your collections)
export interface DirectusSchema {
  // Add your collection types here
  // Example:
  // users: DirectusUser[];
}

export function getDirectusUrl(): string {
  const url = getEnv("ADMIN_PUBLIC_URL");

  if (!url) {
    throw new Error("ADMIN_PUBLIC_URL environment variable is not set");
  }

  return url;
}

// Get the internal Directus URL (for server-side connections within Docker)
export function getDirectusInternalUrl(): string {
  // Use internal URL if available (for Docker), otherwise fall back to public URL
  const url = getEnv("ADMIN_INTERNAL_URL") || getEnv("ADMIN_PUBLIC_URL");

  if (!url) {
    throw new Error(
      "ADMIN_INTERNAL_URL or ADMIN_PUBLIC_URL environment variable is not set",
    );
  }

  return url;
}

// Create a Directus client with cookie authentication (for Docker/server-side)
export function createDirectusServerClient() {
  const directusUrl = getDirectusInternalUrl();

  return createDirectus<DirectusSchema>(directusUrl)
    .with(rest())
    .with(authentication("cookie", { credentials: "include" }));
}

// Create a Directus REST client with JSON authentication (for browser and scripts)
export function createDirectusRestClient(token?: string) {
  const directusUrl = getEnv("ADMIN_PUBLIC_URL") || "http://localhost:8055";

  const client = createDirectus<DirectusSchema>(directusUrl)
    .with(rest())
    .with(authentication("json"));

  if (token) {
    client.setToken(token);
  }

  return client;
}

// Create a Directus REST client with admin token from environment
export function createDirectusRestClientWithToken() {
  const adminToken = getEnv("DIRECTUS_ADMIN_TOKEN");

  if (!adminToken) {
    throw new Error("DIRECTUS_ADMIN_TOKEN environment variable is not set");
  }

  return createDirectusRestClient(adminToken);
}
