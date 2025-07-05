import { json } from '@sveltejs/kit';
import { createDirectusClient } from '$lib/directus';
import { getEnv } from '$lib/tools/get-env';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
  try {
    const refreshToken = cookies.get('directus_refresh_token');

    if (!refreshToken) {
      return json({ error: 'No refresh token found' }, { status: 401 });
    }

    const client = createDirectusClient();

    // Refresh the access token
    const authResult = await client.refresh();

    if (!authResult.access_token || !authResult.refresh_token) {
      return json({ error: 'Token refresh failed' }, { status: 401 });
    }

    // Set new access token cookie
    cookies.set('directus_access_token', authResult.access_token, {
      httpOnly: true,
      secure: getEnv('NODE_ENV') === 'production',
      sameSite: 'strict',
      maxAge: authResult.expires || 60 * 15, // 15 minutes default
      path: '/'
    });

    // Set new refresh token cookie
    cookies.set('directus_refresh_token', authResult.refresh_token, {
      httpOnly: true,
      secure: getEnv('NODE_ENV') === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    });

    return json({
      success: true,
      access_token: authResult.access_token,
      refresh_token: authResult.refresh_token,
      expires: authResult.expires
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    // Clear invalid tokens
    cookies.delete('directus_access_token', { path: '/' });
    cookies.delete('directus_refresh_token', { path: '/' });
    return json({ error: 'Token refresh failed' }, { status: 401 });
  }
};
