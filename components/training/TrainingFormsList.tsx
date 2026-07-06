import { StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass/GlassSurface';
import { TrainingFormItem } from './types';

type Props = {
  forms: TrainingFormItem[];
  title: string;
  isDark: boolean;
  textColor: string;
  mutedColor: string;
  fonts: any;
};

export function TrainingFormsList({
  forms,
  title,
  isDark,
  textColor,
  mutedColor,
  fonts,
}: Props) {
  if (!forms.length) return null;

  return (
    <GlassSurface
      variant="tile"
      dark={isDark}
      style={styles.root}
      contentStyle={styles.inner}
    >
      <Text
        style={[
          styles.title,
          {
            fontSize: fonts.meta,
            color: mutedColor,
          },
        ]}
      >
        {title}
      </Text>

      {forms.map((form) => (
        <View
          key={`${form.label}-${form.value}`}
          style={styles.row}
        >
          <Text
            style={[
              styles.label,
              {
                fontSize: fonts.meta,
                color: mutedColor,
              },
            ]}
          >
            {form.label}
          </Text>

          <Text
            style={[
              styles.value,
              {
                fontSize: fonts.base,
                color: textColor,
              },
            ]}
          >
            {form.value}
          </Text>
        </View>
      ))}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 12,
  },
  inner: {
    padding: 14,
  },
  title: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 6,
  },
  label: {
    width: 130,
    fontWeight: '700',
  },
  value: {
    flex: 1,
    fontWeight: '700',
  },
});