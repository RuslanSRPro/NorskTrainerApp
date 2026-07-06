import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';

import { ThemeProvider } from '@/contexts/ThemeContext';
import { WallpaperProvider } from '@/design-system/wallpaper';
import { useAuthStore } from '@/store/authStore';

export default function RootLayout() {
  const { initialize, initialized, session } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === 'login';

    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [initialized, session, segments, router]);

  if (!initialized) return null;

  return (
    <ThemeProvider>
      <WallpaperProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </WallpaperProvider>
    </ThemeProvider>
  );
}