export const glassTokens = {
  blur: {
    soft: 58,
    frosted: 82,
    liquid: 100,
    crystal: 100,
    ultra: 100,
  },

  material: {
    hero: {
      blur: 100,
      tint: 'cardTint',
      shadow: 'hero',
      glow: true,
      bottomDepth: true,
      sideRefraction: true,
      density: 0.92,
      highlight: 1.42,
      edge: 1.55,
      lens: 1.34,
    },

    card: {
      blur: 100,
      tint: 'cardTint',
      shadow: 'card',
      glow: true,
      bottomDepth: true,
      sideRefraction: true,
      density: 0.82,
      highlight: 1.18,
      edge: 1.24,
      lens: 1.14,
    },

    tile: {
      blur: 90,
      tint: 'tileTint',
      shadow: 'tile',
      glow: true,
      bottomDepth: true,
      sideRefraction: true,
      density: 0.62,
      highlight: 1.02,
      edge: 1.05,
      lens: 0.96,
    },

    light: {
      blur: 82,
      tint: 'buttonTint',
      shadow: 'button',
      glow: true,
      bottomDepth: true,
      sideRefraction: true,
      density: 0.58,
      highlight: 1,
      edge: 1,
      lens: 0.88,
    },

    floating: {
      blur: 100,
      tint: 'tabBarTint',
      shadow: 'floating',
      glow: true,
      bottomDepth: true,
      sideRefraction: true,
      density: 0.56,
      highlight: 1.65,
      edge: 1.6,
      lens: 1.38,
    },

    tabBar: {
      blur: 100,
      tint: 'tabBarTint',
      shadow: 'tabBar',
      glow: true,
      bottomDepth: true,
      sideRefraction: true,
      density: 0.52,
      highlight: 1.72,
      edge: 1.7,
      lens: 1.42,
    },

    button: {
      blur: 90,
      tint: 'buttonTint',
      shadow: 'button',
      glow: true,
      bottomDepth: true,
      sideRefraction: true,
      density: 0.72,
      highlight: 1.22,
      edge: 1.22,
      lens: 1,
    },

    solid: {
      blur: 90,
      tint: 'buttonTint',
      shadow: 'button',
      glow: true,
      bottomDepth: true,
      sideRefraction: true,
      density: 0.78,
      highlight: 1.2,
      edge: 1.14,
      lens: 0.96,
    },

    overlay: {
      blur: 100,
      tint: 'sheetTint',
      shadow: 'overlay',
      glow: true,
      bottomDepth: true,
      sideRefraction: true,
      density: 0.9,
      highlight: 1.45,
      edge: 1.48,
      lens: 1.32,
    },

    badge: {
      blur: 96,
      tint: 'avatarTint',
      shadow: 'button',
      glow: true,
      bottomDepth: true,
      sideRefraction: true,
      density: 0.74,
      highlight: 1.35,
      edge: 1.32,
      lens: 1.12,
    },
  },

  shape: {
    hero: {
      radius: 28,
      highlightInset: 10,
      glowHeight: 84,
      depthHeight: 74,
    },

    card: {
      radius: 26,
      highlightInset: 12,
      glowHeight: 76,
      depthHeight: 68,
    },

    tile: {
      radius: 20,
      highlightInset: 8,
      glowHeight: 54,
      depthHeight: 46,
    },

    capsule: {
      radius: 999,
      highlightInset: 10,
      glowHeight: 38,
      depthHeight: 36,
    },

    circle: {
      radius: 999,
      highlightInset: 6,
      glowHeight: 30,
      depthHeight: 28,
    },

    tabBar: {
      radius: 31,
      highlightInset: 16,
      glowHeight: 50,
      depthHeight: 46,
    },

    sheet: {
      radius: 30,
      highlightInset: 16,
      glowHeight: 80,
      depthHeight: 72,
    },

    badge: {
      radius: 18,
      highlightInset: 6,
      glowHeight: 34,
      depthHeight: 30,
    },
  },

  radius: {
    card: 26,
    button: 999,
    icon: 22,
    tabBar: 31,
    sheet: 30,
    avatar: 28,
  },

  light: {
    cardTint: 'rgba(255,255,255,0.044)',
    tileTint: 'rgba(255,255,255,0.034)',
    buttonTint: 'rgba(255,255,255,0.052)',
    iconTint: 'rgba(255,255,255,0.048)',
    tabBarTint: 'rgba(255,255,255,0.050)',
    sheetTint: 'rgba(255,255,255,0.060)',
    avatarTint: 'rgba(255,255,255,0.052)',

    border: 'rgba(255,255,255,0.28)',
    edge: 'rgba(255,255,255,0.52)',

    iconInactive: 'rgba(78,87,102,0.68)',
    shadow: 'rgba(8,18,32,0.34)',
  },

  dark: {
    cardTint: 'rgba(255,255,255,0.044)',
    tileTint: 'rgba(255,255,255,0.036)',
    buttonTint: 'rgba(255,255,255,0.046)',
    iconTint: 'rgba(255,255,255,0.040)',
    tabBarTint: 'rgba(255,255,255,0.050)',
    sheetTint: 'rgba(255,255,255,0.060)',
    avatarTint: 'rgba(255,255,255,0.050)',

    border: 'rgba(255,255,255,0.15)',
    edge: 'rgba(255,255,255,0.24)',

    iconInactive: 'rgba(255,255,255,0.58)',
    shadow: 'rgba(0,0,0,0.62)',
  },

  shadow: {
    hero: {
      opacity: 0.32,
      radius: 46,
      offsetY: 26,
      elevation: 20,
    },

    card: {
      opacity: 0.26,
      radius: 38,
      offsetY: 22,
      elevation: 16,
    },

    tile: {
      opacity: 0.12,
      radius: 20,
      offsetY: 8,
      elevation: 8,
    },

    button: {
      opacity: 0.18,
      radius: 24,
      offsetY: 10,
      elevation: 10,
    },

    floating: {
      opacity: 0.3,
      radius: 42,
      offsetY: 20,
      elevation: 18,
    },

    tabBar: {
      opacity: 0.32,
      radius: 46,
      offsetY: 22,
      elevation: 20,
    },

    overlay: {
      opacity: 0.34,
      radius: 48,
      offsetY: 26,
      elevation: 22,
    },
  },

  surface: {
    hero: {
      material: 'hero',
      shape: 'hero',
    },

    card: {
      material: 'card',
      shape: 'card',
    },

    tile: {
      material: 'tile',
      shape: 'tile',
    },

    button: {
      material: 'button',
      shape: 'capsule',
    },

    icon: {
      material: 'light',
      shape: 'circle',
    },

    tabBar: {
      material: 'tabBar',
      shape: 'tabBar',
    },

    tabActive: {
      material: 'floating',
      shape: 'capsule',
    },

    avatar: {
      material: 'floating',
      shape: 'circle',
    },

    sheet: {
      material: 'overlay',
      shape: 'sheet',
    },

    badge: {
      material: 'badge',
      shape: 'badge',
    },
  },

  gradient: {
    lightSurface: [
      'rgba(255,255,255,0.115)',
      'rgba(255,255,255,0.032)',
      'rgba(255,255,255,0.006)',
    ],

    darkSurface: [
      'rgba(255,255,255,0.085)',
      'rgba(255,255,255,0.026)',
      'rgba(255,255,255,0.006)',
    ],

    highlight: [
      'rgba(255,255,255,1.00)',
      'rgba(255,255,255,0.42)',
      'rgba(255,255,255,0.00)',
    ],

    innerGlow: [
      'rgba(255,255,255,0.38)',
      'rgba(255,255,255,0.10)',
      'rgba(255,255,255,0.00)',
    ],

    bottomDepth: [
      'rgba(0,0,0,0.00)',
      'rgba(0,0,0,0.030)',
      'rgba(0,0,0,0.086)',
    ],

    sideRefraction: [
      'rgba(255,255,255,0.00)',
      'rgba(255,255,255,0.30)',
      'rgba(255,255,255,0.00)',
    ],

    lensShadow: [
      'rgba(0,0,0,0.00)',
      'rgba(0,0,0,0.026)',
      'rgba(0,0,0,0.078)',
    ],

    fresnelTop: [
      'rgba(255,255,255,0.86)',
      'rgba(255,255,255,0.22)',
      'rgba(255,255,255,0.00)',
    ],

    fresnelBottom: [
      'rgba(255,255,255,0.00)',
      'rgba(0,0,0,0.026)',
      'rgba(0,0,0,0.076)',
    ],

    microNoise: [
      'rgba(255,255,255,0.018)',
      'rgba(255,255,255,0.000)',
      'rgba(0,0,0,0.016)',
    ],

    cornerSpark: [
      'rgba(255,255,255,0.72)',
      'rgba(255,255,255,0.12)',
      'rgba(255,255,255,0.00)',
    ],
  },

  animation: {
    pressScale: 0.97,
    iconPressScale: 0.94,
    pressOpacity: 0.92,
  },
} as const;

export type GlassSurfaceVariant = keyof typeof glassTokens.surface;
export type GlassMaterialVariant = keyof typeof glassTokens.material;
export type GlassShapeVariant = keyof typeof glassTokens.shape;
export type GlassShadowVariant = keyof typeof glassTokens.shadow;