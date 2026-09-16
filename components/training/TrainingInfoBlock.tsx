import { ReactNode } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { GlassSurface } from '@/components/ui/glass/GlassSurface';
import type { TrainingDensity } from './TrainingCard';

type Props = {
  children: ReactNode; isDark: boolean; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>;
  density?: TrainingDensity;
};

export function TrainingInfoBlock({ children, isDark, style, contentStyle, density = 'normal' }: Props) {
  return (
    <GlassSurface
      variant="tile" dark={isDark}
      style={[styles.root, density === 'compact' && styles.rootCompact, density === 'dense' && styles.rootDense, style]}
      contentStyle={[styles.inner, density === 'compact' && styles.innerCompact, density === 'dense' && styles.innerDense, contentStyle]}
    >
      {children}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 8, marginBottom: 4 },
  rootCompact: { marginTop: 5, marginBottom: 3 },
  rootDense: { marginTop: 3, marginBottom: 2 },
  inner: { padding: 15 },
  innerCompact: { paddingVertical: 11, paddingHorizontal: 13 },
  innerDense: { paddingVertical: 8, paddingHorizontal: 11 },
});
