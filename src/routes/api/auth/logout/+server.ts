import { json } from '@sveltejs/kit';
import { createDirectusClient } from '$lib/directus';
import { logout } from '@directus/sdk';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
  try {
    const refreshToken = cookies.get('directus_refresh_token');

    if (refreshToken) {
      const client = createDirectusClient();

      // Logout from Directus (invalidates the refresh token)
      try {
        await client.request(logout(refreshToken, 'json'));
      } catch (error) {
        console.error('Directus logout error:', error);
        // Continue anyway to clear cookies
      }
    }

    // Delete cookies
    cookies.delete('directus_access_token', { path: '/' });
    cookies.delete('directus_refresh_token', { path: '/' });

    return json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    // Still try to clear cookies even if there's an error
    cookies.delete('directus_access_token', { path: '/' });
    cookies.delete('directus_refresh_token', { path: '/' });
    return json({ success: true });
  }
};