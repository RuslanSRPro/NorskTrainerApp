// app/(tabs)/voice.tsx
import { ScrollView, StyleSheet, Text } from 'react-native';

import { GlassSurface } from '@/components/ui/glass/GlassSurface';
import { useTheme } from '@/contexts/ThemeContext';

export default function VoiceScreen() {
  const { theme, fonts, themeName } = useTheme();
  const T = theme;
  const F = fonts;
  const isDark = themeName === 'dark';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: T.textPrimary, fontSize: 22 }]}>
        🎙 Voice Capture
      </Text>

      <GlassSurface variant="card" dark={isDark} contentStyle={styles.card}>
        <Text style={[styles.sectionTitle, { color: T.textPrimary, fontSize: F.base + 4 }]}>
          Speech recognition needs a dev build
        </Text>

        <Text style={[styles.text, { color: T.textSecondary, fontSize: F.base }]}>
          Голосовой ввод установлен, но не работает в обычном Expo Go.
          Для микрофона и Norwegian speech-to-text нужен development build.
        </Text>

        <GlassSurface
          variant="tile"
          dark={isDark}
          shadow={false}
          contentStyle={styles.code}
        >
          <Text style={[styles.codeText, { color: T.accent, fontSize: F.base - 1 }]}>
            npx expo run:android
          </Text>
        </GlassSurface>

        <Text style={[styles.text, { color: T.textSecondary, fontSize: F.base }]}>
          После этого вернём полноценный Voice экран: Start, Stop, live transcript,
          перевод и отправка в Reading Analyzer.
        </Text>
      </GlassSurface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingTop: 70,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  title: {
    fontWeight: '900',
    marginBottom: 20,
  },
  card: {
    padding: 18,
  },
  sectionTitle: {
    fontWeight: '900',
    marginBottom: 12,
  },
  text: {
    lineHeight: 24,
    fontWeight: '600',
    marginBottom: 14,
  },
  code: {
    padding: 14,
    marginBottom: 14,
  },
  codeText: {
    fontWeight: '800',
  },
});