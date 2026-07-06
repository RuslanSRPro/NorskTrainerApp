import { useMemo, useState } from 'react';

import { AppLanguage } from '@/services/i18n';
import { useSettingsStore } from '@/store/settingsStore';

import { GlassBottomSheet } from './GlassBottomSheet';
import { GlassSettingsRow } from './GlassSettingsRow';
import { GlassSettingsSection } from './GlassSettingsSection';

type Props = {
  lang: AppLanguage;
};

export function SettingsPronunciationSection({ lang }: Props) {
  const {
    auto_pronounce,
    pronounce_forms,
    pronounce_after_answer,
    speech_rate,
    updateSetting,
  } = useSettingsStore();

  const [sheet, setSheet] = useState<'speed' | null>(null);

  const title = lang === 'ua' ? 'Озвучка' : lang === 'no' ? 'Uttale' : 'Pronunciation';
  const autoTitle = lang === 'ua' ? 'Автоозвучка' : lang === 'no' ? 'Automatisk uttale' : 'Auto pronounce';
  const formsTitle = lang === 'ua' ? 'Усі форми' : lang === 'no' ? 'Alle former' : 'All forms';
  const afterTitle = lang === 'ua' ? 'Після відповіді' : lang === 'no' ? 'Etter svar' : 'After answer';
  const speedTitle = lang === 'ua' ? 'Швидкість' : lang === 'no' ? 'Hastighet' : 'Speed';

  const speedOptions = useMemo(
    () => [
      { id: '0.7', title: lang === 'ua' ? 'Повільно' : lang === 'no' ? 'Sakte' : 'Slow' },
      { id: '0.85', title: lang === 'ua' ? 'Нормально' : lang === 'no' ? 'Normal' : 'Normal' },
      { id: '1', title: lang === 'ua' ? 'Швидко' : lang === 'no' ? 'Raskt' : 'Fast' },
    ],
    [lang],
  );

  const speedLabel = speedOptions.find((o) => Number(o.id) === speech_rate)?.title || String(speech_rate);

  return (
    <>
      <GlassSettingsSection title={title}>
        <GlassSettingsRow
          icon="🔊"
          title={autoTitle}
          switchValue={auto_pronounce}
          onSwitchChange={(v) => updateSetting('auto_pronounce', v)}
        />

        <GlassSettingsRow
          icon="📖"
          title={formsTitle}
          switchValue={pronounce_forms}
          onSwitchChange={(v) => updateSetting('pronounce_forms', v)}
        />

        <GlassSettingsRow
          icon="✅"
          title={afterTitle}
          switchValue={pronounce_after_answer}
          onSwitchChange={(v) => updateSetting('pronounce_after_answer', v)}
        />

        <GlassSettingsRow
          icon="⏱️"
          title={speedTitle}
          value={speedLabel}
          isLast
          onPress={() => setSheet('speed')}
        />
      </GlassSettingsSection>

      <GlassBottomSheet
        visible={sheet === 'speed'}
        title={speedTitle}
        selected={String(speech_rate)}
        options={speedOptions}
        onClose={() => setSheet(null)}
        onSelect={(id) => updateSetting('speech_rate', Number(id))}
      />
    </>
  );
}