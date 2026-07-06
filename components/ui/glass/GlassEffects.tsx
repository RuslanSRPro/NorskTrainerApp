import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

type Props = {
  radius: number;
  highlightInset: number;
  glowHeight: number;
  depthHeight: number;

  highlightOpacity: number;
  causticOpacity: number;
  glowOpacity: number;
  bottomOpacity: number;
  lensOpacity: number;

  animated?: boolean;
};

export function GlassEffects({
  radius,
  highlightInset,
  glowHeight,
  depthHeight,
  highlightOpacity,
  causticOpacity,
  glowOpacity,
  bottomOpacity,
  lensOpacity,
  animated = true,
}: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 5200,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 5200,
          useNativeDriver: true,
        }),
      ]),
    );

    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 9000,
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 9000,
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
  }, [animated, drift, pulse]);

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

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.causticWrap,
          {
            opacity: causticOpacity,
            transform: [
              { translateX: causticTranslateX },
              { rotate: causticRotate },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={[
            'rgba(255,255,255,0.70)',
            'rgba(255,255,255,0.20)',
            'rgba(255,255,255,0.00)',
          ]}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={[
            styles.caustic,
            {
              borderTopLeftRadius: radius,
              borderTopRightRadius: radius,
            },
          ]}
        />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.topEdgeWrap,
          {
            left: highlightInset,
            right: highlightInset,
            opacity: pulseOpacity,
          },
        ]}
      >
        <LinearGradient
          colors={[
            'rgba(255,255,255,0.90)',
            'rgba(255,255,255,0.24)',
            'rgba(255,255,255,0.00)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.topEdge, { opacity: highlightOpacity }]}
        />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.innerGlowWrap,
          {
            height: glowHeight,
            opacity: pulseOpacity,
          },
        ]}
      >
        <LinearGradient
          colors={[
            'rgba(255,255,255,0.18)',
            'rgba(255,255,255,0.045)',
            'rgba(255,255,255,0.00)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[
            styles.innerGlow,
            {
              opacity: glowOpacity,
              borderTopLeftRadius: radius,
              borderTopRightRadius: radius,
            },
          ]}
        />
      </Animated.View>

      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(0,0,0,0.00)',
          'rgba(0,0,0,0.030)',
          'rgba(0,0,0,0.090)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[
          styles.bottomDepth,
          {
            height: depthHeight,
            opacity: bottomOpacity,
            borderBottomLeftRadius: radius,
            borderBottomRightRadius: radius,
          },
        ]}
      />

      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(0,0,0,0.00)',
          'rgba(0,0,0,0.024)',
          'rgba(0,0,0,0.070)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[
          styles.lensShadow,
          {
            borderRadius: radius,
            opacity: lensOpacity,
          },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  causticWrap: {
    position: 'absolute',
    top: -34,
    left: -28,
    right: 6,
    height: 88,
  },
  caustic: {
    flex: 1,
  },
  topEdgeWrap: {
    position: 'absolute',
    top: 0,
    height: 1.4,
  },
  topEdge: {
    flex: 1,
  },
  innerGlowWrap: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
  },
  innerGlow: {
    flex: 1,
  },
  bottomDepth: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  lensShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});