import { json } from '@sveltejs/kit'
import { prisma } from '$lib/db'
import { hashPassword } from '$lib/auth'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return json({ error: 'Token and password are required' }, { status: 400 })
    }

    if (password.length < 6) {
      return json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiry: {
          gt: new Date()
        }
      }
    })

    if (!user) {
      return json({ error: 'Invalid or expired reset token' }, { status: 400 })
    }

    const hashedPassword = await hashPassword(password)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null
      }
    })

    return json({ success: true, message: 'Password reset successful' })
  } catch (error) {
    console.error('Reset password error:', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
}