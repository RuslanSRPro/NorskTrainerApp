import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

type Props = {
  radius: number;
  opacity?: number;
  enabled?: boolean;
};

export function GlassReflection({
  radius,
  opacity = 0.18,
  enabled = true,
}: Props) {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 11000,
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 11000,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [drift, enabled]);

  const translateX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-12, 12],
  });

  const rotate = drift.interpolate({
    inputRange: [0, 1],
    outputRange: ['-8deg', '-4deg'],
  });

  const pulseOpacity = drift.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [opacity * 0.72, opacity, opacity * 0.72],
  });

  if (!enabled) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.root,
        {
          borderRadius: radius,
          opacity: pulseOpacity,
          transform: [{ translateX }, { rotate }],
        },
      ]}
    >
      <LinearGradient
        colors={[
          'rgba(255,255,255,0.00)',
          'rgba(255,255,255,0.32)',
          'rgba(255,255,255,0.00)',
        ]}
        start={{ x: 0, y: 0.1 }}
        end={{ x: 1, y: 0.9 }}
        style={styles.reflection}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: -40,
    left: -40,
    right: -40,
    height: 120,
    overflow: 'hidden',
  },
  reflection: {
    flex: 1,
  },
});