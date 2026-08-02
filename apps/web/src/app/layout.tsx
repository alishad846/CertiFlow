import type { Metadata } from 'next';
import { Bodoni_Moda, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// Redesign type system: Bodoni Moda (display serif) + DM Sans (body).
const serif = Bodoni_Moda({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap'
});

const sans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-sans',
  display: 'swap'
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'CertiFlow — Certificates, perfected.',
  description:
    'A quietly powerful platform for bulk certificate delivery. Upload, compose, and send personalized certificates with the craft of fine stationery.'
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
