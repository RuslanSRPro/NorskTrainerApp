import { ReactNode } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { GlassSurface } from '@/components/ui/glass/GlassSurface';

type Props = {
  children: ReactNode;
  isDark: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export function TrainingInfoBlock({
  children,
  isDark,
  style,
  contentStyle,
}: Props) {
  return (
    <GlassSurface
      variant="tile"
      dark={isDark}
      style={[styles.root, style]}
      contentStyle={[styles.inner, contentStyle]}
    >
      {children}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 8,
    marginBottom: 4,
  },
  inner: {
    padding: 15,
  },
});