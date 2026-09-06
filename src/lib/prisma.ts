import { PrismaClient } from '@prisma/client';

/**
 * Next.js hot-reloads route modules in dev, which would otherwise create a
 * fresh PrismaClient (and a fresh pool of DB connections) on every edit.
 * Stashing the instance on `globalThis` survives that reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
