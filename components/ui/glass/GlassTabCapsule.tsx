import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { GlassSurface } from './GlassSurface';
import { GlassReflection } from './GlassReflection';

type Props = {
  children?: ReactNode;
  accent: string;
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function GlassTabCapsule({ children, accent, dark = false, style }: Props) {
  return (
    <View style={[styles.shadowWrap, style]}>
      <GlassSurface
        variant="tabActive"
        dark={dark}
        intensity={100}
        surfaceTint={dark ? 'rgba(255,255,255,0.070)' : 'rgba(255,255,255,0.145)'}
        borderColor={`${accent}99`}
        edgeColor="rgba(255,255,255,0.82)"
        shadow={false}
        glow
        edge
        border
        highlight={false}
        bottomDepth
        sideRefraction
        contentStyle={styles.surface}
      >
        <LinearGradient
          pointerEvents="none"
          colors={[
            'rgba(255,255,255,0.62)',
            'rgba(255,255,255,0.16)',
            'rgba(255,255,255,0.00)',
          ]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={styles.topLight}
        />

        <LinearGradient
          pointerEvents="none"
          colors={[
            `${accent}4D`,
            `${accent}22`,
            'rgba(255,255,255,0.00)',
          ]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.accentGlow}
        />

        <LinearGradient
          pointerEvents="none"
          colors={[
            'rgba(255,255,255,0.00)',
            'rgba(0,0,0,0.030)',
            'rgba(0,0,0,0.105)',
          ]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.lensDepth}
        />

        <GlassReflection radius={24} opacity={0.22} enabled />

        <View pointerEvents="none" style={styles.innerRing} />

        <View style={styles.content}>
          {children}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    shadowColor: 'rgba(0,0,0,0.36)',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  surface: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topLight: {
    position: 'absolute',
    top: 1,
    left: 9,
    right: 9,
    height: 18,
    borderRadius: 999,
  },
  accentGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  lensDepth: {
    ...StyleSheet.absoluteFillObject,
  },
  innerRing: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderRadius: 999,
    borderWidth: 0.8,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  content: {
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});