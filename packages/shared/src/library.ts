import { z } from 'zod';
import { editionRefSchema, workRefSchema } from './refs';

export const BOOK_STATUSES = ['READING', 'READ', 'WANT_TO_READ', 'ABANDONED'] as const;

export const TAG_COLORS = [
  'WINE',
  'TOBACCO',
  'BRASS',
  'FOREST',
  'NAVY',
  'OXBLOOD',
  'SLATE',
  'SAND',
] as const;

export const bookStatusSchema = z.enum(BOOK_STATUSES);
export const tagColorSchema = z.enum(TAG_COLORS);

/** What catalog responses say about a book in the viewer's library. */
export const libraryStatusSchema = z.object({
  userBookId: z.string().uuid(),
  status: bookStatusSchema,
  /** FINISHED readings. */
  readCount: z.number().int().min(0),
  /** The saved edition. */
  editionRef: editionRefSchema,
});

/** A real calendar date, year 0001 or later (Postgres has no year 0). */
const readingDateSchema = z.iso.date().refine((v) => !v.startsWith('0000'), {
  message: 'Invalid date',
});

/** Body of `POST /v1/library`. "Not after today" depends on the user's time zone: API only. */
export const addToLibraryBodySchema = z
  .object({
    workRef: workRefSchema,
    editionRef: editionRefSchema.optional(),
    status: bookStatusSchema,
    startedOn: readingDateSchema.optional(),
    finishedOn: readingDateSchema.optional(),
  })
  .superRefine((body, ctx) => {
    if (body.status !== 'READ') {
      for (const field of ['startedOn', 'finishedOn'] as const) {
        if (body[field] !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message: 'Dates are only valid with status READ',
          });
        }
      }
      return;
    }
    // YYYY-MM-DD strings sort like dates.
    if (body.startedOn && body.finishedOn && body.startedOn > body.finishedOn) {
      ctx.addIssue({
        code: 'custom',
        path: ['finishedOn'],
        message: 'finishedOn is before startedOn',
      });
    }
  });

export const addToLibraryResponseSchema = libraryStatusSchema.extend({
  /** Always the local work id. */
  workRef: workRefSchema,
});

export type BookStatus = z.infer<typeof bookStatusSchema>;
export type TagColor = z.infer<typeof tagColorSchema>;
export type LibraryStatus = z.infer<typeof libraryStatusSchema>;
export type AddToLibraryBody = z.infer<typeof addToLibraryBodySchema>;
export type AddToLibraryResponse = z.infer<typeof addToLibraryResponseSchema>;
