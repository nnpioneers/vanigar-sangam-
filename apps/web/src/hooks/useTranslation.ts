'use client';

import { useContext } from 'react';
import {
  LanguageContext,
  type LanguageContextValue,
} from '@/components/i18n/LanguageProvider';

/**
 * Custom hook to consume the current language context and translation helper.
 *
 * @throws {Error} if used outside `<LanguageProvider>`.
 */
export function useTranslation(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
