import type { Prisma } from '../../generated/prisma/client.js';

/**
 * The client inside `prisma.$transaction(async (tx) => ...)`. A service that opens a transaction
 * passes it to other modules' services, so their writes commit or roll back together.
 */
export type PrismaTransaction = Prisma.TransactionClient;
