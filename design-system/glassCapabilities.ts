import { Platform } from 'react-native';
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';

export function canUseNativeLiquidGlass() {
  if (Platform.OS !== 'ios') return false;
  try {
    return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  } catch {
    return false;
  }
}
