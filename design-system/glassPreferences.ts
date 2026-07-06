import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'glass_preferences_v1';

export type GlassStyleName = 'ultraThin' | 'thin' | 'regular' | 'thick';

export type GlassPreferences = {
  style: GlassStyleName;
  opacity: number;
  blur: number;
  glow: number;
  refraction: number;
};

type GlassPreferencesState = GlassPreferences & {
  loading: boolean;

  load: () => Promise<void>;

  setGlassStyle: (style: GlassStyleName) => Promise<void>;
  setOpacity: (value: number) => Promise<void>;
  setBlur: (value: number) => Promise<void>;
  setGlow: (value: number) => Promise<void>;
  setRefraction: (value: number) => Promise<void>;
};

const PRESETS: Record<GlassStyleName, GlassPreferences> = {
  ultraThin: {
    style: 'ultraThin',
    opacity: 0.28,
    blur: 0.65,
    glow: 0.55,
    refraction: 0.55,
  },

  thin: {
    style: 'thin',
    opacity: 0.48,
    blur: 0.82,
    glow: 0.78,
    refraction: 0.78,
  },

  regular: {
    style: 'regular',
    opacity: 0.78,
    blur: 1,
    glow: 1,
    refraction: 1,
  },

  thick: {
    style: 'thick',
    opacity: 1.15,
    blur: 1.18,
    glow: 1.18,
    refraction: 1.18,
  },
};

const DEFAULTS: GlassPreferences = PRESETS.regular;

async function persist(state: GlassPreferences) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeStyle(value: unknown): GlassStyleName {
  if (
    value === 'ultraThin' ||
    value === 'thin' ||
    value === 'regular' ||
    value === 'thick'
  ) {
    return value;
  }

  return DEFAULTS.style;
}

export const useGlassPreferences = create<GlassPreferencesState>((set, get) => ({
  ...DEFAULTS,

  loading: false,

  async load() {
    try {
      set({ loading: true });

      const raw = await AsyncStorage.getItem(STORAGE_KEY);

      if (!raw) {
        set({ ...DEFAULTS, loading: false });
        return;
      }

      const saved = JSON.parse(raw);

      set({
        style: normalizeStyle(saved.style),
        opacity: normalizeNumber(saved.opacity, DEFAULTS.opacity),
        blur: normalizeNumber(saved.blur, DEFAULTS.blur),
        glow: normalizeNumber(saved.glow, DEFAULTS.glow),
        refraction: normalizeNumber(saved.refraction, DEFAULTS.refraction),
        loading: false,
      });
    } catch {
      set({ ...DEFAULTS, loading: false });
    }
  },

  async setGlassStyle(style) {
    const next = PRESETS[style];

    set(next);
    await persist(next);
  },

  async setOpacity(value) {
    const next = { ...get(), opacity: value };

    set({ opacity: value });
    await persist({
      style: next.style,
      opacity: next.opacity,
      blur: next.blur,
      glow: next.glow,
      refraction: next.refraction,
    });
  },

  async setBlur(value) {
    const next = { ...get(), blur: value };

    set({ blur: value });
    await persist({
      style: next.style,
      opacity: next.opacity,
      blur: next.blur,
      glow: next.glow,
      refraction: next.refraction,
    });
  },

  async setGlow(value) {
    const next = { ...get(), glow: value };

    set({ glow: value });
    await persist({
      style: next.style,
      opacity: next.opacity,
      blur: next.blur,
      glow: next.glow,
      refraction: next.refraction,
    });
  },

  async setRefraction(value) {
    const next = { ...get(), refraction: value };

    set({ refraction: value });
    await persist({
      style: next.style,
      opacity: next.opacity,
      blur: next.blur,
      glow: next.glow,
      refraction: next.refraction,
    });
  },
}));