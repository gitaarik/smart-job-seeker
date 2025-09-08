import { json } from '@sveltejs/kit'
import { prisma } from '$lib/db'
import { hashPassword, isValidEmail, generateJWT } from '$lib/auth'
import { getEnv } from '$lib/tools/get-env'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const { email, password, firstName, lastName } = await request.json()

    if (!email || !password) {
      return json({ error: 'Email and password are required' }, { status: 400 })
    }

    if (!isValidEmail(email)) {
      return json({ error: 'Invalid email format' }, { status: 400 })
    }

    if (password.length < 6) {
      return json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return json({ error: 'User already exists with this email' }, { status: 409 })
    }

    const hashedPassword = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null
      }
    })

    const token = generateJWT(user.id)

    cookies.set('token', token, {
      httpOnly: true,
      secure: getEnv('NODE_ENV') === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    })

    return json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    })
  } catch (error) {
    console.error('Registration error:', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
}