import { z } from 'zod';

/** Id formats shared by the catalog and library contracts. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OL_WORK_REF_RE = /^ol:OL\d+W$/;
const OL_AUTHOR_REF_RE = /^ol:OL\d+A$/;
const OL_EDITION_REF_RE = /^ol:OL\d+M$/;

/** Local UUID or "ol:OL123W". */
export const workRefSchema = z
  .string()
  .refine((v) => UUID_RE.test(v) || OL_WORK_REF_RE.test(v), { message: 'Invalid work ref' });

/** Local UUID or "ol:OL123A". */
export const authorRefSchema = z
  .string()
  .refine((v) => UUID_RE.test(v) || OL_AUTHOR_REF_RE.test(v), { message: 'Invalid author ref' });

/** Local UUID or "ol:OL123M". */
export const editionRefSchema = z
  .string()
  .refine((v) => UUID_RE.test(v) || OL_EDITION_REF_RE.test(v), { message: 'Invalid edition ref' });
