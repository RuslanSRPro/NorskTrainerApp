// contexts/ThemeContext.tsx
import React, { createContext, useContext } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { THEMES, FONT_SIZES, AppColors, AppFonts, ThemeName, FontSizeName } from '@/services/theme';

type ThemeCtx = { theme: AppColors; fonts: AppFonts; themeName: ThemeName; fontSizeName: FontSizeName };

const ThemeContext = createContext<ThemeCtx>({
  theme: THEMES.light, fonts: FONT_SIZES.medium, themeName: 'light', fontSizeName: 'medium',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeName    = useSettingsStore((s) => s.theme)     as ThemeName;
  const fontSizeName = useSettingsStore((s) => s.font_size) as FontSizeName;
  return (
    <ThemeContext.Provider value={{
      theme:        THEMES[themeName]        ?? THEMES.light,
      fonts:        FONT_SIZES[fontSizeName] ?? FONT_SIZES.medium,
      themeName,
      fontSizeName,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
