import { PrismaClient } from '@prisma/client'

export * from '@prisma/client'

// Eén client per proces. In development overleeft hij hot reloads via globalThis.
const globalForPrisma = globalThis as unknown as { puntiqPrisma?: PrismaClient }

export const prisma =
  globalForPrisma.puntiqPrisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.puntiqPrisma = prisma

/** Alle rollen die mogen schrijven binnen een bedrijf. */
export const WRITE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const
