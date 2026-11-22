import type { ReactNode } from 'react';
import { WakingBanner } from '@/components/shell/WakingBanner';
import { AuthQuote } from '@/features/auth/AuthQuote';
import { pickQuote } from '@/features/auth/quotes';

// Split screen (DESIGN P2): quote panel on the left, form on the right.
// On mobile the quote collapses to a short band above the form.
// The root layout reads cookies, so this renders per request and picks a new quote per visit.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] md:grid-cols-2 md:grid-rows-1">
      <AuthQuote quote={pickQuote()} />
      <main className="relative flex items-start justify-center bg-surface px-4 py-8 md:items-center md:p-12">
        {/* Overlays the top edge, so the banner never shifts the form. */}
        <div className="absolute inset-x-0 top-0">
          <WakingBanner />
        </div>
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
