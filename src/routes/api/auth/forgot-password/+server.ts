import { json } from '@sveltejs/kit'
import { prisma } from '$lib/db'
import { generateResetToken, isValidEmail } from '$lib/auth'
import { sendPasswordResetEmail } from '$lib/email'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { email } = await request.json()

    if (!email) {
      return json({ error: 'Email is required' }, { status: 400 })
    }

    if (!isValidEmail(email)) {
      return json({ error: 'Invalid email format' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return json({ 
        success: true, 
        message: 'If an account exists with this email, a password reset link has been sent.' 
      })
    }

    const resetToken = generateResetToken()
    const resetExpiry = new Date(Date.now() + 3600000)

    await prisma.user.update({
      where: { email },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpiry: resetExpiry
      }
    })

    const emailSent = await sendPasswordResetEmail(email, resetToken)

    if (!emailSent) {
      return json({ error: 'Failed to send reset email' }, { status: 500 })
    }

    return json({ 
      success: true, 
      message: 'If an account exists with this email, a password reset link has been sent.' 
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
}