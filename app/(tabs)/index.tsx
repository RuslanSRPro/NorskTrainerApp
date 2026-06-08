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

type DashboardStats = {
  totalWords: number;
  learnedWords: number;
  weakWords: number;
  dueToday: number;
  reviewsToday: number;
  accuracyToday: number;
};

function StatCard({
  value,
  label,
  tone = 'blue',
}: {
  value: number | string;
  label: string;
  tone?: 'blue' | 'green' | 'orange' | 'red' | 'gray';
}) {
  return (
    <View style={styles.statCard}>
      <Text
        style={[
          styles.statValue,
          tone === 'green' && styles.greenText,
          tone === 'orange' && styles.orangeText,
          tone === 'red' && styles.redText,
          tone === 'gray' && styles.grayText,
        ]}
      >
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${safeValue}%` }]} />
    </View>
  );
}

function ActionCard({
  title,
  text,
  badge,
  onPress,
}: {
  title: string;
  text: string;
  badge?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {badge ? <Text style={styles.cardBadge}>{badge}</Text> : null}
      </View>

      <Text style={styles.cardText}>{text}</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<DashboardStats>({
    totalWords: 0,
    learnedWords: 0,
    weakWords: 0,
    dueToday: 0,
    reviewsToday: 0,
    accuracyToday: 0,
  });

  const { preferred_user, app_language } = useSettingsStore();

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
    if (stats.reviewsToday === 0) {
      return isUa ? 'Сьогодні ще немає повторів' : 'No reviews yet today';
    }

    if (stats.accuracyToday >= 85) {
      return isUa ? 'Сильний день навчання' : 'Strong learning day';
    }

    if (stats.accuracyToday >= 65) {
      return isUa ? 'Нормальний темп, продовжуй' : 'Good pace, keep going';
    }

    return isUa ? 'Сьогодні краще зробити легке повторення' : 'Better do light review today';
  }, [stats.reviewsToday, stats.accuracyToday, isUa]);

  async function loadDashboard() {
    try {
      setLoading(true);

      const data = await getDashboardStatsFromSupabase(preferred_user);

      setStats(data);
    } catch (error) {
      console.log('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [preferred_user])
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🇳🇴 Norsk Trainer</Text>

      <Text style={styles.subtitle}>
        {isUa
          ? 'Адаптивна система вивчення норвезької'
          : 'Adaptive Norwegian acquisition system'}
      </Text>

      <View style={styles.dashboardCard}>
        <View style={styles.dashboardHeader}>
          <Text style={styles.dashboardTitle}>
            {isUa ? '📊 Прогрес' : '📊 Progress'}
          </Text>

          {loading ? <ActivityIndicator size="small" color="#0EA5E9" /> : null}
        </View>

        <View style={styles.masteryBox}>
          <View style={styles.masteryHeader}>
            <Text style={styles.masteryLabel}>
              {isUa ? 'Покриття бази' : 'Base coverage'}
            </Text>
            <Text style={styles.masteryPercent}>{learnedPercent}%</Text>
          </View>

          <ProgressBar value={learnedPercent} />

          <Text style={styles.masteryHint}>
            {stats.learnedWords} / {stats.totalWords}{' '}
            {isUa ? 'слів у навчанні' : 'words in learning'}
          </Text>
        </View>

        <View style={styles.todayBox}>
          <Text style={styles.todayTitle}>
            {isUa ? 'Сьогодні' : 'Today'}
          </Text>

          <Text style={styles.todayStatus}>{dailyStatus}</Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            value={stats.totalWords}
            label={isUa ? 'Всього слів' : 'Total words'}
          />

          <StatCard
            value={stats.learnedWords}
            label={isUa ? 'У навчанні' : 'In learning'}
            tone="green"
          />

          <StatCard
            value={stats.weakWords}
            label={isUa ? 'Слабкі' : 'Weak'}
            tone={stats.weakWords > 0 ? 'red' : 'gray'}
          />

          <StatCard
            value={stats.dueToday}
            label={isUa ? 'Due сьогодні' : 'Due today'}
            tone={stats.dueToday > 0 ? 'orange' : 'gray'}
          />

          <StatCard
            value={stats.reviewsToday}
            label={isUa ? 'Повторів' : 'Reviews'}
          />

          <StatCard
            value={`${stats.accuracyToday}%`}
            label={isUa ? 'Точність' : 'Accuracy'}
            tone={stats.accuracyToday >= 80 ? 'green' : stats.accuracyToday > 0 ? 'orange' : 'gray'}
          />
        </View>

        <View style={styles.healthBox}>
          <Text style={styles.healthTitle}>
            {isUa ? 'Стан памʼяті' : 'Memory health'}
          </Text>

          <Text style={styles.healthText}>
            {isUa
              ? `Слабких слів серед активних: ${weakPercent}%. Часті weak-слова будуть підніматися вище в тренуванні.`
              : `Weak words among active learning: ${weakPercent}%. Frequent weak words will be prioritized in training.`}
          </Text>
        </View>
      </View>

      <ActionCard
        title="🎯 Training"
        text={isUa ? 'Картки, введення, форми, вимова' : 'Flashcards, typing, forms, pronunciation'}
        badge={stats.dueToday > 0 ? `${stats.dueToday} due` : undefined}
        onPress={() => router.push('/explore')}
      />

      <ActionCard
        title="📖 Reading"
        text={isUa ? 'Аналіз текстів, preview слів, AI пояснення' : 'Text analysis, word preview, AI explanations'}
        onPress={() => router.push('/reading')}
      />

      <ActionCard
        title="🎙 Voice"
        text={isUa ? 'Мікрофон, transcript і майбутній Reading pipeline' : 'Microphone, transcript and future Reading pipeline'}
        badge="Beta"
        onPress={() => router.push('/voice')}
      />

      <ActionCard
        title="🔥 Weak Words"
        text={isUa ? 'Нестабільна лексика і memory heatmap' : 'Unstable vocabulary and memory heatmap'}
        badge={stats.weakWords > 0 ? String(stats.weakWords) : undefined}
        onPress={() => router.push('/weak')}
      />

      <ActionCard
        title="⚙️ Settings"
        text={isUa ? 'Мова, переклади, режими навчання' : 'Language, translation, theme and study settings'}
        onPress={() => router.push('/settings')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F4ED',
  },

  content: {
    paddingTop: 70,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },

  title: {
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 8,
    color: '#111827',
  },

  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 26,
    lineHeight: 24,
  },

  dashboardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },

  dashboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  dashboardTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
  },

  masteryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },

  masteryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  masteryLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: '#64748B',
    textTransform: 'uppercase',
  },

  masteryPercent: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0EA5E9',
  },

  progressTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#0EA5E9',
  },

  masteryHint: {
    marginTop: 9,
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
  },

  todayBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },

  todayTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0369A1',
    textTransform: 'uppercase',
    marginBottom: 5,
  },

  todayStatus: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 23,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  statCard: {
    width: '47%',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 14,
  },

  statValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0EA5E9',
    marginBottom: 6,
  },

  greenText: {
    color: '#16A34A',
  },

  orangeText: {
    color: '#D97706',
  },

  redText: {
    color: '#DC2626',
  },

  grayText: {
    color: '#94A3B8',
  },

  statLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#64748B',
  },

  healthBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
  },

  healthTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 6,
  },

  healthText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    lineHeight: 22,
  },

  card: {
    backgroundColor: '#FFFFFF',
    padding: 22,
    borderRadius: 22,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },

  cardTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },

  cardBadge: {
    backgroundColor: '#E0F2FE',
    color: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
  },

  cardText: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    fontWeight: '600',
  },
});
