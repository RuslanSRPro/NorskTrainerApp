import { useMemo, useState } from 'react';

import {
  FONT_SIZE_LABELS,
  FontSizeName,
  THEME_LABELS,
  ThemeName,
} from '@/services/theme';

import { AppLanguage } from '@/services/i18n';
import { useSettingsStore } from '@/store/settingsStore';

import { GlassBottomSheet } from './GlassBottomSheet';
import { GlassSettingsRow } from './GlassSettingsRow';
import { GlassSettingsSection } from './GlassSettingsSection';
import { SettingsTransparencySection } from './SettingsTransparencySection';

type SheetType = 'theme' | 'fontSize' | 'transparency' | null;

type Props = {
  lang: AppLanguage;
};

export function SettingsAppearanceSection({ lang }: Props) {
  const { theme, font_size, updateSetting } = useSettingsStore();
  const [sheet, setSheet] = useState<SheetType>(null);

  const title = lang === 'ua' ? 'Вигляд' : lang === 'no' ? 'Utseende' : 'Appearance';
  const themeTitle = lang === 'ua' ? 'Тема' : lang === 'no' ? 'Tema' : 'Theme';
  const fontSizeTitle = lang === 'ua' ? 'Розмір тексту' : lang === 'no' ? 'Tekststørrelse' : 'Text size';
  const transparencyTitle = lang === 'ua' ? 'Прозорість' : lang === 'no' ? 'Gjennomsiktighet' : 'Transparency';

  const themeOptions = useMemo(
    () =>
      (['light', 'dark', 'reading', 'turquoise'] as ThemeName[]).map((item) => ({
        id: item,
        title: THEME_LABELS[item][lang],
      })),
    [lang],
  );

  const fontSizeOptions = useMemo(
    () =>
      (['small', 'medium', 'large'] as FontSizeName[]).map((item) => ({
        id: item,
        title: FONT_SIZE_LABELS[item][lang],
      })),
    [lang],
  );

  return (
    <>
      <GlassSettingsSection title={title}>
        <GlassSettingsRow
          icon="🎨"
          title={themeTitle}
          value={THEME_LABELS[theme as ThemeName][lang]}
          onPress={() => setSheet('theme')}
        />

        <GlassSettingsRow
          icon="🔠"
          title={fontSizeTitle}
          value={FONT_SIZE_LABELS[font_size as FontSizeName][lang]}
          onPress={() => setSheet('fontSize')}
        />

        <GlassSettingsRow
          icon="◐"
          title={transparencyTitle}
          value=""
          isLast
          onPress={() => setSheet('transparency')}
        />
      </GlassSettingsSection>

      <GlassBottomSheet
        visible={sheet === 'theme'}
        title={themeTitle}
        selected={theme}
        options={themeOptions}
        onClose={() => setSheet(null)}
        onSelect={(id) => updateSetting('theme', id as ThemeName)}
      />

      <GlassBottomSheet
        visible={sheet === 'fontSize'}
        title={fontSizeTitle}
        selected={font_size}
        options={fontSizeOptions}
        onClose={() => setSheet(null)}
        onSelect={(id) => updateSetting('font_size', id as FontSizeName)}
      />

      <GlassBottomSheet
        visible={sheet === 'transparency'}
        title={transparencyTitle}
        height="medium"
        onClose={() => setSheet(null)}
      >
        <SettingsTransparencySection lang={lang} />
      </GlassBottomSheet>
    </>
  );
}