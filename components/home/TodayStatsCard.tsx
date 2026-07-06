import { StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass/GlassSurface';
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
    <GlassSurface
      variant="card"
      material="light"
      shape="card"
      dark={dark}
      contentStyle={styles.inner}
    >
      <View style={styles.row}>
        {stats.map((item, index) => (
          <View key={item.label} style={styles.item}>
            <Text style={[styles.value, { color: textColor }]} numberOfLines={1}>
              {item.value}
            </Text>

            <Text style={[styles.label, { color: mutedColor }]} numberOfLines={1}>
              {item.label}
            </Text>

            {index < stats.length - 1 ? (
              <View
                pointerEvents="none"
                style={[
                  styles.divider,
                  {
                    backgroundColor: dark
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(255,255,255,0.34)',
                  },
                ]}
              />
            ) : null}
          </View>
        ))}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  inner: {
    paddingHorizontal: visionSpacing.md,
    paddingVertical: 10,
    minHeight: 56,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  value: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 2,
  },
  label: {
    fontSize: 8,
    fontWeight: '800',
  },
  divider: {
    position: 'absolute',
    right: 0,
    top: 6,
    bottom: 6,
    width: 0.7,
    opacity: 0.7,
  },
});