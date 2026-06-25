import { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeBackground } from '@/components/home/HomeBackground';
import { useWallpaper } from '@/components/home/useWallpaper';

type Props = {
  children: ReactNode;
  dark?: boolean;
};

export function AppPage({ children, dark = false }: Props) {
  const { wallpaper, customUri } = useWallpaper();

  return (
    <HomeBackground wallpaper={wallpaper} customUri={customUri} dark={dark}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </SafeAreaView>
    </HomeBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 92,
    gap: 14,
  },
});
