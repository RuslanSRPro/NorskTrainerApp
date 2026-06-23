// app/(tabs)/voice.tsx
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function VoiceScreen() {
  const { theme, fonts } = useTheme();
  const T = theme, F = fonts;

  return (
    <ScrollView style={{ flex:1, backgroundColor:T.background }} contentContainerStyle={s.content}>
      <Text style={[s.title, { color:T.textPrimary, fontSize:22 }]}>🎙 Voice Capture</Text>
      <View style={[s.card, { backgroundColor:T.card, borderColor:T.border }]}>
        <Text style={[s.sectionTitle, { color:T.textPrimary, fontSize:F.base+4 }]}>
          Speech recognition needs a dev build
        </Text>
        <Text style={[s.text, { color:T.textSecondary, fontSize:F.base }]}>
          Голосовой ввод установлен, но не работает в обычном Expo Go.
          Для микрофона и Norwegian speech-to-text нужен development build.
        </Text>
        <View style={[s.code, { backgroundColor:T.cardAlt, borderColor:T.border }]}>
          <Text style={[s.codeText, { color:T.accent, fontSize:F.base-1 }]}>npx expo run:android</Text>
        </View>
        <Text style={[s.text, { color:T.textSecondary, fontSize:F.base }]}>
          После этого вернём полноценный Voice экран: Start, Stop, live transcript,
          перевод и отправка в Reading Analyzer.
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content:      { paddingTop:70, paddingHorizontal:20, paddingBottom:120 },
  title:        { fontWeight:'900', marginBottom:20 },
  card:         { borderRadius:22, padding:18, borderWidth:0.5 },
  sectionTitle: { fontWeight:'900', marginBottom:12 },
  text:         { lineHeight:24, fontWeight:'600', marginBottom:14 },
  code:         { borderRadius:14, padding:14, marginBottom:14, borderWidth:0.5 },
  codeText:     { fontWeight:'800' },
});