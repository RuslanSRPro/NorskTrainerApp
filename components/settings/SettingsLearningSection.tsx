import { useMemo, useState } from 'react';

import { AppLanguage } from '@/services/i18n';
import { CategoryFilter, DailyLimit, StudySet } from '@/services/settings';
import { useSettingsStore } from '@/store/settingsStore';

import { GlassBottomSheet } from './GlassBottomSheet';
import { GlassSettingsRow } from './GlassSettingsRow';
import { GlassSettingsSection } from './GlassSettingsSection';

type SheetType = 'studySet' | 'category' | 'dailyLimit' | null;

type Props = {
  lang: AppLanguage;
};

export function SettingsLearningSection({ lang }: Props) {
  const {
    study_set,
    category_filters,
    daily_limit,
    updateSetting,
  } = useSettingsStore();

  const [sheet, setSheet] = useState<SheetType>(null);

  const title = lang === 'ua' ? 'Навчання' : lang === 'no' ? 'Læring' : 'Learning';

  const studyTitle = lang === 'ua' ? 'Набір слів' : lang === 'no' ? 'Studiesett' : 'Study set';
  const categoryTitle = lang === 'ua' ? 'Категорії' : lang === 'no' ? 'Kategorier' : 'Categories';
  const dailyTitle = lang === 'ua' ? 'Денна ціль' : lang === 'no' ? 'Dagsmål' : 'Daily goal';

  const studyOptions = useMemo(
    () => [
      { id: 'all', title: lang === 'ua' ? 'Усі слова' : lang === 'no' ? 'Alle ord' : 'All words' },
      { id: 'new', title: lang === 'ua' ? 'Нові' : lang === 'no' ? 'Nye' : 'New' },
      { id: 'weak', title: lang === 'ua' ? 'Слабкі' : lang === 'no' ? 'Svake' : 'Weak' },
      { id: 'due', title: 'Due' },
    ],
    [lang],
  );

  const categoryOptions = useMemo(
    () => [
      { id: 'all', title: lang === 'ua' ? 'Усі' : lang === 'no' ? 'Alle' : 'All' },
      { id: 'verbs', title: lang === 'ua' ? 'Дієслова' : lang === 'no' ? 'Verb' : 'Verbs' },
      { id: 'nouns', title: lang === 'ua' ? 'Іменники' : lang === 'no' ? 'Substantiv' : 'Nouns' },
      { id: 'adjectives', title: lang === 'ua' ? 'Прикметники' : lang === 'no' ? 'Adjektiv' : 'Adjectives' },
      { id: 'adverbs', title: lang === 'ua' ? 'Прислівники' : lang === 'no' ? 'Adverb' : 'Adverbs' },
      { id: 'expressions', title: lang === 'ua' ? 'Вирази' : lang === 'no' ? 'Uttrykk' : 'Expressions' },
    ],
    [lang],
  );

  const dailyOptions = useMemo(
    () => [
      { id: '20', title: '20' },
      { id: '50', title: '50' },
      { id: '100', title: '100' },
      { id: '200', title: '200' },
    ],
    [],
  );

  function toggleCategory(id: string) {
    const value = id as CategoryFilter;

    if (value === 'all') {
      updateSetting('category_filters', ['all']);
      updateSetting('category_filter', 'all');
      return;
    }

    const current = category_filters.filter((item) => item !== 'all');

    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];

    const finalNext = next.length ? next : ['all'];

    updateSetting('category_filters', finalNext);
    updateSetting('category_filter', finalNext[0]);
  }

  function categoryLabel() {
    if (!category_filters || category_filters.includes('all')) {
      return lang === 'ua' ? 'Усі' : lang === 'no' ? 'Alle' : 'All';
    }

    if (category_filters.length === 1) {
      return categoryOptions.find((o) => o.id === category_filters[0])?.title || '';
    }

    return String(category_filters.length);
  }

  const label = (options: { id: string; title: string }[], value: string) =>
    options.find((o) => o.id === value)?.title || value;

  return (
    <>
      <GlassSettingsSection title={title}>
        <GlassSettingsRow
          icon="📚"
          title={studyTitle}
          value={label(studyOptions, study_set)}
          onPress={() => setSheet('studySet')}
        />

        <GlassSettingsRow
          icon="🧩"
          title={categoryTitle}
          value={categoryLabel()}
          onPress={() => setSheet('category')}
        />

        <GlassSettingsRow
          icon="🎯"
          title={dailyTitle}
          value={String(daily_limit)}
          isLast
          onPress={() => setSheet('dailyLimit')}
        />
      </GlassSettingsSection>

      <GlassBottomSheet
        visible={sheet === 'studySet'}
        title={studyTitle}
        selected={study_set}
        options={studyOptions}
        onClose={() => setSheet(null)}
        onSelect={(id) => updateSetting('study_set', id as StudySet)}
      />

      <GlassBottomSheet
        visible={sheet === 'category'}
        title={categoryTitle}
        selected={category_filters}
        multi
        options={categoryOptions}
        onClose={() => setSheet(null)}
        onSelect={toggleCategory}
      />

      <GlassBottomSheet
        visible={sheet === 'dailyLimit'}
        title={dailyTitle}
        selected={String(daily_limit)}
        options={dailyOptions}
        onClose={() => setSheet(null)}
        onSelect={(id) => updateSetting('daily_limit', Number(id) as DailyLimit)}
      />
    </>
  );
}