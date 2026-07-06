import { Pressable, StyleSheet, Text } from 'react-native';

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
    <Pressable style={styles.press} onPress={onPress} disabled={disabled}>
      <GlassSurface
        variant="button"
        dark={isDark}
        style={[styles.outer, disabled && styles.disabled]}
        contentStyle={[
          styles.inner,
          tone === 'hard' && styles.hard,
          tone === 'ok' && styles.ok,
          tone === 'easy' && styles.easy,
        ]}
      >
        <Text style={styles.text}>{label}</Text>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {
    flex: 1,
  },
  outer: {
    flex: 1,
  },
  inner: {
    minHeight: 50,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hard: {
    backgroundColor: 'rgba(255,75,75,0.22)',
  },
  ok: {
    backgroundColor: 'rgba(255,204,0,0.20)',
  },
  easy: {
    backgroundColor: 'rgba(52,199,89,0.22)',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
});