import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  // Check if user is authenticated
  if (!locals.user) {
    throw redirect(302, '/auth');
  }

  // Check if user has admin permissions
  if (locals.user.role !== 'ADMIN' && locals.user.role !== 'SUPER_ADMIN') {
    throw redirect(302, '/dashboard');
  }

  // If we reach here, user is authenticated and has admin access
  return {
    user: locals.user
  };
};