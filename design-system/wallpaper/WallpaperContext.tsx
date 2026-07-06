import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';

import {
  AdaptiveGlassConfig,
  defaultWallpaperKey,
  isWallpaperKey,
  WallpaperKey,
  wallpapers,
} from './wallpapers';

const WALLPAPER_KEY_PREFIX = 'norsk_trainer_wallpaper';
const CUSTOM_WALLPAPER_URI_KEY_PREFIX = 'norsk_trainer_custom_wallpaper_uri';
const WALLPAPER_MODE_KEY_PREFIX = 'norsk_trainer_wallpaper_mode';

export type WallpaperMode = 'follow_theme' | 'built_in' | 'custom';

type PickCustomWallpaperResult =
  | { ok: true; uri: string }
  | { ok: false; reason: 'permission-denied' | 'cancelled' };

type WallpaperContextValue = {
  wallpaper: WallpaperKey;
  effectiveWallpaper: WallpaperKey;
  wallpaperMode: WallpaperMode;
  customUri: string | null;
  config: typeof wallpapers[WallpaperKey];
  adaptiveGlass: AdaptiveGlassConfig;

  setWallpaper: (next: WallpaperKey) => Promise<void>;
  setFollowTheme: () => Promise<void>;
  pickCustomWallpaper: () => Promise<PickCustomWallpaperResult>;
  clearCustomWallpaper: () => Promise<void>;
};

const WallpaperContext = createContext<WallpaperContextValue | null>(null);

type Props = {
  children: ReactNode;
};

function storageUserId(userId?: string | null) {
  return userId && userId !== 'anonymous' ? userId : 'anonymous';
}

function getWallpaperStorageKey(userId: string) {
  return `${WALLPAPER_KEY_PREFIX}_${userId}`;
}

function getCustomWallpaperStorageKey(userId: string) {
  return `${CUSTOM_WALLPAPER_URI_KEY_PREFIX}_${userId}`;
}

function getWallpaperModeStorageKey(userId: string) {
  return `${WALLPAPER_MODE_KEY_PREFIX}_${userId}`;
}

function themeToWallpaper(theme?: string): WallpaperKey {
  if (theme === 'dark') return 'theme_dark';
  if (theme === 'reading') return 'theme_reading';
  if (theme === 'turquoise') return 'theme_turquoise';
  return 'theme_light';
}

function isWallpaperMode(value: string | null): value is WallpaperMode {
  return value === 'follow_theme' || value === 'built_in' || value === 'custom';
}

export function WallpaperProvider({ children }: Props) {
  const authUserId = useAuthStore((state) => state.user?.id);
  const theme = useSettingsStore((state) => state.theme);

  const userId = storageUserId(authUserId);

  const [wallpaper, setWallpaperState] = useState<WallpaperKey>(defaultWallpaperKey);
  const [wallpaperMode, setWallpaperModeState] = useState<WallpaperMode>('built_in');
  const [customUri, setCustomUriState] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadWallpaper() {
      const [savedWallpaper, savedCustomUri, savedMode] = await Promise.all([
        AsyncStorage.getItem(getWallpaperStorageKey(userId)),
        AsyncStorage.getItem(getCustomWallpaperStorageKey(userId)),
        AsyncStorage.getItem(getWallpaperModeStorageKey(userId)),
      ]);

      if (!mounted) return;

      setWallpaperState(isWallpaperKey(savedWallpaper) ? savedWallpaper : defaultWallpaperKey);
      setCustomUriState(savedCustomUri || null);
      setWallpaperModeState(isWallpaperMode(savedMode) ? savedMode : 'built_in');
    }

    void loadWallpaper();

    return () => {
      mounted = false;
    };
  }, [userId]);

  const setWallpaper = useCallback(
    async (next: WallpaperKey) => {
      setWallpaperState(next);
      setWallpaperModeState('built_in');
      setCustomUriState(null);

      await AsyncStorage.setItem(getWallpaperStorageKey(userId), next);
      await AsyncStorage.setItem(getWallpaperModeStorageKey(userId), 'built_in');
      await AsyncStorage.removeItem(getCustomWallpaperStorageKey(userId));
    },
    [userId],
  );

  const setFollowTheme = useCallback(async () => {
    setWallpaperModeState('follow_theme');
    setCustomUriState(null);

    await AsyncStorage.setItem(getWallpaperModeStorageKey(userId), 'follow_theme');
    await AsyncStorage.removeItem(getCustomWallpaperStorageKey(userId));
  }, [userId]);

  const pickCustomWallpaper = useCallback(async (): Promise<PickCustomWallpaperResult> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      return { ok: false, reason: 'permission-denied' };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
      aspect: [9, 16],
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return { ok: false, reason: 'cancelled' };
    }

    const uri = result.assets[0].uri;

    setCustomUriState(uri);
    setWallpaperModeState('custom');

    await AsyncStorage.setItem(getCustomWallpaperStorageKey(userId), uri);
    await AsyncStorage.setItem(getWallpaperModeStorageKey(userId), 'custom');

    return { ok: true, uri };
  }, [userId]);

  const clearCustomWallpaper = useCallback(async () => {
    setCustomUriState(null);
    setWallpaperModeState('built_in');

    await AsyncStorage.removeItem(getCustomWallpaperStorageKey(userId));
    await AsyncStorage.setItem(getWallpaperModeStorageKey(userId), 'built_in');
  }, [userId]);

  const effectiveWallpaper = useMemo<WallpaperKey>(() => {
    if (wallpaperMode === 'follow_theme') return themeToWallpaper(theme);
    if (wallpaperMode === 'custom') return themeToWallpaper(theme);
    return wallpaper;
  }, [wallpaperMode, wallpaper, theme]);

  const value = useMemo<WallpaperContextValue>(
    () => ({
      wallpaper,
      effectiveWallpaper,
      wallpaperMode,
      customUri,
      config: wallpapers[effectiveWallpaper],
      adaptiveGlass: wallpapers[effectiveWallpaper].glass,
      setWallpaper,
      setFollowTheme,
      pickCustomWallpaper,
      clearCustomWallpaper,
    }),
    [
      wallpaper,
      effectiveWallpaper,
      wallpaperMode,
      customUri,
      setWallpaper,
      setFollowTheme,
      pickCustomWallpaper,
      clearCustomWallpaper,
    ],
  );

  return <WallpaperContext.Provider value={value}>{children}</WallpaperContext.Provider>;
}

export function useWallpaper() {
  const value = useContext(WallpaperContext);

  if (!value) {
    throw new Error('useWallpaper must be used inside WallpaperProvider');
  }

  return value;
}