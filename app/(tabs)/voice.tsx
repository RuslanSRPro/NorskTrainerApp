import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function VoiceScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🎙 Voice Capture</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Speech recognition needs a dev build</Text>

        <Text style={styles.text}>
          Голосовой ввод установлен, но не работает в обычном Expo Go.
          Для микрофона и Norwegian speech-to-text нужен development build.
        </Text>

        <Text style={styles.code}>npx expo run:android</Text>

        <Text style={styles.text}>
          После этого вернём полноценный Voice экран: Start, Stop, live transcript,
          перевод и отправка в Reading Analyzer.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F4ED' },
  content: { paddingTop: 70, paddingHorizontal: 20, paddingBottom: 120 },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 12,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 14,
  },
  code: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 14,
  },
});