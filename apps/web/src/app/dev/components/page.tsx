import { notFound } from 'next/navigation';
import { ComponentsDemo } from './components-demo';

// Dev-only showcase for SPEC 03. Removed or promoted when M1.6 ships.
export default function DevComponentsPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <ComponentsDemo />;
}
