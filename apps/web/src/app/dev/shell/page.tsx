import { notFound } from 'next/navigation';
import { ShellDemo } from './shell-demo';

// Dev-only demo for SPEC 05. M2 mounts AppShell in (app)/layout.tsx with the real session.
export default function DevShellPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <ShellDemo />;
}
