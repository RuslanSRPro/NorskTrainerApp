import { useMemo, useState } from 'react';

import { useWallpaper } from '@/design-system/wallpaper';
import { AppLanguage } from '@/services/i18n';

import { GlassBottomSheet } from './GlassBottomSheet';
import { GlassSettingsRow } from './GlassSettingsRow';
import { GlassSettingsSection } from './GlassSettingsSection';

type Props = {
  lang: AppLanguage;
};

export function SettingsWallpaperSection({ lang }: Props) {
  const {
    wallpaper,
    customUri,
    setWallpaper,
    pickCustomWallpaper,
    clearCustomWallpaper,
  } = useWallpaper();

  const [sheet, setSheet] = useState<'wallpaper' | null>(null);

  const sectionTitle =
    lang === 'ua' ? 'Шпалери' : lang === 'no' ? 'Bakgrunn' : 'Wallpaper';

  const wallpaperTitle =
    lang === 'ua' ? 'Фон застосунку' : lang === 'no' ? 'Appbakgrunn' : 'App wallpaper';

  const choosePhotoTitle =
    lang === 'ua' ? 'Обрати фото' : lang === 'no' ? 'Velg bilde' : 'Choose photo';

  const removePhotoTitle =
    lang === 'ua' ? 'Прибрати власне фото' : lang === 'no' ? 'Fjern eget bilde' : 'Remove custom photo';

  const options = useMemo(
    () => [
      { id: 'default', title: 'Default' },
      { id: 'fjord', title: 'Fjord' },
      { id: 'aurora', title: 'Aurora' },
      { id: 'forest', title: 'Forest' },
      { id: 'custom', title: choosePhotoTitle },
      ...(customUri ? [{ id: 'removeCustom', title: removePhotoTitle }] : []),
    ],
    [choosePhotoTitle, customUri, removePhotoTitle],
  );

  function wallpaperLabel() {
    if (customUri) return choosePhotoTitle;

    switch (wallpaper) {
      case 'fjord':
        return 'Fjord';
      case 'aurora':
        return 'Aurora';
      case 'forest':
        return 'Forest';
      default:
        return 'Default';
    }
  }

  async function handleSelect(id: string) {
    if (id === 'custom') {
      await pickCustomWallpaper();
      return;
    }

    if (id === 'removeCustom') {
      await clearCustomWallpaper();
      return;
    }

    await setWallpaper(id as any);
  }

  return (
    <>
      <GlassSettingsSection title={sectionTitle}>
        <GlassSettingsRow
          icon="🖼️"
          title={wallpaperTitle}
          value={wallpaperLabel()}
          isLast
          onPress={() => setSheet('wallpaper')}
        />
      </GlassSettingsSection>

      <GlassBottomSheet
        visible={sheet === 'wallpaper'}
        title={wallpaperTitle}
        selected={customUri ? 'custom' : wallpaper}
        options={options}
        onClose={() => setSheet(null)}
        onSelect={handleSelect}
      />
    </>
  );
}