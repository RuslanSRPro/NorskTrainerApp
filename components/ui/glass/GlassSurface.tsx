import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import {
  GlassMaterialVariant,
  GlassShapeVariant,
  GlassSurfaceVariant,
  glassTokens,
} from '@/design-system/glass';
import { getGlassDensity, getGlassReflectionOpacity } from '@/design-system/glassEngine';
import { useGlassPreferences } from '@/design-system/glassPreferences';
import { useWallpaper } from '@/design-system/wallpaper';

import { GlassMaterial } from './GlassMaterial';

type Props = {
  children?: ReactNode;
  variant?: GlassSurfaceVariant;
  material?: GlassMaterialVariant;
  shape?: GlassShapeVariant;
  dark?: boolean;
  intensity?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  surfaceTint?: string;
  borderColor?: string;
  edgeColor?: string;
  gradientColors?: readonly string[];
  shadow?: boolean;
  highlight?: boolean;
  glow?: boolean;
  edge?: boolean;
  border?: boolean;
  bottomDepth?: boolean;
  sideRefraction?: boolean;
};

function tintFromAdaptiveGlass(
  material: GlassMaterialVariant,
  dark: boolean,
  adaptive: ReturnType<typeof useWallpaper>['adaptiveGlass'],
) {
  if (dark) return undefined;

  if (material === 'floating') return adaptive.floatingTint;
  if (material === 'tabBar') return adaptive.floatingTint;
  if (material === 'light') return adaptive.lightTint;
  if (material === 'button') return adaptive.solidTint;
  if (material === 'solid') return adaptive.solidTint;
  if (material === 'tile') return adaptive.lightTint;

  return adaptive.tint;
}

export function GlassSurface({
  children,
  variant = 'card',
  material,
  shape,
  dark = false,
  intensity,
  radius,
  style,
  contentStyle,
  surfaceTint,
  borderColor,
  edgeColor,
  gradientColors,
  shadow = true,
  highlight = true,
  glow,
  edge = true,
  border = true,
  bottomDepth,
  sideRefraction,
}: Props) {
  const { adaptiveGlass } = useWallpaper();
  const glassPrefs = useGlassPreferences();

  const surfacePreset = glassTokens.surface[variant];

  const finalMaterialName = material ?? surfacePreset.material;
  const finalShapeName = shape ?? surfacePreset.shape;

  const materialToken = glassTokens.material[finalMaterialName];
  const shapeToken = glassTokens.shape[finalShapeName];

  const themeMaterial = dark ? glassTokens.dark : glassTokens.light;
  const shadowToken = glassTokens.shadow[materialToken.shadow];

  const densityMultiplier = getGlassDensity(variant);
  const reflectionOpacity = getGlassReflectionOpacity(variant);

  const finalRadius = radius ?? shapeToken.radius;
  const baseIntensity = intensity ?? materialToken.blur;
  const finalIntensity = Math.max(0, Math.min(100, baseIntensity * glassPrefs.blur));

  const tintKey = materialToken.tint as keyof typeof themeMaterial;
  const adaptiveTint = tintFromAdaptiveGlass(finalMaterialName, dark, adaptiveGlass);

  const finalTint = surfaceTint ?? adaptiveTint ?? themeMaterial[tintKey];
  const finalBorder = borderColor ?? (!dark ? adaptiveGlass.border : themeMaterial.border);
  const finalEdge = edgeColor ?? (!dark ? adaptiveGlass.edge : themeMaterial.edge);

  const finalGradient =
    gradientColors ?? (dark ? glassTokens.gradient.darkSurface : glassTokens.gradient.lightSurface);

  const finalGlow = glow ?? materialToken.glow;
  const finalBottomDepth = bottomDepth ?? materialToken.bottomDepth;
  const finalSideRefraction = sideRefraction ?? materialToken.sideRefraction;

  const finalGlassOpacity = glassPrefs.opacity * densityMultiplier;

  const finalShadowOpacity = dark
    ? shadowToken.opacity * densityMultiplier
    : shadowToken.opacity * adaptiveGlass.shadowStrength * densityMultiplier;

  return (
    <View
      style={[
        { borderRadius: finalRadius },
        shadow && {
          shadowColor: themeMaterial.shadow,
          shadowOpacity: finalShadowOpacity,
          shadowRadius: shadowToken.radius,
          shadowOffset: { width: 0, height: shadowToken.offsetY },
          elevation: shadowToken.elevation,
        },
        style,
      ]}
    >
      <GlassMaterial
        material={finalMaterialName}
        shape={finalShapeName}
        dark={dark}
        radius={finalRadius}
        intensity={finalIntensity}
        surfaceTint={finalTint}
        borderColor={finalBorder}
        edgeColor={finalEdge}
        gradientColors={finalGradient}
        contentStyle={contentStyle}
        highlight={highlight}
        glow={finalGlow}
        edge={edge}
        border={border}
        bottomDepth={finalBottomDepth}
        sideRefraction={finalSideRefraction}
        highlightStrength={adaptiveGlass.highlightStrength}
        glowStrength={adaptiveGlass.glowStrength * glassPrefs.glow}
        refractionStrength={adaptiveGlass.refractionStrength * glassPrefs.refraction}
        lensStrength={adaptiveGlass.lensStrength}
        glassOpacity={finalGlassOpacity}
        reflectionOpacity={reflectionOpacity}
      >
        {children}
      </GlassMaterial>
    </View>
  );
}