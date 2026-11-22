import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { messages } from '@verso/i18n';
import type { Me } from '@verso/shared';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { vi } from 'vitest';

export const baseMe: Me = {
  id: 'u1',
  email: 'ana.garcia@example.com',
  emailVerified: true,
  name: 'Ana Garcia',
  username: null,
  bio: null,
  image: null,
  settings: {
    ratingStyle: 'STARS_HALF',
    progressStyle: 'PAGES',
    profileVisibility: 'PUBLIC',
    defaultAnnotationVisibility: 'PRIVATE',
    locale: 'en',
    theme: 'SYSTEM',
    timeZone: 'UTC',
  },
  onboardingCompletedAt: null,
};

export const t = messages.en.onboarding;

export function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

export function problem(status: number, code: string, detail?: string): Response {
  return json(
    { type: 'about:blank', title: 'Error', status, code, ...(detail ? { detail } : {}) },
    status,
  );
}

type Handler = (init: RequestInit | undefined, url: string) => Response | Promise<Response>;

/**
 * Stubs fetch with a route table keyed by "METHOD /path" (query string ignored, path prefix
 * match for routes ending in "*"). An unknown route fails the test loudly.
 */
export function mockApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const key = `${method} ${url.split('?')[0]}`;
    const exact = routes[key];
    const wildcard = Object.entries(routes).find(
      ([route]) => route.endsWith('*') && key.startsWith(route.slice(0, -1)),
    )?.[1];
    const handler = exact ?? wildcard;
    if (!handler) throw new Error(`Unmocked request: ${key}`);
    return handler(init, url);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const bodyOf = (init: RequestInit | undefined): unknown =>
  init?.body ? JSON.parse(String(init.body)) : undefined;
