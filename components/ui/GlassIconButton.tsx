import { Ionicons } from '@expo/vector-icons';

import { GlassControl } from './glass/GlassControl';

type Props = { icon: keyof typeof Ionicons.glyphMap; onPress?: () => void; focused?: boolean; accent?: string; dark?: boolean };

export function GlassIconButton({ icon, onPress, focused = false, accent = '#0A84FF', dark = false }: Props) {
  return (
    <GlassControl onPress={onPress} dark={dark} tone={focused ? 'accent' : 'neutral'} size="icon" material={focused ? 'floating' : 'light'} pressedScale={0.94}>
      <Ionicons name={icon} size={focused ? 25 : 23} color={focused ? accent : dark ? 'rgba(255,255,255,0.72)' : 'rgba(48,58,72,0.76)'} />
    </GlassControl>
  );
}
