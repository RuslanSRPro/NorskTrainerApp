import { StyleProp, TextStyle, ViewStyle } from 'react-native';

import { GlassControl } from '@/components/ui/glass/GlassControl';

type Props = {
  label: string; onPress: () => void; disabled?: boolean; isDark: boolean; primary?: boolean;
  style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle>;
};

export function TrainingGlassButton({ label, onPress, disabled = false, isDark, primary = false, style, contentStyle, textStyle }: Props) {
  return (
    <GlassControl
      label={label}
      onPress={onPress}
      disabled={disabled}
      dark={isDark}
      tone={primary ? 'accent' : 'neutral'}
      size="regular"
      material={primary ? 'solid' : 'floating'}
      style={style}
      contentStyle={contentStyle}
      textStyle={textStyle}
    />
  );
}
