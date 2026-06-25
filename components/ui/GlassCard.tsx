import { BlurView } from 'expo-blur';
import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { visionGlass, visionRadius } from '@/design-system/vision';

type Props = {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  innerStyle?: ViewStyle | ViewStyle[];
  dark?: boolean;
  intensity?: number;
};

export function GlassCard({ children, style, innerStyle, dark = false, intensity = 55 }: Props) {
  const glass = dark ? visionGlass.dark : visionGlass.light;

  return (
    <BlurView intensity={intensity} tint={dark ? 'dark' : 'light'} style={[styles.blur, style]}>
      <View
        style={[
          styles.inner,
          {
            backgroundColor: glass.card,
            borderColor: glass.border,
            shadowColor: glass.shadow,
          },
          innerStyle,
        ]}
      >
        {children}
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  blur: {
    borderRadius: visionRadius.lg,
    overflow: 'hidden',
  },
  inner: {
    borderRadius: visionRadius.lg,
    borderWidth: 0.8,
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
});
