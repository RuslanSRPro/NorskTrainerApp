import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { GlassRimLight } from './GlassRimLight';

type Props = {
  children?: ReactNode;
  accent?: string;
  dark?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function GlassLens({
  children,
  accent = '#0A84FF',
  dark = false,
  size = 36,
  style,
}: Props) {
  return (
    <View
      style={[
        styles.root,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: dark ? 'rgba(255,255,255,0.058)' : 'rgba(255,255,255,0.095)',
          borderColor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.40)',
        },
        style,
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(255,255,255,0.36)',
          'rgba(255,255,255,0.10)',
          'rgba(255,255,255,0.00)',
        ]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        pointerEvents="none"
        colors={[
          `${accent}3A`,
          `${accent}18`,
          'rgba(255,255,255,0.00)',
        ]}
        start={{ x: 0.18, y: 0.12 }}
        end={{ x: 0.88, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <GlassRimLight size={size} accent={accent} dark={dark} />

      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(255,255,255,0.62)',
          'rgba(255,255,255,0.14)',
          'rgba(255,255,255,0.00)',
        ]}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.88, y: 0.68 }}
        style={[
          styles.topReflection,
          {
            left: size * 0.2,
            right: size * 0.2,
            height: size * 0.24,
          },
        ]}
      />

      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(255,255,255,0.00)',
          `${accent}20`,
          'rgba(0,0,0,0.15)',
        ]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.depth}
      />

      <View
        pointerEvents="none"
        style={[
          styles.innerEdge,
          {
            borderRadius: size / 2 - 1,
          },
        ]}
      />

      <View
        pointerEvents="none"
        style={[
          styles.outerEdge,
          {
            borderRadius: size / 2 - 2,
          },
        ]}
      />

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.65,
    shadowColor: 'rgba(0,0,0,0.22)',
    shadowOpacity: 0.16,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  topReflection: {
    position: 'absolute',
    top: 1,
    borderRadius: 999,
  },
  depth: {
    ...StyleSheet.absoluteFillObject,
  },
  innerEdge: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderWidth: 0.7,
    borderColor: 'rgba(255,255,255,0.34)',
  },
  outerEdge: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderWidth: 0.8,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  content: {
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});