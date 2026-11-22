import type { ReactNode } from 'react';
import { AuthQuote } from '@/features/auth/AuthQuote';

// Split screen (DESIGN P2): quote panel on the left, form on the right.
// On mobile the quote collapses to a short band above the form.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] md:grid-cols-2 md:grid-rows-1">
      <AuthQuote />
      <main className="flex items-start justify-center bg-surface px-4 py-8 md:items-center md:p-12">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
