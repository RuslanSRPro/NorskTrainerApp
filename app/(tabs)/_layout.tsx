import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home',
  explore: 'play-circle',
  reading: 'book',
  voice: 'mic',
  weak: 'flash',
  settings: 'settings',
};

function TabIcon({
  name,
  focused,
  accent,
}: {
  name: string;
  focused: boolean;
  accent: string;
}) {
  const iconName = ICONS[name] || 'ellipse';

  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons
        name={iconName}
        size={focused ? 25 : 23}
        color={focused ? accent : 'rgba(95,105,120,0.68)'}
      />
    </View>
  );
}

export default function TabLayout() {
  const { theme, themeName } = useTheme();
  const isDark = themeName === 'dark';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.accent,
        tabBarStyle: [
          styles.tabBar,
          {
            borderColor: isDark
              ? 'rgba(255,255,255,0.16)'
              : 'rgba(255,255,255,0.72)',
          },
        ],
        tabBarBackground: () => (
          <BlurView
            intensity={isDark ? 70 : 76}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="index" focused={focused} accent={theme.accent} />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: 'Training',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="explore" focused={focused} accent={theme.accent} />
          ),
        }}
      />

      <Tabs.Screen
        name="reading"
        options={{
          title: 'Reading',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="reading" focused={focused} accent={theme.accent} />
          ),
        }}
      />

      <Tabs.Screen
        name="voice"
        options={{
          title: 'Voice',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="voice" focused={focused} accent={theme.accent} />
          ),
        }}
      />

      <Tabs.Screen
        name="weak"
        options={{
          title: 'Weak',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="weak" focused={focused} accent={theme.accent} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="settings" focused={focused} accent={theme.accent} />
          ),
        }}
      />
    </Tabs>
  );
}

const TAB_BAR_HEIGHT = 62;

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: Platform.OS === 'ios' ? 12 : 10,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    borderTopWidth: 0,
    borderWidth: 0.8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.16)',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
  },
  tabItem: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
});
