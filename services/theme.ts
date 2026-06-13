import { useSettingsStore } from '@/store/settingsStore';

export type ThemeName = 'light' | 'dark' | 'reading' | 'turquoise';
export type FontSizeName = 'small' | 'medium' | 'large';

export type AppColors = {
  background: string;
  card: string;
  cardAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
};

/**
 * Four palettes:
 *  - light:     current cream/white look (default)
 *  - dark:      dark UI for low-light use
 *  - reading:   warm sepia / paper, easy on the eyes for long text-analysis sessions
 *  - turquoise: light background with a teal/turquoise accent identity
 */
export const THEMES: Record<ThemeName, AppColors> = {
  light: {
    background: '#F7F4ED',
    card: '#FFFFFF',
    cardAlt: '#F8FAFC',
    border: '#E5E7EB',
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    accent: '#0EA5E9',
    accentText: '#0284C7',
    accentSoft: '#E0F2FE',
    success: '#22C55E',
    successSoft: '#DCFCE7',
    warning: '#F59E0B',
    warningSoft: '#FEF3C7',
    danger: '#EF4444',
    dangerSoft: '#FEE2E2',
  },

  dark: {
    background: '#15181B',
    card: '#1F2327',
    cardAlt: '#262B30',
    border: '#33383E',
    textPrimary: '#F3F4F6',
    textSecondary: '#A1A8B0',
    textTertiary: '#6B7280',
    accent: '#38BDF8',
    accentText: '#7DD3FC',
    accentSoft: '#0C3A4F',
    success: '#4ADE80',
    successSoft: '#143821',
    warning: '#FBBF24',
    warningSoft: '#3D2E0B',
    danger: '#F87171',
    dangerSoft: '#3D1414',
  },

  reading: {
    background: '#F4ECDA',
    card: '#FBF6EA',
    cardAlt: '#F0E6D2',
    border: '#E2D5BB',
    textPrimary: '#3D3424',
    textSecondary: '#8A7A5C',
    textTertiary: '#A6987C',
    accent: '#B5651D',
    accentText: '#8A4A12',
    accentSoft: '#F1E0C6',
    success: '#5C7F3F',
    successSoft: '#E6EBD9',
    warning: '#B5821D',
    warningSoft: '#F2E6C6',
    danger: '#A4452F',
    dangerSoft: '#F2DDD4',
  },

  turquoise: {
    background: '#E9F6F0',
    card: '#FFFFFF',
    cardAlt: '#F1FAF6',
    border: '#CDEBE0',
    textPrimary: '#04342C',
    textSecondary: '#0F6E56',
    textTertiary: '#5DCAA5',
    accent: '#1D9E75',
    accentText: '#0F6E56',
    accentSoft: '#E1F5EE',
    success: '#22C55E',
    successSoft: '#DCFCE7',
    warning: '#F59E0B',
    warningSoft: '#FEF3C7',
    danger: '#EF4444',
    dangerSoft: '#FEE2E2',
  },
};

export const THEME_LABELS: Record<ThemeName, { ua: string; en: string; no: string }> = {
  light: { ua: 'Світла', en: 'Light', no: 'Lys' },
  dark: { ua: 'Темна', en: 'Dark', no: 'Mørk' },
  reading: { ua: 'Читання', en: 'Reading', no: 'Lesemodus' },
  turquoise: { ua: 'Бірюзова', en: 'Turquoise', no: 'Turkis' },
};

/**
 * Font size multipliers.
 * "medium" matches the current sizes used across the app (multiplier 1).
 * Use scale(baseSize) to get the adjusted size for the current setting.
 */
export const FONT_SCALE: Record<FontSizeName, number> = {
  small: 0.88,
  medium: 1,
  large: 1.14,
};

export const FONT_SIZE_LABELS: Record<FontSizeName, { ua: string; en: string; no: string }> = {
  small: { ua: 'Малий', en: 'Small', no: 'Liten' },
  medium: { ua: 'Звичайний', en: 'Medium', no: 'Normal' },
  large: { ua: 'Великий', en: 'Large', no: 'Stor' },
};

/**
 * Central hook for theme + font scale.
 *
 * Reads `theme` and `font_size` from settingsStore. Both fields are optional
 * for now (default to 'light' / 'medium') -- add them to services/settings.ts
 * and settingsStore once the Settings screen exposes the pickers.
 */
export function useAppTheme() {
  const { theme, font_size } = useSettingsStore() as {
    theme?: ThemeName;
    font_size?: FontSizeName;
  };

  const themeName: ThemeName = theme || 'light';
  const fontSizeName: FontSizeName = font_size || 'medium';

  const colors = THEMES[themeName];
  const multiplier = FONT_SCALE[fontSizeName];

  // Round to whole pixels so React Native doesn't sub-pixel render text.
  const scale = (base: number) => Math.round(base * multiplier);

  return {
    themeName,
    fontSizeName,
    colors,
    multiplier,
    scale,
  };
}