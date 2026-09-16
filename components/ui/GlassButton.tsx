import { StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { GlassControl } from './glass/GlassControl';

type Props = { title: string; onPress?: () => void; icon?: string; variant?: 'primary' | 'secondary' | 'danger'; style?: StyleProp<ViewStyle>; accent?: string; dark?: boolean };

export function GlassButton({ title, onPress, icon, variant = 'secondary', style, dark = false }: Props) {
  const tone = variant === 'primary' ? 'accent' : variant === 'danger' ? 'danger' : 'neutral';
  return (
    <GlassControl onPress={onPress} dark={dark} tone={tone} size="regular" material={variant === 'primary' ? 'solid' : 'light'} style={style}>
      <Text style={styles.text}>{icon ? `${icon} ` : ''}{title}</Text>
    </GlassControl>
  );
}
const styles = StyleSheet.create({ text: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' } });
