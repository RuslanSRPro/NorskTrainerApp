import { StyleSheet } from 'react-native';

import { GlassControl } from '@/components/ui/glass/GlassControl';
import { GlassTone } from '@/design-system/glassSemantic';
import { TrainingTone } from './types';

type Props = { label: string; onPress: () => void; disabled?: boolean; isDark: boolean; tone: TrainingTone };

const toneMap: Record<TrainingTone, GlassTone> = { hard: 'danger', ok: 'warning', easy: 'success' };

export function TrainingGradeButton({ label, onPress, disabled = false, isDark, tone }: Props) {
  return (
    <GlassControl
      label={label}
      onPress={onPress}
      disabled={disabled}
      dark={isDark}
      tone={toneMap[tone]}
      size="compact"
      material="button"
      style={styles.control}
      textStyle={styles.text}
    />
  );
}

const styles = StyleSheet.create({
  control: { flex: 1 },
  text: { fontSize: 14, fontWeight: '800' },
});
