import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';

import { AuthProvider } from '@/components/auth/AuthProvider';
import { LanguageProvider } from '@/components/i18n/LanguageProvider';
import { NotificationProvider } from '@/components/feedback/NotificationProvider';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
});

/**
 * Root layout — Vanigar Sangam application foundation.
 * Provides central localization, authentication, and notification feedback contexts.
 */
export const metadata: Metadata = {
  title: {
    default: 'Vanigar Sangam Management System',
    template: '%s · Vanigar Sangam Management System',
  },
  description: 'Management system for a traders association.',
  applicationName: 'Vanigar Sangam Management System',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body suppressHydrationWarning>
        <LanguageProvider>
          <AuthProvider>
            <NotificationProvider>{children}</NotificationProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
