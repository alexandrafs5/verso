'use client';

import { healthResponseSchema } from '@verso/shared';
import { useQuery } from '@tanstack/react-query';
import { ApiError, api } from '../lib/api-client';
import { queryKeys } from '../lib/query-keys';

// Demo: raw values only. Real copy and states arrive with i18n (M1.5) and the design system (M1.x).
export default function HomePage() {
  const { data, error } = useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => api.get('/api/health', healthResponseSchema, { signal }),
  });

  const value = data?.status ?? (error instanceof ApiError ? error.status : null);

  return (
    <main>
      <p data-testid="health-status">{value}</p>
    </main>
  );
}
