import type { GlassSurfaceVariant } from '@/design-system/glass';

export const glassEngine = {
  density: {
    default: 0.82,
    hero: 0.74,
    card: 0.78,
    tile: 0.58,
    tabBar: 0.66,
    tabActive: 1.05,
    sheet: 0.76,
  } satisfies Partial<Record<GlassSurfaceVariant | 'default', number>>,

  material: {
    alphaBase: 0.125,
    alphaMin: 0.008,
    alphaMax: 0.34,
    gradientMaxOpacity: 0.62,
  },

  reflection: {
    default: 0.055,
    hero: 0.05,
    card: 0.045,
    tile: 0.032,
    tabBar: 0.045,
    tabActive: 0.13,
    sheet: 0.05,
  } satisfies Partial<Record<GlassSurfaceVariant | 'default', number>>,

  light: {
    localLight: 0.075,
    localLightTile: 0.045,
    localLightFloating: 0.09,
    topEdge: 0.36,
    innerGlow: 0.38,
    sideRefraction: 0.18,
    bottomDepth: 0.23,
    lensShadow: 0.14,
  },

  rim: {
    opacityLow: 0.54,
    opacityHigh: 0.92,
    durationMs: 5600,
    driftX: 1.8,
    driftY: 1.2,
  },
};

export function getGlassDensity(variant: GlassSurfaceVariant) {
  return glassEngine.density[variant] ?? glassEngine.density.default;
}

export function getGlassReflectionOpacity(variant: GlassSurfaceVariant) {
  return glassEngine.reflection[variant] ?? glassEngine.reflection.default;
}