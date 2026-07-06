import { Tabs } from 'expo-router';

import { FloatingTabBar } from '@/components/ui/FloatingTabBar';
import { WallpaperLayer } from '@/design-system/wallpaper';
import { useSettingsStore } from '@/store/settingsStore';

export default function TabLayout() {
  const theme = useSettingsStore((state) => state.theme);
  const isDark = theme === 'dark';

  return (
    <WallpaperLayer dark={isDark}>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          sceneStyle: {
            backgroundColor: 'transparent',
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="explore" options={{ title: 'Training' }} />
        <Tabs.Screen name="reading" options={{ title: 'Reading' }} />
        <Tabs.Screen name="voice" options={{ title: 'Voice' }} />
        <Tabs.Screen name="weak" options={{ title: 'Weak' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      </Tabs>
    </WallpaperLayer>
  );
}