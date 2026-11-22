import type { ReactNode } from 'react';
import { RequireOnboarded } from '@/features/onboarding/RequireOnboarded';

// Everything under (app) needs a finished onboarding (SPEC 11).
export default function AppLayout({ children }: { children: ReactNode }) {
  return <RequireOnboarded>{children}</RequireOnboarded>;
}
