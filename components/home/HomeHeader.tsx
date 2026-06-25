import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/ui/GlassCard';
import { visionSpacing } from '@/design-system/vision';

type Props = {
  greeting: string;
  name: string;
  dark: boolean;
  textColor: string;
  mutedColor: string;
  onOpenAnalytics: () => void;
};

export function HomeHeader({
  greeting,
  name,
  dark,
  textColor,
  mutedColor,
  onOpenAnalytics,
}: Props) {
  return (
    <View style={styles.root}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.brand, { color: mutedColor }]}>🇳🇴 Norsk Trainer</Text>
        <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
          {greeting},
        </Text>
        <Text style={[styles.name, { color: textColor }]} numberOfLines={1}>
          {name || 'friend'} 👋
        </Text>
      </View>

      <Pressable onPress={onOpenAnalytics}>
        <GlassCard dark={dark} intensity={44} style={styles.action}>
          <Text style={styles.actionIcon}>📊</Text>
        </GlassCard>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: visionSpacing.md,
    marginBottom: visionSpacing.sm,
  },
  brand: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 27,
  },
  name: {
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 27,
  },
  action: {
    width: 48,
    height: 48,
  },
  actionIcon: {
    fontSize: 20,
    textAlign: 'center',
    paddingTop: 13,
  },
});
