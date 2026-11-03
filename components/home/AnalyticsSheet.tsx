import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GlassOverlay } from '@/components/ui/glass/GlassOverlay';
import { HomeBackground } from './HomeBackground';
import { useTheme } from '@/contexts/ThemeContext';

import { visionSpacing } from '@/design-system/vision';

type Props = {
  visible: boolean;
  lang?: string;
  onClose: () => void;
  dark: boolean;
  textColor: string;
  mutedColor: string;
  isUa: boolean;
  pct: number;
  totalWords: number;
  learnedWords: number;
  weakWords: number;
  dueToday: number;
  reviewsToday: number;
  accuracyToday: number;
};

export function AnalyticsSheet({
  visible,
  lang,
  onClose,
  dark,
  textColor,
  mutedColor,
  isUa,
  pct,
  totalWords,
  learnedWords,
  weakWords,
  dueToday,
  reviewsToday,
  accuracyToday,
}: Props) {
  const { theme } = useTheme();
  const label = (ua: string,en: string,no: string) => isUa ? ua : lang==='no' ? no : en;
  const items = [
    { label: label('Всього слів','Total words','Ord totalt'), value: totalWords },
    { label: label('У навчанні','In learning','Under læring'), value: learnedWords },
    { label: label('Слабкі','Weak','Svake ord'), value: weakWords },
    { label: label('До повторення','Due','Til repetisjon'), value: dueToday },
    { label: label('Повтори','Reviews','Repetisjoner'), value: reviewsToday },
    { label: label('Точність','Accuracy','Treffsikkerhet'), value: `${accuracyToday}%` },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <HomeBackground dark={dark}>
        <SafeAreaView style={{ flex: 1 }} edges={['top','bottom']}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: textColor,flex:1 }]}>
              {label('Статистика','Statistics','Statistikk')}
            </Text>

            <Pressable accessibilityRole="button" accessibilityLabel={label('Закрити','Close','Lukk')}
              style={({pressed})=>[styles.close,pressed&&{opacity:0.65,transform:[{scale:0.95}]}]} onPress={onClose}>
              <GlassOverlay dark={dark} material="button" shape="card" radius={22} />
              <Ionicons name="close" size={23} color={textColor} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <GlassOverlay dark={dark} material="card" shape="card" radius={26} />
              <Text style={[styles.kicker, { color: mutedColor }]}>
                {label('Покриття бази','Base coverage','Dekning av ordbasen')}
              </Text>
              <Text style={[styles.percent,{color:theme.accent}]}>{pct}%</Text>
              <Text style={[styles.meta, { color: mutedColor }]}>
                {learnedWords} / {totalWords} {label('слів','words','ord')}
              </Text>
            </View>

            <View style={styles.grid}>
              {items.map((item) => (
                <View key={item.label} style={styles.stat}>
                  <GlassOverlay dark={dark} material="card" shape="card" radius={20} />
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.statValue, { color: textColor }]}>{item.value}</Text>
                  <Text style={[styles.statLabel, { color: mutedColor }]}>{item.label}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </HomeBackground>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 22, fontWeight: '900' },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  hero: {
    overflow: 'hidden',
    borderRadius: 26,
    padding: visionSpacing.lg,
    marginBottom: visionSpacing.md,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  percent: {
    marginTop: 8,
    fontSize: 42,
    fontWeight: '900',
    color: '#0A84FF',
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stat: {
    flexBasis: '45%',
    flexGrow: 1,
    minWidth: 130,
    overflow: 'hidden',
    borderRadius: 20,
    padding: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
