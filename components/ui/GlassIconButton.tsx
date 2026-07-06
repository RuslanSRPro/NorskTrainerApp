import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { glassTokens } from '@/design-system/glass';

import { GlassSurface } from './glass/GlassSurface';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  focused?: boolean;
  accent?: string;
  dark?: boolean;
};

export function GlassIconButton({
  icon,
  onPress,
  focused = false,
  accent = '#0A84FF',
  dark = false,
}: Props) {
  const material = dark ? glassTokens.dark : glassTokens.light;
  const iconColor = focused ? accent : material.iconInactive;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <GlassSurface
        material={focused ? 'floating' : 'light'}
        shape="circle"
        dark={dark}
        intensity={focused ? glassTokens.blur.crystal : glassTokens.blur.frosted}
        surfaceTint={focused ? material.buttonTint : 'transparent'}
        borderColor={focused ? `${accent}88` : 'transparent'}
        shadow={focused}
        glow={focused}
        edge={focused}
        highlight={focused}
        sideRefraction={focused}
        bottomDepth={focused}
        contentStyle={styles.inner}
      >
        <Ionicons name={icon} size={focused ? 25 : 23} color={iconColor} />
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    transform: [{ scale: glassTokens.animation.iconPressScale }],
    opacity: glassTokens.animation.pressOpacity,
  },
  inner: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});