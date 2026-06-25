import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/ui/GlassCard';
import { visionSpacing } from '@/design-system/vision';

type Props = {
  dark: boolean;
  textColor: string;
  mutedColor: string;
  isUa: boolean;
  reviewsToday: number;
  accuracyToday: number;
  dueToday: number;
  weakWords: number;
};

export function TodayStatsCard({
  dark,
  textColor,
  mutedColor,
  isUa,
  reviewsToday,
  accuracyToday,
  dueToday,
  weakWords,
}: Props) {
  const stats = [
    { label: isUa ? 'Повтори' : 'Reviews', value: reviewsToday },
    { label: isUa ? 'Точність' : 'Accuracy', value: `${accuracyToday}%` },
    { label: 'Due', value: dueToday },
    { label: isUa ? 'Слабкі' : 'Weak', value: weakWords },
  ];

  return (
    <GlassCard dark={dark} intensity={42} innerStyle={styles.inner}>
      <View style={styles.row}>
        {stats.map((item) => (
          <View key={item.label} style={styles.item}>
            <Text style={[styles.value, { color: textColor }]} numberOfLines={1}>
              {item.value}
            </Text>
            <Text style={[styles.label, { color: mutedColor }]} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  inner: {
    paddingHorizontal: visionSpacing.md,
    paddingVertical: 8,
    minHeight: 50,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  value: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 2,
  },
  label: {
    fontSize: 8,
    fontWeight: '800',
  },
});

