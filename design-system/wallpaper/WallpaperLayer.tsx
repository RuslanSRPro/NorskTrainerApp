import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';

import { useWallpaper } from './WallpaperContext';

type Props = {
  children: ReactNode;
  dark?: boolean;
};

export function WallpaperLayer({ children, dark = false }: Props) {
  const { config, customUri, adaptiveGlass } = useWallpaper();

  const overlayColors = dark
    ? adaptiveGlass.backgroundOverlayDark
    : adaptiveGlass.backgroundOverlayLight;

  if (customUri) {
    return (
      <ImageBackground source={{ uri: customUri }} style={styles.root} resizeMode="cover">
        <LinearGradient colors={overlayColors as any} style={styles.fill}>
          <View style={styles.atmosphere} />
          {children}
        </LinearGradient>
      </ImageBackground>
    );
  }

  if (config.image) {
    return (
      <ImageBackground source={config.image} style={styles.root} resizeMode="cover">
        <LinearGradient colors={overlayColors as any} style={styles.fill}>
          <View style={styles.atmosphere} />
          {children}
        </LinearGradient>
      </ImageBackground>
    );
  }

  return (
    <LinearGradient colors={config.palette as any} style={styles.root}>
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
  atmosphere: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  orbOne: {
    position: 'absolute',
    top: 80,
    right: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  orbTwo: {
    position: 'absolute',
    top: 260,
    left: -80,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(94,160,220,0.16)',
  },
  orbThree: {
    position: 'absolute',
    bottom: 80,
    right: -60,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});