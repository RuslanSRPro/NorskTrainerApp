import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { visionSpacing } from '@/design-system/vision';

type Props = {
  visible: boolean;
  onClose: () => void;
  dark: boolean;
  textColor: string;
  mutedColor: string;
  isUa: boolean;
  pct: number;
  totalWords: number;
  learnedWords: number;
  weakWords: number;
  dueToday: number;
  reviewsToday: number;
  accuracyToday: number;
};

export function AnalyticsSheet({
  visible,
  onClose,
  dark,
  textColor,
  mutedColor,
  isUa,
  pct,
  totalWords,
  learnedWords,
  weakWords,
  dueToday,
  reviewsToday,
  accuracyToday,
}: Props) {
  const items = [
    { label: isUa ? 'Всього слів' : 'Total words', value: totalWords },
    { label: isUa ? 'У навчанні' : 'In learning', value: learnedWords },
    { label: isUa ? 'Слабкі' : 'Weak', value: weakWords },
    { label: 'Due', value: dueToday },
    { label: isUa ? 'Повтори' : 'Reviews', value: reviewsToday },
    { label: isUa ? 'Точність' : 'Accuracy', value: `${accuracyToday}%` },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: dark ? '#081421' : '#F2F6FA' }]}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: textColor }]}>
              📊 {isUa ? 'Аналітика' : 'Analytics'}
            </Text>

            <Pressable style={[styles.close, { backgroundColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)' }]} onPress={onClose}>
              <Text style={[styles.closeText, { color: textColor }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={[styles.hero, { backgroundColor: dark ? 'rgba(255,255,255,0.08)' : '#FFFFFF' }]}>
              <Text style={[styles.kicker, { color: mutedColor }]}>
                {isUa ? 'Покриття бази' : 'Base coverage'}
              </Text>
              <Text style={styles.percent}>{pct}%</Text>
              <Text style={[styles.meta, { color: mutedColor }]}>
                {learnedWords} / {totalWords} {isUa ? 'слів' : 'words'}
              </Text>
            </View>

            <View style={styles.grid}>
              {items.map((item) => (
                <View key={item.label} style={[styles.stat, { backgroundColor: dark ? 'rgba(255,255,255,0.08)' : '#FFFFFF' }]}>
                  <Text style={[styles.statValue, { color: textColor }]}>{item.value}</Text>
                  <Text style={[styles.statLabel, { color: mutedColor }]}>{item.label}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 22, fontWeight: '900' },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 14, fontWeight: '800' },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  hero: {
    borderRadius: 26,
    padding: visionSpacing.lg,
    marginBottom: visionSpacing.md,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  percent: {
    marginTop: 8,
    fontSize: 42,
    fontWeight: '900',
    color: '#0A84FF',
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stat: {
    width: '48%',
    borderRadius: 20,
    padding: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
