import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CertiFlow',
  description: 'Bulk certificate and offer letter generation for EdTech and HR teams.'
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
