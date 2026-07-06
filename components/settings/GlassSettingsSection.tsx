import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass/GlassSurface';
import { useAppTheme } from '@/services/theme';

type Props = {
  title?: string;
  children: ReactNode;
};

export function GlassSettingsSection({ title, children }: Props) {
  const { colors, scale } = useAppTheme();

  return (
    <View style={styles.wrap}>
      {title ? (
        <Text
          style={[
            styles.title,
            {
              color: colors.textSecondary,
              fontSize: scale(12),
            },
          ]}
        >
          {title}
        </Text>
      ) : null}

      <GlassSurface variant="card" style={styles.surface} contentStyle={styles.content}>
        {children}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
  },
  title: {
    marginBottom: 6,
    marginLeft: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  surface: {
    width: '100%',
  },
  content: {
    overflow: 'hidden',
  },
});