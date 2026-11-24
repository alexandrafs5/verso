import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedGenres } from '../src/modules/catalog/genre-seed.js';

// Seed scaffold (M0.4). Later milestones add: one admin, two users, a few books with
// sessions, highlights and follows (ARCHITECTURE.md §13). Keep it idempotent.
async function main(): Promise<void> {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await prisma.$queryRaw`SELECT 1`;
    await seedGenres(prisma);
    console.log('Seed: genres done.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
