import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';

import { wallpaperPalettes } from '@/design-system/vision';

type WallpaperKey = keyof typeof wallpaperPalettes;

type Props = {
  children: ReactNode;
  wallpaper?: WallpaperKey;
  customUri?: string | null;
  dark?: boolean;
};

export function HomeBackground({
  children,
  wallpaper = 'fjord',
  customUri = null,
  dark = false,
}: Props) {
  const palette = wallpaperPalettes[wallpaper] || wallpaperPalettes.fjord;

  const overlayColors = dark
    ? ['rgba(5,12,22,0.72)', 'rgba(5,12,22,0.54)', 'rgba(5,12,22,0.82)']
    : ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.42)'];

  if (customUri) {
    return (
      <ImageBackground source={{ uri: customUri }} style={styles.root} resizeMode="cover">
        <LinearGradient colors={overlayColors as any} style={styles.fill}>
          {children}
        </LinearGradient>
      </ImageBackground>
    );
  }

  return (
    <LinearGradient colors={palette as any} style={styles.root}>
      <LinearGradient colors={overlayColors as any} style={styles.fill}>
        <View style={styles.orbOne} />
        <View style={styles.orbTwo} />
        <View style={styles.orbThree} />
        {children}
      </LinearGradient>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  orbOne: {
    position: 'absolute',
    top: 80,
    right: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  orbTwo: {
    position: 'absolute',
    top: 260,
    left: -80,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(94,160,220,0.18)',
  },
  orbThree: {
    position: 'absolute',
    bottom: 80,
    right: -60,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
});
