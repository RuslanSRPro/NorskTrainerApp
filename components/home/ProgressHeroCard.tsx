import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/ui/GlassCard';
import { visionSpacing } from '@/design-system/vision';

type Props = {
  pct: number;
  learnedWords: number;
  totalWords: number;
  accent: string;
  textColor: string;
  mutedColor: string;
  dark: boolean;
  isUa: boolean;
  lang?: string;
};

export function ProgressHeroCard({
  pct,
  learnedWords,
  totalWords,
  accent,
  textColor,
  mutedColor,
  dark,
  isUa,
  lang = 'ua',
}: Props) {
  const isNo = lang === 'no';

  const label = isUa ? 'Прогрес' : isNo ? 'Fremgang' : 'Progress';

  const footer = isUa
    ? `${learnedWords} / ${totalWords} слів`
    : isNo
      ? `${learnedWords} / ${totalWords} ord`
      : `${learnedWords} / ${totalWords} words`;

  return (
    <GlassCard dark={dark} intensity={54} innerStyle={styles.inner}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: mutedColor }]}>{label}</Text>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {footer}
          </Text>
        </View>

        <Text style={[styles.percent, { color: accent }]}>{pct}%</Text>
      </View>

      <View style={[styles.barBg, { backgroundColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}>
        <View style={[styles.barFill, { backgroundColor: accent, width: `${Math.max(2, pct)}%` as any }]} />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  inner: {
    paddingHorizontal: visionSpacing.lg,
    paddingVertical: 14,
    minHeight: 102,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: visionSpacing.md,
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
  },
  percent: {
    fontSize: 36,
    fontWeight: '900',
    marginTop: -2,
  },
  barBg: {
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: 7,
    borderRadius: 999,
  },
});
