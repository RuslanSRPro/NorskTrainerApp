import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { GlassOverlay } from '@/components/ui/glass/GlassOverlay';
import { visionSpacing } from '@/design-system/vision';

type Props = {
  greeting: string;
  name: string;
  dark: boolean;
  textColor: string;
  mutedColor: string;
  onOpenAnalytics: () => void;
  analyticsLabel?: string;
};

export function HomeHeader({
  greeting,
  name,
  dark,
  textColor,
  mutedColor,
  onOpenAnalytics,
  analyticsLabel = 'Analytics',
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

      <Pressable onPress={onOpenAnalytics} accessibilityRole="button" accessibilityLabel={analyticsLabel}
        style={({pressed})=>[styles.action,pressed&&{opacity:0.65,transform:[{scale:0.95}]}]}>
        <GlassOverlay dark={dark} material="button" shape="card" radius={24} />
        <Ionicons name="stats-chart-outline" size={23} color={textColor} />
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
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
