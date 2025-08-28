import { redirect } from '@sveltejs/kit'
import { db } from '$lib/db'
import type { PageServerLoad, Actions } from './$types'
import { hashPassword } from '$lib/auth'

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, '/auth')
  }

  if (locals.user.role !== 'ADMIN' && locals.user.role !== 'SUPER_ADMIN') {
    throw redirect(302, '/dashboard')
  }

  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isEmailVerified: true,
      createdAt: true,
      updatedAt: true
    }
  })

  return {
    users,
    currentUser: locals.user
  }
}

export const actions: Actions = {
  createUser: async ({ request, locals }) => {
    if (!locals.user || (locals.user.role !== 'ADMIN' && locals.user.role !== 'SUPER_ADMIN')) {
      return { error: 'Unauthorized' }
    }

    const data = await request.formData()
    const email = data.get('email') as string
    const password = data.get('password') as string
    const firstName = data.get('firstName') as string
    const lastName = data.get('lastName') as string
    const role = data.get('role') as 'USER' | 'ADMIN' | 'SUPER_ADMIN'

    if (!email || !password) {
      return { error: 'Email and password are required' }
    }

    try {
      const existingUser = await db.user.findUnique({
        where: { email }
      })

      if (existingUser) {
        return { error: 'User with this email already exists' }
      }

      const hashedPassword = await hashPassword(password)

      await db.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName: firstName || null,
          lastName: lastName || null,
          role,
          isEmailVerified: true
        }
      })

      return { success: true }
    } catch (error) {
      console.error('User creation error:', error)
      return { error: 'Failed to create user' }
    }
  },

  updateUser: async ({ request, locals }) => {
    if (!locals.user || (locals.user.role !== 'ADMIN' && locals.user.role !== 'SUPER_ADMIN')) {
      return { error: 'Unauthorized' }
    }

    const data = await request.formData()
    const userId = data.get('userId') as string
    const email = data.get('email') as string
    const firstName = data.get('firstName') as string
    const lastName = data.get('lastName') as string
    const role = data.get('role') as 'USER' | 'ADMIN' | 'SUPER_ADMIN'
    const password = data.get('password') as string

    if (!userId || !email) {
      return { error: 'User ID and email are required' }
    }

    try {
      const updateData: any = {
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        role
      }

      if (password) {
        updateData.password = await hashPassword(password)
      }

      await db.user.update({
        where: { id: userId },
        data: updateData
      })

      return { success: true }
    } catch (error) {
      console.error('User update error:', error)
      return { error: 'Failed to update user' }
    }
  },

  deleteUser: async ({ request, locals }) => {
    if (!locals.user || (locals.user.role !== 'ADMIN' && locals.user.role !== 'SUPER_ADMIN')) {
      return { error: 'Unauthorized' }
    }

    const data = await request.formData()
    const userId = data.get('userId') as string

    if (!userId) {
      return { error: 'User ID is required' }
    }

    if (userId === locals.user.id) {
      return { error: 'You cannot delete your own account' }
    }

    try {
      await db.user.delete({
        where: { id: userId }
      })

      return { success: true }
    } catch (error) {
      console.error('User deletion error:', error)
      return { error: 'Failed to delete user' }
    }
  }
}