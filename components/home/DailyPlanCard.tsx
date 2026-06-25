import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/ui/GlassCard';
import { visionSpacing } from '@/design-system/vision';

type PlanItem = {
  icon: string;
  title: string;
  subtitle: string;
  accent: string;
  onPress: () => void;
};

type Props = {
  dark: boolean;
  textColor: string;
  mutedColor: string;
  isUa: boolean;
  dueToday: number;
  weakWords: number;
  onTraining: () => void;
  onReading: () => void;
  onVoice: () => void;
  onWeak: () => void;
};

export function DailyPlanCard({
  dark,
  textColor,
  mutedColor,
  isUa,
  dueToday,
  weakWords,
  onTraining,
  onReading,
  onVoice,
  onWeak,
}: Props) {
  const items: PlanItem[] = [
    {
      icon: '▶',
      title: isUa ? 'Продовжити навчання' : 'Continue training',
      subtitle: dueToday > 0
        ? `${dueToday} ${isUa ? 'карток чекають' : 'cards waiting'}`
        : isUa ? 'Можна взяти нові слова' : 'Ready for new words',
      accent: '#0A84FF',
      onPress: onTraining,
    },
    {
      icon: '📖',
      title: isUa ? 'Читання' : 'Reading',
      subtitle: isUa ? 'Попрацювати з текстом' : 'Work with text',
      accent: '#FF9F0A',
      onPress: onReading,
    },
    {
      icon: '🎙',
      title: isUa ? 'Аудіо' : 'Audio',
      subtitle: isUa ? 'Голосова практика' : 'Voice practice',
      accent: '#BF5AF2',
      onPress: onVoice,
    },
    {
      icon: '🔥',
      title: isUa ? 'Слабкі слова' : 'Weak words',
      subtitle: `${weakWords} ${isUa ? 'слів для повторення' : 'words to review'}`,
      accent: '#FF453A',
      onPress: onWeak,
    },
  ];

  return (
    <GlassCard dark={dark} intensity={52} innerStyle={styles.inner}>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: mutedColor }]}>
          {isUa ? 'План на сьогодні' : 'Today’s plan'}
        </Text>
        <Text style={[styles.time, { color: textColor }]}>
          {isUa ? '≈ 12 хв' : '≈ 12 min'}
        </Text>
      </View>

      <View style={styles.grid}>
        {items.map((item) => (
          <Pressable key={item.title} style={styles.tile} onPress={item.onPress}>
            <View style={[styles.iconBubble, { backgroundColor: `${item.accent}22` }]}>
              <Text style={styles.icon}>{item.icon}</Text>
            </View>
            <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.subtitle, { color: mutedColor }]} numberOfLines={2}>
              {item.subtitle}
            </Text>
          </Pressable>
        ))}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  inner: {
    padding: visionSpacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: visionSpacing.sm,
    alignItems: 'center',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  time: {
    fontSize: 13,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: visionSpacing.sm,
  },
  tile: {
    width: '48%',
    minHeight: 104,
    borderRadius: 22,
    padding: visionSpacing.sm,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 17,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
});
