import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { GlassSurface } from '@/components/ui/glass/GlassSurface';

type Props = {
  children: ReactNode;
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function GlassTile({ children, dark = false, style }: Props) {
  return (
    <GlassSurface
      variant="tile"
      dark={dark}
      shadow={false}
      style={style}
      border
      edge
      highlight
      glow
      bottomDepth
      sideRefraction
      contentStyle={styles.content}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(255,255,255,0.16)',
          'rgba(255,255,255,0.04)',
          'rgba(255,255,255,0.00)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(255,255,255,0.00)',
          'rgba(0,0,0,0.028)',
          'rgba(0,0,0,0.070)',
        ]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View pointerEvents="none" style={styles.topEdge} />
      <View pointerEvents="none" style={styles.opticalEdge} />

      <View style={styles.inner}>{children}</View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  content: {
    overflow: 'hidden',
    position: 'relative',
  },
  inner: {
    padding: 13,
    flex: 1,
  },
  topEdge: {
    position: 'absolute',
    top: 1,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.42)',
    opacity: 0.65,
  },
  opticalEdge: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: 19,
    borderWidth: 0.45,
    borderColor: 'rgba(255,255,255,0.24)',
  },
});