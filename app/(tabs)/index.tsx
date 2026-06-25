// app/(tabs)/index.tsx

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnalyticsSheet } from '@/components/home/AnalyticsSheet';
import { DailyPlanCard } from '@/components/home/DailyPlanCard';
import { HomeBackground } from '@/components/home/HomeBackground';
import { HomeHeader } from '@/components/home/HomeHeader';
import { ProgressHeroCard } from '@/components/home/ProgressHeroCard';
import { TodayStatsCard } from '@/components/home/TodayStatsCard';
import { useWallpaper } from '@/components/home/useWallpaper';

import { getDashboardStatsFromSupabase } from '@/services/api';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/contexts/ThemeContext';

type Stats = {
  totalWords: number;
  learnedWords: number;
  weakWords: number;
  dueToday: number;
  reviewsToday: number;
  accuracyToday: number;
};

function nameFromEmail(email?: string | null): string {
  if (!email) return '';

  const raw = email
    .split('@')[0]
    .replace(/\d+/g, '')
    .replace(/[._-]/g, ' ')
    .trim();

  if (!raw) return '';

  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function timeGreeting(lang: string): string {
  const h = new Date().getHours();

  if (lang === 'ua') {
    return h < 12 ? 'Доброго ранку' : h < 18 ? 'Доброго дня' : 'Доброго вечора';
  }

  if (lang === 'no') {
    return h < 12 ? 'God morgen' : h < 18 ? 'God dag' : 'God kveld';
  }

  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function HomeScreen() {
  const router = useRouter();

  const { theme, themeName } = useTheme();
  const { preferred_user, app_language } = useSettingsStore();
  const { user } = useAuthStore();
  const { wallpaper, customUri } = useWallpaper();

  const [showAnalytics, setShowAnalytics] = useState(false);

  const [stats, setStats] = useState<Stats>({
    totalWords: 0,
    learnedWords: 0,
    weakWords: 0,
    dueToday: 0,
    reviewsToday: 0,
    accuracyToday: 0,
  });

  const lang = (app_language || 'ua') as string;
  const isUa = lang === 'ua';
  const isDark = themeName === 'dark';

  const name = useMemo(() => nameFromEmail(user?.email), [user?.email]);
  const greeting = useMemo(() => timeGreeting(lang), [lang]);

  const pct = stats.totalWords > 0
    ? Math.round((stats.learnedWords / stats.totalWords) * 100)
    : 0;

  const textColor = isDark ? '#FFFFFF' : theme.textPrimary;
  const mutedColor = isDark ? 'rgba(255,255,255,0.62)' : theme.textMuted;

  useFocusEffect(
    useCallback(() => {
      getDashboardStatsFromSupabase(preferred_user)
        .then(setStats)
        .catch(() => {});
    }, [preferred_user])
  );

  return (
    <HomeBackground wallpaper={wallpaper} customUri={customUri} dark={isDark}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <HomeHeader
            greeting={greeting}
            name={name}
            dark={isDark}
            textColor={textColor}
            mutedColor={mutedColor}
            onOpenAnalytics={() => setShowAnalytics(true)}
          />

          <ProgressHeroCard
            pct={pct}
            learnedWords={stats.learnedWords}
            totalWords={stats.totalWords}
            accent={theme.accent}
            textColor={textColor}
            mutedColor={mutedColor}
            dark={isDark}
            isUa={isUa}
            lang={lang}
          />

          <DailyPlanCard
            dark={isDark}
            textColor={textColor}
            mutedColor={mutedColor}
            isUa={isUa}
            dueToday={stats.dueToday}
            weakWords={stats.weakWords}
            onTraining={() => router.push('/explore')}
            onReading={() => router.push('/reading')}
            onVoice={() => router.push('/voice')}
            onWeak={() => router.push('/weak')}
          />

          <TodayStatsCard
            dark={isDark}
            textColor={textColor}
            mutedColor={mutedColor}
            isUa={isUa}
            reviewsToday={stats.reviewsToday}
            accuracyToday={stats.accuracyToday}
            dueToday={stats.dueToday}
            weakWords={stats.weakWords}
          />
        </ScrollView>
      </SafeAreaView>

      <AnalyticsSheet
        visible={showAnalytics}
        onClose={() => setShowAnalytics(false)}
        dark={isDark}
        textColor={textColor}
        mutedColor={mutedColor}
        isUa={isUa}
        pct={pct}
        totalWords={stats.totalWords}
        learnedWords={stats.learnedWords}
        weakWords={stats.weakWords}
        dueToday={stats.dueToday}
        reviewsToday={stats.reviewsToday}
        accuracyToday={stats.accuracyToday}
      />
    </HomeBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 76,
    gap: 10,
  },
});



