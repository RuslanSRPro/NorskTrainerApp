import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';

export type WallpaperKey = 'fjord' | 'mountains' | 'aurora' | 'forest' | 'winter';

const WALLPAPER_KEY = 'norsk_trainer_wallpaper';
const CUSTOM_WALLPAPER_URI_KEY = 'norsk_trainer_custom_wallpaper_uri';

export function useWallpaper() {
  const [wallpaper, setWallpaperState] = useState<WallpaperKey>('fjord');
  const [customUri, setCustomUriState] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      AsyncStorage.getItem(WALLPAPER_KEY),
      AsyncStorage.getItem(CUSTOM_WALLPAPER_URI_KEY),
    ]).then(([savedWallpaper, savedCustomUri]) => {
      if (!mounted) return;

      if (
        savedWallpaper === 'fjord' ||
        savedWallpaper === 'mountains' ||
        savedWallpaper === 'aurora' ||
        savedWallpaper === 'forest' ||
        savedWallpaper === 'winter'
      ) {
        setWallpaperState(savedWallpaper);
      }

      if (savedCustomUri) {
        setCustomUriState(savedCustomUri);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const setWallpaper = useCallback(async (next: WallpaperKey) => {
    setWallpaperState(next);
    setCustomUriState(null);
    await AsyncStorage.setItem(WALLPAPER_KEY, next);
    await AsyncStorage.removeItem(CUSTOM_WALLPAPER_URI_KEY);
  }, []);

  const pickCustomWallpaper = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      return { ok: false as const, reason: 'permission-denied' as const };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
      aspect: [9, 16],
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return { ok: false as const, reason: 'cancelled' as const };
    }

    const uri = result.assets[0].uri;

    setCustomUriState(uri);
    await AsyncStorage.setItem(CUSTOM_WALLPAPER_URI_KEY, uri);

    return { ok: true as const, uri };
  }, []);

  return {
    wallpaper,
    customUri,
    setWallpaper,
    pickCustomWallpaper,
  };
}
