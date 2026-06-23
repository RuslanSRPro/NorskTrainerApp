// app/(tabs)/index.tsx
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getDashboardStatsFromSupabase } from '@/services/api';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/contexts/ThemeContext';

type DashboardStats = {
  totalWords: number; learnedWords: number; weakWords: number;
  dueToday: number; reviewsToday: number; accuracyToday: number;
};

export default function HomeScreen() {
  const router = useRouter();
  const { theme, fonts } = useTheme();
  const { preferred_user, app_language } = useSettingsStore();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalWords: 0, learnedWords: 0, weakWords: 0,
    dueToday: 0, reviewsToday: 0, accuracyToday: 0,
  });

  const isUa = app_language === 'ua';

  const learnedPercent = useMemo(() => {
    if (!stats.totalWords) return 0;
    return Math.round((stats.learnedWords / stats.totalWords) * 100);
  }, [stats.learnedWords, stats.totalWords]);

  const weakPercent = useMemo(() => {
    if (!stats.learnedWords) return 0;
    return Math.round((stats.weakWords / stats.learnedWords) * 100);
  }, [stats.weakWords, stats.learnedWords]);

  const dailyStatus = useMemo(() => {
    if (stats.reviewsToday === 0) return isUa ? 'Сьогодні ще немає повторів' : 'No reviews yet today';
    if (stats.accuracyToday >= 85) return isUa ? 'Сильний день навчання' : 'Strong learning day';
    if (stats.accuracyToday >= 65) return isUa ? 'Нормальний темп, продовжуй' : 'Good pace, keep going';
    return isUa ? 'Сьогодні краще зробити легке повторення' : 'Better do light review today';
  }, [stats.reviewsToday, stats.accuracyToday, isUa]);

  async function loadDashboard() {
    try {
      setLoading(true);
      const data = await getDashboardStatsFromSupabase(preferred_user);
      setStats(data);
    } catch (e) { console.log('Dashboard load error:', e); }
    finally { setLoading(false); }
  }

  useFocusEffect(useCallback(() => { loadDashboard(); }, [preferred_user]));

  // ── tone helpers ──────────────────────────────────────────
  function toneColor(tone: 'blue'|'green'|'orange'|'red'|'gray') {
    if (tone === 'green')  return '#34C759';
    if (tone === 'orange') return '#FF9500';
    if (tone === 'red')    return theme.danger;
    if (tone === 'gray')   return theme.textMuted;
    return theme.accent;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: theme.textPrimary, fontSize: 22 }]}>
        🇳🇴 Norsk Trainer
      </Text>
      <Text style={[styles.subtitle, { color: theme.textTertiary, fontSize: fonts.base }]}>
        {isUa ? 'Адаптивна система вивчення норвезької' : 'Adaptive Norwegian acquisition system'}
      </Text>

      {/* ── Dashboard card */}
      <View style={[styles.dashboardCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.dashboardHeader}>
          <Text style={[styles.dashboardTitle, { color: theme.textPrimary, fontSize: fonts.translation }]}>
            {isUa ? '📊 Прогрес' : '📊 Progress'}
          </Text>
          {loading ? <ActivityIndicator size="small" color={theme.accent} /> : null}
        </View>

        {/* Mastery */}
        <View style={[styles.box, { backgroundColor: theme.cardAlt }]}>
          <View style={styles.row}>
            <Text style={[styles.boxLabel, { color: theme.textMuted, fontSize: fonts.meta }]}>
              {isUa ? 'Покриття бази' : 'Base coverage'}
            </Text>
            <Text style={[styles.bigNum, { color: theme.accent, fontSize: fonts.translation }]}>
              {learnedPercent}%
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
            <View style={[styles.progressFill, { width: `${learnedPercent}%`, backgroundColor: theme.accent }]} />
          </View>
          <Text style={[styles.hint, { color: theme.textMuted, fontSize: fonts.meta }]}>
            {stats.learnedWords} / {stats.totalWords} {isUa ? 'слів у навчанні' : 'words in learning'}
          </Text>
        </View>

        {/* Today */}
        <View style={[styles.box, { backgroundColor: theme.accentBg }]}>
          <Text style={[styles.boxLabel, { color: theme.accent, fontSize: fonts.meta }]}>
            {isUa ? 'Сьогодні' : 'Today'}
          </Text>
          <Text style={[styles.todayStatus, { color: theme.textPrimary, fontSize: fonts.base }]}>
            {dailyStatus}
          </Text>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {[
            { value: stats.totalWords,    label: isUa ? 'Всього слів' : 'Total words',  tone: 'blue'   as const },
            { value: stats.learnedWords,  label: isUa ? 'У навчанні'  : 'In learning',  tone: 'green'  as const },
            { value: stats.weakWords,     label: isUa ? 'Слабкі'      : 'Weak',         tone: stats.weakWords > 0 ? 'red' as const : 'gray' as const },
            { value: stats.dueToday,      label: isUa ? 'Due сьогодні': 'Due today',    tone: stats.dueToday > 0 ? 'orange' as const : 'gray' as const },
            { value: stats.reviewsToday,  label: isUa ? 'Повторів'    : 'Reviews',      tone: 'blue'   as const },
            { value: `${stats.accuracyToday}%`, label: isUa ? 'Точність' : 'Accuracy', tone: stats.accuracyToday >= 80 ? 'green' as const : stats.accuracyToday > 0 ? 'orange' as const : 'gray' as const },
          ].map((item) => (
            <View key={item.label} style={[styles.statCard, { backgroundColor: theme.cardAlt }]}>
              <Text style={[styles.statValue, { color: toneColor(item.tone), fontSize: fonts.translation }]}>
                {item.value}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textMuted, fontSize: fonts.meta }]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Health */}
        <View style={[styles.box, { backgroundColor: theme.cardAlt, marginTop: 14 }]}>
          <Text style={[styles.boxLabel, { color: theme.textMuted, fontSize: fonts.meta }]}>
            {isUa ? 'Стан памʼяті' : 'Memory health'}
          </Text>
          <Text style={[styles.healthText, { color: theme.textSecondary, fontSize: fonts.base }]}>
            {isUa
              ? `Слабких серед активних: ${weakPercent}%. Weak-слова підіймаються вище в тренуванні.`
              : `Weak among active: ${weakPercent}%. Weak words are prioritized in training.`}
          </Text>
        </View>
      </View>

      {/* ── Action cards */}
      {[
        { title: '🎯 Training',   text: isUa ? 'Картки, введення, форми, вимова' : 'Flashcards, typing, forms, pronunciation', badge: stats.dueToday > 0 ? `${stats.dueToday} due` : undefined, route: '/explore' },
        { title: '📖 Reading',    text: isUa ? 'Аналіз текстів, preview слів, AI пояснення' : 'Text analysis, word preview, AI explanations', badge: undefined, route: '/reading' },
        { title: '🎙 Voice',      text: isUa ? 'Мікрофон, transcript і майбутній Reading pipeline' : 'Microphone, transcript and future Reading pipeline', badge: 'Beta', route: '/voice' },
        { title: '🔥 Weak Words', text: isUa ? 'Нестабільна лексика і memory heatmap' : 'Unstable vocabulary and memory heatmap', badge: stats.weakWords > 0 ? String(stats.weakWords) : undefined, route: '/weak' },
        { title: '⚙️ Settings',   text: isUa ? 'Мова, переклади, режими навчання' : 'Language, translation, theme and study settings', badge: undefined, route: '/settings' },
      ].map((item) => (
        <TouchableOpacity
          key={item.title}
          style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => router.push(item.route as any)}
          activeOpacity={0.75}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary, fontSize: fonts.base + 4 }]}>
              {item.title}
            </Text>
            {item.badge ? (
              <Text style={[styles.cardBadge, { backgroundColor: theme.accentBg, color: theme.accent }]}>
                {item.badge}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.cardText, { color: theme.textTertiary, fontSize: fonts.base - 1 }]}>
            {item.text}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content:        { paddingTop: 70, paddingHorizontal: 20, paddingBottom: 120 },
  title:          { fontWeight: '800', marginBottom: 8 },
  subtitle:       { marginBottom: 26, lineHeight: 24 },
  dashboardCard:  { borderRadius: 24, padding: 20, marginBottom: 24, borderWidth: 0.5 },
  dashboardHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  dashboardTitle: { fontWeight: '800' },
  box:            { borderRadius: 16, padding: 14, marginBottom: 12 },
  row:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  boxLabel:       { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  bigNum:         { fontWeight: '800' },
  progressTrack:  { height: 10, borderRadius: 999, overflow: 'hidden' },
  progressFill:   { height: '100%', borderRadius: 999 },
  hint:           { marginTop: 8, fontWeight: '600' },
  todayStatus:    { fontWeight: '700', lineHeight: 22, marginTop: 4 },
  statsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard:       { width: '47%', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 14 },
  statValue:      { fontWeight: '800', marginBottom: 6 },
  statLabel:      { fontWeight: '600', lineHeight: 18 },
  healthText:     { fontWeight: '600', lineHeight: 22, marginTop: 6 },
  card:           { padding: 20, borderRadius: 20, marginBottom: 16, borderWidth: 0.5 },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  cardTitle:      { flex: 1, fontWeight: '800' },
  cardBadge:      { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, fontSize: 12, fontWeight: '800', overflow: 'hidden' },
  cardText:       { lineHeight: 22, fontWeight: '600' },
});
