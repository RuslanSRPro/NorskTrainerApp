import { ReactNode } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { GlassLens } from '@/components/ui/glass/GlassLens';
import { GlassPressable } from '@/components/ui/glass/GlassPressable';
import { useAppTheme } from '@/services/theme';

type Props = {
  icon?: string;
  title: string;
  value?: string;
  hint?: string;
  right?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  isLast?: boolean;

  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
};

export function GlassSettingsRow({
  icon,
  title,
  value,
  hint,
  right,
  onPress,
  disabled,
  isLast,
  switchValue,
  onSwitchChange,
}: Props) {
  const { colors, scale } = useAppTheme();

  const interactive = Boolean(onPress) || Boolean(onSwitchChange);

  return (
    <GlassPressable
      disabled={disabled || !interactive || Boolean(onSwitchChange)}
      onPress={onPress}
      pressedScale={0.985}
      style={[
        styles.row,
        {
          opacity: disabled ? 0.42 : 1,
          borderBottomColor: isLast ? 'transparent' : 'rgba(255,255,255,0.12)',
        },
      ]}
      contentStyle={styles.pressContent}
    >
      {icon ? (
        <GlassLens accent={colors.accent} size={31} style={styles.icon}>
          <Text style={[styles.iconText, { fontSize: scale(15) }]}>{icon}</Text>
        </GlassLens>
      ) : null}

      <View style={styles.textBlock}>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: colors.textPrimary, fontSize: scale(14) }]}
        >
          {title}
        </Text>

        {hint ? (
          <Text
            numberOfLines={2}
            style={[styles.hint, { color: colors.textTertiary, fontSize: scale(11) }]}
          >
            {hint}
          </Text>
        ) : null}
      </View>

      {typeof switchValue === 'boolean' && onSwitchChange ? (
        <Switch value={switchValue} onValueChange={onSwitchChange} />
      ) : right ? (
        right
      ) : (
        <View style={styles.valueBlock}>
          {value ? (
            <Text
              numberOfLines={1}
              style={[styles.value, { color: colors.textSecondary, fontSize: scale(13) }]}
            >
              {value}
            </Text>
          ) : null}

          {onPress ? (
            <Text style={[styles.chevron, { color: colors.textTertiary, fontSize: scale(21) }]}>
              ›
            </Text>
          ) : null}
        </View>
      )}
    </GlassPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressContent: {
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 11,
  },
  iconText: {
    includeFontPadding: false,
  },
  textBlock: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    fontWeight: '800',
  },
  hint: {
    marginTop: 2,
    fontWeight: '600',
    lineHeight: 15,
  },
  valueBlock: {
    maxWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  value: {
    fontWeight: '800',
  },
  chevron: {
    marginTop: -1,
    fontWeight: '700',
  },
});