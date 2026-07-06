import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  value: number;
  accent: string;
  dark?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function ProgressTrack({
  value,
  accent,
  dark = false,
  height = 10,
  style,
}: Props) {
  const pct = Math.min(100, Math.max(2, value));

  return (
    <View
      style={[
        styles.root,
        {
          height,
          borderRadius: height / 2,
          backgroundColor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.16)',
          borderColor: dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.44)',
        },
        style,
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(255,255,255,0.46)',
          'rgba(255,255,255,0.14)',
          'rgba(255,255,255,0.00)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.fillWrap,
          {
            width: `${pct}%`,
            borderRadius: height / 2,
          },
        ]}
      >
        <LinearGradient
          colors={[`${accent}F2`, `${accent}B8`, `${accent}88`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <LinearGradient
          pointerEvents="none"
          colors={[
            'rgba(255,255,255,0.48)',
            'rgba(255,255,255,0.12)',
            'rgba(255,255,255,0.00)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    borderWidth: 0.7,
  },
  fillWrap: {
    height: '100%',
    overflow: 'hidden',
  },
});