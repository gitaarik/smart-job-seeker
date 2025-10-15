import { json } from '@sveltejs/kit';
import { createDirectusClient } from '$lib/directus';
import { isValidEmail } from '$lib/auth';
import { getEnv } from '$lib/tools/get-env';
import { createUser } from '@directus/sdk';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const { email, password, firstName, lastName } = await request.json();

    if (!email || !password) {
      return json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (password.length < 6) {
      return json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const client = createDirectusClient();

    try {
      // Create user in Directus
      await client.request(
        createUser({
          email,
          password,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          role: null // Set to default role, or specify your default role ID
        })
      );

      // Login the newly created user
      const authResult = await client.login(email, password);

      if (!authResult.access_token || !authResult.refresh_token) {
        return json({ error: 'Registration successful but login failed' }, { status: 500 });
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
    } catch (error: any) {
      // Handle Directus-specific errors
      if (error?.errors?.[0]?.extensions?.code === 'RECORD_NOT_UNIQUE') {
        return json({ error: 'User already exists with this email' }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    console.error('Registration error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};