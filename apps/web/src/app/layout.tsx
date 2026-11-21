import type { ReactNode } from 'react';
import { cormorant, inter } from './fonts';
import { Providers } from './providers';
import '../styles/base.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: next-themes sets data-theme before hydration.
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
