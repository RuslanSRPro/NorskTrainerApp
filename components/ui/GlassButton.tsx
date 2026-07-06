import { StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { glassTokens } from '@/design-system/glass';

import { GlassPressable } from './glass/GlassPressable';
import { GlassSurface } from './glass/GlassSurface';

type Props = {
  title: string;
  onPress?: () => void;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: StyleProp<ViewStyle>;
  accent?: string;
  dark?: boolean;
};

export function GlassButton({
  title,
  onPress,
  icon,
  variant = 'secondary',
  style,
  accent = '#0A84FF',
  dark = false,
}: Props) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';

  const textColor = isPrimary ? '#FFFFFF' : isDanger ? '#FF453A' : dark ? '#FFFFFF' : '#1D2939';

  const gradientColors = isDanger
    ? ['rgba(255,69,58,0.22)', 'rgba(255,255,255,0.08)', 'rgba(255,69,58,0.12)']
    : isPrimary
      ? [`${accent}E6`, `${accent}B8`, `${accent}8C`]
      : dark
        ? glassTokens.gradient.darkSurface
        : glassTokens.gradient.lightSurface;

  return (
    <GlassPressable
      onPress={onPress}
      pressedScale={glassTokens.animation.pressScale}
      style={style}
    >
      <GlassSurface
        material={isPrimary ? 'solid' : 'light'}
        shape="capsule"
        dark={dark}
        surfaceTint={isPrimary ? `${accent}66` : undefined}
        borderColor={isPrimary ? `${accent}88` : undefined}
        gradientColors={gradientColors}
        glow={!isDanger}
        sideRefraction={!isPrimary}
        bottomDepth
        contentStyle={styles.inner}
      >
        <Text style={[styles.text, { color: textColor }]}>
          {icon ? `${icon} ` : ''}
          {title}
        </Text>
      </GlassSurface>
    </GlassPressable>
  );
}

const styles = StyleSheet.create({
  inner: {
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    fontWeight: '900',
  },
});