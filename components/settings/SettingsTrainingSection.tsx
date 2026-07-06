import { useMemo, useState } from 'react';

import { AppLanguage } from '@/services/i18n';
import { TrainingFlow, TrainingLayout, TrainingMode } from '@/services/settings';
import { useSettingsStore } from '@/store/settingsStore';

import { GlassBottomSheet } from './GlassBottomSheet';
import { GlassSettingsRow } from './GlassSettingsRow';
import { GlassSettingsSection } from './GlassSettingsSection';

type SheetType = 'modes' | 'flow' | 'layout' | null;

type Props = {
  lang: AppLanguage;
};

export function SettingsTrainingSection({ lang }: Props) {
  const {
    training_modes,
    mix_modes,
    training_flow,
    training_layout,
    updateSetting,
  } = useSettingsStore();

  const [sheet, setSheet] = useState<SheetType>(null);

  const sectionTitle = lang === 'ua' ? 'Тренування' : lang === 'no' ? 'Trening' : 'Training';
  const modesTitle = lang === 'ua' ? 'Режими' : lang === 'no' ? 'Moduser' : 'Modes';
  const mixTitle = lang === 'ua' ? 'Змішувати режими' : lang === 'no' ? 'Bland moduser' : 'Mix modes';
  const flowTitle = lang === 'ua' ? 'Стиль тренування' : lang === 'no' ? 'Treningsstil' : 'Training flow';
  const layoutTitle = lang === 'ua' ? 'Подача завдання' : lang === 'no' ? 'Oppgavevisning' : 'Training layout';

  const modeOptions = useMemo(
    () => [
      { id: 'flashcards', title: lang === 'ua' ? 'Картки' : lang === 'no' ? 'Kort' : 'Flashcards' },
      { id: 'choice', title: lang === 'ua' ? 'Вибір' : lang === 'no' ? 'Valg' : 'Multiple Choice' },
      { id: 'typing', title: lang === 'ua' ? 'Введення' : lang === 'no' ? 'Skriving' : 'Typing' },
      { id: 'cloze', title: 'Cloze' },
      { id: 'forms', title: lang === 'ua' ? 'Форми' : lang === 'no' ? 'Former' : 'Forms' },
    ],
    [lang],
  );

  const flowOptions = useMemo(
    () => [
      { id: 'reinforcement', title: 'Reinforcement' },
      { id: 'one_per_word', title: lang === 'ua' ? '1 завдання на слово' : lang === 'no' ? '1 oppgave per ord' : 'One task per word' },
    ],
    [lang],
  );

  const layoutOptions = useMemo(
    () => [
      { id: 'standard', title: lang === 'ua' ? 'Стандартна' : lang === 'no' ? 'Standard' : 'Standard' },
      { id: 'sentence_first', title: lang === 'ua' ? 'Спочатку речення' : lang === 'no' ? 'Setning først' : 'Sentence first' },
    ],
    [lang],
  );

  function toggleMode(mode: TrainingMode) {
    const exists = training_modes.includes(mode);
    let next = exists ? training_modes.filter((m) => m !== mode) : [...training_modes, mode];
    if (!next.length) next = ['flashcards'];
    updateSetting('training_modes', next);
  }

  const modeValue =
    training_modes.length === 1
      ? modeOptions.find((o) => o.id === training_modes[0])?.title
      : `${training_modes.length}`;

  return (
    <>
      <GlassSettingsSection title={sectionTitle}>
        <GlassSettingsRow
          icon="🧠"
          title={modesTitle}
          value={modeValue}
          onPress={() => setSheet('modes')}
        />

        <GlassSettingsRow
          icon="🔀"
          title={mixTitle}
          switchValue={mix_modes}
          onSwitchChange={(v) => updateSetting('mix_modes', v)}
        />

        <GlassSettingsRow
          icon="⚡"
          title={flowTitle}
          value={flowOptions.find((o) => o.id === training_flow)?.title}
          onPress={() => setSheet('flow')}
        />

        <GlassSettingsRow
          icon="🧱"
          title={layoutTitle}
          value={layoutOptions.find((o) => o.id === training_layout)?.title}
          isLast
          onPress={() => setSheet('layout')}
        />
      </GlassSettingsSection>

      <GlassBottomSheet
        visible={sheet === 'modes'}
        title={modesTitle}
        selected={training_modes}
        multi
        options={modeOptions}
        onClose={() => setSheet(null)}
        onSelect={(id) => toggleMode(id as TrainingMode)}
      />

      <GlassBottomSheet
        visible={sheet === 'flow'}
        title={flowTitle}
        selected={training_flow}
        options={flowOptions}
        onClose={() => setSheet(null)}
        onSelect={(id) => updateSetting('training_flow', id as TrainingFlow)}
      />

      <GlassBottomSheet
        visible={sheet === 'layout'}
        title={layoutTitle}
        selected={training_layout}
        options={layoutOptions}
        onClose={() => setSheet(null)}
        onSelect={(id) => updateSetting('training_layout', id as TrainingLayout)}
      />
    </>
  );
}