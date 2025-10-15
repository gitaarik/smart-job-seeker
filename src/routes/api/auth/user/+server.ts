import { json } from '@sveltejs/kit';
import { createDirectusClient } from '$lib/directus';
import { readMe } from '@directus/sdk';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const accessToken = cookies.get('directus_access_token');

    if (!accessToken) {
      return json({ error: 'Not authenticated' }, { status: 401 });
    }

    const client = createDirectusClient();
    client.setToken(accessToken);

    const user = await client.request(
      readMe({
        fields: ['id', 'email', 'first_name', 'last_name', 'date_created']
      })
    );

    if (!user) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    return json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        createdAt: user.date_created
      }
    });
  } catch (error) {
    console.error('User profile error:', error);
    return json({ error: 'Invalid or expired token' }, { status: 401 });
  }
};