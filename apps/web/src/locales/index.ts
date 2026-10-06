/**
 * Centralized Localization System for Vanigar Sangam
 *
 * Supports:
 * - English ('en')
 * - Tamil ('ta')
 *
 * Strictly decoupled from server-side session authentication.
 * Stores only user interface language preference.
 */

import { enLocale } from './en';
import { taLocale } from './ta';

export type SupportedLanguage = 'en' | 'ta';

export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export const locales = {
  en: enLocale,
  ta: taLocale,
} as const;

export type TranslationNamespace = keyof typeof enLocale;

/**
 * Resolves a translation string given a dot-separated key (e.g. 'navigation.dashboard', 'common.save')
 * or namespace + key.
 */
export function getTranslation(
  lang: SupportedLanguage,
  path: string,
  params?: Record<string, string | number>
): string {
  const dict = locales[lang] || locales[DEFAULT_LANGUAGE];
  const parts = path.split('.');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = dict;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      // Fallback to English dictionary if key is missing in selected language
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let fallbackCurrent: any = locales[DEFAULT_LANGUAGE];
      for (const fallbackPart of parts) {
        if (fallbackCurrent && typeof fallbackCurrent === 'object' && fallbackPart in fallbackCurrent) {
          fallbackCurrent = fallbackCurrent[fallbackPart];
        } else {
          return path; // Return raw path key if missing in both
        }
      }
      current = fallbackCurrent;
      break;
    }
  }

  if (typeof current !== 'string') {
    return path;
  }

  if (!params) {
    return current;
  }

  return current.replace(/\{\{(\w+)\}\}/g, (_match: string, token: string) => {
    return params[token] !== undefined ? String(params[token]) : `{{${token}}}`;
  });
}
