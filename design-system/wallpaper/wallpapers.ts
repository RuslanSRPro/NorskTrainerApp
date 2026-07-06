import { ImageSourcePropType } from 'react-native';

export type WallpaperKey =
  | 'theme_light'
  | 'theme_reading'
  | 'theme_turquoise'
  | 'theme_dark'
  | 'mountains'
  | 'fjord_cloudy'
  | 'fjord_turquoise'
  | 'fjord_village'
  | 'aurora'
  | 'winter'
  | 'gradient_fjord'
  | 'gradient_aurora'
  | 'gradient_forest'
  | 'gradient_winter';

export type AdaptiveGlassConfig = {
  tint: string;
  floatingTint: string;
  lightTint: string;
  solidTint: string;

  border: string;
  edge: string;

  highlightStrength: number;
  glowStrength: number;
  shadowStrength: number;
  refractionStrength: number;
  lensStrength: number;

  backgroundOverlayLight: readonly [string, string, string];
  backgroundOverlayDark: readonly [string, string, string];
};

export type WallpaperConfig = {
  key: WallpaperKey;
  name: string;
  image?: ImageSourcePropType;
  palette: readonly [string, string, string];
  glass: AdaptiveGlassConfig;
  accentHint: string;
};

export const wallpapers: Record<WallpaperKey, WallpaperConfig> = {
  theme_light: {
    key: 'theme_light',
    name: 'Light',
    palette: ['#F6FBFF', '#DCEAF2', '#FFF1D8'],
    glass: {
      tint: 'rgba(245,250,255,0.105)',
      floatingTint: 'rgba(255,255,255,0.13)',
      lightTint: 'rgba(255,255,255,0.10)',
      solidTint: 'rgba(255,255,255,0.16)',
      border: 'rgba(255,255,255,0.42)',
      edge: 'rgba(255,255,255,0.50)',
      highlightStrength: 1.12,
      glowStrength: 1.05,
      shadowStrength: 0.92,
      refractionStrength: 1,
      lensStrength: 0.96,
      backgroundOverlayLight: [
        'rgba(255,255,255,0.20)',
        'rgba(255,255,255,0.04)',
        'rgba(255,238,210,0.14)',
      ],
      backgroundOverlayDark: [
        'rgba(5,12,22,0.66)',
        'rgba(5,12,22,0.46)',
        'rgba(5,12,22,0.82)',
      ],
    },
    accentHint: '#0A84FF',
  },

  theme_reading: {
    key: 'theme_reading',
    name: 'Reading',
    palette: ['#7A552D', '#C79A55', '#F5DEB5'],
    glass: {
      tint: 'rgba(210,150,72,0.095)',
      floatingTint: 'rgba(230,176,92,0.12)',
      lightTint: 'rgba(255,225,178,0.09)',
      solidTint: 'rgba(210,145,62,0.14)',
      border: 'rgba(255,230,190,0.32)',
      edge: 'rgba(255,230,190,0.38)',
      highlightStrength: 0.98,
      glowStrength: 1.06,
      shadowStrength: 1.05,
      refractionStrength: 1.04,
      lensStrength: 1,
      backgroundOverlayLight: [
        'rgba(255,245,225,0.16)',
        'rgba(255,255,255,0.03)',
        'rgba(90,54,22,0.15)',
      ],
      backgroundOverlayDark: [
        'rgba(32,18,8,0.66)',
        'rgba(32,18,8,0.46)',
        'rgba(32,18,8,0.82)',
      ],
    },
    accentHint: '#B87333',
  },

  theme_turquoise: {
    key: 'theme_turquoise',
    name: 'Turquoise',
    palette: ['#003B42', '#008A92', '#B9F2EF'],
    glass: {
      tint: 'rgba(70,220,220,0.095)',
      floatingTint: 'rgba(100,235,230,0.12)',
      lightTint: 'rgba(180,250,245,0.09)',
      solidTint: 'rgba(0,170,180,0.15)',
      border: 'rgba(200,255,250,0.34)',
      edge: 'rgba(180,255,248,0.42)',
      highlightStrength: 1.02,
      glowStrength: 1.14,
      shadowStrength: 1.08,
      refractionStrength: 1.18,
      lensStrength: 1.1,
      backgroundOverlayLight: [
        'rgba(255,255,255,0.10)',
        'rgba(255,255,255,0.02)',
        'rgba(0,45,50,0.18)',
      ],
      backgroundOverlayDark: [
        'rgba(0,12,18,0.66)',
        'rgba(0,12,18,0.46)',
        'rgba(0,12,18,0.82)',
      ],
    },
    accentHint: '#00AEEF',
  },

  theme_dark: {
    key: 'theme_dark',
    name: 'Dark',
    palette: ['#050814', '#151B2D', '#3E4A68'],
    glass: {
      tint: 'rgba(255,255,255,0.052)',
      floatingTint: 'rgba(255,255,255,0.070)',
      lightTint: 'rgba(255,255,255,0.050)',
      solidTint: 'rgba(255,255,255,0.080)',
      border: 'rgba(255,255,255,0.18)',
      edge: 'rgba(255,255,255,0.26)',
      highlightStrength: 0.88,
      glowStrength: 0.95,
      shadowStrength: 1.24,
      refractionStrength: 0.9,
      lensStrength: 0.92,
      backgroundOverlayLight: [
        'rgba(255,255,255,0.04)',
        'rgba(255,255,255,0.00)',
        'rgba(5,8,18,0.24)',
      ],
      backgroundOverlayDark: [
        'rgba(2,4,10,0.74)',
        'rgba(2,4,10,0.58)',
        'rgba(2,4,10,0.90)',
      ],
    },
    accentHint: '#64D2FF',
  },

  mountains: {
    key: 'mountains',
    name: 'Mountains',
    image: require('../../assets/wallpapers/mountains.jpg'),
    palette: ['#3B5F76', '#86AFC8', '#E7F0F5'],
    glass: {
      tint: 'rgba(120,185,220,0.060)',
      floatingTint: 'rgba(145,205,238,0.085)',
      lightTint: 'rgba(205,235,250,0.060)',
      solidTint: 'rgba(255,255,255,0.115)',
      border: 'rgba(255,255,255,0.34)',
      edge: 'rgba(255,255,255,0.46)',
      highlightStrength: 1.12,
      glowStrength: 1.04,
      shadowStrength: 1.12,
      refractionStrength: 1.08,
      lensStrength: 1.05,
      backgroundOverlayLight: [
        'rgba(255,255,255,0.02)',
        'rgba(255,255,255,0.00)',
        'rgba(4,18,30,0.18)',
      ],
      backgroundOverlayDark: [
        'rgba(3,10,18,0.58)',
        'rgba(3,10,18,0.42)',
        'rgba(3,10,18,0.78)',
      ],
    },
    accentHint: '#5E9FE0',
  },

  fjord_cloudy: {
    key: 'fjord_cloudy',
    name: 'Fjord Cloudy',
    image: require('../../assets/wallpapers/fjord_cloudy.jpg'),
    palette: ['#27404A', '#6F98A6', '#DCE9EC'],
    glass: {
      tint: 'rgba(155,210,225,0.060)',
      floatingTint: 'rgba(175,225,238,0.085)',
      lightTint: 'rgba(220,245,250,0.058)',
      solidTint: 'rgba(255,255,255,0.110)',
      border: 'rgba(255,255,255,0.34)',
      edge: 'rgba(255,255,255,0.44)',
      highlightStrength: 1.06,
      glowStrength: 1.0,
      shadowStrength: 1.16,
      refractionStrength: 1.02,
      lensStrength: 1.08,
      backgroundOverlayLight: [
        'rgba(255,255,255,0.04)',
        'rgba(255,255,255,0.00)',
        'rgba(5,20,28,0.20)',
      ],
      backgroundOverlayDark: [
        'rgba(3,10,16,0.62)',
        'rgba(3,10,16,0.46)',
        'rgba(3,10,16,0.82)',
      ],
    },
    accentHint: '#64D2FF',
  },

  fjord_turquoise: {
    key: 'fjord_turquoise',
    name: 'Fjord Turquoise',
    image: require('../../assets/wallpapers/fjord_turquoise.jpg'),
    palette: ['#1A6B78', '#53B6C8', '#E7F7FA'],
    glass: {
      tint: 'rgba(70,220,240,0.060)',
      floatingTint: 'rgba(110,235,250,0.085)',
      lightTint: 'rgba(190,250,255,0.060)',
      solidTint: 'rgba(100,210,255,0.110)',
      border: 'rgba(220,255,255,0.34)',
      edge: 'rgba(200,255,255,0.48)',
      highlightStrength: 1.12,
      glowStrength: 1.14,
      shadowStrength: 1.06,
      refractionStrength: 1.18,
      lensStrength: 1.08,
      backgroundOverlayLight: [
        'rgba(255,255,255,0.03)',
        'rgba(255,255,255,0.00)',
        'rgba(0,35,45,0.16)',
      ],
      backgroundOverlayDark: [
        'rgba(0,12,20,0.58)',
        'rgba(0,12,20,0.42)',
        'rgba(0,12,20,0.78)',
      ],
    },
    accentHint: '#00AEEF',
  },

  fjord_village: {
    key: 'fjord_village',
    name: 'Fjord Village',
    image: require('../../assets/wallpapers/fjord_village.jpg'),
    palette: ['#2F5668', '#87B4C7', '#EAF4F7'],
    glass: {
      tint: 'rgba(155,215,235,0.060)',
      floatingTint: 'rgba(180,232,246,0.085)',
      lightTint: 'rgba(225,248,252,0.060)',
      solidTint: 'rgba(255,255,255,0.115)',
      border: 'rgba(255,255,255,0.36)',
      edge: 'rgba(255,255,255,0.46)',
      highlightStrength: 1.08,
      glowStrength: 1.05,
      shadowStrength: 1.08,
      refractionStrength: 1.08,
      lensStrength: 1.06,
      backgroundOverlayLight: [
        'rgba(255,255,255,0.03)',
        'rgba(255,255,255,0.00)',
        'rgba(5,22,34,0.17)',
      ],
      backgroundOverlayDark: [
        'rgba(3,10,18,0.60)',
        'rgba(3,10,18,0.44)',
        'rgba(3,10,18,0.80)',
      ],
    },
    accentHint: '#5E9FE0',
  },

  aurora: {
    key: 'aurora',
    name: 'Aurora',
    image: require('../../assets/wallpapers/aurora.jpg'),
    palette: ['#10192D', '#26535B', '#8ED6C5'],
    glass: {
      tint: 'rgba(95,230,210,0.060)',
      floatingTint: 'rgba(120,235,225,0.085)',
      lightTint: 'rgba(180,245,230,0.055)',
      solidTint: 'rgba(100,210,255,0.105)',
      border: 'rgba(200,255,245,0.30)',
      edge: 'rgba(180,255,240,0.42)',
      highlightStrength: 1.0,
      glowStrength: 1.16,
      shadowStrength: 1.2,
      refractionStrength: 1.24,
      lensStrength: 1.14,
      backgroundOverlayLight: [
        'rgba(255,255,255,0.00)',
        'rgba(20,40,70,0.08)',
        'rgba(5,8,18,0.28)',
      ],
      backgroundOverlayDark: [
        'rgba(3,5,14,0.66)',
        'rgba(3,5,14,0.52)',
        'rgba(3,5,14,0.86)',
      ],
    },
    accentHint: '#64D2FF',
  },

  winter: {
    key: 'winter',
    name: 'Winter',
    image: require('../../assets/wallpapers/winter.jpg'),
    palette: ['#D8E7F2', '#F5F8FB', '#B7CBDC'],
    glass: {
      tint: 'rgba(245,248,251,0.085)',
      floatingTint: 'rgba(255,255,255,0.105)',
      lightTint: 'rgba(255,255,255,0.075)',
      solidTint: 'rgba(255,255,255,0.135)',
      border: 'rgba(255,255,255,0.42)',
      edge: 'rgba(255,255,255,0.52)',
      highlightStrength: 1.16,
      glowStrength: 1.1,
      shadowStrength: 0.96,
      refractionStrength: 1.0,
      lensStrength: 0.95,
      backgroundOverlayLight: [
        'rgba(255,255,255,0.10)',
        'rgba(255,255,255,0.02)',
        'rgba(180,210,230,0.12)',
      ],
      backgroundOverlayDark: [
        'rgba(6,14,24,0.56)',
        'rgba(6,14,24,0.42)',
        'rgba(6,14,24,0.76)',
      ],
    },
    accentHint: '#64A9E8',
  },

  gradient_fjord: {
    key: 'gradient_fjord',
    name: 'Classic Fjord',
    palette: ['#8FB8D8', '#C9DDEC', '#EEF4F8'],
    glass: {
      tint: 'rgba(210,232,246,0.10)',
      floatingTint: 'rgba(220,238,250,0.12)',
      lightTint: 'rgba(235,247,255,0.10)',
      solidTint: 'rgba(255,255,255,0.16)',
      border: 'rgba(255,255,255,0.38)',
      edge: 'rgba(255,255,255,0.42)',
      highlightStrength: 1,
      glowStrength: 1,
      shadowStrength: 1,
      refractionStrength: 1,
      lensStrength: 1,
      backgroundOverlayLight: [
        'rgba(255,255,255,0.16)',
        'rgba(255,255,255,0.04)',
        'rgba(255,255,255,0.24)',
      ],
      backgroundOverlayDark: [
        'rgba(5,12,22,0.66)',
        'rgba(5,12,22,0.46)',
        'rgba(5,12,22,0.82)',
      ],
    },
    accentHint: '#0A84FF',
  },

  gradient_aurora: {
    key: 'gradient_aurora',
    name: 'Classic Aurora',
    palette: ['#162536', '#26535B', '#8ED6C5'],
    glass: {
      tint: 'rgba(142,214,197,0.095)',
      floatingTint: 'rgba(130,220,210,0.12)',
      lightTint: 'rgba(180,245,230,0.09)',
      solidTint: 'rgba(100,210,255,0.15)',
      border: 'rgba(200,255,245,0.32)',
      edge: 'rgba(180,255,240,0.36)',
      highlightStrength: 0.9,
      glowStrength: 1.08,
      shadowStrength: 1.16,
      refractionStrength: 1.08,
      lensStrength: 1.08,
      backgroundOverlayLight: [
        'rgba(255,255,255,0.06)',
        'rgba(255,255,255,0.02)',
        'rgba(5,15,25,0.22)',
      ],
      backgroundOverlayDark: [
        'rgba(5,12,22,0.66)',
        'rgba(5,12,22,0.46)',
        'rgba(5,12,22,0.82)',
      ],
    },
    accentHint: '#64D2FF',
  },

  gradient_forest: {
    key: 'gradient_forest',
    name: 'Classic Forest',
    palette: ['#244236', '#6E9B7B', '#DDEBDD'],
    glass: {
      tint: 'rgba(181,222,194,0.095)',
      floatingTint: 'rgba(190,232,204,0.115)',
      lightTint: 'rgba(220,245,225,0.09)',
      solidTint: 'rgba(48,209,88,0.14)',
      border: 'rgba(235,255,240,0.32)',
      edge: 'rgba(220,255,230,0.36)',
      highlightStrength: 0.92,
      glowStrength: 1,
      shadowStrength: 1.1,
      refractionStrength: 1.05,
      lensStrength: 1.08,
      backgroundOverlayLight: [
        'rgba(255,255,255,0.12)',
        'rgba(255,255,255,0.02)',
        'rgba(10,25,16,0.18)',
      ],
      backgroundOverlayDark: [
        'rgba(5,12,22,0.66)',
        'rgba(5,12,22,0.46)',
        'rgba(5,12,22,0.82)',
      ],
    },
    accentHint: '#30D158',
  },

  gradient_winter: {
    key: 'gradient_winter',
    name: 'Classic Winter',
    palette: ['#D8E7F2', '#F5F8FB', '#B7CBDC'],
    glass: {
      tint: 'rgba(245,248,251,0.12)',
      floatingTint: 'rgba(255,255,255,0.14)',
      lightTint: 'rgba(255,255,255,0.11)',
      solidTint: 'rgba(255,255,255,0.17)',
      border: 'rgba(255,255,255,0.42)',
      edge: 'rgba(255,255,255,0.46)',
      highlightStrength: 1.05,
      glowStrength: 1.04,
      shadowStrength: 0.92,
      refractionStrength: 1,
      lensStrength: 0.96,
      backgroundOverlayLight: [
        'rgba(255,255,255,0.20)',
        'rgba(255,255,255,0.04)',
        'rgba(180,210,230,0.14)',
      ],
      backgroundOverlayDark: [
        'rgba(5,12,22,0.66)',
        'rgba(5,12,22,0.46)',
        'rgba(5,12,22,0.82)',
      ],
    },
    accentHint: '#64A9E8',
  },
};

export const defaultWallpaperKey: WallpaperKey = 'theme_light';

export function isWallpaperKey(value: string | null): value is WallpaperKey {
  return typeof value === 'string' && value in wallpapers;
}