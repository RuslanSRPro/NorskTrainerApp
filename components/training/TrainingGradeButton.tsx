import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass/GlassSurface';
import { TrainingTone } from './types';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  isDark: boolean;
  tone: TrainingTone;
};

export function TrainingGradeButton({
  label,
  onPress,
  disabled = false,
  isDark,
  tone,
}: Props) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.press,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View
        style={[
          styles.buttonFrame,
          isDark ? styles.darkBase : styles.lightBase,
          tone === 'hard' && styles.hardBorder,
          tone === 'ok' && styles.okBorder,
          tone === 'easy' && styles.easyBorder,
        ]}
      >
        <GlassSurface
          variant="button"
          dark={isDark}
          style={styles.glassLayer}
          contentStyle={[
            styles.glassContent,
            tone === 'hard' && styles.hardTint,
            tone === 'ok' && styles.okTint,
            tone === 'easy' && styles.easyTint,
          ]}
        >
          <View />
        </GlassSurface>

        <View style={styles.topHighlight} />
        <View style={styles.bottomShade} />

        <Text style={styles.text}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {
    flex: 1,
    height: 36,
    minHeight: 36,
  },

  buttonFrame: {
    flex: 1,
    height: 54,
    minHeight: 54,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  lightBase: {
    backgroundColor: 'rgba(255,255,255,0.24)',
    borderColor: 'rgba(255,255,255,0.48)',
  },

  darkBase: {
    backgroundColor: 'rgba(18,28,42,0.36)',
    borderColor: 'rgba(255,255,255,0.24)',
  },

  glassLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
  },

  glassContent: {
    flex: 1,
    borderRadius: 24,
  },

  hardTint: {
    backgroundColor: 'rgba(255,110,110,0.12)',
  },

  okTint: {
    backgroundColor: 'rgba(255,225,120,0.12)',
  },

  easyTint: {
    backgroundColor: 'rgba(120,255,180,0.12)',
  },

  hardBorder: {
    borderColor: 'rgba(255,160,160,0.46)',
  },

  okBorder: {
    borderColor: 'rgba(255,235,150,0.46)',
  },

  easyBorder: {
    borderColor: 'rgba(160,255,205,0.46)',
  },




  text: {
    zIndex: 5,
    color: 'rgba(255,255,255,0.96)',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },

  pressed: {
    transform: [{ scale: 0.97 }],
  },

  disabled: {
    opacity: 0.5,
  },
});
