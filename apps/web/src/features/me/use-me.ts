'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Me,
  type UpdateMeInput,
  type UpdateSettingsInput,
  meSchema,
} from '@verso/shared';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => api.get('/api/v1/me', meSchema, { signal }),
    staleTime: 60_000,
  });
}

/** Every write returns the updated user, which replaces the cached one. */
function useMeMutation<TVariables>(write: (variables: TVariables) => Promise<Me>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: write,
    onSuccess: (me) => queryClient.setQueryData(queryKeys.me, me),
  });
}

export const useUpdateMe = () =>
  useMeMutation((input: UpdateMeInput) => api.patch('/api/v1/me', meSchema, input));

export const useUpdateSettings = () =>
  useMeMutation((input: UpdateSettingsInput) =>
    api.patch('/api/v1/me/settings', meSchema, input),
  );

export const useCompleteOnboarding = () =>
  useMeMutation<void>(() => api.post('/api/v1/me/onboarding/complete', meSchema));
