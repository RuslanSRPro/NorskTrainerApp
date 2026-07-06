import { useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '@/services/theme';

type Props = {
  title: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onComplete?: (value: number) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundToStep(value: number, step: number) {
  return Number((Math.round(value / step) * step).toFixed(2));
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function GlassSlider({
  title,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  onComplete,
}: Props) {
  const { colors, scale } = useAppTheme();

  const [trackWidth, setTrackWidth] = useState(1);

  const trackWidthRef = useRef(1);
  const latestValueRef = useRef(value);

  latestValueRef.current = value;

  function valueFromLocationX(locationX: number) {
    const width = Math.max(trackWidthRef.current, 1);
    const progress = clamp(locationX / width, 0, 1);
    const raw = min + progress * (max - min);

    return clamp(roundToStep(raw, step), min, max);
  }

  function update(locationX: number) {
    const next = valueFromLocationX(locationX);

    if (next !== latestValueRef.current) {
      latestValueRef.current = next;
      onChange(next);
    }

    return next;
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (event) => {
        update(event.nativeEvent.locationX);
      },

      onPanResponderMove: (event) => {
        update(event.nativeEvent.locationX);
      },

      onPanResponderRelease: (event) => {
        const finalValue = update(event.nativeEvent.locationX);
        onComplete?.(finalValue);
      },

      onPanResponderTerminate: (event) => {
        const finalValue = update(event.nativeEvent.locationX);
        onComplete?.(finalValue);
      },
    }),
  ).current;

  function handleLayout(event: LayoutChangeEvent) {
    const width = Math.max(event.nativeEvent.layout.width, 1);
    trackWidthRef.current = width;
    setTrackWidth(width);
  }

  const progress = clamp((value - min) / (max - min), 0, 1);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary, fontSize: scale(15) }]}>
          {title}
        </Text>

        <Text style={[styles.value, { color: colors.textSecondary, fontSize: scale(13) }]}>
          {formatPercent(value)}
        </Text>
      </View>

      <View
        style={styles.trackArea}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        <View style={styles.trackBase} />

        <View
          style={[
            styles.trackFill,
            {
              width: trackWidth * progress,
              backgroundColor: colors.accent,
            },
          ]}
        />

        <View
          style={[
            styles.thumb,
            {
              left: trackWidth * progress,
              backgroundColor: colors.accent,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingVertical: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    flex: 1,
    fontWeight: '850',
  },
  value: {
    fontWeight: '900',
  },
  trackArea: {
    height: 38,
    justifyContent: 'center',
  },
  trackBase: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    height: 8,
    borderRadius: 999,
  },
  thumb: {
    position: 'absolute',
    width: 28,
    height: 28,
    marginLeft: -14,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.88)',
  },
});