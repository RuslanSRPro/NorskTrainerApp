import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassOverlay } from '@/components/ui/glass/GlassOverlay';

export function ReadingWordActions({ dark, color, accent, learned, busy, lang,
  speakLabel, stopLabel, closeLabel, onSpeak, onStop, onAdd, onClose }: {
  dark: boolean; color: string; accent: string; learned: boolean; busy: boolean; lang: string;
  speakLabel: string; stopLabel: string; closeLabel: string;
  onSpeak: () => void; onStop: () => void; onAdd: () => void; onClose: () => void;
}) {
  const addLabel = busy ? '…' : learned
    ? (lang === 'ua' ? 'У навчанні' : lang === 'no' ? 'I læring' : 'In learning')
    : (lang === 'ua' ? 'Додати' : lang === 'no' ? 'Legg til' : 'Add');
  return <View style={styles.footer}>
    <View style={styles.row}>
      {[{ icon: 'volume-high-outline' as const, label: speakLabel, action: onSpeak },
        { icon: 'stop-outline' as const, label: stopLabel, action: onStop }].map(item =>
        <Pressable key={item.icon} accessibilityRole="button" accessibilityLabel={item.label}
          onPress={item.action} style={({ pressed }) => [styles.icon, pressed && styles.pressed]}>
          <GlassOverlay dark={dark} material="button" shape="card" radius={16} />
          <Ionicons name={item.icon} size={23} color={color} />
        </Pressable>)}
      <Pressable accessibilityRole="button" accessibilityLabel={addLabel}
        accessibilityState={{ disabled: busy || learned }} disabled={busy || learned} onPress={onAdd}
        style={({ pressed }) => [styles.add, { backgroundColor: dark ? 'rgba(10,132,255,0.2)' : 'rgba(10,132,255,0.12)' },
          pressed && styles.pressed, (busy || learned) && { opacity: 0.65 }]}>
        <GlassOverlay dark={dark} material="button" shape="card" radius={16} />
        <Ionicons name={learned ? 'checkmark' : 'add'} size={22} color={accent} />
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
          style={[styles.text, { color: accent, flexShrink: 1 }]}>{addLabel}</Text>
      </Pressable>
    </View>
    <Pressable accessibilityRole="button" onPress={onClose}
      style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
      <GlassOverlay dark={dark} material="button" shape="card" radius={16} />
      <Text style={[styles.text, { color }]}>{closeLabel}</Text>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 8, flexShrink: 0 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  icon: { width: 48, height: 48, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  add: { flex: 1, minHeight: 48, borderRadius: 16, overflow: 'hidden', flexDirection: 'row', gap: 6,
    paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  close: { minHeight: 44, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.65, transform: [{ scale: 0.97 }] },
});
