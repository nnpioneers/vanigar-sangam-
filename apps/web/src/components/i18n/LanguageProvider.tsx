'use client';

import React, { createContext, useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_LANGUAGE,
  getTranslation,
  type SupportedLanguage,
} from '@/locales';

const LANGUAGE_STORAGE_KEY = 'vs_lang';

export interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

export interface LanguageProviderProps {
  children: React.ReactNode;
  defaultLanguage?: SupportedLanguage;
}

function getInitialLanguage(defaultLanguage: SupportedLanguage): SupportedLanguage {
  if (typeof window === 'undefined') {
    return defaultLanguage;
  }
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'en' || stored === 'ta') {
      return stored;
    }
  } catch {
    // Fall back to default language
  }
  return defaultLanguage;
}

export function LanguageProvider({
  children,
  defaultLanguage = DEFAULT_LANGUAGE,
}: LanguageProviderProps) {
  const [language, setLanguageState] = useState<SupportedLanguage>(() =>
    getInitialLanguage(defaultLanguage)
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // Ignore localStorage write error if unavailable
    }
  }, []);

  const t = useCallback(
    (path: string, params?: Record<string, string | number>) => {
      return getTranslation(language, path, params);
    },
    [language]
  );

  const value: LanguageContextValue = {
    language,
    setLanguage,
    t,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
