/**
 * TypeScript Design Tokens Mirror
 *
 * Provides strongly-typed constants for the Vanigar Sangam design system.
 */

export const colors = {
  primary: {
    50: '#fdf6f2',
    100: '#fceade',
    200: '#f8d2bd',
    300: '#f1b392',
    400: '#e3895e',
    500: '#7e3a1e',
    600: '#6b2f16',
    700: '#54220e',
    800: '#421a0a',
    900: '#2c1006',
  },
  gold: {
    50: '#fdfaf0',
    100: '#f9f3db',
    200: '#f1e4b3',
    300: '#e7cf85',
    400: '#d4af37',
    500: '#c59b27',
    600: '#a37d16',
    700: '#7f5f0e',
  },
  espresso: {
    950: '#1b100a',
    900: '#2b1a12',
    800: '#3b2014',
    700: '#463327',
    600: '#584437',
    500: '#6e6257',
    400: '#94887d',
    300: '#b8aea4',
    200: '#dcd6ce',
    100: '#efece8',
    50: '#f8f6f4',
  },
  background: {
    app: '#f6f3ec',
    surface: '#ffffff',
    surfaceSubtle: '#faf7f2',
    surfaceElevated: '#ffffff',
    surfaceHighlight: '#f2ebe1',
  },
  border: {
    subtle: '#e8dfc8',
    default: '#d8cebc',
    strong: '#bfae95',
    focus: '#7e3a1e',
  },
  status: {
    success: {
      text: '#14532d',
      bg: '#f0fdf4',
      border: '#86efac',
      main: '#1b7a43',
    },
    warning: {
      text: '#78350f',
      bg: '#fffbeb',
      border: '#fde68a',
      main: '#b45309',
    },
    danger: {
      text: '#7f1d1d',
      bg: '#fef2f2',
      border: '#fca5a5',
      main: '#a82315',
    },
    info: {
      text: '#1e3a8a',
      bg: '#eff6ff',
      border: '#bfdbfe',
      main: '#1d4ed8',
    },
  },
} as const;

export const spacing = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
} as const;

export const borderRadius = {
  xs: '3px',
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
} as const;

export const typography = {
  fonts: {
    sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    heading: "'Playfair Display', Georgia, 'Times New Roman', serif",
    mono: "'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace",
  },
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
} as const;
