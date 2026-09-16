import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/ui/glass/GlassSurface';

import type { TrainingFormItem } from './types';

type Props = {
  forms: TrainingFormItem[];
  title: string;
  alternativeLabel: string;
  isDark: boolean;
  textColor: string;
  mutedColor: string;
  fonts: any;
};

export function TrainingFormsList({
  forms,
  title,
  alternativeLabel,
  isDark,
  textColor,
  mutedColor,
  fonts,
}: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (!forms.length) return null;

  const alternativeColor = isDark ? '#64B5FF' : '#0A84FF';

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

      {forms.map((form, index) => {
        const rowKey = form.formKey || `${form.label}-${index}`;
        const alternatives = form.alternativeValues ?? [];
        const expanded = expandedKey === rowKey;

        return (
          <View key={rowKey} style={styles.row}>
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

            <View style={styles.valueColumn}>
              <View style={styles.valueLine}>
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

                {alternatives.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${alternativeLabel}: ${alternatives.join(', ')}`}
                    accessibilityState={{ expanded }}
                    hitSlop={8}
                    onPress={(event) => {
                      event.stopPropagation();
                      setExpandedKey(expanded ? null : rowKey);
                    }}
                    style={({ pressed }) => [
                      styles.variantButton,
                      {
                        backgroundColor: isDark
                          ? 'rgba(100,181,255,0.16)'
                          : 'rgba(10,132,255,0.12)',
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.variantButtonText,
                        { color: alternativeColor },
                      ]}
                    >
                      {expanded ? '−' : `+${alternatives.length}`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {expanded ? (
                <View style={styles.alternativeLine}>
                  <Text
                    style={[
                      styles.alternativeLabel,
                      { color: mutedColor },
                    ]}
                  >
                    {alternativeLabel}
                  </Text>

                  <Text
                    style={[
                      styles.alternativeValue,
                      {
                        fontSize: fonts.base,
                        color: alternativeColor,
                      },
                    ]}
                  >
                    {alternatives.join(', ')}
                  </Text>

                  <Text style={[styles.source, { color: mutedColor }]}>
                    Ordbøkene
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
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
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  label: {
    width: 130,
    paddingTop: 3,
    fontWeight: '700',
  },
  valueColumn: {
    flex: 1,
    minWidth: 0,
  },
  valueLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },
  value: {
    flexShrink: 1,
    fontWeight: '700',
  },
  variantButton: {
    minWidth: 34,
    height: 28,
    paddingHorizontal: 7,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantButtonText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
  alternativeLine: {
    marginTop: 7,
    gap: 2,
  },
  alternativeLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  alternativeValue: {
    fontWeight: '700',
  },
  source: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
  },
});
