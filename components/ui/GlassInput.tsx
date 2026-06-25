import { StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  label: string;
  value: string;
  placeholder?: string;
  onChangeText: (value: string) => void;
  textColor: string;
  mutedColor: string;
};

export function GlassInput({
  label,
  value,
  placeholder,
  onChangeText,
  textColor,
  mutedColor,
}: Props) {
  return (
    <View style={styles.root}>
      <Text style={[styles.label, { color: mutedColor }]}>{label}</Text>
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor={mutedColor}
        onChangeText={onChangeText}
        style={[styles.input, { color: textColor }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    minHeight: 48,
    borderRadius: 18,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.24)',
    fontSize: 16,
    fontWeight: '800',
  },
});
