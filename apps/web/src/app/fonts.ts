import { Cormorant_Garamond, Inter } from 'next/font/google';

// Display serif: 500 plus italic, only used at 20px and up (DESIGN.md Typography).
export const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: '500',
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

// UI sans.
export const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});
