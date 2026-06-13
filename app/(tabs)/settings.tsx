import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
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
import { t, AppLanguage } from '@/services/i18n';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  AppColors,
  FONT_SIZE_LABELS,
  FontSizeName,
  THEME_LABELS,
  ThemeName,
  useAppTheme,
} from '@/services/theme';

function SectionTitle({ title }: { title: string }) {
  const { colors, scale } = useAppTheme();

  return (
    <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontSize: scale(18) }]}>
      {title}
    </Text>
  );
}

function OptionButton({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  const { colors, scale } = useAppTheme();

  return (
    <Pressable
      style={[
        styles.optionButton,
        { backgroundColor: active ? colors.accent : colors.cardAlt },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.optionText,
          { fontSize: scale(15), color: active ? '#FFFFFF' : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const {
    loading, saving, app_language, translation_mode, category_filter,
    study_set, daily_limit, training_modes, mix_modes, training_flow,
    training_layout, auto_pronounce, pronounce_forms, pronounce_after_answer,
    speech_rate, theme, font_size, loadSettings, updateSetting, saveSettings,
  } = useSettingsStore();

  const { user, signOut, loading: authLoading } = useAuthStore();
  const [signingOut, setSigningOut] = useState(false);
  const { colors, scale } = useAppTheme();

  // Use i18n system — supports ua, en, no
  const lang = (app_language as AppLanguage) || 'ua';
  const T = (key: Parameters<typeof t>[0]) => t(key, lang);

  useEffect(() => { loadSettings(); }, []);

  function toggleMode(mode: TrainingMode) {
    const exists = training_modes.includes(mode);
    let next = exists ? training_modes.filter((m) => m !== mode) : [...training_modes, mode];
    if (!next.length) next = ['flashcards'];
    updateSetting('training_modes', next);
  }

  async function handleSave() {
    try { await saveSettings(); } catch (error) { console.log('Save settings error:', error); }
  }

  async function handleSignOut() {
    try { setSigningOut(true); await signOut(); } finally { setSigningOut(false); }
  }

  const dynamic = useMemo(() => createDynamicStyles(colors, scale), [colors, scale]);

  const appearanceTitle =
    lang === 'ua' ? 'Вигляд' : lang === 'no' ? 'Utseende' : 'Appearance';
  const themeLabel =
    lang === 'ua' ? 'Тема' : lang === 'no' ? 'Tema' : 'Theme';
  const fontSizeLabel =
    lang === 'ua' ? 'Розмір шрифту' : lang === 'no' ? 'Tekststørrelse' : 'Font size';

  const themeOptions: ThemeName[] = ['light', 'dark', 'reading', 'turquoise'];
  const fontSizeOptions: FontSizeName[] = ['small', 'medium', 'large'];

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader icon="⚙️" title={T('settings')} />

        {/* ── ACCOUNT ── */}
        <View style={dynamic.card}>
          <SectionTitle title={lang === 'ua' ? 'Акаунт' : lang === 'no' ? 'Konto' : 'Account'} />
          {user ? (
            <View style={dynamic.accountBox}>
              <View style={dynamic.accountAvatar}>
                <Text style={[styles.accountAvatarText, { fontSize: scale(20) }]}>
                  {(user.email?.[0] || 'U').toUpperCase()}
                </Text>
              </View>
              <View style={styles.accountInfo}>
                <Text style={[styles.accountEmail, { fontSize: scale(15), color: colors.textPrimary }]}>
                  {user.email}
                </Text>
                <Text style={[styles.accountId, { fontSize: scale(11), color: colors.textTertiary }]}>
                  ID: {user.id.slice(0, 8)}...
                </Text>
              </View>
            </View>
          ) : null}
          <Pressable
            style={[dynamic.signOutButton, signingOut && styles.disabledButton]}
            disabled={signingOut}
            onPress={handleSignOut}
          >
            <Text style={[styles.signOutButtonText, { fontSize: scale(14), color: colors.danger }]}>
              {signingOut
                ? (lang === 'ua' ? 'Вихід...' : lang === 'no' ? 'Logger ut...' : 'Signing out...')
                : (lang === 'ua' ? '🚪 Вийти з акаунту' : lang === 'no' ? '🚪 Logg ut' : '🚪 Sign out')}
            </Text>
          </Pressable>
        </View>

        {/* ── APPEARANCE ── */}
        <View style={dynamic.card}>
          <SectionTitle title={appearanceTitle} />

          <Text style={[styles.label, { fontSize: scale(13), color: colors.textSecondary }]}>
            {themeLabel}
          </Text>
          <View style={styles.actionsRow}>
            {themeOptions.map((option) => (
              <OptionButton
                key={option}
                label={THEME_LABELS[option][lang]}
                active={theme === option}
                onPress={() => updateSetting('theme', option)}
              />
            ))}
          </View>

          <Text style={[styles.label, { fontSize: scale(13), color: colors.textSecondary }]}>
            {fontSizeLabel}
          </Text>
          <View style={styles.actionsRow}>
            {fontSizeOptions.map((option) => (
              <OptionButton
                key={option}
                label={FONT_SIZE_LABELS[option][lang]}
                active={font_size === option}
                onPress={() => updateSetting('font_size', option)}
              />
            ))}
          </View>
        </View>

        {/* ── LANGUAGE ── */}
        <View style={dynamic.card}>
          <SectionTitle title={T('interface_language')} />

          <Text style={[styles.label, { fontSize: scale(13), color: colors.textSecondary }]}>
            {T('app_language')}
          </Text>
          <View style={styles.actionsRow}>
            <OptionButton label="🇺🇦 UA"  active={app_language === 'ua'} onPress={() => updateSetting('app_language', 'ua' as any)} />
            <OptionButton label="🇬🇧 EN"  active={app_language === 'en'} onPress={() => updateSetting('app_language', 'en' as any)} />
            <OptionButton label="🇳🇴 NO"  active={app_language === 'no'} onPress={() => updateSetting('app_language', 'no' as any)} />
          </View>

          <Text style={[styles.label, { fontSize: scale(13), color: colors.textSecondary }]}>
            {lang === 'ua' ? 'Мова перекладу' : lang === 'no' ? 'Oversettingsspråk' : 'Translation mode'}
          </Text>
          <View style={styles.actionsRow}>
            <OptionButton label="UA"      active={translation_mode === 'ua'}    onPress={() => updateSetting('translation_mode', 'ua')} />
            <OptionButton label="EN"      active={translation_mode === 'en'}    onPress={() => updateSetting('translation_mode', 'en')} />
            <OptionButton label="UA + EN" active={translation_mode === 'ua_en'} onPress={() => updateSetting('translation_mode', 'ua_en')} />
          </View>
        </View>

        {/* ── STUDY CONTENT ── */}
        <View style={dynamic.card}>
          <SectionTitle title={lang === 'ua' ? 'Навчальний матеріал' : lang === 'no' ? 'Studieinnhold' : 'Study content'} />

          <Text style={[styles.label, { fontSize: scale(13), color: colors.textSecondary }]}>
            {lang === 'ua' ? 'Категорія' : lang === 'no' ? 'Kategori' : 'Category'}
          </Text>
          <View style={styles.actionsRow}>
            <OptionButton label={lang === 'ua' ? 'Усі'         : lang === 'no' ? 'Alle'        : 'All'}         active={category_filter === 'all'}         onPress={() => updateSetting('category_filter', 'all')} />
            <OptionButton label={lang === 'ua' ? 'Дієслова'    : lang === 'no' ? 'Verb'        : 'Verbs'}       active={category_filter === 'verbs'}       onPress={() => updateSetting('category_filter', 'verbs')} />
            <OptionButton label={lang === 'ua' ? 'Іменники'    : lang === 'no' ? 'Substantiv'  : 'Nouns'}       active={category_filter === 'nouns'}       onPress={() => updateSetting('category_filter', 'nouns')} />
            <OptionButton label={lang === 'ua' ? 'Прикметники' : lang === 'no' ? 'Adjektiv'    : 'Adjectives'}  active={category_filter === 'adjectives'}  onPress={() => updateSetting('category_filter', 'adjectives')} />
            <OptionButton label={lang === 'ua' ? 'Прислівники' : lang === 'no' ? 'Adverb'      : 'Adverbs'}     active={category_filter === 'adverbs'}     onPress={() => updateSetting('category_filter', 'adverbs')} />
            <OptionButton label={lang === 'ua' ? 'Вирази'      : lang === 'no' ? 'Uttrykk'     : 'Expressions'} active={category_filter === 'expressions'} onPress={() => updateSetting('category_filter', 'expressions')} />
          </View>

          <Text style={[styles.label, { fontSize: scale(13), color: colors.textSecondary }]}>
            {lang === 'ua' ? 'Набір' : lang === 'no' ? 'Studiesett' : 'Study set'}
          </Text>
          <View style={styles.actionsRow}>
            <OptionButton label={lang === 'ua' ? 'Усі'   : lang === 'no' ? 'Alle' : 'All'}  active={study_set === 'all'}  onPress={() => updateSetting('study_set', 'all')} />
            <OptionButton label={lang === 'ua' ? 'Нові'  : lang === 'no' ? 'Nye'  : 'New'}  active={study_set === 'new'}  onPress={() => updateSetting('study_set', 'new')} />
            <OptionButton label={lang === 'ua' ? 'Слабкі': lang === 'no' ? 'Svake': 'Weak'} active={study_set === 'weak'} onPress={() => updateSetting('study_set', 'weak')} />
            <OptionButton label="Due"                                                         active={study_set === 'due'}  onPress={() => updateSetting('study_set', 'due')} />
          </View>

          <Text style={[styles.label, { fontSize: scale(13), color: colors.textSecondary }]}>
            {lang === 'ua' ? 'Денний ліміт' : lang === 'no' ? 'Dagsgrense' : 'Daily limit'}
          </Text>
          <View style={styles.actionsRow}>
            {[20, 50, 100, 200].map((limit) => (
              <OptionButton key={limit} label={String(limit)} active={daily_limit === limit} onPress={() => updateSetting('daily_limit', limit as DailyLimit)} />
            ))}
          </View>
        </View>

        {/* ── TRAINING MODES ── */}
        <View style={dynamic.card}>
          <SectionTitle title={lang === 'ua' ? 'Режими тренування' : lang === 'no' ? 'Treningsmoduser' : 'Training modes'} />
          <View style={styles.actionsRow}>
            <OptionButton label={lang === 'ua' ? 'Картки'   : lang === 'no' ? 'Kort'    : 'Cards'}  active={training_modes.includes('flashcards')} onPress={() => toggleMode('flashcards')} />
            <OptionButton label={lang === 'ua' ? 'Вибір'    : lang === 'no' ? 'Valg'    : 'Choice'} active={training_modes.includes('choice')}     onPress={() => toggleMode('choice')} />
            <OptionButton label={lang === 'ua' ? 'Введення' : lang === 'no' ? 'Skriving': 'Typing'} active={training_modes.includes('typing')}     onPress={() => toggleMode('typing')} />
            <OptionButton label="Cloze"                                                               active={training_modes.includes('cloze')}      onPress={() => toggleMode('cloze')} />
            <OptionButton label={lang === 'ua' ? 'Форми'    : lang === 'no' ? 'Former'  : 'Forms'}  active={training_modes.includes('forms')}      onPress={() => toggleMode('forms')} />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchTextBlock}>
              <Text style={[styles.switchLabel, { fontSize: scale(15), color: colors.textPrimary }]}>
                {lang === 'ua' ? 'Змішувати вибрані режими' : lang === 'no' ? 'Bland valgte moduser' : 'Mix selected modes'}
              </Text>
            </View>
            <Switch value={mix_modes} onValueChange={(v) => updateSetting('mix_modes', v)} />
          </View>

          <Text style={[styles.label, { fontSize: scale(13), color: colors.textSecondary }]}>
            {lang === 'ua' ? 'Стиль тренування' : lang === 'no' ? 'Treningsstil' : 'Training flow'}
          </Text>
          <View style={styles.actionsRow}>
            <OptionButton label="Reinforcement" active={training_flow === 'reinforcement'} onPress={() => updateSetting('training_flow', 'reinforcement' as TrainingFlow)} />
            <OptionButton label={lang === 'ua' ? '1 завдання на слово' : lang === 'no' ? '1 oppgave per ord' : 'One task per word'} active={training_flow === 'one_per_word'} onPress={() => updateSetting('training_flow', 'one_per_word' as TrainingFlow)} />
          </View>

          <Text style={[styles.infoText, { fontSize: scale(12), color: colors.textSecondary }]}>
            {lang === 'ua' ? 'Reinforcement = кілька типів вправ для одного слова.' : lang === 'no' ? 'Reinforcement = flere øvelsestyper per ord.' : 'Reinforcement = multiple exercise types for one word.'}
          </Text>

          <Text style={[styles.label, { fontSize: scale(13), color: colors.textSecondary }]}>
            {lang === 'ua' ? 'Подача завдання' : lang === 'no' ? 'Oppgavevisning' : 'Training layout'}
          </Text>
          <View style={styles.actionsRow}>
            <OptionButton label={lang === 'ua' ? 'Стандартна' : lang === 'no' ? 'Standard' : 'Standard'} active={training_layout === 'standard'} onPress={() => updateSetting('training_layout', 'standard' as TrainingLayout)} />
            <OptionButton label={lang === 'ua' ? 'Спочатку речення' : lang === 'no' ? 'Setning først' : 'Sentence-first'} active={training_layout === 'sentence_first'} onPress={() => updateSetting('training_layout', 'sentence_first' as TrainingLayout)} />
          </View>
        </View>

        {/* ── PRONUNCIATION ── */}
        <View style={dynamic.card}>
          <SectionTitle title={lang === 'ua' ? 'Озвучка' : lang === 'no' ? 'Uttale' : 'Pronunciation'} />

          <View style={styles.switchRow}>
            <View style={styles.switchTextBlock}>
              <Text style={[styles.switchLabel, { fontSize: scale(15), color: colors.textPrimary }]}>
                {lang === 'ua' ? 'Автоозвучка' : lang === 'no' ? 'Automatisk uttale' : 'Auto pronounce'}
              </Text>
              <Text style={[styles.switchHint, { fontSize: scale(12), color: colors.textSecondary }]}>
                {lang === 'ua' ? 'Автоматично озвучувати слово, коли відкривається завдання.' : lang === 'no' ? 'Si ordet automatisk når en oppgave åpnes.' : 'Speak the word automatically when a task opens.'}
              </Text>
            </View>
            <Switch value={auto_pronounce} onValueChange={(v) => updateSetting('auto_pronounce', v)} />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchTextBlock}>
              <Text style={[styles.switchLabel, { fontSize: scale(15), color: colors.textPrimary }]}>
                {lang === 'ua' ? 'Озвучувати всі форми' : lang === 'no' ? 'Si alle former' : 'Pronounce all forms'}
              </Text>
              <Text style={[styles.switchHint, { fontSize: scale(12), color: colors.textSecondary }]}>
                {lang === 'ua' ? 'Озвучувати всю парадигму замість лише основного слова.' : lang === 'no' ? 'Si hele paradigmet i stedet for bare hovedordet.' : 'Speak the whole paradigm instead of only the main word.'}
              </Text>
            </View>
            <Switch value={pronounce_forms} onValueChange={(v) => updateSetting('pronounce_forms', v)} />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchTextBlock}>
              <Text style={[styles.switchLabel, { fontSize: scale(15), color: colors.textPrimary }]}>
                {lang === 'ua' ? 'Озвучувати після відповіді' : lang === 'no' ? 'Si etter svar' : 'Pronounce after answer'}
              </Text>
              <Text style={[styles.switchHint, { fontSize: scale(12), color: colors.textSecondary }]}>
                {lang === 'ua' ? 'Озвучувати правильну відповідь після перевірки.' : lang === 'no' ? 'Si riktig svar etter sjekk.' : 'Speak the correct answer after checking.'}
              </Text>
            </View>
            <Switch value={pronounce_after_answer} onValueChange={(v) => updateSetting('pronounce_after_answer', v)} />
          </View>

          <Text style={[styles.label, { fontSize: scale(13), color: colors.textSecondary }]}>
            {lang === 'ua' ? 'Швидкість озвучки' : lang === 'no' ? 'Talehastighet' : 'Speech speed'}
          </Text>
          <View style={styles.actionsRow}>
            <OptionButton label={lang === 'ua' ? 'Повільно'  : lang === 'no' ? 'Sakte'  : 'Slow'}   active={speech_rate === 0.7}  onPress={() => updateSetting('speech_rate', 0.7)} />
            <OptionButton label={lang === 'ua' ? 'Нормально' : lang === 'no' ? 'Normal' : 'Normal'} active={speech_rate === 0.85} onPress={() => updateSetting('speech_rate', 0.85)} />
            <OptionButton label={lang === 'ua' ? 'Швидко'    : lang === 'no' ? 'Raskt'  : 'Fast'}   active={speech_rate === 1}    onPress={() => updateSetting('speech_rate', 1)} />
          </View>
        </View>

        <Pressable style={[dynamic.saveButton, saving && styles.disabledButton]} disabled={saving} onPress={handleSave}>
          <Text style={[styles.saveButtonText, { fontSize: scale(16) }]}>
            {saving
              ? (lang === 'ua' ? 'Збереження...' : lang === 'no' ? 'Lagrer...' : 'Saving...')
              : (lang === 'ua' ? 'Зберегти налаштування' : lang === 'no' ? 'Lagre innstillinger' : 'Save settings')}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Colors and theme-dependent values that StyleSheet.create can't hold
 * (it's evaluated once at module load, before useAppTheme() has data).
 */
function createDynamicStyles(colors: AppColors, _scale: (n: number) => number) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 18,
      marginBottom: 18,
    },
    accountBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accentSoft,
      borderRadius: 18,
      padding: 14,
      marginBottom: 14,
    },
    accountAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    signOutButton: {
      backgroundColor: colors.dangerSoft,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    saveButton: {
      backgroundColor: colors.accent,
      borderRadius: 18,
      paddingVertical: 18,
      marginTop: 10,
    },
  });
}

const styles = StyleSheet.create({
  safeArea:            { flex: 1 },
  loadingContainer:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container:           { padding: 20, paddingBottom: 120 },
  sectionTitle:        { fontWeight: '900', marginBottom: 16 },
  accountAvatarText:   { color: '#FFFFFF', fontWeight: '900' },
  accountInfo:         { flex: 1 },
  accountEmail:        { fontWeight: '800' },
  accountId:           { marginTop: 2, fontWeight: '600' },
  signOutButtonText:   { fontWeight: '900' },
  label:               { fontWeight: '800', marginBottom: 8, marginTop: 12 },
  actionsRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  infoText:            { marginTop: 12, lineHeight: 18, fontWeight: '600' },
  optionButton:        { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  optionText:          { fontWeight: '800' },
  switchRow:           { width: '100%', marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  switchTextBlock:     { flex: 1, paddingRight: 12 },
  switchLabel:         { fontWeight: '800' },
  switchHint:          { marginTop: 4, lineHeight: 18, fontWeight: '600' },
  saveButtonText:      { color: '#FFFFFF', textAlign: 'center', fontWeight: '900' },
  disabledButton:      { opacity: 0.55 },
});