import { createDirectus, rest, authentication } from '@directus/sdk';
import { getEnv } from '$lib/tools/get-env';

// Define your Directus schema here (customize based on your collections)
export interface DirectusSchema {
  // Add your collection types here
  // Example:
  // users: DirectusUser[];
}

export function getDirectusUrl(): string {
  const url = getEnv('ADMIN_PUBLIC_URL');

  if (!url) {
    throw new Error('ADMIN_PUBLIC_URL environment variable is not set');
  }

  return url;
}

// Create a server-side Directus client
export function createDirectusClient() {
  const directusUrl = getDirectusUrl();

  return createDirectus<DirectusSchema>(directusUrl)
    .with(rest())
    .with(authentication('cookie', { credentials: 'include' }));
}

// Create a client-side Directus client (for browser)
export function createDirectusClientBrowser() {
  const directusUrl = getEnv('ADMIN_PUBLIC_URL') || 'http://localhost:8055';

  return createDirectus<DirectusSchema>(directusUrl)
    .with(rest())
    .with(authentication('json'));
}
