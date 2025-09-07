const SMTP2GO_API_KEY = process.env.SMTP2GO_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@localhost'
const FROM_NAME = process.env.FROM_NAME || 'Portfolio App'

if (!SMTP2GO_API_KEY) {
  console.warn('SMTP2GO_API_KEY is not set. Email functionality will be disabled.')
}

export interface EmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: EmailOptions): Promise<boolean> {
  if (!SMTP2GO_API_KEY) {
    console.error('SMTP2GO API key is not configured')
    return false
  }

  try {
    const response = await fetch('https://api.smtp2go.com/v3/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Smtp2go-Api-Key': SMTP2GO_API_KEY,
      },
      body: JSON.stringify({
        api_key: SMTP2GO_API_KEY,
        to: [to],
        sender: `${FROM_NAME} <${FROM_EMAIL}>`,
        subject: subject,
        html_body: html,
      }),
    })

    const data = await response.json()

    if (data.data?.succeeded && data.data.succeeded > 0) {
      return true
    } else {
      console.error('SMTP2GO API error:', data)
      return false
    }
  } catch (error) {
    console.error('Failed to send email via SMTP2GO API:', error)
    return false
  }
}

export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
  const resetUrl = `${process.env.APP_URL}/auth/reset-password?token=${resetToken}`
  
  const html = `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
      <h2>Password Reset Request</h2>
      <p>You requested to reset your password. Click the button below to reset it:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" 
           style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p>If the button doesn't work, copy and paste this URL into your browser:</p>
      <p style="word-break: break-all;">${resetUrl}</p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request a password reset, please ignore this email.</p>
    </div>
  `
  
  return sendEmail({
    to: email,
    subject: 'Password Reset Request',
    html
  })
}
