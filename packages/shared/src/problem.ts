import { z } from 'zod';

export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const problemSchema = z.object({
  type: z.string(), // 'about:blank' by default
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  code: z.nativeEnum(ErrorCode),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(), // VALIDATION_ERROR only
});

export type Problem = z.infer<typeof problemSchema>;
