import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/services/theme';

type ScreenHeaderProps = {
  /** Emoji or short icon shown before the title, e.g. "🎯", "📊", "📖", "🔥" */
  icon?: string;
  /** Main title, e.g. "Тренування", "Прогрес", "Аналіз тексту" */
  title: string;
  /** Optional element on the right side of the title row, e.g. "1/50" counter */
  right?: ReactNode;
  /**
   * Optional short subtitle below the title row.
   * Keep it to a single short line -- this replaces the old large
   * two-line descriptions so the header stays compact on all screens.
   */
  subtitle?: string;
};

/**
 * Compact one-line header used on the "Тренування" screen, now shared
 * across all screens (Прогрес, Аналіз тексту, Слабкі слова, Налаштування, ...).
 *
 * Replaces the old large two-line title blocks that pushed content
 * below the fold.
 */
export function ScreenHeader({ icon, title, right, subtitle }: ScreenHeaderProps) {
  const { colors, scale } = useAppTheme();

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <View style={styles.titleRow}>
          {icon ? (
            <Text style={[styles.icon, { fontSize: scale(20) }]}>{icon}</Text>
          ) : null}

          <Text
            style={[styles.title, { fontSize: scale(20), color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>

        {right ? (
          <Text
            style={[styles.right, { fontSize: scale(15), color: colors.textTertiary }]}
          >
            {right}
          </Text>
        ) : null}
      </View>

      {subtitle ? (
        <Text
          style={[styles.subtitle, { fontSize: scale(13), color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexShrink: 1,
  },

  icon: {
    fontWeight: '900',
  },

  title: {
    fontWeight: '900',
  },

  right: {
    fontWeight: '800',
    marginLeft: 12,
  },

  subtitle: {
    marginTop: 2,
    fontWeight: '600',
  },
});