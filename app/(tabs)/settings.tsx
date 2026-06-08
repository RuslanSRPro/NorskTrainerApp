import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DailyLimit,
  TrainingFlow,
  TrainingLayout,
  TrainingMode,
} from '@/services/settings';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function OptionButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.optionButton, active && styles.optionButtonActive]}
      onPress={onPress}
    >
      <Text style={[styles.optionText, active && styles.optionTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const {
    loading,
    saving,
    app_language,
    translation_mode,
    category_filter,
    study_set,
    daily_limit,
    training_modes,
    mix_modes,
    training_flow,
    training_layout,
    auto_pronounce,
    pronounce_forms,
    pronounce_after_answer,
    speech_rate,
    loadSettings,
    updateSetting,
    saveSettings,
  } = useSettingsStore();

  const { user, signOut, loading: authLoading } = useAuthStore();
  const [signingOut, setSigningOut] = useState(false);

  const isUa = app_language === 'ua';

  useEffect(() => {
    loadSettings();
  }, []);

  function toggleMode(mode: TrainingMode) {
    const exists = training_modes.includes(mode);
    let next = exists
      ? training_modes.filter((m) => m !== mode)
      : [...training_modes, mode];
    if (!next.length) next = ['flashcards'];
    updateSetting('training_modes', next);
  }

  async function handleSave() {
    try {
      await saveSettings();
    } catch (error) {
      console.log('Save settings error:', error);
    }
  }

  async function handleSignOut() {
    try {
      setSigningOut(true);
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>
          {isUa ? '⚙️ Налаштування' : '⚙️ Settings'}
        </Text>

        {/* ── ACCOUNT ── */}
        <View style={styles.card}>
          <SectionTitle title={isUa ? 'Акаунт' : 'Account'} />

          {user ? (
            <View style={styles.accountBox}>
              <View style={styles.accountAvatar}>
                <Text style={styles.accountAvatarText}>
                  {(user.email?.[0] || 'U').toUpperCase()}
                </Text>
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountEmail}>{user.email}</Text>
                <Text style={styles.accountId}>
                  ID: {user.id.slice(0, 8)}...
                </Text>
              </View>
            </View>
          ) : null}

          <Pressable
            style={[styles.signOutButton, signingOut && styles.disabledButton]}
            disabled={signingOut}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutButtonText}>
              {signingOut
                ? isUa ? 'Вихід...' : 'Signing out...'
                : isUa ? '🚪 Вийти з акаунту' : '🚪 Sign out'}
            </Text>
          </Pressable>
        </View>

        {/* ── LANGUAGE ── */}
        <View style={styles.card}>
          <SectionTitle title={isUa ? 'Мова' : 'Language'} />

          <Text style={styles.label}>
            {isUa ? 'Мова застосунку' : 'App language'}
          </Text>
          <View style={styles.actionsRow}>
            <OptionButton label="UA" active={app_language === 'ua'} onPress={() => updateSetting('app_language', 'ua')} />
            <OptionButton label="EN" active={app_language === 'en'} onPress={() => updateSetting('app_language', 'en')} />
          </View>

          <Text style={styles.label}>
            {isUa ? 'Мова перекладу' : 'Translation mode'}
          </Text>
          <View style={styles.actionsRow}>
            <OptionButton label="UA"      active={translation_mode === 'ua'}    onPress={() => updateSetting('translation_mode', 'ua')} />
            <OptionButton label="EN"      active={translation_mode === 'en'}    onPress={() => updateSetting('translation_mode', 'en')} />
            <OptionButton label="UA + EN" active={translation_mode === 'ua_en'} onPress={() => updateSetting('translation_mode', 'ua_en')} />
          </View>
        </View>

        {/* ── STUDY CONTENT ── */}
        <View style={styles.card}>
          <SectionTitle title={isUa ? 'Навчальний матеріал' : 'Study content'} />

          <Text style={styles.label}>{isUa ? 'Категорія' : 'Category'}</Text>
          <View style={styles.actionsRow}>
            <OptionButton label={isUa ? 'Усі'         : 'All'}         active={category_filter === 'all'}         onPress={() => updateSetting('category_filter', 'all')} />
            <OptionButton label={isUa ? 'Дієслова'    : 'Verbs'}       active={category_filter === 'verbs'}       onPress={() => updateSetting('category_filter', 'verbs')} />
            <OptionButton label={isUa ? 'Іменники'    : 'Nouns'}       active={category_filter === 'nouns'}       onPress={() => updateSetting('category_filter', 'nouns')} />
            <OptionButton label={isUa ? 'Прикметники' : 'Adjectives'}  active={category_filter === 'adjectives'}  onPress={() => updateSetting('category_filter', 'adjectives')} />
            <OptionButton label={isUa ? 'Прислівники' : 'Adverbs'}     active={category_filter === 'adverbs'}     onPress={() => updateSetting('category_filter', 'adverbs')} />
            <OptionButton label={isUa ? 'Вирази'      : 'Expressions'} active={category_filter === 'expressions'} onPress={() => updateSetting('category_filter', 'expressions')} />
          </View>

          <Text style={styles.label}>{isUa ? 'Набір' : 'Study set'}</Text>
          <View style={styles.actionsRow}>
            <OptionButton label={isUa ? 'Усі'   : 'All'}  active={study_set === 'all'}  onPress={() => updateSetting('study_set', 'all')} />
            <OptionButton label={isUa ? 'Нові'  : 'New'}  active={study_set === 'new'}  onPress={() => updateSetting('study_set', 'new')} />
            <OptionButton label={isUa ? 'Слабкі': 'Weak'} active={study_set === 'weak'} onPress={() => updateSetting('study_set', 'weak')} />
            <OptionButton label="Due"                      active={study_set === 'due'}  onPress={() => updateSetting('study_set', 'due')} />
          </View>

          <Text style={styles.label}>{isUa ? 'Денний ліміт' : 'Daily limit'}</Text>
          <View style={styles.actionsRow}>
            {[20, 50, 100, 200].map((limit) => (
              <OptionButton
                key={limit}
                label={String(limit)}
                active={daily_limit === limit}
                onPress={() => updateSetting('daily_limit', limit as DailyLimit)}
              />
            ))}
          </View>
        </View>

        {/* ── TRAINING MODES ── */}
        <View style={styles.card}>
          <SectionTitle title={isUa ? 'Режими тренування' : 'Training modes'} />

          <View style={styles.actionsRow}>
            <OptionButton label={isUa ? 'Картки'   : 'Cards'}  active={training_modes.includes('flashcards')} onPress={() => toggleMode('flashcards')} />
            <OptionButton label={isUa ? 'Вибір'    : 'Choice'} active={training_modes.includes('choice')}     onPress={() => toggleMode('choice')} />
            <OptionButton label={isUa ? 'Введення' : 'Typing'} active={training_modes.includes('typing')}     onPress={() => toggleMode('typing')} />
            <OptionButton label="Cloze"                         active={training_modes.includes('cloze')}      onPress={() => toggleMode('cloze')} />
            <OptionButton label={isUa ? 'Форми'    : 'Forms'}  active={training_modes.includes('forms')}      onPress={() => toggleMode('forms')} />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchTextBlock}>
              <Text style={styles.switchLabel}>
                {isUa ? 'Змішувати вибрані режими' : 'Mix selected modes'}
              </Text>
            </View>
            <Switch value={mix_modes} onValueChange={(v) => updateSetting('mix_modes', v)} />
          </View>

          <Text style={styles.label}>{isUa ? 'Стиль тренування' : 'Training flow'}</Text>
          <View style={styles.actionsRow}>
            <OptionButton label="Reinforcement"                          active={training_flow === 'reinforcement'} onPress={() => updateSetting('training_flow', 'reinforcement' as TrainingFlow)} />
            <OptionButton label={isUa ? '1 завдання на слово' : 'One task per word'} active={training_flow === 'one_per_word'}   onPress={() => updateSetting('training_flow', 'one_per_word' as TrainingFlow)} />
          </View>

          <Text style={styles.infoText}>
            {isUa
              ? 'Reinforcement = кілька типів вправ для одного слова.'
              : 'Reinforcement = multiple exercise types for one word.'}
          </Text>

          <Text style={styles.label}>{isUa ? 'Подача завдання' : 'Training layout'}</Text>
          <View style={styles.actionsRow}>
            <OptionButton label={isUa ? 'Стандартна'         : 'Standard'}       active={training_layout === 'standard'}       onPress={() => updateSetting('training_layout', 'standard'       as TrainingLayout)} />
            <OptionButton label={isUa ? 'Спочатку речення'   : 'Sentence-first'} active={training_layout === 'sentence_first'} onPress={() => updateSetting('training_layout', 'sentence_first' as TrainingLayout)} />
          </View>
        </View>

        {/* ── PRONUNCIATION ── */}
        <View style={styles.card}>
          <SectionTitle title={isUa ? 'Озвучка' : 'Pronunciation'} />

          <View style={styles.switchRow}>
            <View style={styles.switchTextBlock}>
              <Text style={styles.switchLabel}>{isUa ? 'Автоозвучка' : 'Auto pronounce'}</Text>
              <Text style={styles.switchHint}>
                {isUa
                  ? 'Автоматично озвучувати слово, коли відкривається завдання.'
                  : 'Speak the word automatically when a task opens.'}
              </Text>
            </View>
            <Switch value={auto_pronounce} onValueChange={(v) => updateSetting('auto_pronounce', v)} />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchTextBlock}>
              <Text style={styles.switchLabel}>{isUa ? 'Озвучувати всі форми' : 'Pronounce all forms'}</Text>
              <Text style={styles.switchHint}>
                {isUa
                  ? 'Озвучувати всю парадигму замість лише основного слова.'
                  : 'Speak the whole paradigm instead of only the main word.'}
              </Text>
            </View>
            <Switch value={pronounce_forms} onValueChange={(v) => updateSetting('pronounce_forms', v)} />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchTextBlock}>
              <Text style={styles.switchLabel}>{isUa ? 'Озвучувати після відповіді' : 'Pronounce after answer'}</Text>
              <Text style={styles.switchHint}>
                {isUa
                  ? 'Озвучувати правильну відповідь після перевірки.'
                  : 'Speak the correct answer after checking.'}
              </Text>
            </View>
            <Switch value={pronounce_after_answer} onValueChange={(v) => updateSetting('pronounce_after_answer', v)} />
          </View>

          <Text style={styles.label}>{isUa ? 'Швидкість озвучки' : 'Speech speed'}</Text>
          <View style={styles.actionsRow}>
            <OptionButton label={isUa ? 'Повільно' : 'Slow'}   active={speech_rate === 0.7}  onPress={() => updateSetting('speech_rate', 0.7)} />
            <OptionButton label={isUa ? 'Нормально': 'Normal'} active={speech_rate === 0.85} onPress={() => updateSetting('speech_rate', 0.85)} />
            <OptionButton label={isUa ? 'Швидко'   : 'Fast'}   active={speech_rate === 1}    onPress={() => updateSetting('speech_rate', 1)} />
          </View>
        </View>

        <Pressable
          style={[styles.saveButton, saving && styles.disabledButton]}
          disabled={saving}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>
            {saving
              ? isUa ? 'Збереження...' : 'Saving...'
              : isUa ? 'Зберегти налаштування' : 'Save settings'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:            { flex: 1, backgroundColor: '#F7F4ED' },
  loadingContainer:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F4ED' },
  container:           { padding: 20, paddingBottom: 120 },
  title:               { fontSize: 31, lineHeight: 38, fontWeight: '900', color: '#111827', marginBottom: 20 },
  card:                { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, marginBottom: 18 },
  sectionTitle:        { fontSize: 22, fontWeight: '900', color: '#111827', marginBottom: 16 },

  // Account
  accountBox:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDFA', borderRadius: 18, padding: 14, marginBottom: 14 },
  accountAvatar:       { width: 48, height: 48, borderRadius: 24, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  accountAvatarText:   { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  accountInfo:         { flex: 1 },
  accountEmail:        { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  accountId:           { marginTop: 2, fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  signOutButton:       { backgroundColor: '#FEE2E2', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  signOutButtonText:   { color: '#B91C1C', fontSize: 15, fontWeight: '900' },

  label:               { fontSize: 14, fontWeight: '800', color: '#6B7280', marginBottom: 8, marginTop: 12 },
  input:               { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, fontSize: 16, fontWeight: '700' },
  actionsRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  primaryButton:       { backgroundColor: '#0EA5E9', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14 },
  primaryButtonText:   { color: '#FFFFFF', fontWeight: '900' },
  secondaryButton:     { backgroundColor: '#E0F2FE', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14 },
  secondaryButtonText: { color: '#0284C7', fontWeight: '900' },
  grayButton:          { backgroundColor: '#E5E7EB', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14 },
  grayButtonText:      { color: '#111827', fontWeight: '900' },
  infoText:            { marginTop: 12, fontSize: 13, lineHeight: 18, fontWeight: '600', color: '#6B7280' },
  optionButton:        { backgroundColor: '#F3F4F6', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  optionButtonActive:  { backgroundColor: '#0EA5E9' },
  optionText:          { fontSize: 15, fontWeight: '800', color: '#374151' },
  optionTextActive:    { color: '#FFFFFF' },
  switchRow:           { width: '100%', marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  switchTextBlock:     { flex: 1, paddingRight: 12 },
  switchLabel:         { fontSize: 16, fontWeight: '800', color: '#111827' },
  switchHint:          { marginTop: 4, fontSize: 13, lineHeight: 18, fontWeight: '600', color: '#6B7280' },
  saveButton:          { backgroundColor: '#0EA5E9', borderRadius: 18, paddingVertical: 18, marginTop: 10 },
  saveButtonText:      { color: '#FFFFFF', textAlign: 'center', fontSize: 17, fontWeight: '900' },
  disabledButton:      { opacity: 0.55 },
});