import {
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';

type Props = {
  label: string;
  accessibilityLabel:
    string;
  accent:
    string;
  fontSize:
    number;
  half?: boolean;
  disabled?: boolean;
  onPress:
    () => void;
};

export function AudioActionButton({
  label,
  accessibilityLabel,
  accent,
  fontSize,
  half = false,
  disabled = false,
  onPress,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel
      }
      disabled={
        disabled
      }
      hitSlop={{
        top: 8,
        bottom: 8,
        left: 6,
        right: 6,
      }}
      pressRetentionOffset={{
        top: 20,
        bottom: 20,
        left: 20,
        right: 20,
      }}
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        styles.button,
        half
          ? styles.half
          : styles.full,
        {
          borderColor:
            accent,
          backgroundColor:
            pressed
              ? `${accent}14`
              : 'transparent',
          opacity:
            disabled
              ? 0.45
              : pressed
                ? 0.62
                : 1,
          transform: [
            {
              scale:
                pressed
                  ? 0.97
                  : 1,
            },
          ],
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color:
              accent,
            fontSize,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles =
  StyleSheet.create({
    button: {
      minHeight: 56,
      borderWidth: 1.5,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    half: {
      flexGrow: 1,
      flexBasis: '46%',
    },
    full: {
      width: '100%',
    },
    text: {
      fontWeight: '900',
      textAlign: 'center',
      lineHeight: 21,
    },
  });
