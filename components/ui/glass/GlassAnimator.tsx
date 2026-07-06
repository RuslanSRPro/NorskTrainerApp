import { ReactNode, useEffect, useRef } from 'react';
import { Animated } from 'react-native';

type Props = {
  children: (values: {
    pulseOpacity: Animated.AnimatedInterpolation<number>;
    causticTranslateX: Animated.AnimatedInterpolation<number>;
    causticRotate: Animated.AnimatedInterpolation<string>;
  }) => ReactNode;
  enabled?: boolean;
};

export function GlassAnimator({ children, enabled = true }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) return;

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 5600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 5600,
          useNativeDriver: true,
        }),
      ]),
    );

    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 9200,
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 9200,
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();
    driftLoop.start();

    return () => {
      pulseLoop.stop();
      driftLoop.stop();
    };
  }, [enabled, pulse, drift]);

  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.12],
  });

  const causticTranslateX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-4, 4],
  });

  const causticRotate = drift.interpolate({
    inputRange: [0, 1],
    outputRange: ['-6deg', '-3deg'],
  });

  return <>{children({ pulseOpacity, causticTranslateX, causticRotate })}</>;
}