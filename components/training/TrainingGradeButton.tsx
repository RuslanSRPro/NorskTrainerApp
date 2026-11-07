import { StyleSheet, Text } from 'react-native';

import { GlassControl } from '@/components/ui/glass/GlassControl';
import { GlassTone, glassSemantic } from '@/design-system/glassSemantic';
import { TrainingTone } from './types';

type Props = { label: string; onPress: () => void; disabled?: boolean; isDark: boolean; tone: TrainingTone };

const toneMap: Record<TrainingTone, GlassTone> = { hard: 'danger', ok: 'warning', easy: 'success' };

export function TrainingGradeButton({ label, onPress, disabled = false, isDark, tone }: Props) {
  return (
    // D10 07.11.2026: the label is one line and shrinks to fit a narrow button
    // ("Складно" was cut to "Складнс"); less side padding, same font otherwise.
    <GlassControl
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      dark={isDark}
      tone={toneMap[tone]}
      size="compact"
      material="button"
      style={styles.control}
      contentStyle={styles.content}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={[styles.text, { color: glassSemantic[toneMap[tone]].text }]}
      >
        {label}
      </Text>
    </GlassControl>
  );
}

const styles = StyleSheet.create({
  control: { flex: 1 },
  content: { paddingHorizontal: 8 },
  text: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
});
