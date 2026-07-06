import { StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass/GlassSurface';
import { ProgressTrack } from '@/components/ui/glass/ProgressTrack';
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
    <GlassSurface variant="hero" dark={dark} contentStyle={styles.inner}>
      <View style={styles.header}>
        <View style={styles.left}>
          <Text style={[styles.label, { color: mutedColor }]}>{label}</Text>

          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {footer}
          </Text>
        </View>

        <Text style={[styles.percent, { color: accent }]}>{pct}%</Text>
      </View>

      <ProgressTrack value={pct} accent={accent} dark={dark} height={8} />
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  inner: {
    paddingHorizontal: visionSpacing.lg,
    paddingTop: 18,
    paddingBottom: 17,
    minHeight: 112,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  left: {
    flex: 1,
    paddingRight: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
  percent: {
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 40,
  },
});