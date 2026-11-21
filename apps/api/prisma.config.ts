import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Migrations use the direct connection (Neon pooled URLs break migrate); falls back to DATABASE_URL locally.
const url = process.env['DIRECT_DATABASE_URL'] ?? process.env['DATABASE_URL'] ?? '';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: { url },
});
