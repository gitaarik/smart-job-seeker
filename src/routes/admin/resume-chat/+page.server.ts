import { redirect } from '@sveltejs/kit'
import { isAdmin } from '$lib/auth.js'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, '/auth')
  }

  if (!isAdmin(locals.user)) {
    throw redirect(302, '/dashboard')
  }

  return {
    currentUser: locals.user
  }
}