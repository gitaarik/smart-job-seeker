import { PrismaClient } from '@prisma/client'
import { getEnv } from '$lib/tools/get-env'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (getEnv('NODE_ENV') !== 'production') globalForPrisma.prisma = prisma
