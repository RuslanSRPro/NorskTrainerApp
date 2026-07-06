import { Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';

import { GlassSurface } from '@/components/ui/glass/GlassSurface';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  isDark: boolean;
  primary?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function TrainingGlassButton({
  label,
  onPress,
  disabled = false,
  isDark,
  primary = false,
  style,
  contentStyle,
  textStyle,
}: Props) {
  return (
    <Pressable onPress={onPress} disabled={disabled}>
      <GlassSurface
        variant="button"
        dark={isDark}
        material={primary ? 'button' : 'floating'}
        style={[styles.outer, style, disabled && styles.disabled]}
        contentStyle={[
          styles.inner,
          primary && styles.primaryInner,
          contentStyle,
        ]}
      >
        <Text style={[styles.text, textStyle]}>{label}</Text>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {},
  inner: {
    minHeight: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryInner: {
    backgroundColor: 'rgba(10,132,255,0.42)',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
});