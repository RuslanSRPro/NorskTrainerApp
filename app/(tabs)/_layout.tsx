import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0EA5E9',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: () => null,
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: () => null,
        }}
      />

      <Tabs.Screen
        name="reading"
        options={{
          title: 'Reading',
          tabBarIcon: () => null,
        }}
      />

      <Tabs.Screen
        name="voice"
        options={{
          title: 'Voice',
          tabBarIcon: () => null,
        }}
      />

      <Tabs.Screen
        name="weak"
        options={{
          title: 'Weak',
          tabBarIcon: () => null,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: () => null,
        }}
      />
    </Tabs>
  );
}