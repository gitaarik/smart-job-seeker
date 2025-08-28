import { json } from '@sveltejs/kit'
import { prisma } from '$lib/db'
import { verifyJWT } from '$lib/auth'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const token = cookies.get('token')

    if (!token) {
      return json({ error: 'Not authenticated' }, { status: 401 })
    }

    const decoded = verifyJWT(token)

    if (!decoded) {
      return json({ error: 'Invalid token' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true
      }
    })

    if (!user) {
      return json({ error: 'User not found' }, { status: 404 })
    }

    return json({ user })
  } catch (error) {
    console.error('User profile error:', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
}