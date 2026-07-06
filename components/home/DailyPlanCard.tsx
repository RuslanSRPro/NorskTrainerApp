import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { GlassLens } from '@/components/ui/glass/GlassLens';
import { GlassPressable } from '@/components/ui/glass/GlassPressable';
import { GlassSurface } from '@/components/ui/glass/GlassSurface';
import { visionSpacing } from '@/design-system/vision';

type PlanItem = {
  icon: keyof typeof Ionicons.glyphMap;
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
      icon: 'play',
      title: isUa ? 'Продовжити тренування' : 'Continue training',
      subtitle:
        dueToday > 0
          ? `${dueToday} ${isUa ? 'карток чекають' : 'cards waiting'}`
          : isUa
            ? 'Можна взяти нові слова'
            : 'Ready for new words',
      accent: '#0A84FF',
      onPress: onTraining,
    },
    {
      icon: 'book-outline',
      title: isUa ? 'Читання' : 'Reading',
      subtitle: isUa ? 'Попрацювати з текстом' : 'Work with text',
      accent: '#FFB340',
      onPress: onReading,
    },
    {
      icon: 'mic',
      title: isUa ? 'Аудіо' : 'Audio',
      subtitle: isUa ? 'Голосова практика' : 'Voice practice',
      accent: '#BF5AF2',
      onPress: onVoice,
    },
    {
      icon: 'flame',
      title: isUa ? 'Слабкі слова' : 'Weak words',
      subtitle: `${weakWords} ${isUa ? 'слів для повторення' : 'words to review'}`,
      accent: '#FF453A',
      onPress: onWeak,
    },
  ];

  return (
    <GlassSurface
      variant="hero"
      dark={dark}
      intensity={92}
      glow
      edge
      bottomDepth
      sideRefraction
      contentStyle={styles.container}
    >
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: mutedColor }]} numberOfLines={1}>
          {isUa ? 'План на сьогодні' : 'Today’s plan'}
        </Text>

        <Text style={[styles.time, { color: textColor }]} numberOfLines={1}>
          {isUa ? '≈ 12 хв' : '≈ 12 min'}
        </Text>
      </View>

      <View style={styles.grid}>
        {[0, 2].map((startIndex) => (
          <View key={startIndex} style={styles.row}>
            {items.slice(startIndex, startIndex + 2).map((item) => (
              <GlassPressable
                key={item.title}
                onPress={item.onPress}
                pressedScale={0.975}
                style={styles.tilePressable}
                contentStyle={styles.tileContent}
              >
                <GlassSurface
                  variant="tile"
                  dark={dark}
                  intensity={76}
                  shadow={false}
                  glow
                  edge
                  border
                  bottomDepth
                  sideRefraction
                  contentStyle={styles.tile}
                >
                  <GlassLens accent={item.accent} dark={dark} size={30} style={styles.icon}>
                    <Ionicons name={item.icon} size={17} color={item.accent} />
                  </GlassLens>

                  <View style={styles.tileText}>
                    <Text
                      style={[styles.title, { color: textColor }]}
                      numberOfLines={2}
                      maxFontSizeMultiplier={1.05}
                    >
                      {item.title}
                    </Text>

                    <Text
                      style={[styles.subtitle, { color: mutedColor }]}
                      numberOfLines={2}
                      maxFontSizeMultiplier={1.05}
                    >
                      {item.subtitle}
                    </Text>
                  </View>
                </GlassSurface>
              </GlassPressable>
            ))}
          </View>
        ))}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: visionSpacing.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: visionSpacing.sm,
    gap: 12,
  },

  kicker: {
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },

  time: {
    fontSize: 13,
    fontWeight: '900',
  },

  grid: {
    gap: visionSpacing.sm,
  },

  row: {
    flexDirection: 'row',
    gap: visionSpacing.sm,
  },

  tilePressable: {
    flex: 1,
  },

  tileContent: {
    flex: 1,
  },

  tile: {
    height: 126,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },

  icon: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },

  tileText: {
    flex: 1,
    justifyContent: 'flex-start',
  },

  title: {
    minHeight: 36,
    fontSize: 14,
    fontWeight: '850',
    lineHeight: 18,
    marginBottom: 3,
  },

  subtitle: {
    minHeight: 34,
    fontSize: 11.5,
    fontWeight: '700',
    lineHeight: 16,
  },
});