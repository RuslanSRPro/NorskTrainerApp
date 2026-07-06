import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { GlassMaterialVariant, GlassShapeVariant, glassTokens } from '@/design-system/glass';
import { glassEngine } from '@/design-system/glassEngine';

import { GlassReflection } from './GlassReflection';

type Props = {
  children?: ReactNode;
  material: GlassMaterialVariant;
  shape: GlassShapeVariant;
  dark?: boolean;
  radius: number;
  intensity: number;
  surfaceTint: string;
  borderColor: string;
  edgeColor: string;
  gradientColors: readonly string[];
  contentStyle?: StyleProp<ViewStyle>;
  highlight?: boolean;
  glow?: boolean;
  edge?: boolean;
  border?: boolean;
  bottomDepth?: boolean;
  sideRefraction?: boolean;
  highlightStrength?: number;
  glowStrength?: number;
  refractionStrength?: number;
  lensStrength?: number;
  glassOpacity?: number;
  reflectionOpacity?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function withAlpha(color: string, glassOpacity: number) {
  const safeOpacity = clamp(glassOpacity, 0.08, 1.35);

  const materialAlpha = clamp(
    safeOpacity * glassEngine.material.alphaBase,
    glassEngine.material.alphaMin,
    glassEngine.material.alphaMax,
  );

  const rgba = color.match(
    /rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/,
  );

  if (rgba) {
    const r = Number(rgba[1]);
    const g = Number(rgba[2]);
    const b = Number(rgba[3]);
    const originalA = Number(rgba[4]);
    const finalA = Math.max(originalA * safeOpacity, materialAlpha);

    return `rgba(${r},${g},${b},${clamp(finalA, 0, glassEngine.material.alphaMax)})`;
  }

  const rgb = color.match(
    /rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/,
  );

  if (rgb) {
    const r = Number(rgb[1]);
    const g = Number(rgb[2]);
    const b = Number(rgb[3]);

    return `rgba(${r},${g},${b},${materialAlpha})`;
  }

  return color;
}

export function GlassMaterial({
  children,
  material,
  shape,
  dark = false,
  radius,
  intensity,
  surfaceTint,
  borderColor,
  edgeColor,
  gradientColors,
  contentStyle,
  highlight = true,
  glow = true,
  edge = true,
  border = true,
  bottomDepth = true,
  sideRefraction = true,
  highlightStrength = 1,
  glowStrength = 1,
  refractionStrength = 1,
  lensStrength = 1,
  glassOpacity = 1,
  reflectionOpacity = glassEngine.reflection.default,
}: Props) {
  const materialToken = glassTokens.material[material];
  const shapeToken = glassTokens.shape[shape];

  const isFloating = material === 'floating' || material === 'tabBar';
  const isTile = material === 'tile';
  const isSolid = material === 'solid' || material === 'button';

  const safeOpacity = clamp(glassOpacity, 0.08, 1.35);

  const finalHighlight = highlightStrength * materialToken.highlight * safeOpacity;
  const finalGlow = glowStrength * materialToken.highlight * safeOpacity;
  const finalRefraction = refractionStrength * materialToken.edge;
  const finalLens = lensStrength * materialToken.lens * safeOpacity;

  const surfaceOpacity = clamp(
    materialToken.density * safeOpacity,
    0.025,
    glassEngine.material.gradientMaxOpacity,
  );

  const localLightOpacity = dark
    ? glassEngine.light.localLight * 0.8 * finalHighlight
    : isFloating
      ? glassEngine.light.localLightFloating * finalHighlight
      : isTile
        ? glassEngine.light.localLightTile * finalHighlight
        : glassEngine.light.localLight * finalHighlight;

  const topEdgeOpacity = dark
    ? glassEngine.light.topEdge * 0.72 * finalHighlight
    : glassEngine.light.topEdge * finalHighlight;

  const sideOpacity = dark
    ? glassEngine.light.sideRefraction * 0.64 * finalRefraction
    : glassEngine.light.sideRefraction * finalRefraction;

  const bottomOpacity = dark
    ? glassEngine.light.bottomDepth * 1.72 * finalLens
    : isSolid
      ? glassEngine.light.bottomDepth * 0.86 * finalLens
      : glassEngine.light.bottomDepth * finalLens;

  const lensOpacity = dark
    ? glassEngine.light.lensShadow * 1.9 * finalLens
    : isTile
      ? glassEngine.light.lensShadow * 0.78 * finalLens
      : glassEngine.light.lensShadow * finalLens;

  return (
    <BlurView
      intensity={intensity}
      tint={dark ? 'dark' : 'light'}
      style={[styles.blur, { borderRadius: radius }]}
    >
      <View
        style={[
          styles.inner,
          {
            borderRadius: radius,
            backgroundColor: withAlpha(surfaceTint, safeOpacity),
            borderColor: border ? withAlpha(borderColor, safeOpacity) : 'transparent',
            borderWidth: border ? 0.52 : 0,
          },
          contentStyle,
        ]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={gradientColors as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { opacity: surfaceOpacity }]}
        />

        {highlight ? (
          <>
            <LinearGradient
              pointerEvents="none"
              colors={[
                'rgba(255,255,255,0.24)',
                'rgba(255,255,255,0.065)',
                'rgba(255,255,255,0.00)',
              ]}
              start={{ x: 0.08, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={[
                styles.localLightOne,
                {
                  opacity: localLightOpacity,
                  borderTopLeftRadius: radius,
                  borderTopRightRadius: radius,
                },
              ]}
            />

            <LinearGradient
              pointerEvents="none"
              colors={[
                'rgba(255,255,255,0.00)',
                'rgba(255,255,255,0.085)',
                'rgba(255,255,255,0.00)',
              ]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.localLightTwo,
                {
                  opacity: localLightOpacity * 0.62,
                  borderRadius: radius,
                },
              ]}
            />

            <LinearGradient
              pointerEvents="none"
              colors={[
                'rgba(255,255,255,0.64)',
                'rgba(255,255,255,0.16)',
                'rgba(255,255,255,0.00)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.topEdge,
                {
                  left: shapeToken.highlightInset,
                  right: shapeToken.highlightInset,
                  opacity: Math.min(1, topEdgeOpacity),
                },
              ]}
            />
          </>
        ) : null}

        {glow ? (
          <LinearGradient
            pointerEvents="none"
            colors={[
              'rgba(255,255,255,0.095)',
              'rgba(255,255,255,0.025)',
              'rgba(255,255,255,0.00)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[
              styles.innerGlow,
              {
                height: shapeToken.glowHeight,
                opacity: Math.min(1, glassEngine.light.innerGlow * finalGlow),
                borderTopLeftRadius: radius,
                borderTopRightRadius: radius,
              },
            ]}
          />
        ) : null}

        {sideRefraction ? (
          <>
            <LinearGradient
              pointerEvents="none"
              colors={[
                'rgba(255,255,255,0.00)',
                'rgba(255,255,255,0.13)',
                'rgba(255,255,255,0.00)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.leftRefraction, { opacity: sideOpacity }]}
            />

            <LinearGradient
              pointerEvents="none"
              colors={[
                'rgba(255,255,255,0.00)',
                'rgba(255,255,255,0.10)',
                'rgba(255,255,255,0.00)',
              ]}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 0 }}
              style={[styles.rightRefraction, { opacity: sideOpacity * 0.68 }]}
            />
          </>
        ) : null}

        {bottomDepth ? (
          <LinearGradient
            pointerEvents="none"
            colors={[
              'rgba(0,0,0,0.00)',
              'rgba(0,0,0,0.022)',
              'rgba(0,0,0,0.064)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[
              styles.bottomDepth,
              {
                height: shapeToken.depthHeight,
                opacity: bottomOpacity,
                borderBottomLeftRadius: radius,
                borderBottomRightRadius: radius,
              },
            ]}
          />
        ) : null}

        <LinearGradient
          pointerEvents="none"
          colors={[
            'rgba(0,0,0,0.00)',
            'rgba(0,0,0,0.014)',
            'rgba(0,0,0,0.044)',
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

        {edge ? (
          <>
            <View
              pointerEvents="none"
              style={[
                styles.edgeLight,
                {
                  borderRadius: Math.max(radius - 1, 0),
                  borderColor: withAlpha(edgeColor, safeOpacity),
                  opacity: dark ? 0.34 : 0.48,
                },
              ]}
            />

            <View
              pointerEvents="none"
              style={[
                styles.outerEdgeGlow,
                {
                  borderRadius: Math.max(radius - 2, 0),
                  borderColor: withAlpha(edgeColor, safeOpacity),
                  opacity: dark ? 0.07 : 0.11,
                },
              ]}
            />

            <View
              pointerEvents="none"
              style={[
                styles.innerEdgeShadow,
                {
                  borderRadius: Math.max(radius - 3, 0),
                  opacity: dark ? 0.14 * safeOpacity : 0.07 * safeOpacity,
                },
              ]}
            />
          </>
        ) : null}

        <GlassReflection radius={radius} opacity={reflectionOpacity} enabled={highlight} />

        {children}
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  blur: {
    overflow: 'hidden',
  },
  inner: {
    position: 'relative',
    overflow: 'hidden',
  },
  localLightOne: {
    position: 'absolute',
    top: -18,
    left: -12,
    right: 30,
    height: 52,
  },
  localLightTwo: {
    position: 'absolute',
    top: 20,
    right: -34,
    width: 112,
    height: 78,
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    height: 1.1,
  },
  innerGlow: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
  },
  leftRefraction: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -18,
    width: 54,
  },
  rightRefraction: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: -20,
    width: 48,
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
  edgeLight: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderWidth: 0.5,
  },
  outerEdgeGlow: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderWidth: 0.75,
  },
  innerEdgeShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.11)',
  },
});