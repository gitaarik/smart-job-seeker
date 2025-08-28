import { redirect } from '@sveltejs/kit'
import { prisma } from '$lib/db'
import type { PageServerLoad, Actions } from './$types'
import { v4 as uuidv4 } from 'uuid'

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, '/auth')
  }

  if (locals.user.role !== 'ADMIN' && locals.user.role !== 'SUPER_ADMIN') {
    throw redirect(302, '/dashboard')
  }

  const tokens = await prisma.resumeToken.findMany({
    include: {
      creator: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return {
    tokens,
    currentUser: locals.user,
    resumeTypes: [
      { value: 'resume', label: 'Visual Resume' },
      { value: 'resume-ats/', label: 'ATS Resume (General)' },
      { value: 'resume-ats/fullstack-python', label: 'ATS Resume (Fullstack Python)' },
      { value: 'resume-ats/fullstack-django', label: 'ATS Resume (Fullstack Django)' },
      { value: 'resume-ats/fullstack-react', label: 'ATS Resume (Fullstack React)' },
      { value: 'resume-ats/fullstack-svelte', label: 'ATS Resume (Fullstack Svelte)' },
      { value: 'resume-ats/datascience', label: 'ATS Resume (Data Science)' }
    ]
  }
}

export const actions: Actions = {
  createToken: async ({ request, locals }) => {
    if (!locals.user || (locals.user.role !== 'ADMIN' && locals.user.role !== 'SUPER_ADMIN')) {
      return { error: 'Unauthorized' }
    }

    const data = await request.formData()
    const name = data.get('name') as string
    const description = data.get('description') as string
    const resumeType = data.get('resumeType') as string
    const expiresAtStr = data.get('expiresAt') as string
    const maxViewsStr = data.get('maxViews') as string

    if (!name || !resumeType) {
      return { error: 'Name and resume type are required' }
    }

    try {
      const token = uuidv4()
      const expiresAt = expiresAtStr ? new Date(expiresAtStr) : null
      const maxViews = maxViewsStr ? parseInt(maxViewsStr) : null

      await prisma.resumeToken.create({
        data: {
          token,
          name,
          description: description || null,
          resumeType,
          expiresAt,
          maxViews,
          createdBy: locals.user.id
        }
      })

      return { success: true, message: 'Token created successfully' }
    } catch (error) {
      console.error('Token creation error:', error)
      return { error: 'Failed to create token' }
    }
  },

  updateToken: async ({ request, locals }) => {
    if (!locals.user || (locals.user.role !== 'ADMIN' && locals.user.role !== 'SUPER_ADMIN')) {
      return { error: 'Unauthorized' }
    }

    const data = await request.formData()
    const tokenId = data.get('tokenId') as string
    const name = data.get('name') as string
    const description = data.get('description') as string
    const resumeType = data.get('resumeType') as string
    const expiresAtStr = data.get('expiresAt') as string
    const maxViewsStr = data.get('maxViews') as string
    const isActive = data.get('isActive') === 'true'

    if (!tokenId || !name || !resumeType) {
      return { error: 'Token ID, name, and resume type are required' }
    }

    try {
      const expiresAt = expiresAtStr ? new Date(expiresAtStr) : null
      const maxViews = maxViewsStr ? parseInt(maxViewsStr) : null

      await prisma.resumeToken.update({
        where: { id: tokenId },
        data: {
          name,
          description: description || null,
          resumeType,
          expiresAt,
          maxViews,
          isActive
        }
      })

      return { success: true, message: 'Token updated successfully' }
    } catch (error) {
      console.error('Token update error:', error)
      return { error: 'Failed to update token' }
    }
  },

  deleteToken: async ({ request, locals }) => {
    if (!locals.user || (locals.user.role !== 'ADMIN' && locals.user.role !== 'SUPER_ADMIN')) {
      return { error: 'Unauthorized' }
    }

    const data = await request.formData()
    const tokenId = data.get('tokenId') as string

    if (!tokenId) {
      return { error: 'Token ID is required' }
    }

    try {
      await prisma.resumeToken.delete({
        where: { id: tokenId }
      })

      return { success: true, message: 'Token deleted successfully' }
    } catch (error) {
      console.error('Token deletion error:', error)
      return { error: 'Failed to delete token' }
    }
  },

  resetViews: async ({ request, locals }) => {
    if (!locals.user || (locals.user.role !== 'ADMIN' && locals.user.role !== 'SUPER_ADMIN')) {
      return { error: 'Unauthorized' }
    }

    const data = await request.formData()
    const tokenId = data.get('tokenId') as string

    if (!tokenId) {
      return { error: 'Token ID is required' }
    }

    try {
      await prisma.resumeToken.update({
        where: { id: tokenId },
        data: { viewCount: 0 }
      })

      return { success: true, message: 'View count reset successfully' }
    } catch (error) {
      console.error('View reset error:', error)
      return { error: 'Failed to reset view count' }
    }
  }
}