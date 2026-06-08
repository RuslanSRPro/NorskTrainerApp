import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getLearningWordsFromSupabase } from '@/services/api';
import { useSettingsStore } from '@/store/settingsStore';

export default function WeakScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState<any[]>([]);
  const [error, setError] = useState('');

  const { preferred_user, app_language } = useSettingsStore();

  const isUa = app_language === 'ua';

  useEffect(() => {
    loadWeakWords();
  }, [preferred_user]);

  const summary = useMemo(() => {
    const total = words.length;
    const veryWeak = words.filter((w) => getWeakScore(w) >= 70).length;
    const readingBoosted = words.filter((w) => getPersonalHits(w) > 0).length;
    const passive = words.filter((w) => getMemoryStatus(w) === 'passive_known').length;

    return { total, veryWeak, readingBoosted, passive };
  }, [words]);

  async function loadWeakWords() {
    try {
      setLoading(true);
      setError('');

      const data = await getLearningWordsFromSupabase({
        preferred_user,
        study_set: 'weak',
        category_filter: 'all',
        daily_limit: 100,
      });

      setWords(data);
    } catch (error: any) {
      console.log('Weak words load error:', error);
      setError(String(error?.message || error));
    } finally {
      setLoading(false);
    }
  }

  function getTranslation(word: any) {
    const ua = word?.ua || '';
    const en = word?.en || '';
    return isUa ? ua || en : en || ua;
  }

  function getSrs(word: any) {
    return word?.srs || {};
  }

  function getWeakScore(word: any) {
    return Number(word?.weakScore ?? getSrs(word).weak_score ?? 0);
  }

  function getPriorityScore(word: any) {
    return Number(word?.priorityScore ?? getSrs(word).priority_score ?? 0);
  }

  function getMemoryScore(word: any) {
    return Number(word?.memoryScore ?? getSrs(word).memory_score ?? 0);
  }

  function getPersonalHits(word: any) {
    return Number(word?.personalHits ?? getSrs(word).personal_hits ?? 0);
  }

  function getMemoryStatus(word: any) {
    return String(word?.memoryStatus ?? getSrs(word).memory_status ?? 'active');
  }

  function getWeakLevel(score: number) {
    if (score >= 80) return 'critical';
    if (score >= 50) return 'weak';
    if (score >= 20) return 'unstable';
    return 'stable';
  }

  function getWeakLevelLabel(score: number) {
    const level = getWeakLevel(score);

    if (level === 'critical') return 'CRITICAL';
    if (level === 'weak') return 'WEAK';
    if (level === 'unstable') return 'UNSTABLE';
    return 'STABLE';
  }

  function getWeakReason(word: any) {
    const weak = getWeakScore(word);
    const priority = getPriorityScore(word);
    const hits = getPersonalHits(word);
    const status = getMemoryStatus(word);

    if (weak >= 80) {
      return isUa
        ? 'Критично слабке слово: багато помилок або провалів.'
        : 'Critical weak word: many mistakes or lapses.';
    }

    if (weak >= 50) {
      return isUa
        ? 'Слабке слово: потребує частого повторення.'
        : 'Weak word: needs frequent review.';
    }

    if (weak >= 20) {
      return isUa
        ? 'Нестабільне слово: краще ще закріпити.'
        : 'Unstable word: should be reinforced.';
    }

    if (priority >= 90) return isUa ? 'Високий пріоритет повторення' : 'High review priority';
    if (hits > 0) return isUa ? 'Часто зустрічалось у Reading' : 'Seen often in Reading';
    if (status === 'weak') return isUa ? 'Позначено як слабке' : 'Marked as weak';

    return isUa ? 'Потребує повторення' : 'Needs review';
  }

  function getStatusLabel(status: string) {
    const ua: Record<string, string> = {
      active: 'Active',
      reinforcement: 'Закріплення',
      passive_known: 'Пасивно відоме',
      weak: 'Слабке',
      archived: 'Архів',
    };

    const en: Record<string, string> = {
      active: 'Active',
      reinforcement: 'Reinforcement',
      passive_known: 'Passive known',
      weak: 'Weak',
      archived: 'Archived',
    };

    return isUa ? ua[status] || status : en[status] || status;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>
        {isUa ? '🔥 Слабкі слова' : '🔥 Weak Words'}
      </Text>

      <Text style={styles.subtitle}>
        {isUa
          ? 'Слова, які потребують додаткового повторення.'
          : 'Forgotten, unstable and difficult vocabulary.'}
      </Text>

      {loading ? <ActivityIndicator size="large" color="#0EA5E9" /> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && !error && words.length > 0 ? (
        <View style={styles.summaryGrid}>
          <SummaryCard label={isUa ? 'Усього' : 'Total'} value={summary.total} />
          <SummaryCard label={isUa ? 'Дуже слабкі' : 'Very weak'} value={summary.veryWeak} />
          <SummaryCard label="Reading" value={summary.readingBoosted} />
          <SummaryCard label={isUa ? 'Пасивні' : 'Passive'} value={summary.passive} />
        </View>
      ) : null}

      {!loading && !error && words.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {isUa ? 'Поки немає слабких слів' : 'No weak words yet'}
          </Text>

          <Text style={styles.emptyText}>
            {isUa
              ? 'Натискай Hard або помиляйся в тренуванні — слова зʼявляться тут.'
              : 'Press Hard or make mistakes in training, and words will appear here.'}
          </Text>
        </View>
      ) : null}

      {words.map((word) => {
        const weakScore = getWeakScore(word);
        const priorityScore = getPriorityScore(word);
        const memoryScore = getMemoryScore(word);
        const personalHits = getPersonalHits(word);
        const memoryStatus = getMemoryStatus(word);
        const weakLevel = getWeakLevel(weakScore);

        return (
          <View key={word.id} style={styles.wordCard}>
            <View style={styles.wordHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.word}>{word.word}</Text>
                <Text style={styles.translation}>{getTranslation(word)}</Text>
              </View>

              <View
                style={[
                  styles.scoreBadge,
                  weakLevel === 'critical' && styles.scoreCritical,
                  weakLevel === 'weak' && styles.scoreWeak,
                  weakLevel === 'unstable' && styles.scoreUnstable,
                  weakLevel === 'stable' && styles.scoreStable,
                ]}
              >
                <Text
                  style={[
                    styles.scoreBadgeValue,
                    weakLevel === 'critical' && styles.scoreCriticalText,
                    weakLevel === 'weak' && styles.scoreWeakText,
                    weakLevel === 'unstable' && styles.scoreUnstableText,
                    weakLevel === 'stable' && styles.scoreStableText,
                  ]}
                >
                  {weakScore}
                </Text>

                <Text
                  style={[
                    styles.scoreBadgeLabel,
                    weakLevel === 'critical' && styles.scoreCriticalText,
                    weakLevel === 'weak' && styles.scoreWeakText,
                    weakLevel === 'unstable' && styles.scoreUnstableText,
                    weakLevel === 'stable' && styles.scoreStableText,
                  ]}
                >
                  {getWeakLevelLabel(weakScore)}
                </Text>
              </View>
            </View>

            <Text style={styles.meta}>
              {word.category || word.type || ''}
            </Text>

            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>
                {isUa ? 'Причина' : 'Reason'}
              </Text>
              <Text style={styles.reasonText}>{getWeakReason(word)}</Text>
            </View>

            <View style={styles.metricsGrid}>
              <Metric label="Memory" value={memoryScore} />
              <Metric label="Priority" value={priorityScore} />
              <Metric label="Reading hits" value={personalHits} />
              <Metric label="Status" value={getStatusLabel(memoryStatus)} />
            </View>
          </View>
        );
      })}

      {words.length > 0 ? (
        <Pressable
          style={styles.trainButton}
          onPress={() => router.push('/explore')}
        >
          <Text style={styles.trainButtonText}>
            {isUa ? 'Тренувати слабкі слова' : 'Train weak words'}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
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
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 10,
    color: '#111827',
  },

  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 24,
  },

  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },

  summaryCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
  },

  summaryValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0EA5E9',
  },

  summaryLabel: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '800',
    color: '#6B7280',
  },

  wordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },

  wordHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },

  word: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 8,
  },

  translation: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0EA5E9',
    lineHeight: 24,
    marginBottom: 8,
  },

  scoreBadge: {
    minWidth: 76,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
  },

  scoreBadgeValue: {
    fontSize: 22,
    fontWeight: '900',
  },

  scoreBadgeLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },

  scoreStable: {
    backgroundColor: '#E5E7EB',
  },

  scoreUnstable: {
    backgroundColor: '#FEF3C7',
  },

  scoreWeak: {
    backgroundColor: '#FED7AA',
  },

  scoreCritical: {
    backgroundColor: '#FEE2E2',
  },

  scoreStableText: {
    color: '#6B7280',
  },

  scoreUnstableText: {
    color: '#B45309',
  },

  scoreWeakText: {
    color: '#C2410C',
  },

  scoreCriticalText: {
    color: '#991B1B',
  },

  meta: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 4,
  },

  reasonBox: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
  },

  reasonLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase',
  },

  reasonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#374151',
    lineHeight: 22,
  },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },

  metricBox: {
    width: '47%',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 12,
  },

  metricLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 5,
  },

  metricValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 8,
  },

  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },

  trainButton: {
    marginTop: 12,
    backgroundColor: '#0EA5E9',
    borderRadius: 18,
    paddingVertical: 16,
  },

  trainButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '900',
  },

  error: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
});
