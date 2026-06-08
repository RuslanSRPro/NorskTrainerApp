import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function RootLayout() {
  const { initialize, initialized, session } = useAuthStore();
  const router   = useRouter();
  const segments = useSegments();

  // Initialize auth once on app start
  useEffect(() => {
    initialize();
  }, []);

  // Redirect based on auth state
  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === 'login';

    if (!session && !inAuthGroup) {
      // Not logged in — go to login
      router.replace('/login');
    } else if (session && inAuthGroup) {
      // Logged in — go to app
      router.replace('/(tabs)');
    }
  }, [initialized, session, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}