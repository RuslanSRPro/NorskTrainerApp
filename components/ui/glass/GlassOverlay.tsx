import { GlassView } from 'expo-glass-effect';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { GlassMaterialVariant, GlassShapeVariant, glassTokens } from '@/design-system/glass';
import { canUseNativeLiquidGlass } from '@/design-system/glassCapabilities';
import { GlassTone, glassSemantic } from '@/design-system/glassSemantic';

import { GlassSurface } from './GlassSurface';

type Props = {
  dark?: boolean;
  material?: GlassMaterialVariant;
  shape?: GlassShapeVariant;
  radius?: number;
  tone?: GlassTone;
  style?: StyleProp<ViewStyle>;
};

export function GlassOverlay({
  dark = false,
  material = 'card',
  shape = 'card',
  radius,
  tone = 'neutral',
  style,
}: Props) {
  const finalRadius = radius ?? glassTokens.shape[shape].radius;
  const semantic = glassSemantic[tone];
  const tint = dark ? semantic.darkTint : semantic.lightTint;

  if (canUseNativeLiquidGlass()) {
    return (
      <GlassView
        pointerEvents="none"
        glassEffectStyle={material === 'light' ? 'clear' : 'regular'}
        tintColor={tint}
        isInteractive={false}
        style={[StyleSheet.absoluteFill, { borderRadius: finalRadius }, style]}
      />
    );
  }

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <GlassSurface
        material={material}
        shape={shape}
        dark={dark}
        radius={finalRadius}
        surfaceTint={tint}
        borderColor={semantic.border}
        shadow={false}
        style={StyleSheet.absoluteFill}
        contentStyle={styles.fill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
