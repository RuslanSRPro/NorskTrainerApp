// services/theme.ts

export type ThemeName    = 'light' | 'dark' | 'reading' | 'turquoise';
export type FontSizeName = 'small' | 'medium' | 'large';

// Unified color type — covers both settings.tsx and explore.tsx field names
export type AppColors = {
  // backgrounds
  background: string;
  card:       string;
  cardAlt:    string;   // secondary card / inner area
  cardInner:  string;   // alias for cardAlt (explore.tsx)
  inputBg:    string;
  // text hierarchy
  textPrimary:   string;
  textSecondary: string;
  textTertiary:  string;
  text:          string; // alias for textPrimary (explore.tsx)
  textMuted:     string; // alias for textTertiary (explore.tsx)
  // accent
  accent:     string;
  accentSoft: string;
  accentBg:   string;  // alias for accentSoft (explore.tsx)
  // border
  border: string;
  // semantic
  danger:     string;
  dangerSoft: string;
  // tags
  tagBg:   string;
  tagText: string;
  // grade buttons
  hardBtn:  string; hardText:  string;
  okBtn:    string; okText:    string;
  easyBtn:  string; easyText:  string;
  // next button
  nextBtn: string; nextBorder: string; nextText: string;
};

export type AppFonts = {
  word:        number;
  translation: number;
  prompt:      number;
  base:        number;
  meta:        number;
};

// ── Themes ───────────────────────────────────────────────────────────────────

export const THEMES: Record<ThemeName, AppColors> = {
  // Apple iOS Light
  light: {
    background: '#F2F2F7', card: '#FFFFFF', cardAlt: '#F2F2F7', cardInner: '#F2F2F7', inputBg: '#FFFFFF',
    textPrimary: '#000000', textSecondary: '#3C3C43', textTertiary: '#8E8E93',
    text: '#000000', textMuted: '#8E8E93',
    accent: '#007AFF', accentSoft: '#EAF3FF', accentBg: '#EAF3FF',
    border: '#C6C6C8',
    danger: '#FF3B30', dangerSoft: '#FFF0EE',
    tagBg: '#EAF3FF', tagText: '#007AFF',
    hardBtn: '#FF3B30', hardText: '#FFFFFF',
    okBtn: '#FF9500', okText: '#FFFFFF',
    easyBtn: '#34C759', easyText: '#FFFFFF',
    nextBtn: '#FFFFFF', nextBorder: '#C6C6C8', nextText: '#000000',
  },
  // Apple iOS Dark
  dark: {
    background: '#000000', card: '#1C1C1E', cardAlt: '#2C2C2E', cardInner: '#2C2C2E', inputBg: '#2C2C2E',
    textPrimary: '#FFFFFF', textSecondary: '#EBEBF5', textTertiary: '#636366',
    text: '#FFFFFF', textMuted: '#636366',
    accent: '#0A84FF', accentSoft: '#001D3D', accentBg: '#001D3D',
    border: '#38383A',
    danger: '#FF453A', dangerSoft: '#2D0000',
    tagBg: '#001D3D', tagText: '#0A84FF',
    hardBtn: '#FF453A', hardText: '#FFFFFF',
    okBtn: '#FF9F0A', okText: '#000000',
    easyBtn: '#30D158', easyText: '#000000',
    nextBtn: '#2C2C2E', nextBorder: '#38383A', nextText: '#FFFFFF',
  },
  // Apple Books Sepia
  reading: {
    background: '#F5E6C8', card: '#FFFBF0', cardAlt: '#F5E6C8', cardInner: '#F5E6C8', inputBg: '#FFFBF0',
    textPrimary: '#2C1810', textSecondary: '#6B4C35', textTertiary: '#A07855',
    text: '#2C1810', textMuted: '#A07855',
    accent: '#8B4513', accentSoft: '#F0D9B5', accentBg: '#F0D9B5',
    border: '#D4B896',
    danger: '#C0392B', dangerSoft: '#FAE5E3',
    tagBg: '#F0D9B5', tagText: '#8B4513',
    hardBtn: '#C0392B', hardText: '#FFFFFF',
    okBtn: '#D4810A', okText: '#FFFFFF',
    easyBtn: '#27AE60', easyText: '#FFFFFF',
    nextBtn: '#FFFBF0', nextBorder: '#D4B896', nextText: '#2C1810',
  },
  // Apple macOS Mint
  turquoise: {
    background: '#ECF8F5', card: '#FFFFFF', cardAlt: '#ECF8F5', cardInner: '#ECF8F5', inputBg: '#FFFFFF',
    textPrimary: '#0A3728', textSecondary: '#1A6B55', textTertiary: '#64B8A0',
    text: '#0A3728', textMuted: '#64B8A0',
    accent: '#00977A', accentSoft: '#D1F2EA', accentBg: '#D1F2EA',
    border: '#A8E6D8',
    danger: '#FF3B30', dangerSoft: '#FFF0EE',
    tagBg: '#D1F2EA', tagText: '#007A62',
    hardBtn: '#FF3B30', hardText: '#FFFFFF',
    okBtn: '#FF9500', okText: '#FFFFFF',
    easyBtn: '#2DD4BF', easyText: '#0A3728',
    nextBtn: '#FFFFFF', nextBorder: '#A8E6D8', nextText: '#0A3728',
  },
};

// ── Font sizes ────────────────────────────────────────────────────────────────

export const FONT_SIZES: Record<FontSizeName, AppFonts> = {
  small:  { word: 26, translation: 18, prompt: 19, base: 14, meta: 11 },
  medium: { word: 32, translation: 22, prompt: 23, base: 16, meta: 13 },
  large:  { word: 40, translation: 28, prompt: 29, base: 18, meta: 15 },
};

// Font scale multipliers — used by useAppTheme()
const SCALE_MULTIPLIER: Record<FontSizeName, number> = {
  small: 0.875, medium: 1, large: 1.125,
};

// ── Labels (multilingual) ────────────────────────────────────────────────────
// settings.tsx reads: THEME_LABELS[option][lang]

export const THEME_LABELS: Record<ThemeName, Record<string, string>> = {
  light:     { ua: 'Світла',   en: 'Light',   no: 'Lys' },
  dark:      { ua: 'Темна',    en: 'Dark',    no: 'Mørk' },
  reading:   { ua: 'Читання',  en: 'Reading', no: 'Lesing' },
  turquoise: { ua: 'Бірюзова', en: 'Teal',    no: 'Turkis' },
};

export const FONT_SIZE_LABELS: Record<FontSizeName, Record<string, string>> = {
  small:  { ua: 'Малий',     en: 'Small',  no: 'Liten' },
  medium: { ua: 'Звичайний', en: 'Normal', no: 'Normal' },
  large:  { ua: 'Великий',   en: 'Large',  no: 'Stor' },
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

import { useSettingsStore } from '@/store/settingsStore';

// useAppTheme — used by settings.tsx and ScreenHeader.tsx
// returns: { colors, scale(n) }  where scale is a function
export function useAppTheme(): { colors: AppColors; scale: (n: number) => number } {
  const themeName    = useSettingsStore((s) => s.theme)     as ThemeName;
  const fontSizeName = useSettingsStore((s) => s.font_size) as FontSizeName;
  const multiplier   = SCALE_MULTIPLIER[fontSizeName] ?? 1;
  return {
    colors: THEMES[themeName] ?? THEMES.light,
    scale:  (n: number) => Math.round(n * multiplier),
  };
}