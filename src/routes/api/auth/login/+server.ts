import { json } from '@sveltejs/kit';
import { createDirectusClient } from '$lib/directus';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return json({ error: 'Email and password are required' }, { status: 400 });
    }

    const client = createDirectusClient();

    // Login with Directus using 'json' mode to get tokens in response
    await client.login({ email, password }, { mode: 'json' });

    // Get the token from the client
    const token = await client.getToken();

    if (!token) {
      return json({ error: 'Invalid email or password' }, { status: 401 });
    }

    return json({
      success: true,
      access_token: token
    });
  } catch (error) {
    console.error('Login error:', error);
    return json({ error: 'Invalid email or password' }, { status: 401 });
  }
};