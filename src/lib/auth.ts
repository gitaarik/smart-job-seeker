import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { getEnv } from '$lib/tools/get-env'

function getJWTSecret(): string {
  const JWT_SECRET = getEnv('JWT_SECRET')
  
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set')
  }
  
  return JWT_SECRET
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12)
  return bcrypt.hash(password, salt)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export function generateJWT(userId: string): string {
  const JWT_SECRET = getJWTSecret()
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyJWT(token: string): { userId: string } | null {
  try {
    const JWT_SECRET = getJWTSecret()
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    return decoded
  } catch (error) {
    return null
  }
}

export function generateResetToken(): string {
  return uuidv4()
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isAdmin(user: { role: string }): boolean {
  return user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
}

export function isSuperAdmin(user: { role: string }): boolean {
  return user.role === 'SUPER_ADMIN'
}
