import { AppLanguage } from '@/services/i18n';
import { useSettingsStore } from '@/store/settingsStore';

import { GlassSettingsRow } from './GlassSettingsRow';
import { GlassSettingsSection } from './GlassSettingsSection';

type Props = {
  lang: AppLanguage;
};

// D10 05.11.2026: clean synonyms are always shown (first in the carousel);
// contextual synonyms ("in context") are added only when this switch is on.
export function SettingsSynonymsSection({ lang }: Props) {
  const { show_contextual_synonyms, setShowContextualSynonyms } = useSettingsStore();

  const title = lang === 'ua' ? 'Синоніми' : lang === 'no' ? 'Synonymer' : 'Synonyms';
  const contextualTitle =
    lang === 'ua' ? 'Показувати контекстні' : lang === 'no' ? 'Vis kontekstuelle' : 'Show contextual';

  return (
    <GlassSettingsSection title={title}>
      <GlassSettingsRow
        icon="🔁"
        title={contextualTitle}
        switchValue={show_contextual_synonyms}
        onSwitchChange={(v) => setShowContextualSynonyms(v)}
        isLast
      />
    </GlassSettingsSection>
  );
}
