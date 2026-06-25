import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

type Props = {
  title: string;
  onPress?: () => void;
  icon?: string;
  variant?: 'primary' | 'soft';
  style?: ViewStyle | ViewStyle[];
};

export function GlassButton({ title, onPress, icon, variant = 'soft', style }: Props) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.button,
        isPrimary ? styles.primary : styles.soft,
        style,
      ]}
    >
      <Text style={[styles.text, isPrimary && styles.primaryText]}>
        {icon ? `${icon} ` : ''}{title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soft: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  primary: {
    backgroundColor: '#0A84FF',
  },
  text: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1D2939',
  },
  primaryText: {
    color: '#FFFFFF',
  },
});
