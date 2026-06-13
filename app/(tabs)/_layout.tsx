import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { View, StyleSheet, Platform } from 'react-native';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home',
  explore: 'play-circle',
  reading: 'book',
  voice: 'mic',
  weak: 'flash',
  settings: 'person',
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const iconName = ICONS[name] || 'ellipse';
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons
        name={iconName}
        size={24}
        color={focused ? '#0EA5E9' : '#9CA3AF'}
      />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#0EA5E9',
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <BlurView
            intensity={60}
            tint="light"
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
          tabBarIcon: ({ focused }) => <TabIcon name="index" focused={focused} />,
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ focused }) => <TabIcon name="explore" focused={focused} />,
        }}
      />

      <Tabs.Screen
        name="reading"
        options={{
          title: 'Reading',
          tabBarIcon: ({ focused }) => <TabIcon name="reading" focused={focused} />,
        }}
      />

      <Tabs.Screen
        name="voice"
        options={{
          title: 'Voice',
          tabBarIcon: ({ focused }) => <TabIcon name="voice" focused={focused} />,
        }}
      />

      <Tabs.Screen
        name="weak"
        options={{
          title: 'Weak',
          tabBarIcon: ({ focused }) => <TabIcon name="weak" focused={focused} />,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const TAB_BAR_HEIGHT = 64;

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: Platform.OS === 'ios' ? 28 : 16,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    borderTopWidth: 0,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    backgroundColor: 'transparent',
  },
  tabItem: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#E0F2FE',
  },
});