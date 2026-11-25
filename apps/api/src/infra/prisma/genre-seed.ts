import { GENRES } from '@verso/shared';
import type { PrismaClient } from '../../generated/prisma/client.js';

/**
 * Seeds the fixed genre list (SPEC 18). Idempotent: upserts by `slug`, with the slug as the id.
 * `name` is the English name and is never shown to users (labels come from `packages/i18n`).
 */
export async function seedGenres(prisma: Pick<PrismaClient, 'genre'>): Promise<void> {
  for (const genre of GENRES) {
    await prisma.genre.upsert({
      where: { slug: genre.slug },
      create: { id: genre.slug, slug: genre.slug, name: genre.name },
      update: { name: genre.name },
    });
  }
}
