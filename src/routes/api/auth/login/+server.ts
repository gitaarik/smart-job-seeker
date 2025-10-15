import { json } from '@sveltejs/kit';
import { createDirectusClient } from '$lib/directus';
import { getEnv } from '$lib/tools/get-env';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return json({ error: 'Email and password are required' }, { status: 400 });
    }

    const client = createDirectusClient();

    // Login with Directus
    const authResult = await client.login(email, password);

    if (!authResult.access_token || !authResult.refresh_token) {
      return json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Set access token cookie
    cookies.set('directus_access_token', authResult.access_token, {
      httpOnly: true,
      secure: getEnv('NODE_ENV') === 'production',
      sameSite: 'strict',
      maxAge: authResult.expires || 60 * 15, // 15 minutes default
      path: '/'
    });

    // Set refresh token cookie
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
    console.error('Login error:', error);
    return json({ error: 'Invalid email or password' }, { status: 401 });
  }
};