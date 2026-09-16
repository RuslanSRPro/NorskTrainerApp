import { ReactNode } from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

import { GlassMaterialVariant } from '@/design-system/glass';
import { GlassControlSize, glassControls } from '@/design-system/glassControls';
import { GlassTone, glassSemantic } from '@/design-system/glassSemantic';

import { GlassOverlay } from './GlassOverlay';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  children?: ReactNode;
  label?: string;
  dark?: boolean;
  tone?: GlassTone;
  size?: GlassControlSize;
  material?: GlassMaterialVariant;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  pressedScale?: number;
};

export function GlassControl({
  children,
  label,
  dark = false,
  tone = 'neutral',
  size = 'regular',
  material = 'button',
  style,
  contentStyle,
  textStyle,
  pressedScale = 0.97,
  disabled,
  hitSlop = 4,
  pressRetentionOffset = 12,
  accessibilityRole = 'button',
  ...pressableProps
}: Props) {
  const metrics = glassControls[size];
  const semantic = glassSemantic[tone];

  return (
    <Pressable
      {...pressableProps}
      disabled={disabled}
      hitSlop={hitSlop}
      pressRetentionOffset={pressRetentionOffset}
      accessibilityRole={accessibilityRole}
      style={({ pressed }) => [
        styles.touchHost,
        { minHeight: metrics.minTouchHeight },
        style,
        pressed && !disabled && { transform: [{ scale: pressedScale }] },
        disabled && styles.disabled,
      ]}
    >
      <View
        style={[
          styles.visual,
          {
            height: metrics.visualHeight,
            borderRadius: metrics.radius,
            paddingHorizontal: metrics.horizontalPadding,
          },
          contentStyle,
        ]}
      >
        <GlassOverlay
          dark={dark}
          material={material}
          shape={size === 'icon' ? 'circle' : 'capsule'}
          radius={metrics.radius}
          tone={tone}
        />
        {label ? (
          <Text style={[styles.text, { color: semantic.text, fontSize: metrics.fontSize }, textStyle]}>
            {label}
          </Text>
        ) : children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchHost: { justifyContent: 'center' },
  visual: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '800', textAlign: 'center' },
  disabled: { transform: [{ scale: 1 }] },
});
