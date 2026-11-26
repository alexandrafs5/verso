'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type AddToLibraryBody, addToLibraryResponseSchema, type ErrorCode } from '@verso/shared';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';
import { applyAddedBook, refetchCatalogViews } from './library-cache';

export const LIBRARY_PATH = '/api/v1/library';

export type AddToLibraryVariables = {
  body: AddToLibraryBody;
  /** Other refs the book is shown under, for example the route ref of the work page. */
  aliases?: string[];
};

/** Message keys under `library.errors`. Rate limiting uses the common message. */
const ERROR_KEYS = {
  BOOK_ALREADY_IN_LIBRARY: 'alreadyInLibrary',
  NO_EDITION_AVAILABLE: 'noEdition',
  EDITION_NOT_IN_WORK: 'editionNotInWork',
  CATALOG_NOT_FOUND: 'notFound',
  CATALOG_UNAVAILABLE: 'unavailable',
} as const satisfies Partial<Record<ErrorCode, string>>;

/**
 * Adds a book (SPEC 20). No optimistic update: a cold server could roll it back a minute later.
 * The callbacks live here, so the toast and the cache update happen even if the control unmounts.
 */
export function useAddToLibrary() {
  const queryClient = useQueryClient();
  const t = useTranslations();

  const errorMessage = (error: unknown): string => {
    const code = error instanceof ApiError ? error.code : null;
    if (code === 'RATE_LIMITED') return t('common.rateLimited');
    const key = code && code in ERROR_KEYS ? ERROR_KEYS[code as keyof typeof ERROR_KEYS] : null;
    return t(`library.errors.${key ?? 'generic'}`);
  };

  return useMutation({
    mutationFn: ({ body }: AddToLibraryVariables) =>
      api.post(LIBRARY_PATH, addToLibraryResponseSchema, body),
    onSuccess: (added, { body, aliases = [] }) => {
      applyAddedBook(queryClient, [body.workRef, ...aliases], added);
      toast.success(t('library.added', { status: t(`status.${added.status}`) }));
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'BOOK_ALREADY_IN_LIBRARY') {
        refetchCatalogViews(queryClient);
      }
      toast.error(errorMessage(error));
    },
  });
}
