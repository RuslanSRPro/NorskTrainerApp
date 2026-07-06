import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { glassEngine } from '@/design-system/glassEngine';

type Props = {
  size: number;
  accent?: string;
  dark?: boolean;
  enabled?: boolean;
};

export function GlassRimLight({
  size,
  accent = '#0A84FF',
  dark = false,
  enabled = true,
}: Props) {
  const light = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(light, {
          toValue: 1,
          duration: glassEngine.rim.durationMs,
          useNativeDriver: true,
        }),
        Animated.timing(light, {
          toValue: 0,
          duration: glassEngine.rim.durationMs,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [enabled, light]);

  const translateX = light.interpolate({
    inputRange: [0, 1],
    outputRange: [-glassEngine.rim.driftX, glassEngine.rim.driftX],
  });

  const translateY = light.interpolate({
    inputRange: [0, 1],
    outputRange: [glassEngine.rim.driftY, -glassEngine.rim.driftY],
  });

  const opacity = light.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [
      glassEngine.rim.opacityLow,
      glassEngine.rim.opacityHigh,
      glassEngine.rim.opacityLow + 0.08,
    ],
  });

  if (!enabled) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.root,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity,
          transform: [{ translateX }, { translateY }],
        },
      ]}
    >
      <LinearGradient
        colors={[
          'rgba(255,255,255,0.00)',
          dark ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.78)',
          `${accent}5E`,
          'rgba(255,255,255,0.00)',
        ]}
        start={{ x: 0.06, y: 0.02 }}
        end={{ x: 0.92, y: 0.8 }}
        style={styles.outerArc}
      />

      <LinearGradient
        colors={[
          'rgba(255,255,255,0.00)',
          `${accent}44`,
          'rgba(255,255,255,0.42)',
          'rgba(255,255,255,0.00)',
        ]}
        start={{ x: 0.18, y: 0 }}
        end={{ x: 0.84, y: 1 }}
        style={styles.sideArc}
      />

      <LinearGradient
        colors={[
          'rgba(255,255,255,0.00)',
          'rgba(255,255,255,0.26)',
          'rgba(255,255,255,0.00)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.innerArc}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    overflow: 'hidden',
  },
  outerArc: {
    position: 'absolute',
    top: -3,
    left: 1,
    right: 1,
    height: '52%',
    borderRadius: 999,
  },
  sideArc: {
    position: 'absolute',
    top: 2,
    right: -3,
    width: '48%',
    height: '78%',
    borderRadius: 999,
    opacity: 0.58,
  },
  innerArc: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderRadius: 999,
    opacity: 0.34,
  },
});