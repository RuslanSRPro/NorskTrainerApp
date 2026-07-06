import { useMemo, useState } from 'react';

import { AppLanguage } from '@/services/i18n';
import { TranslationMode } from '@/services/settings';
import { useSettingsStore } from '@/store/settingsStore';

import { GlassBottomSheet } from './GlassBottomSheet';
import { GlassSettingsRow } from './GlassSettingsRow';
import { GlassSettingsSection } from './GlassSettingsSection';

type SheetType = 'app' | 'translation' | null;

type Props = {
  lang: AppLanguage;
};

export function SettingsLanguageSection({ lang }: Props) {
  const {
    app_language,
    translation_mode,
    updateSetting,
  } = useSettingsStore();

  const [sheet, setSheet] = useState<SheetType>(null);

  const sectionTitle =
    lang === 'ua'
      ? 'Мова'
      : lang === 'no'
        ? 'Språk'
        : 'Language';

  const appTitle =
    lang === 'ua'
      ? 'Мова інтерфейсу'
      : lang === 'no'
        ? 'Appspråk'
        : 'Interface language';

  const translationTitle =
    lang === 'ua'
      ? 'Мова перекладу'
      : lang === 'no'
        ? 'Oversettelse'
        : 'Translation language';

  const appOptions = useMemo(
    () => [
      { id: 'ua', title: 'Українська' },
      { id: 'en', title: 'English' },
      { id: 'no', title: 'Norsk' },
    ],
    [],
  );

  const translationOptions = useMemo(
    () => [
      { id: 'ua', title: 'Українська' },
      { id: 'en', title: 'English' },
      { id: 'ua_en', title: 'Українська + English' },
    ],
    [],
  );

  function appLabel() {
    switch (app_language) {
      case 'en':
        return 'English';
      case 'no':
        return 'Norsk';
      default:
        return 'Українська';
    }
  }

  function translationLabel() {
    switch (translation_mode) {
      case 'en':
        return 'English';
      case 'ua_en':
        return 'Українська + English';
      default:
        return 'Українська';
    }
  }

  return (
    <>
      <GlassSettingsSection title={sectionTitle}>
        <GlassSettingsRow
          icon="🌍"
          title={appTitle}
          value={appLabel()}
          onPress={() => setSheet('app')}
        />

        <GlassSettingsRow
          icon="🈯"
          title={translationTitle}
          value={translationLabel()}
          isLast
          onPress={() => setSheet('translation')}
        />
      </GlassSettingsSection>

      <GlassBottomSheet
        visible={sheet === 'app'}
        title={appTitle}
        selected={app_language}
        options={appOptions}
        onClose={() => setSheet(null)}
        onSelect={(id) =>
          updateSetting('app_language', id as AppLanguage)
        }
      />

      <GlassBottomSheet
        visible={sheet === 'translation'}
        title={translationTitle}
        selected={translation_mode}
        options={translationOptions}
        onClose={() => setSheet(null)}
        onSelect={(id) =>
          updateSetting('translation_mode', id as TranslationMode)
        }
      />
    </>
  );
}